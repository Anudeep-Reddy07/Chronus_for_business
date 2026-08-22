import os
import shutil
import tempfile
import time

from fastapi import Depends, File, UploadFile

from app.controllers import base
from app.controllers.v1.base import new_router
from app.studio import db, media_pool, publish, voice_clone
from app.utils import utils

router = new_router(dependencies=[Depends(base.verify_token)])


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
        platform="tiktok", status="draft", created_at=time.time(),
    )
    return {"status": 200, "data": {"project_id": project_id}}


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
async def create_voice(name: str, files: list[UploadFile] = File(...)):
    tmp_dir = tempfile.mkdtemp(prefix="studio-voice-")
    try:
        sample_paths = []
        for file in files:
            dest = os.path.join(tmp_dir, file.filename)
            with open(dest, "wb") as fp:
                shutil.copyfileobj(file.file, fp)
            sample_paths.append(dest)
        voice_name = voice_clone.create_cloned_voice(name, sample_paths, provider="elevenlabs")
        return {"status": 200, "data": {"voice_name": voice_name}}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/studio/renders/{render_id}/approve")
def approve_render(render_id: str):
    db.query("UPDATE renders SET status='approved' WHERE id=?", (render_id,))
    return {"status": 200, "data": {"render_id": render_id}}


@router.post("/studio/publish")
def publish_render(render_id: str, platforms: str = "tiktok"):
    platforms = [p.strip() for p in platforms.split(",") if p.strip()]
    results = publish.approve_and_publish(render_id, platforms)
    return {"status": 200, "data": results}
