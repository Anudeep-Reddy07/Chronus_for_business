import os
import random
import threading
import time
from pathlib import Path
from typing import Any, Callable, List
from urllib.parse import quote_plus, urlencode, urlsplit, urlunsplit

import requests
from loguru import logger
from moviepy.video.io.VideoFileClip import VideoFileClip

from app.config import config
from app.models.schema import MaterialInfo, VideoAspect, VideoConcatMode
from app.services import material_cache, task_artifacts
from app.utils import utils

# Thread-safe counter for API key rotation
_api_key_counter = 0
_api_key_lock = threading.Lock()


def _safe_public_url(value: Any) -> str | None:
    """
    Keep only public HTTP(S) URLs and strip query parameters and credentials.
    """
    if not isinstance(value, str) or not value.strip():
        return None

    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
    ):
        return None
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _creator_info(value: Any) -> dict[str, str] | None:
    """Extract unified public creator fields from various provider formats."""
    if isinstance(value, str) and value.strip():
        return {"name": value.strip()}
    if not isinstance(value, dict):
        return None

    creator: dict[str, str] = {}
    creator_id = value.get("id")
    creator_name = value.get("name") or value.get("username")
    creator_page = _safe_public_url(
        value.get("url") or value.get("profile_url") or value.get("profile_page")
    )
    if creator_id is not None:
        creator["id"] = str(creator_id)
    if creator_name:
        creator["name"] = str(creator_name)
    if creator_page:
        creator["profile_page"] = creator_page
    return creator or None


def _material_source_record(item: MaterialInfo, local_path: str) -> dict[str, Any]:
    """
    Create lightweight provenance records for successfully downloaded materials.
    """
    source = item.source_info if isinstance(item.source_info, dict) else {}
    record: dict[str, Any] = {
        "provider": str(item.provider or source.get("provider") or ""),
        "local_file": Path(local_path).name,
        "duration": int(item.duration),
    }

    search_term = source.get("search_term")
    asset_id = source.get("asset_id")
    source_page = _safe_public_url(source.get("source_page"))
    if isinstance(search_term, str) and search_term.strip():
        record["search_term"] = search_term.strip()
    if asset_id not in (None, ""):
        record["asset_id"] = str(asset_id)
    if source_page:
        record["source_page"] = source_page

    creator = _creator_info(source.get("creator"))
    if creator:
        record["creator"] = creator

    raw_rendition = source.get("rendition")
    if isinstance(raw_rendition, dict):
        rendition = {}
        for field in ("id", "width", "height"):
            value = raw_rendition.get(field)
            if value not in (None, ""):
                rendition[field] = str(value) if field == "id" else value
        if rendition:
            record["rendition"] = rendition
    return record


def _persist_material_sources(
    task_id: str,
    material_sources: list[dict[str, Any]],
) -> None:
    """
    Persist downloaded material source records to the task manifest.
    """
    try:
        saved = task_artifacts.patch_script_data(
            task_id,
            material_sources=material_sources,
        )
        if saved:
            logger.info(
                f"saved material source records: "
                f"task_id={task_id}, count={len(material_sources)}"
            )
    except Exception as exc:
        logger.warning(
            "failed to persist material source records: "
            f"task_id={task_id}, error={type(exc).__name__}, detail={exc}"
        )


def _get_tls_verify() -> bool:
    tls_verify = config.app.get("tls_verify", True)
    if isinstance(tls_verify, str):
        tls_verify = tls_verify.strip().lower() not in ("0", "false", "no", "off")

    if not tls_verify:
        logger.warning(
            "TLS certificate verification is disabled by config.app.tls_verify=false. "
            "Only use this in trusted proxy environments."
        )

    return bool(tls_verify)


def get_api_key(cfg_key: str):
    api_keys = config.app.get(cfg_key)
    if not api_keys:
        raise ValueError(
            f"\n\n##### {cfg_key} is not set #####\n\n"
            f"Please set it in the config.toml file: {config.config_file}\n"
        )

    # if only one key is provided, return it
    if isinstance(api_keys, str):
        return api_keys

    global _api_key_counter
    with _api_key_lock:
        _api_key_counter += 1
        return api_keys[_api_key_counter % len(api_keys)]


def _redact_secret(message: str, secret: str) -> str:
    """
    Sanitize sensitive API keys or credentials in error messages for logging.
    """
    safe_message = str(message)
    if not secret:
        return safe_message

    safe_message = safe_message.replace(secret, "***")
    encoded_secret = quote_plus(secret)
    if encoded_secret != secret:
        safe_message = safe_message.replace(encoded_secret, "***")
    return safe_message


def _redact_request_error(error: Exception, *secrets: str) -> str:
    """
    Redact API keys and proxy secrets from exception messages.
    """
    safe_message = str(error)
    for secret in secrets:
        safe_message = _redact_secret(safe_message, str(secret or ""))
    for proxy_url in config.proxy.values():
        safe_message = _redact_secret(safe_message, str(proxy_url))
    return safe_message


def _is_cloudflare_challenge(response: requests.Response) -> bool:
    """
    Identify Cloudflare HTML Challenge responses.
    """
    headers = getattr(response, "headers", {}) or {}
    if str(headers.get("cf-mitigated", "")).lower() == "challenge":
        return True

    content_type = str(headers.get("content-type", "")).lower()
    if "text/html" not in content_type:
        return False

    body = str(getattr(response, "text", "")).lower()
    return "just a moment" in body or "/cdn-cgi/challenge-platform/" in body


def _matches_video_aspect(
    width: Any,
    height: Any,
    video_aspect: VideoAspect,
    *,
    is_vertical: Any = None,
) -> bool:
    """
    Check if remote material aspect ratio matches the target video orientation.
    """
    aspect = VideoAspect(video_aspect)
    try:
        normalized_width = int(float(width))
        normalized_height = int(float(height))
    except (TypeError, ValueError):
        normalized_width = 0
        normalized_height = 0

    if normalized_width > 0 and normalized_height > 0:
        if aspect == VideoAspect.portrait:
            return normalized_height > normalized_width
        if aspect == VideoAspect.landscape:
            return normalized_width > normalized_height
        return normalized_width == normalized_height

    if isinstance(is_vertical, bool) and aspect != VideoAspect.square:
        return is_vertical == (aspect == VideoAspect.portrait)
    return False


def _filter_materials_by_aspect(
    items: List[MaterialInfo],
    video_aspect: VideoAspect,
) -> List[MaterialInfo]:
    """
    Filter material items by matching video aspect ratio.
    """
    aspect = VideoAspect(video_aspect)
    if aspect == VideoAspect.square:
        return list(items)

    filtered_items = []
    for item in items:
        source_info = item.source_info if isinstance(item.source_info, dict) else {}
        rendition = source_info.get("rendition")
        rendition = rendition if isinstance(rendition, dict) else {}
        if _matches_video_aspect(
            rendition.get("width"),
            rendition.get("height"),
            aspect,
        ):
            filtered_items.append(item)
    return filtered_items


def search_videos_pexels(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    aspect = VideoAspect(video_aspect)
    video_orientation = aspect.name
    video_width, video_height = aspect.to_resolution()
    api_key = get_api_key("pexels_api_keys")
    headers = {
        "Authorization": api_key,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    }
    # Build URL
    params = {"query": search_term, "per_page": 20, "orientation": video_orientation}
    query_url = f"https://api.pexels.com/v1/videos/search?{urlencode(params)}"
    logger.info(f"searching videos on pexels: term={search_term!r}")

    try:
        r = requests.get(
            query_url,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
        response = r.json()
        video_items = []
        if "videos" not in response:
            logger.error("pexels video search returned an unsupported response")
            return video_items
        videos = response["videos"]
        # loop through each video in the result
        for v in videos:
            duration = v["duration"]
            # check if video has desired minimum duration
            if duration < minimum_duration:
                continue
            video_files = v["video_files"]
            # loop through each url to determine the best quality
            for video in video_files:
                w = int(video["width"])
                h = int(video["height"])
                if (
                    _matches_video_aspect(w, h, aspect)
                    and w == video_width
                    and h == video_height
                ):
                    item = MaterialInfo()
                    item.provider = "pexels"
                    item.url = video["link"]
                    item.duration = duration
                    item.source_info = {
                        "provider": "pexels",
                        "search_term": search_term,
                        "asset_id": (
                            str(v.get("id")) if v.get("id") is not None else None
                        ),
                        "source_page": _safe_public_url(v.get("url")),
                        "creator": _creator_info(v.get("user")),
                        "rendition": {
                            "id": (
                                str(video.get("id"))
                                if video.get("id") is not None
                                else None
                            ),
                            "width": w,
                            "height": h,
                        },
                    }
                    video_items.append(item)
                    break
        return video_items
    except Exception as e:
        logger.error(
            "pexels video search failed: "
            f"error={type(e).__name__}, detail={_redact_request_error(e, api_key)}"
        )

    return []


def search_videos_pixabay(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    aspect = VideoAspect(video_aspect)

    video_width, video_height = aspect.to_resolution()

    api_key = get_api_key("pixabay_api_keys")
    # Build URL
    params = {
        "q": search_term,
        "video_type": "all",  # Accepted values: "all", "film", "animation"
        "per_page": 50,
        "key": api_key,
    }
    query_url = f"https://pixabay.com/api/videos/?{urlencode(params)}"
    logger.info(
        f"searching videos on pixabay: term={search_term!r}, "
        f"proxy_enabled={bool(config.proxy)}"
    )

    try:
        r = requests.get(
            query_url, proxies=config.proxy, verify=_get_tls_verify(), timeout=(30, 60)
        )
        status_code = int(getattr(r, "status_code", 200))
        headers = getattr(r, "headers", {}) or {}
        content_type = str(headers.get("content-type", ""))
        retry_after = headers.get("retry-after")
        cf_ray = headers.get("cf-ray")

        if _is_cloudflare_challenge(r):
            logger.error(
                "pixabay search was blocked by a Cloudflare challenge: "
                f"status={status_code}, cf_ray={cf_ray or 'unknown'}. "
                "Check the server network or proxy, or use Pexels/Coverr instead."
            )
            return []

        if status_code == 429:
            logger.error(
                "pixabay API rate limit exceeded: "
                f"status=429, retry_after={retry_after or 'unknown'}"
            )
            return []

        if status_code >= 400:
            logger.error(
                "pixabay search request failed: "
                f"status={status_code}, content_type={content_type or 'unknown'}"
            )
            return []

        try:
            response = r.json()
        except ValueError:
            logger.error(
                "pixabay returned an unexpected non-JSON response: "
                f"status={status_code}, content_type={content_type or 'unknown'}"
            )
            return []

        video_items = []
        if "hits" not in response:
            logger.error("pixabay video search returned an unsupported response")
            return video_items
        videos = response["hits"]
        # loop through each video in the result
        for v in videos:
            duration = v["duration"]
            # check if video has desired minimum duration
            if duration < minimum_duration:
                continue
            video_files = v["videos"]
            # loop through each url to determine the best quality
            for video_type in video_files:
                video = video_files[video_type]
                try:
                    w = int(video["width"])
                    h = int(video["height"])
                except (KeyError, TypeError, ValueError):
                    continue
                orientation_matches = aspect == VideoAspect.square or (
                    _matches_video_aspect(w, h, aspect)
                )
                if orientation_matches and w >= video_width:
                    item = MaterialInfo()
                    item.provider = "pixabay"
                    item.url = video["url"]
                    item.duration = duration
                    item.source_info = {
                        "provider": "pixabay",
                        "search_term": search_term,
                        "asset_id": (
                            str(v.get("id")) if v.get("id") is not None else None
                        ),
                        "source_page": _safe_public_url(v.get("pageURL")),
                        "creator": _creator_info(
                            {
                                "id": v.get("user_id"),
                                "name": v.get("user"),
                            }
                        ),
                        "rendition": {
                            "id": video_type,
                            "width": w,
                            "height": video.get("height"),
                        },
                    }
                    video_items.append(item)
                    break
        return video_items
    except Exception as e:
        error_message = _redact_request_error(e, api_key)
        logger.error(
            "pixabay search request failed: "
            f"error={type(e).__name__}, detail={error_message}"
        )

    return []


def search_videos_coverr(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    """
    Coverr (https://coverr.co) - free HD/4K stock videos,
    subject to Coverr license terms (https://coverr.co/license).
    """
    aspect = VideoAspect(video_aspect)
    api_key = get_api_key("coverr_api_keys")
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "query": search_term,
        "page_size": 20,
        "urls": "true",
        "sort": "popular",
    }
    if aspect == VideoAspect.portrait:
        params["filter"] = "is_vertical:true"
    elif aspect == VideoAspect.landscape:
        params["filter"] = "is_vertical:false"
    query_url = f"https://api.coverr.co/videos?{urlencode(params)}"
    logger.info(f"searching videos on coverr: term={search_term!r}")

    try:
        r = requests.get(
            query_url,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
        response = r.json()
        video_items: List[MaterialInfo] = []

        if not isinstance(response, dict) or "hits" not in response:
            logger.error("coverr video search returned an unsupported response")
            return video_items

        for v in response["hits"]:
            try:
                duration = int(float(v.get("duration") or 0))
            except (TypeError, ValueError):
                continue
            if duration < minimum_duration:
                continue

            video_id = v.get("id")
            mp4_download_url = (v.get("urls") or {}).get("mp4_download")
            if not video_id or not mp4_download_url:
                continue
            if aspect != VideoAspect.square and not _matches_video_aspect(
                v.get("max_width"),
                v.get("max_height"),
                aspect,
                is_vertical=v.get("is_vertical"),
            ):
                continue

            item = MaterialInfo()
            item.provider = "coverr"
            item.url = mp4_download_url
            item.duration = duration
            item.source_info = {
                "provider": "coverr",
                "search_term": search_term,
                "asset_id": str(video_id),
                "source_page": _safe_public_url(v.get("canonical_url") or v.get("url")),
                "creator": _creator_info(v.get("creator") or v.get("author")),
                "rendition": {
                    "id": "mp4_download",
                    "width": v.get("max_width"),
                    "height": v.get("max_height"),
                },
            }
            video_items.append(item)
        return video_items
    except Exception as e:
        logger.error(
            "coverr video search failed: "
            f"error={type(e).__name__}, detail={_redact_request_error(e, api_key)}"
        )

    return []


# WaveSpeed AI (https://wavespeed.ai) generates video clips from keywords.
WAVESPEED_API_BASE_URL = "https://api.wavespeed.ai/api/v3"
WAVESPEED_DEFAULT_T2V_MODEL = "bytedance/seedance-2.0-fast/text-to-video"
WAVESPEED_POLL_INTERVAL_SECONDS = 2.0
WAVESPEED_RUN_TIMEOUT_SECONDS = 600.0
WAVESPEED_MIN_DURATION_SECONDS = 4
WAVESPEED_MAX_DURATION_SECONDS = 15
WAVESPEED_FAILURE_STATUSES = frozenset({"failed", "cancelled", "timeout"})
WAVESPEED_RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
WAVESPEED_MAX_POLL_RETRIES = 5
WAVESPEED_RETRY_BASE_SECONDS = 1.0
WAVESPEED_MAX_DOWNLOAD_RETRIES = 2


class WaveSpeedUnconfirmedTaskError(RuntimeError):
    """
    Exception raised when a paid generation task has been submitted but status cannot be confirmed locally.
    """

    def __init__(self, message: str, prediction_id: str = ""):
        super().__init__(message)
        self.prediction_id = prediction_id


def _wavespeed_status_code(response: Any) -> int:
    """Read response status code; default to 200 on test mocks or missing attribute."""
    try:
        return int(getattr(response, "status_code", 200))
    except (TypeError, ValueError):
        return 200


def _is_wavespeed_retryable_error(error: Exception) -> bool:
    """
    Determine whether a polling error is retryable.
    """
    if isinstance(
        error,
        (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.ChunkedEncodingError,
        ),
    ):
        return True
    response = getattr(error, "response", None)
    if response is not None:
        return _wavespeed_status_code(response) in WAVESPEED_RETRYABLE_STATUS_CODES
    return False


def _wavespeed_duration_bounds() -> tuple[int, int]:
    """
    Return the duration bounds (in seconds) supported by the current model.
    """

    def read_bound(key: str, fallback: int) -> int:
        try:
            value = int(config.app.get(key, fallback))
        except (TypeError, ValueError):
            return fallback
        return value if value >= 1 else fallback

    min_duration = read_bound("wavespeed_min_duration", WAVESPEED_MIN_DURATION_SECONDS)
    max_duration = read_bound("wavespeed_max_duration", WAVESPEED_MAX_DURATION_SECONDS)
    return min_duration, max(max_duration, min_duration)


def generate_videos_wavespeed(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    """
    Generate video material using WaveSpeed text-to-video for a keyword.
    """
    aspect = VideoAspect(video_aspect)
    video_width, video_height = aspect.to_resolution()
    api_key = get_api_key("wavespeed_api_keys")
    model_id = (
        str(
            config.app.get("wavespeed_text_to_video_model", "")
            or WAVESPEED_DEFAULT_T2V_MODEL
        )
        .strip()
        .strip("/")
    )
    headers = {"Authorization": f"Bearer {api_key}"}
    requested_duration = max(int(minimum_duration), 1)
    min_duration, max_duration = _wavespeed_duration_bounds()
    duration = min(max(requested_duration, min_duration), max_duration)
    if duration != requested_duration:
        logger.info(
            f"wavespeed clip duration clamped to model-supported range: "
            f"requested={requested_duration}s, using={duration}s "
            f"(supported {min_duration}-{max_duration}s)"
        )
    payload = {
        "prompt": search_term,
        "aspect_ratio": aspect.value,
        "duration": duration,
    }
    logger.info(
        f"generating video on wavespeed: model={model_id}, "
        f"term={search_term!r}, duration={duration}s"
    )

    try:
        submit_response = requests.post(
            f"{WAVESPEED_API_BASE_URL}/{model_id}",
            json=payload,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
    except Exception as e:
        raise WaveSpeedUnconfirmedTaskError(
            "wavespeed submission did not return a response, the task may "
            "already exist remotely: "
            f"error={type(e).__name__}, detail={_redact_request_error(e, api_key)}"
        ) from e

    submit_status = _wavespeed_status_code(submit_response)
    if submit_status >= 500:
        raise WaveSpeedUnconfirmedTaskError(
            f"wavespeed submission failed with HTTP {submit_status}, "
            "the task may already exist remotely"
        )
    try:
        submit_body = submit_response.json()
    except Exception as e:
        raise WaveSpeedUnconfirmedTaskError(
            "wavespeed submission returned an unreadable response, the task "
            f"may already exist remotely: error={type(e).__name__}"
        ) from e

    submit_data = submit_body.get("data") if isinstance(submit_body, dict) else None
    if not isinstance(submit_body, dict) or submit_body.get("code") != 200:
        logger.error(
            "wavespeed video generation request rejected: "
            f"http_status={submit_status}, "
            f"code={submit_body.get('code') if isinstance(submit_body, dict) else None}, "
            f"detail={_redact_secret(str((submit_body or {}).get('message') or ''), api_key)}"
        )
        return []
    prediction_id = (
        str(submit_data.get("id") or "") if isinstance(submit_data, dict) else ""
    )
    if not prediction_id:
        raise WaveSpeedUnconfirmedTaskError(
            "wavespeed accepted the submission without returning a prediction id"
        )
    logger.info(f"wavespeed prediction created: id={prediction_id}")

    result_data = _wait_for_wavespeed_prediction(
        prediction_id=prediction_id,
        headers=headers,
        api_key=api_key,
    )
    if result_data is None:
        return []

    try:
        video_items = []
        outputs = result_data.get("outputs")
        for output in outputs if isinstance(outputs, list) else []:
            if not isinstance(output, str) or not output.startswith(
                ("http://", "https://")
            ):
                continue
            item = MaterialInfo()
            item.provider = "wavespeed"
            item.url = output
            item.duration = duration
            item.source_info = {
                "provider": "wavespeed",
                "search_term": search_term,
                "asset_id": prediction_id,
                "rendition": {
                    "id": None,
                    "width": video_width,
                    "height": video_height,
                },
            }
            video_items.append(item)
        if not video_items:
            logger.error(
                "wavespeed prediction completed without downloadable outputs: "
                f"id={prediction_id}"
            )
        return video_items
    except Exception as e:
        logger.error(
            "wavespeed output parsing failed: "
            f"id={prediction_id}, error={type(e).__name__}, "
            f"detail={_redact_request_error(e, api_key)}"
        )

    return []


def _wait_for_wavespeed_prediction(
    *,
    prediction_id: str,
    headers: dict,
    api_key: str,
) -> dict | None:
    """
    Poll the same prediction id until completion or deterministic failure.
    """
    deadline = time.monotonic() + WAVESPEED_RUN_TIMEOUT_SECONDS
    consecutive_failures = 0
    while True:
        try:
            response = requests.get(
                f"{WAVESPEED_API_BASE_URL}/predictions/{prediction_id}/result",
                headers=headers,
                proxies=config.proxy,
                verify=_get_tls_verify(),
                timeout=(30, 60),
            )
            status_code = _wavespeed_status_code(response)
            if status_code in WAVESPEED_RETRYABLE_STATUS_CODES:
                raise requests.exceptions.HTTPError(
                    f"HTTP {status_code}", response=response
                )
            result_body = response.json()
            result_data = (
                result_body.get("data") if isinstance(result_body, dict) else None
            )
            if not isinstance(result_body, dict) or result_body.get("code") != 200:
                raise WaveSpeedUnconfirmedTaskError(
                    "wavespeed prediction status is unknown: "
                    f"http_status={status_code}, "
                    f"code={result_body.get('code') if isinstance(result_body, dict) else None}, "
                    f"detail={_redact_secret(str((result_body or {}).get('message') or ''), api_key)}",
                    prediction_id=prediction_id,
                )
            if not isinstance(result_data, dict):
                raise WaveSpeedUnconfirmedTaskError(
                    "wavespeed prediction result payload is malformed",
                    prediction_id=prediction_id,
                )
        except WaveSpeedUnconfirmedTaskError:
            raise
        except Exception as e:
            if not _is_wavespeed_retryable_error(e):
                raise WaveSpeedUnconfirmedTaskError(
                    "wavespeed prediction polling failed and the task state is "
                    f"unknown: error={type(e).__name__}, "
                    f"detail={_redact_request_error(e, api_key)}",
                    prediction_id=prediction_id,
                ) from e
            consecutive_failures += 1
            if consecutive_failures > WAVESPEED_MAX_POLL_RETRIES:
                raise WaveSpeedUnconfirmedTaskError(
                    "wavespeed prediction polling failed after "
                    f"{WAVESPEED_MAX_POLL_RETRIES + 1} attempts, the task may "
                    "still be running remotely: "
                    f"error={type(e).__name__}, "
                    f"detail={_redact_request_error(e, api_key)}",
                    prediction_id=prediction_id,
                ) from e
            delay = WAVESPEED_RETRY_BASE_SECONDS * consecutive_failures
            logger.warning(
                "wavespeed prediction polling hit a transient error, retry the "
                f"same task: id={prediction_id}, "
                f"attempt={consecutive_failures}/{WAVESPEED_MAX_POLL_RETRIES}, "
                f"error={type(e).__name__}, retry_in={delay:.1f}s"
            )
            time.sleep(delay)
            continue

        consecutive_failures = 0
        status = str(result_data.get("status") or "")
        if status == "completed":
            return result_data
        if status in WAVESPEED_FAILURE_STATUSES:
            logger.error(
                "wavespeed prediction did not produce a video: "
                f"id={prediction_id}, status={status}, "
                f"detail={_redact_secret(str(result_data.get('error') or ''), api_key)}"
            )
            return None
        if time.monotonic() > deadline:
            raise WaveSpeedUnconfirmedTaskError(
                f"wavespeed prediction is still {status or 'pending'} after "
                f"{WAVESPEED_RUN_TIMEOUT_SECONDS:.0f}s of local waiting",
                prediction_id=prediction_id,
            )
        time.sleep(WAVESPEED_POLL_INTERVAL_SECONDS)


def _save_wavespeed_video_with_retry(video_url: str, save_dir: str) -> str:
    """
    Download generated video output with retry on transient failures.
    """
    for attempt in range(WAVESPEED_MAX_DOWNLOAD_RETRIES + 1):
        try:
            saved_video_path = save_video(video_url=video_url, save_dir=save_dir)
            if saved_video_path:
                return saved_video_path
            failure_detail = "empty result"
        except Exception as e:
            failure_detail = (
                f"error={type(e).__name__}, "
                f"detail={_redact_request_error(e, video_url)}"
            )
        if attempt >= WAVESPEED_MAX_DOWNLOAD_RETRIES:
            break
        delay = WAVESPEED_RETRY_BASE_SECONDS * (attempt + 1)
        logger.warning(
            "failed to download generated video, retry the same url: "
            f"attempt={attempt + 1}/{WAVESPEED_MAX_DOWNLOAD_RETRIES}, "
            f"{failure_detail}, retry_in={delay:.1f}s"
        )
        time.sleep(delay)
    logger.error(
        "failed to download generated video after "
        f"{WAVESPEED_MAX_DOWNLOAD_RETRIES + 1} attempts: {failure_detail}"
    )
    return ""


def save_video(video_url: str, save_dir: str = "") -> str:
    if not save_dir:
        save_dir = utils.storage_dir("cache_videos")

    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    url_without_query = video_url.split("?")[0]
    url_hash = utils.md5(url_without_query)
    video_id = f"vid-{url_hash}"
    video_path = f"{save_dir}/{video_id}.mp4"

    # if video already exists, return the path
    if os.path.exists(video_path) and os.path.getsize(video_path) > 0:
        logger.info(f"video already exists: {video_path}")
        return video_path

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }

    # if video does not exist, download it
    with open(video_path, "wb") as f:
        f.write(
            requests.get(
                video_url,
                headers=headers,
                proxies=config.proxy,
                verify=_get_tls_verify(),
                timeout=(60, 240),
            ).content
        )

    if os.path.exists(video_path) and os.path.getsize(video_path) > 0:
        clip = None
        try:
            clip = VideoFileClip(video_path)
            duration = clip.duration
            fps = clip.fps
            if duration > 0 and fps > 0:
                return video_path
        except Exception as e:
            logger.warning(f"invalid video file: {video_path} => {str(e)}")
            try:
                os.remove(video_path)
            except Exception as remove_error:
                logger.warning(
                    f"failed to remove invalid video file: {video_path}, error: {str(remove_error)}"
                )
        finally:
            if clip is not None:
                try:
                    clip.close()
                except Exception as close_error:
                    logger.warning(
                        f"failed to close video clip: {video_path}, error: {str(close_error)}"
                    )
    return ""


def _search_videos_with_cache(
    provider: str,
    search_videos: Callable[..., List[MaterialInfo]],
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect,
) -> List[MaterialInfo]:
    """
    Unified 24-hour search caching for stock video providers.
    """
    cache_args = {
        "provider": provider,
        "search_term": search_term,
        "minimum_duration": minimum_duration,
        "video_aspect": video_aspect,
    }

    def load_cache_safely() -> List[MaterialInfo] | None:
        try:
            return material_cache.load_material_search_cache(**cache_args)
        except Exception as exc:
            logger.warning(
                "material search cache read failed, continue with remote search: "
                f"provider={provider}, error={type(exc).__name__}, detail={exc}"
            )
            return None

    def load_matching_cache() -> tuple[List[MaterialInfo] | None, int]:
        cached_items = load_cache_safely()
        if cached_items is None:
            return None, 0

        filtered_cached_items = _filter_materials_by_aspect(
            cached_items,
            video_aspect,
        )
        ignored_count = len(cached_items) - len(filtered_cached_items)
        if ignored_count:
            return None, ignored_count
        return filtered_cached_items, 0

    cached_items, ignored_count = load_matching_cache()
    if cached_items is not None:
        return cached_items
    if ignored_count:
        logger.info(
            "material search cache contains mismatched orientations, "
            f"refresh from provider: provider={provider}, term={search_term!r}, "
            f"ignored={ignored_count}"
        )

    cache_lock = material_cache.get_material_search_cache_lock(**cache_args)
    with cache_lock:
        cached_items, _ = load_matching_cache()
        if cached_items is not None:
            return cached_items

        items = search_videos(
            search_term=search_term,
            minimum_duration=minimum_duration,
            video_aspect=video_aspect,
        )
        for item in items:
            if isinstance(item.source_info, dict):
                item.source_info = dict(item.source_info)
                item.source_info["search_term"] = search_term
        if items:
            try:
                material_cache.save_material_search_cache(
                    **cache_args,
                    items=items,
                )
            except Exception as exc:
                logger.warning(
                    "material search cache write failed, use remote results: "
                    f"provider={provider}, error={type(exc).__name__}, detail={exc}"
                )
        return items


def download_videos(
    task_id: str,
    search_terms: List[str],
    source: str = "pexels",
    video_aspect: VideoAspect = VideoAspect.portrait,
    video_concat_mode: VideoConcatMode = VideoConcatMode.random,
    audio_duration: float = 0.0,
    max_clip_duration: int = 5,
    match_script_order: bool = False,
) -> List[str]:
    provider = "pexels"
    remote_search_videos = search_videos_pexels
    if source == "pixabay":
        provider = "pixabay"
        remote_search_videos = search_videos_pixabay
    elif source == "coverr":
        provider = "coverr"
        remote_search_videos = search_videos_coverr

    def search_videos(
        search_term: str,
        minimum_duration: int,
        video_aspect: VideoAspect,
    ) -> List[MaterialInfo]:
        return _search_videos_with_cache(
            provider=provider,
            search_videos=remote_search_videos,
            search_term=search_term,
            minimum_duration=minimum_duration,
            video_aspect=video_aspect,
        )

    material_directory = config.app.get("material_directory", "").strip()
    if material_directory == "task":
        material_directory = utils.task_dir(task_id)
    elif material_directory and not os.path.isdir(material_directory):
        material_directory = ""

    if source == "wavespeed":
        return _download_videos_wavespeed_on_demand(
            task_id=task_id,
            search_terms=search_terms,
            video_aspect=video_aspect,
            audio_duration=audio_duration,
            max_clip_duration=max_clip_duration,
            material_directory=material_directory,
        )

    if match_script_order:
        return _download_videos_by_script_order(
            task_id=task_id,
            search_terms=search_terms,
            search_videos=search_videos,
            video_aspect=video_aspect,
            audio_duration=audio_duration,
            max_clip_duration=max_clip_duration,
            material_directory=material_directory,
        )

    valid_video_items = []
    valid_video_urls = []
    found_duration = 0.0
    for search_term in search_terms:
        video_items = search_videos(
            search_term=search_term,
            minimum_duration=max_clip_duration,
            video_aspect=video_aspect,
        )
        logger.info(f"found {len(video_items)} videos for '{search_term}'")

        for item in video_items:
            if item.url not in valid_video_urls:
                valid_video_items.append(item)
                valid_video_urls.append(item.url)
                found_duration += item.duration

    logger.info(
        f"found total videos: {len(valid_video_items)}, required duration: {audio_duration} seconds, found duration: {found_duration} seconds"
    )
    video_paths = []
    material_sources: list[dict[str, Any]] = []

    concat_mode_value = getattr(video_concat_mode, "value", video_concat_mode)
    if concat_mode_value == VideoConcatMode.random.value:
        random.shuffle(valid_video_items)

    total_duration = 0.0
    for item in valid_video_items:
        try:
            source_info = item.source_info if isinstance(item.source_info, dict) else {}
            logger.info(
                f"downloading {item.provider} video: "
                f"asset_id={source_info.get('asset_id') or 'unknown'}"
            )
            saved_video_path = save_video(
                video_url=item.url, save_dir=material_directory
            )
            if saved_video_path:
                logger.info(f"video saved: {saved_video_path}")
                video_paths.append(saved_video_path)
                try:
                    material_sources.append(
                        _material_source_record(item, saved_video_path)
                    )
                except Exception as source_error:
                    logger.warning(
                        "failed to prepare material source record: "
                        f"provider={item.provider}, "
                        f"error={type(source_error).__name__}, detail={source_error}"
                    )
                seconds = min(max_clip_duration, item.duration)
                total_duration += seconds
                if total_duration > audio_duration:
                    logger.info(
                        f"total duration of downloaded videos: {total_duration} seconds, skip downloading more"
                    )
                    break
        except Exception as e:
            logger.error(
                "failed to download material video: "
                f"provider={item.provider}, error={type(e).__name__}, "
                f"detail={_redact_request_error(e, item.url)}"
            )
    logger.success(f"downloaded {len(video_paths)} videos")
    _persist_material_sources(task_id, material_sources)
    return video_paths


def _download_videos_wavespeed_on_demand(
    *,
    task_id: str,
    search_terms: List[str],
    video_aspect: VideoAspect,
    audio_duration: float,
    max_clip_duration: int,
    material_directory: str,
) -> List[str]:
    """
    Generate and download WaveSpeed video materials on demand per script segment.
    """
    video_paths: List[str] = []
    material_sources: list[dict[str, Any]] = []
    total_duration = 0.0
    for search_term in search_terms:
        try:
            video_items = generate_videos_wavespeed(
                search_term=search_term,
                minimum_duration=max_clip_duration,
                video_aspect=video_aspect,
            )
        except WaveSpeedUnconfirmedTaskError as e:
            logger.error(
                "stop submitting new wavespeed tasks, the last submitted task "
                f"is unconfirmed: prediction_id={e.prediction_id or 'unknown'}, "
                f"detail={e}"
            )
            break
        for item in video_items:
            saved_video_path = _save_wavespeed_video_with_retry(
                item.url, material_directory
            )
            if not saved_video_path:
                continue
            logger.info(f"video saved: {saved_video_path}")
            video_paths.append(saved_video_path)
            try:
                material_sources.append(_material_source_record(item, saved_video_path))
            except Exception as source_error:
                logger.warning(
                    "failed to prepare material source record: "
                    f"provider={item.provider}, "
                    f"error={type(source_error).__name__}, detail={source_error}"
                )
            total_duration += min(max_clip_duration, item.duration)
            if total_duration >= audio_duration:
                break
        if total_duration >= audio_duration:
            logger.info(
                "generated materials cover the required duration, stop "
                f"generating more clips: generated={total_duration:.1f}s, "
                f"required={audio_duration:.1f}s"
            )
            break
    logger.success(f"generated and downloaded {len(video_paths)} videos")
    _persist_material_sources(task_id, material_sources)
    return video_paths


def _download_videos_by_script_order(
    task_id: str,
    search_terms: List[str],
    search_videos,
    video_aspect: VideoAspect,
    audio_duration: float,
    max_clip_duration: int,
    material_directory: str,
) -> List[str]:
    """
    Download materials sequentially matching script narration order.
    """
    logger.info("downloading videos with script-order material matching")
    candidate_groups = []
    valid_video_urls = set()
    found_duration = 0.0

    for search_term in search_terms:
        video_items = search_videos(
            search_term=search_term,
            minimum_duration=max_clip_duration,
            video_aspect=video_aspect,
        )
        logger.info(f"found {len(video_items)} videos for '{search_term}'")

        term_items = []
        for item in video_items:
            if item.url in valid_video_urls:
                continue
            term_items.append(item)
            valid_video_urls.add(item.url)
            found_duration += item.duration

        if term_items:
            candidate_groups.append((search_term, term_items))

    logger.info(
        f"found total ordered video candidates: {sum(len(items) for _, items in candidate_groups)}, "
        f"required duration: {audio_duration} seconds, found duration: {found_duration} seconds"
    )

    video_paths = []
    material_sources: list[dict[str, Any]] = []
    total_duration = 0.0
    candidate_index = 0
    while candidate_groups and total_duration <= audio_duration:
        has_candidate = False
        for search_term, term_items in candidate_groups:
            if candidate_index >= len(term_items):
                continue

            has_candidate = True
            item = term_items[candidate_index]
            try:
                source_info = (
                    item.source_info if isinstance(item.source_info, dict) else {}
                )
                logger.info(
                    f"downloading ordered {item.provider} video for {search_term!r}: "
                    f"asset_id={source_info.get('asset_id') or 'unknown'}"
                )
                saved_video_path = save_video(
                    video_url=item.url, save_dir=material_directory
                )
                if saved_video_path:
                    logger.info(f"video saved: {saved_video_path}")
                    video_paths.append(saved_video_path)
                    try:
                        material_sources.append(
                            _material_source_record(item, saved_video_path)
                        )
                    except Exception as source_error:
                        logger.warning(
                            "failed to prepare ordered material source record: "
                            f"provider={item.provider}, "
                            f"error={type(source_error).__name__}, "
                            f"detail={source_error}"
                        )
                    total_duration += min(max_clip_duration, item.duration)
                    if total_duration > audio_duration:
                        logger.info(
                            f"total duration of downloaded videos: {total_duration} seconds, skip downloading more"
                        )
                        break
            except Exception as e:
                logger.error(
                    "failed to download ordered material video: "
                    f"provider={item.provider}, error={type(e).__name__}, "
                    f"detail={_redact_request_error(e, item.url)}"
                )

        if not has_candidate:
            break
        candidate_index += 1

    logger.success(f"downloaded {len(video_paths)} ordered videos")
    _persist_material_sources(task_id, material_sources)
    return video_paths


if __name__ == "__main__":
    download_videos(
        "test123", ["Money Exchange Medium"], audio_duration=100, source="pixabay"
    )
