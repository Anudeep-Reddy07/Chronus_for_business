"""Hybrid material assembly: owner media first, similar stock fills the gap,
then blended so owner footage is spread throughout the timeline."""
import random
from typing import List

from loguru import logger
from moviepy import VideoFileClip

from app.models.schema import MaterialInfo, VideoAspect, VideoConcatMode
from app.services import material, video
from app.studio import db

def get_studio_materials(task_id, params, video_terms, audio_duration):
    """Return a blended list of local-file paths + downloaded stock paths."""
    project_id = str(getattr(params, "studio_project_id", "") or "")
    stock_source = str(getattr(params, "studio_stock_source", "pexels") or "pexels")
    blend_mode = str(getattr(params, "studio_blend_mode", "blend") or "blend")
    aspect = VideoAspect(params.video_aspect)
    clip_duration = int(params.video_clip_duration or 5)

    # 1. Owner media (videos AND images; images become short zoom clips)
    rows = db.query(
        "SELECT url FROM media_items WHERE project_id=? ORDER BY created_at",
        (project_id,),
    )
    local_materials = [MaterialInfo(provider="local", url=row["url"], duration=0) for row in rows]
    local_materials = video.preprocess_video(local_materials, clip_duration=clip_duration)

    local_seconds = 0.0
    for m in local_materials:
        try:
            with VideoFileClip(m.url, audio=False) as clip:
                local_seconds += clip.duration
        except Exception as e:
            logger.warning(f"studio: probe failed for {m.url}: {e}")

    # 2. Fill the remaining duration with similar stock footage
    local_seconds = min(local_seconds, audio_duration)
    remaining = max(0.0, audio_duration - local_seconds)
    stock_paths: List[str] = []
    if remaining > 0 and video_terms:
        stock_paths = material.download_videos(
            task_id=task_id,
            search_terms=video_terms,
            source=stock_source,
            video_aspect=aspect,
            video_concat_mode=VideoConcatMode.random,
            audio_duration=remaining,
            max_clip_duration=clip_duration,
            match_script_order=params.match_materials_to_script,
        )
        logger.info(f"studio: downloaded {len(stock_paths)} stock clips to cover {remaining:.1f}s")

    # 3. Blend local + stock so owner footage is spread throughout
    return blend(list(local_materials), list(stock_paths), blend_mode)


def blend(local_materials, stock_paths, mode="blend"):
    local = [m.url for m in local_materials]
    stock = list(stock_paths)
    if mode == "local_first":
        return local + stock
    if mode == "interleave":
        out, i, j = [], 0, 0
        while i < len(local) or j < len(stock):
            if i < len(local):
                out.append(local[i]); i += 1
            if j < len(stock):
                out.append(stock[j]); j += 1
        return out
    combined = local + stock
    random.shuffle(combined)
    return combined
