import os
import shutil
import tempfile
import time
from typing import Optional

from fastapi import Depends, File, UploadFile
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel

from app.controllers import base
from app.controllers.v1.base import new_router
from app.models.exception import HttpException
from app.services import voice as voice_service
from app.studio import db, media_pool, publish, voice_clone
from app.utils import utils

router = new_router(dependencies=[Depends(base.verify_token)])


class VoicePreviewRequest(BaseModel):
    voice_name: str
    text: str = "Welcome to Chronus! Experience the future of automated video ads."
    voice_rate: float = 1.0
    voice_volume: float = 1.0


@router.post("/studio/voice/preview")
def preview_voice_post(body: VoicePreviewRequest):
    return _generate_voice_preview(body.voice_name, body.text, body.voice_rate, body.voice_volume)


@router.get("/studio/voice/preview")
def preview_voice_get(
    voice_name: str,
    text: str = "Welcome to Chronus! Experience the future of automated video ads.",
    voice_rate: float = 1.0,
    voice_volume: float = 1.0,
):
    return _generate_voice_preview(voice_name, text, voice_rate, voice_volume)


def _generate_voice_preview(voice_name: str, text: str, voice_rate: float, voice_volume: float):
    cache_dir = os.path.join(utils.storage_dir(), "cache", "voice_previews")
    os.makedirs(cache_dir, exist_ok=True)

    sanitized_name = voice_name.replace(":", "_").replace("/", "_").replace("\\", "_")
    text_hash = utils.md5(f"{voice_name}_{text}_{voice_rate}_{voice_volume}")[:12]
    out_filename = f"preview_{sanitized_name}_{text_hash}.mp3"
    out_filepath = os.path.join(cache_dir, out_filename)

    if not os.path.isfile(out_filepath) or os.path.getsize(out_filepath) == 0:
        sub_maker = voice_service.tts(
            text=text.strip() or "Welcome to Chronus!",
            voice_name=voice_name,
            voice_rate=voice_rate,
            voice_file=out_filepath,
            voice_volume=voice_volume,
        )
        if not sub_maker or not os.path.isfile(out_filepath):
            raise HttpException(status_code=500, message="Voice synthesis failed")

    return FileResponse(out_filepath, media_type="audio/mpeg", filename=out_filename)


@router.post("/studio/owners")
def create_owner(name: str):
    owner_id = db.new_id("own")
    db.insert("owners", id=owner_id, name=name, contact="", created_at=time.time())
    return {"status": 200, "data": {"owner_id": owner_id}}


@router.post("/studio/projects")
def create_project(owner_id: str, title: str, topic: str = ""):
    project_id = db.new_id("prj")
    db.insert(
        "projects",
        id=project_id, owner_id=owner_id, title=title, topic=topic,
        platform="all", status="draft", created_at=time.time(),
    )
    return {"status": 200, "data": {"project_id": project_id}}


@router.get("/studio/projects")
def list_projects():
    projects = db.get_all_projects_with_renders()
    return {"status": 200, "data": {"projects": projects}}


@router.get("/studio/projects/{project_id}")
def get_project_details(project_id: str):
    projects = db.query("SELECT * FROM projects WHERE id=?", (project_id,))
    if not projects:
        raise HttpException(status_code=404, message="project not found")
    project = projects[0]
    renders = db.query("SELECT * FROM renders WHERE project_id=? ORDER BY created_at DESC", (project_id,))
    media = db.query("SELECT * FROM media_items WHERE project_id=? ORDER BY created_at DESC", (project_id,))
    return {"status": 200, "data": {"project": project, "renders": renders, "media": media}}


@router.post("/studio/media/{project_id}")
async def upload_media(project_id: str, files: list[UploadFile] = File(...)):
    tmp_dir = tempfile.mkdtemp(prefix="studio-upload-")
    try:
        for file in files:
            dest = os.path.join(tmp_dir, file.filename)
            with open(dest, "wb") as fp:
                shutil.copyfileobj(file.file, fp)
        ingested = media_pool.ingest_folder(project_id, tmp_dir)
        return {"status": 200, "data": {"ingested": ingested}}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/studio/voices")
async def create_voice(name: str, provider: str = "fish_audio", files: list[UploadFile] = File(...)):
    tmp_dir = tempfile.mkdtemp(prefix="studio-voice-")
    try:
        sample_paths = []
        for file in files:
            dest = os.path.join(tmp_dir, file.filename)
            with open(dest, "wb") as fp:
                shutil.copyfileobj(file.file, fp)
            sample_paths.append(dest)
        voice_name = voice_clone.create_cloned_voice(name, sample_paths, provider=provider)
        # Record into SQLite database
        voice_db_id = db.record_custom_voice(name=name, provider=provider, voice_id=voice_name)
        return {
            "status": 200,
            "data": {
                "id": voice_db_id,
                "voice_name": voice_name,
                "name": name,
                "provider": provider,
            },
        }
    except Exception as exc:
        logger.error(f"Voice cloning failed: {exc}")
        raise HttpException(status_code=400, message=str(exc))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.get("/studio/voices")
def list_custom_voices():
    try:
        voices = db.get_all_custom_voices()
        return {"status": 200, "data": {"voices": voices}}
    except Exception as exc:
        logger.error(f"Failed to list custom voices: {exc}")
        raise HttpException(status_code=500, message=str(exc))


@router.delete("/studio/voices/{voice_id}")
def delete_custom_voice(voice_id: str):
    try:
        db.delete_custom_voice(voice_id)
        return {"status": 200, "data": {"deleted": voice_id}}
    except Exception as exc:
        logger.error(f"Failed to delete custom voice: {exc}")
        raise HttpException(status_code=500, message=str(exc))


@router.get("/studio/config")
def get_engine_config():
    from app.config import config as app_config

    return {
        "status": 200,
        "data": {
            "fish_audio_api_key": app_config.fish_audio.get("api_key", "") if hasattr(app_config, "fish_audio") else "",
            "fish_audio_model": app_config.fish_audio.get("model", "s2.1-pro-free") if hasattr(app_config, "fish_audio") else "s2.1-pro-free",
            "openai_api_key": app_config.openai.get("api_key", "") if hasattr(app_config, "openai") else "",
            "openai_base_url": app_config.openai.get("base_url", "https://api.openai.com/v1") if hasattr(app_config, "openai") else "https://api.openai.com/v1",
            "pexels_api_key": app_config.pexels.get("api_key", "") if hasattr(app_config, "pexels") else "",
            "pixabay_api_key": app_config.pixabay.get("api_key", "") if hasattr(app_config, "pixabay") else "",
            "elevenlabs_api_key": app_config.elevenlabs.get("api_key", "") if hasattr(app_config, "elevenlabs") else "",
            "llm_provider": app_config.app.get("llm_provider", "openai") if hasattr(app_config, "app") else "openai",
            "llm_model": app_config.app.get("llm_model", "gpt-4o-mini") if hasattr(app_config, "app") else "gpt-4o-mini",
        },
    }


class EngineConfigUpdateRequest(BaseModel):
    fish_audio_api_key: Optional[str] = None
    fish_audio_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    pexels_api_key: Optional[str] = None
    pixabay_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None


@router.post("/studio/config")
def update_engine_config(body: EngineConfigUpdateRequest):
    from app.config import config as app_config

    if body.fish_audio_api_key is not None:
        app_config.fish_audio["api_key"] = body.fish_audio_api_key.strip()
    if body.fish_audio_model is not None:
        app_config.fish_audio["model"] = body.fish_audio_model.strip()
    if body.openai_api_key is not None:
        app_config.openai["api_key"] = body.openai_api_key.strip()
    if body.openai_base_url is not None:
        app_config.openai["base_url"] = body.openai_base_url.strip()
    if body.pexels_api_key is not None:
        app_config.pexels["api_key"] = body.pexels_api_key.strip()
    if body.pixabay_api_key is not None:
        app_config.pixabay["api_key"] = body.pixabay_api_key.strip()
    if body.elevenlabs_api_key is not None:
        app_config.elevenlabs["api_key"] = body.elevenlabs_api_key.strip()
    if body.llm_provider is not None:
        app_config.app["llm_provider"] = body.llm_provider.strip()
    if body.llm_model is not None:
        app_config.app["llm_model"] = body.llm_model.strip()

    try:
        app_config.save_config()
    except Exception as exc:
        logger.warning(f"could not save config.toml: {exc}")

    return {"status": 200, "message": "Configuration updated successfully"}


@router.post("/studio/renders/{render_id}/approve")
def approve_render(render_id: str):
    db.query("UPDATE renders SET status='approved' WHERE id=?", (render_id,))
    return {"status": 200, "data": {"render_id": render_id}}


@router.post("/studio/publish")
def publish_render(render_id: str, platforms: str = "tiktok"):
    platforms = [p.strip() for p in platforms.split(",") if p.strip()]
    results = publish.approve_and_publish(render_id, platforms)
    return {"status": 200, "data": results}

