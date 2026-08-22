"""Ingest owner-uploaded videos/photos into the project media pool."""
import shutil
import time
import uuid
from pathlib import Path
from moviepy import ImageClip, VideoFileClip
from loguru import logger

from app.studio import db
from app.utils import utils

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".flv", ".mkv", ".webm"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def ingest_folder(project_id: str, folder: str) -> list:
    local_root = Path(utils.storage_dir("local_videos", create=True))
    target_dir = local_root / "studio" / project_id
    target_dir.mkdir(parents=True, exist_ok=True)

    ingested = []
    for f in sorted(Path(folder).rglob("*")):
        ext = f.suffix.lower()
        if ext not in VIDEO_EXTS | IMAGE_EXTS:
            continue
        target = target_dir / f"{uuid.uuid4().hex[:8]}{ext}"
        shutil.copy2(f, target)
        try:
            if ext in VIDEO_EXTS:
                with VideoFileClip(str(target), audio=False) as clip:
                    w, h = clip.size
                    kind, duration = "video", clip.duration
            else:
                with ImageClip(str(target)) as img:
                    w, h = img.size
                    kind, duration = "image", 0.0
        except Exception as e:
            logger.warning(f"skip unreadable media {f.name}: {e}")
            continue

        db.insert(
            "media_items",
            id=db.new_id("med"),
            project_id=project_id,
            url=str(target.relative_to(local_root)),
            path=str(target),
            kind=kind,
            duration=duration,
            width=w,
            height=h,
            orientation=_orient(w, h) if kind == "video" else "any",
            tags="",
            created_at=time.time(),
        )
        ingested.append(target.name)
    logger.success(f"studio: ingested {len(ingested)} files for project {project_id}")
    return ingested

def _orient(w, h):
    if h > w:
        return "portrait"
    if w > h:
        return "landscape"
    return "square"
