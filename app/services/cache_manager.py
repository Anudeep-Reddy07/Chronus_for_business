"""Video material cache statistics, preview, and cleanup service."""

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from typing import Iterator

from loguru import logger

from app.utils import utils


# Online materials use URL MD5 hash as stable filename.
_VIDEO_CACHE_FILE_PATTERN = re.compile(r"^vid-[0-9a-f]{32}\.mp4$")
_SECONDS_PER_DAY = 24 * 60 * 60


@dataclass(frozen=True)
class VideoCacheStats:
    """Lightweight metadata stats for video cache directory."""

    file_count: int = 0
    total_size: int = 0
    oldest_mtime: float | None = None
    newest_mtime: float | None = None


@dataclass(frozen=True)
class VideoCacheCleanupResult:
    """Cleanup execution result summary."""

    deleted_count: int = 0
    deleted_size: int = 0
    failed_count: int = 0


@dataclass(frozen=True)
class _VideoCacheEntry:
    """Minimal file metadata during directory scan."""

    path: str
    name: str
    size: int
    mtime: float


def video_cache_dir() -> str:
    """Return default video cache directory."""
    return os.path.realpath(utils.storage_dir("cache_videos"))


def _iter_video_cache_entries() -> Iterator[_VideoCacheEntry]:
    """
    Sequentially scan first level of default cache directory using os.scandir.
    """
    cache_dir = video_cache_dir()
    try:
        entries = os.scandir(cache_dir)
    except FileNotFoundError:
        return
    except OSError as exc:
        logger.warning(
            f"failed to scan video cache directory: path={cache_dir}, error={exc}"
        )
        return

    with entries:
        for entry in entries:
            if not _VIDEO_CACHE_FILE_PATTERN.fullmatch(entry.name):
                continue

            try:
                if not entry.is_file(follow_symlinks=False):
                    continue
                stat_result = entry.stat(follow_symlinks=False)
            except OSError as exc:
                logger.warning(
                    f"failed to inspect video cache file: file={entry.name}, error={exc}"
                )
                continue

            yield _VideoCacheEntry(
                path=entry.path,
                name=entry.name,
                size=stat_result.st_size,
                mtime=stat_result.st_mtime,
            )


def _is_cleanup_candidate(
    entry: _VideoCacheEntry,
    max_age_days: int | None,
    now: float,
) -> bool:
    if max_age_days is None:
        return True
    return entry.mtime < now - max_age_days * _SECONDS_PER_DAY


def _validate_max_age_days(max_age_days: int | None) -> None:
    """Validate cleanup retention parameter."""
    if max_age_days is None:
        return
    if (
        isinstance(max_age_days, bool)
        or not isinstance(max_age_days, int)
        or max_age_days <= 0
    ):
        raise ValueError("max_age_days must be a positive integer or None")


def get_video_cache_stats(max_age_days: int | None = None) -> VideoCacheStats:
    """
    Compute total cache size or preview candidates older than specified days.
    """
    _validate_max_age_days(max_age_days)
    now = time.time()
    file_count = 0
    total_size = 0
    oldest_mtime = None
    newest_mtime = None

    for entry in _iter_video_cache_entries():
        if not _is_cleanup_candidate(entry, max_age_days, now):
            continue
        file_count += 1
        total_size += entry.size
        oldest_mtime = (
            entry.mtime if oldest_mtime is None else min(oldest_mtime, entry.mtime)
        )
        newest_mtime = (
            entry.mtime if newest_mtime is None else max(newest_mtime, entry.mtime)
        )

    return VideoCacheStats(
        file_count=file_count,
        total_size=total_size,
        oldest_mtime=oldest_mtime,
        newest_mtime=newest_mtime,
    )


def clean_video_cache(max_age_days: int | None = None) -> VideoCacheCleanupResult:
    """
    Clean video cache files older than max_age_days and return summary.
    """
    _validate_max_age_days(max_age_days)
    now = time.time()
    logger.info(
        f"start cleaning video cache: max_age_days={max_age_days}"
    )

    candidate_count = 0
    candidate_size = 0
    deleted_count = 0
    deleted_size = 0
    failed_count = 0
    cache_dir = video_cache_dir()

    for entry in _iter_video_cache_entries():
        if not _is_cleanup_candidate(entry, max_age_days, now):
            continue
        candidate_count += 1
        candidate_size += entry.size
        try:
            if (
                os.path.realpath(os.path.dirname(entry.path)) != cache_dir
                or not _VIDEO_CACHE_FILE_PATTERN.fullmatch(entry.name)
                or os.path.islink(entry.path)
            ):
                raise ValueError("cache file is outside the managed directory")
            os.unlink(entry.path)
            deleted_count += 1
            deleted_size += entry.size
        except (OSError, ValueError) as exc:
            failed_count += 1
            logger.warning(
                f"failed to delete video cache file: file={entry.name}, error={exc}"
            )

    logger.info(
        "finished cleaning video cache: "
        f"candidates={candidate_count}, candidate_bytes={candidate_size}, "
        f"deleted={deleted_count}, deleted_bytes={deleted_size}, failed={failed_count}"
    )
    return VideoCacheCleanupResult(
        deleted_count=deleted_count,
        deleted_size=deleted_size,
        failed_count=failed_count,
    )
