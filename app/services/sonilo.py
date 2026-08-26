import base64
import binascii
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import requests
from loguru import logger

from app.config import config
from app.services import bgm as bgm_service
from app.utils import utils


DEFAULT_BASE_URL = "https://api.sonilo.com"
VIDEO_TO_MUSIC_PATH = "/v1/video-to-music"
SERVICES_PATH = "/v1/account/services"
MAX_VIDEO_DURATION_SECONDS = 360
MAX_PROMPT_LENGTH = 2000
MAX_PROXY_BYTES = 300 * 1024 * 1024
MAX_GENERATED_AUDIO_BYTES = 30 * 1024 * 1024
VIDEO_TO_MUSIC_SERVICE_ID = "video_to_music"


class SoniloError(RuntimeError):
    """Raised on Sonilo request, response protocol, or generated audio validation failure."""


def get_api_key() -> str:
    """Read configured Sonilo API key from app config or environment."""
    configured_key = str(config.app.get("sonilo_api_key", "") or "").strip()
    return configured_key or os.getenv("SONILO_API_KEY", "").strip()


def is_enabled() -> bool:
    return bool(get_api_key())


def _base_url() -> str:
    return str(
        config.app.get("sonilo_base_url", DEFAULT_BASE_URL) or DEFAULT_BASE_URL
    ).rstrip(
        "/"
    )


def _request_timeout() -> tuple[int, int]:
    """Return bounded request timeout tuple (connect, read)."""
    raw_timeout = config.app.get("sonilo_timeout", 600)
    try:
        read_timeout = float(raw_timeout)
    except (TypeError, ValueError):
        read_timeout = 600
    if not math.isfinite(read_timeout) or read_timeout <= 0:
        read_timeout = 600
    return 15, max(1, math.ceil(min(read_timeout, 1800)))


def _normalize_service_id(service_id: str) -> str:
    """Normalize Sonilo service identifier to underscore format."""
    return service_id.strip().lower().replace("-", "_")


def _safe_response_error(response: requests.Response) -> str:
    """Format sanitized response error message."""
    body = (response.text or "").strip().replace("\n", " ")[:500]
    return body or response.reason or "request failed"


def test_connection() -> dict[str, Any]:
    """
    Validate Sonilo API key via services endpoint without consuming generation quota.
    """
    api_key = get_api_key()
    if not api_key:
        raise SoniloError("Sonilo API key is required")
    try:
        response = requests.get(
            f"{_base_url()}{SERVICES_PATH}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=(15, 30),
        )
    except requests.RequestException as exc:
        raise SoniloError(f"failed to connect to Sonilo: {exc}") from exc
    if not response.ok:
        raise SoniloError(
            f"Sonilo connection failed ({response.status_code}): "
            f"{_safe_response_error(response)}"
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise SoniloError("Sonilo returned an invalid service response") from exc
    if not isinstance(payload, dict):
        raise SoniloError("Sonilo returned an unexpected service response")
    available_services = payload.get("available_services")
    if not isinstance(available_services, list) or not all(
        isinstance(service_id, str) for service_id in available_services
    ):
        raise SoniloError("Sonilo returned an invalid service list")
    normalized_services = {
        _normalize_service_id(service_id) for service_id in available_services
    }
    if VIDEO_TO_MUSIC_SERVICE_ID not in normalized_services:
        raise SoniloError("Sonilo video-to-music service is not available for this key")
    logger.info("Sonilo connection test succeeded")
    return payload


def _remove_file(file_path: str) -> None:
    """Safely remove Sonilo intermediate temporary file."""
    if not file_path or not os.path.exists(file_path):
        return
    try:
        os.remove(file_path)
    except OSError as exc:
        logger.warning(
            f"failed to remove Sonilo temporary file: path={file_path}, error={exc}"
        )


def _create_video_proxy(video_path: str) -> str:
    """
    Generate muted 1280px H.264 proxy video for Sonilo analysis.
    """
    descriptor, proxy_path = tempfile.mkstemp(
        prefix=".sonilo-proxy-",
        suffix=".mp4",
        dir=os.path.dirname(os.path.abspath(video_path)),
    )
    os.close(descriptor)
    command = [
        utils.get_ffmpeg_binary(),
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-i",
        video_path,
        "-vf",
        (
            "scale=w=1280:h=1280:force_original_aspect_ratio=decrease:"
            "force_divisible_by=2"
        ),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        proxy_path,
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        _remove_file(proxy_path)
        raise SoniloError("Sonilo video proxy generation timed out") from exc
    except OSError as exc:
        _remove_file(proxy_path)
        raise SoniloError("failed to run FFmpeg for Sonilo video proxy") from exc
    if result.returncode != 0:
        _remove_file(proxy_path)
        detail = (result.stderr or "").strip().replace("\n", " ")[-500:]
        raise SoniloError(f"failed to generate Sonilo video proxy: {detail}")
    proxy_size = os.path.getsize(proxy_path) if os.path.isfile(proxy_path) else 0
    if proxy_size <= 0 or proxy_size > MAX_PROXY_BYTES:
        _remove_file(proxy_path)
        raise SoniloError("Sonilo video proxy is empty or exceeds the 300 MB limit")
    logger.info(
        f"Sonilo video proxy prepared: source={video_path}, size={proxy_size} bytes"
    )
    return proxy_path


def _parse_event(raw_line: bytes) -> dict[str, Any]:
    """Parse single NDJSON line from streaming response."""
    try:
        event = json.loads(raw_line.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SoniloError("Sonilo returned malformed streaming data") from exc
    if not isinstance(event, dict) or not isinstance(event.get("type"), str):
        raise SoniloError("Sonilo returned an invalid streaming event")
    return event


def _stream_audio(response: requests.Response, temp_audio_path: str) -> tuple[int, str]:
    """
    Stream primary audio chunks to temporary file with byte size limit.
    """
    total_bytes = 0
    title = ""
    completed = False
    with open(temp_audio_path, "wb") as output:
        for raw_line in response.iter_lines():
            if not raw_line:
                continue
            event = _parse_event(raw_line)
            event_type = event["type"]
            if event_type == "error":
                message = str(
                    event.get("message") or event.get("error") or "unknown error"
                )
                raise SoniloError(f"Sonilo generation failed: {message}")
            if event_type == "title":
                title = str(event.get("title") or event.get("data") or "")[:200]
                continue
            if event_type == "complete":
                completed = True
                break
            if event_type != "audio_chunk":
                logger.debug(f"ignoring unsupported Sonilo event: type={event_type}")
                continue

            stream_index = event.get("stream_index", 0)
            if stream_index != 0:
                continue
            encoded_chunk = event.get("data") or event.get("audio")
            if not isinstance(encoded_chunk, str) or not encoded_chunk:
                raise SoniloError("Sonilo returned an empty audio chunk")
            try:
                chunk = base64.b64decode(encoded_chunk, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise SoniloError("Sonilo returned an invalid audio chunk") from exc
            if not chunk:
                raise SoniloError("Sonilo returned an empty audio chunk")
            total_bytes += len(chunk)
            if total_bytes > MAX_GENERATED_AUDIO_BYTES:
                raise SoniloError("Sonilo audio exceeds the 30 MB limit")
            output.write(chunk)
        output.flush()
        os.fsync(output.fileno())

    if not completed:
        raise SoniloError("Sonilo stream ended before completion")
    if total_bytes <= 0:
        raise SoniloError("Sonilo returned no audio data")
    return total_bytes, title


def _request_bgm(video_path: str, output_path: str, prompt: str) -> str:
    """Request background music from Sonilo and atomically save output."""
    output_dir = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(output_dir, exist_ok=True)
    descriptor, temp_audio_path = tempfile.mkstemp(
        prefix=".sonilo-audio-",
        suffix=Path(output_path).suffix or ".m4a",
        dir=output_dir,
    )
    os.close(descriptor)
    try:
        logger.info(
            f"requesting Sonilo background music: video={video_path}, "
            f"prompt_provided={bool(prompt)}"
        )
        try:
            with open(video_path, "rb") as video_file:
                response = requests.post(
                    f"{_base_url()}{VIDEO_TO_MUSIC_PATH}",
                    headers={"Authorization": f"Bearer {get_api_key()}"},
                    files={"video": (Path(video_path).name, video_file, "video/mp4")},
                    data={"prompt": prompt} if prompt else None,
                    stream=True,
                    timeout=_request_timeout(),
                )
                with response:
                    if not response.ok:
                        raise SoniloError(
                            f"Sonilo generation failed ({response.status_code}): "
                            f"{_safe_response_error(response)}"
                        )
                    total_bytes, title = _stream_audio(response, temp_audio_path)
        except requests.RequestException as exc:
            raise SoniloError(f"failed to request Sonilo music: {exc}") from exc

        try:
            bgm_service.validate_audio_file(temp_audio_path, timeout_seconds=120)
        except (bgm_service.BgmUploadError, bgm_service.BgmServiceError) as exc:
            raise SoniloError("Sonilo returned audio that FFmpeg cannot decode") from exc
        os.replace(temp_audio_path, output_path)
        temp_audio_path = ""
        logger.info(
            f"Sonilo background music generated: output={output_path}, "
            f"size={total_bytes} bytes, title={title or '-'}"
        )
        return output_path
    finally:
        _remove_file(temp_audio_path)


def generate_bgm(
    video_path: str,
    output_path: str,
    video_duration: float,
    prompt: str = "",
) -> str:
    """Generate matching background music for a video clip via Sonilo API."""
    if not get_api_key():
        raise SoniloError("Sonilo API key is required")
    if not os.path.isfile(video_path):
        raise SoniloError("Sonilo input video does not exist")
    try:
        duration = float(video_duration)
    except (TypeError, ValueError) as exc:
        raise SoniloError("Sonilo video duration is invalid") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise SoniloError("Sonilo video duration is invalid")
    if duration > MAX_VIDEO_DURATION_SECONDS:
        raise SoniloError("Sonilo supports videos up to 360 seconds")
    prompt = str(prompt or "").strip()
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise SoniloError("Sonilo music prompt exceeds 2000 characters")

    proxy_path = ""
    try:
        proxy_path = _create_video_proxy(video_path)
        return _request_bgm(proxy_path, output_path, prompt)
    except SoniloError:
        raise
    except OSError as exc:
        raise SoniloError(f"Sonilo local file operation failed: {exc}") from exc
    finally:
        _remove_file(proxy_path)
