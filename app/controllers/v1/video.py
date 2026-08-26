import glob
import os
import pathlib
import shutil
from typing import Union

from fastapi import BackgroundTasks, Depends, Path, Query, Request, UploadFile
from fastapi.params import File
from fastapi.responses import FileResponse, StreamingResponse
from loguru import logger

from app.config import config
from app.controllers import base
from app.controllers.manager.base_manager import TaskQueueFullError
from app.controllers.manager.memory_manager import InMemoryTaskManager
from app.controllers.manager.redis_manager import RedisTaskManager
from app.controllers.v1.base import new_router
from app.models.exception import HttpException
from app.models.schema import (
    AudioRequest,
    BgmRetrieveResponse,
    BgmUploadResponse,
    SubtitleRequest,
    TaskDeletionResponse,
    TaskListResponse,
    TaskQueryRequest,
    TaskQueryResponse,
    TaskResponse,
    TaskVideoRequest,
    VideoMaterialUploadResponse,
    VideoMaterialRetrieveResponse
)
from app.services import bgm as bgm_service
from app.services import material_upload as material_upload_service
from app.services import state as sm
from app.services import task as tm
from app.utils import file_security, utils

# Enforce authentication at the V1 video router entry. verify_token preserves
# open local access when api_key is not configured.
router = new_router(dependencies=[Depends(base.verify_token)])

_enable_redis = config.app.get("enable_redis", False)
_redis_host = config.app.get("redis_host", "localhost")
_redis_port = config.app.get("redis_port", 6379)
_redis_db = config.app.get("redis_db", 0)
_redis_password = config.app.get("redis_password", None)
_max_concurrent_tasks = config.app.get("max_concurrent_tasks", 5)
_max_queued_tasks = config.app.get("max_queued_tasks", 100)

redis_url = f"redis://:{_redis_password}@{_redis_host}:{_redis_port}/{_redis_db}"
# Select task manager based on configuration
if _enable_redis:
    task_manager = RedisTaskManager(
        max_concurrent_tasks=_max_concurrent_tasks,
        redis_url=redis_url,
        max_queued_tasks=_max_queued_tasks,
    )
else:
    task_manager = InMemoryTaskManager(
        max_concurrent_tasks=_max_concurrent_tasks,
        max_queued_tasks=_max_queued_tasks,
    )


def _sanitize_upload_filename(filename: str, request_id: str) -> str:
    # Retain basename only to prevent directory traversal attacks
    normalized_name = (filename or "").replace("\\", "/").split("/")[-1].strip()
    if not normalized_name or normalized_name in {".", ".."}:
        raise HttpException(
            task_id=request_id,
            status_code=400,
            message=f"{request_id}: invalid filename",
        )
    return normalized_name


def _resolve_path_within_directory(base_dir: str, unsafe_path: str, request_id: str) -> str:
    try:
        return file_security.resolve_path_within_directory(base_dir, unsafe_path)
    except ValueError as exc:
        logger.warning(
            f"reject unsafe file path, request_id: {request_id}, path: {unsafe_path}, "
            f"error: {str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=404 if str(exc) == "file does not exist" else 403,
            message=f"{request_id}: invalid file path",
        )


def _public_task_data(task: dict) -> dict:
    """Clone task state dict and strip internal coordination fields."""
    public_task = dict(task)
    public_task.pop("cross_post_owner", None)
    return public_task


def _task_file_to_uri(file: str, endpoint: str, task_dir: str, request_id: str) -> str:
    if not isinstance(file, str):
        return file

    if file.startswith(("http://", "https://")):
        return file

    normalized = file.replace("\\", "/")
    if normalized.startswith("/tasks/"):
        uri_path = normalized.lstrip("/")
        if endpoint:
            return f"{endpoint.rstrip('/')}/{uri_path}"
        return f"/{uri_path}"
    if normalized.startswith("tasks/"):
        uri_path = normalized
        if endpoint:
            return f"{endpoint.rstrip('/')}/{uri_path}"
        return f"/{uri_path}"

    try:
        resolved_path = file_security.resolve_path_within_directory(task_dir, file)
    except ValueError as exc:
        logger.warning(
            f"skip unsafe task output path, request_id: {request_id}, path: {file}, "
            f"error: {str(exc)}"
        )
        return file

    relative_path = os.path.relpath(resolved_path, task_dir).replace("\\", "/")
    uri_path = f"tasks/{relative_path}"
    if endpoint:
        return f"{endpoint.rstrip('/')}/{uri_path}"
    return f"/{uri_path}"


def _parse_byte_range(
    range_header: str | None, file_size: int, request_id: str
) -> tuple[int, int]:
    """Parse single-range HTTP Range header into start/end byte offsets."""
    if file_size <= 0:
        raise HttpException(
            task_id=request_id,
            status_code=416,
            message=f"{request_id}: requested range is not satisfiable",
        )

    if not range_header:
        return 0, file_size - 1

    try:
        if not range_header.startswith("bytes=") or "," in range_header:
            raise ValueError("unsupported range format")
        start_text, end_text = range_header[6:].split("-", 1)
        if not start_text and not end_text:
            raise ValueError("empty range")

        if not start_text:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                raise ValueError("invalid suffix length")
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else file_size - 1
            if start < 0 or start >= file_size or end < start:
                raise ValueError("range outside file")
            end = min(end, file_size - 1)
    except (TypeError, ValueError) as exc:
        logger.warning(
            f"reject invalid video range, request_id: {request_id}, "
            f"range: {range_header}, file_size: {file_size}, error: {str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=416,
            message=f"{request_id}: requested range is not satisfiable",
        ) from exc

    return start, end


@router.post("/videos", response_model=TaskResponse, summary="Generate a short video")
def create_video(
    background_tasks: BackgroundTasks, request: Request, body: TaskVideoRequest
):
    return create_task(request, body, stop_at="video")


@router.post("/subtitle", response_model=TaskResponse, summary="Generate subtitle only")
def create_subtitle(
    background_tasks: BackgroundTasks, request: Request, body: SubtitleRequest
):
    return create_task(request, body, stop_at="subtitle")


@router.post("/audio", response_model=TaskResponse, summary="Generate audio only")
def create_audio(
    background_tasks: BackgroundTasks, request: Request, body: AudioRequest
):
    return create_task(request, body, stop_at="audio")


def create_task(
    request: Request,
    body: Union[TaskVideoRequest, SubtitleRequest, AudioRequest],
    stop_at: str,
):
    task_id = utils.get_uuid()
    request_id = base.get_task_id(request)
    try:
        task = {
            "task_id": task_id,
            "request_id": request_id,
            "params": body.model_dump(),
        }
        sm.state.update_task(task_id)
        try:
            task_manager.add_task(
                tm.start, task_id=task_id, params=body, stop_at=stop_at
            )
        except Exception:
            # Rollback state record if scheduler failed to accept task
            sm.state.delete_task(task_id)
            raise
        logger.success(f"Task created: {utils.to_json(task)}")
        return utils.get_response(200, task)
    except TaskQueueFullError as e:
        logger.warning(
            f"reject task because queue is full, request_id: {request_id}, task_id: {task_id}"
        )
        raise HttpException(
            task_id=task_id, status_code=429, message=f"{request_id}: {str(e)}"
        )
    except ValueError as e:
        raise HttpException(
            task_id=task_id, status_code=400, message=f"{request_id}: {str(e)}"
        )

@router.get("/tasks", response_model=TaskListResponse, summary="Get all tasks")
def get_all_tasks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1),
):
    request_id = base.get_task_id(request)
    endpoint = config.app.get("endpoint", "").rstrip("/")
    task_dir = utils.task_dir()

    tasks, total = sm.state.get_all_tasks(page, page_size)
    task_map: dict[str, dict] = {}
    video_to_task_id: dict[str, str] = {}
    studio_prj_to_task_id: dict[str, str] = {}

    for task in tasks:
        tid = task.get("task_id") or task.get("id")
        if not tid:
            continue
        public_t = _public_task_data(task)
        if "videos" in public_t and public_t["videos"]:
            formatted_videos = []
            for v in public_t["videos"]:
                norm_v = _task_file_to_uri(v, endpoint, task_dir, request_id)
                formatted_videos.append(norm_v)
                try:
                    from app.studio import db as studio_db
                    v_key = studio_db.normalize_video_path(v)
                    if v_key:
                        video_to_task_id[v_key] = tid
                except Exception:
                    pass
            public_t["videos"] = formatted_videos

        task_map[tid] = public_t
        studio_pid = task.get("studio_project_id") or (task.get("params") or {}).get("studio_project_id")
        if studio_pid:
            studio_prj_to_task_id[studio_pid] = tid

    # Merge persistent projects & renders from SQLite
    try:
        from app.models import const
        from app.studio import db as studio_db

        db_projects = studio_db.get_all_projects_with_renders()
        for p in db_projects:
            pid = p.get("project_id")
            if not pid:
                continue
            video_path = p.get("video_path")
            norm_video = studio_db.normalize_video_path(video_path) if video_path else ""
            formatted_video_path = (
                _task_file_to_uri(norm_video, endpoint, task_dir, request_id)
                if norm_video
                else None
            )
            title = p.get("title") or "Untitled Project"
            topic = p.get("topic") or ""

            # Check if this DB project corresponds to an in-memory task
            matching_tid = None
            if pid in task_map:
                matching_tid = pid
            elif pid in studio_prj_to_task_id:
                matching_tid = studio_prj_to_task_id[pid]
            elif norm_video and norm_video in video_to_task_id:
                matching_tid = video_to_task_id[norm_video]

            if matching_tid and matching_tid in task_map:
                # Merge DB project data into the existing in-memory task
                task_map[matching_tid]["title"] = title
                task_map[matching_tid]["topic"] = topic
                if not task_map[matching_tid].get("videos") and formatted_video_path:
                    task_map[matching_tid]["videos"] = [formatted_video_path]
            elif page == 1:
                videos_list = [formatted_video_path] if formatted_video_path else []
                task_map[pid] = {
                    "task_id": pid,
                    "state": const.TASK_STATE_COMPLETE if formatted_video_path else const.TASK_STATE_DRAFT,
                    "progress": 100 if formatted_video_path else 0,
                    "videos": videos_list,
                    "combined_videos": [],
                    "params": {
                        "video_subject": title,
                        "video_topic": topic,
                    },
                    "title": title,
                    "topic": topic,
                    "created_at": p.get("created_at") or 0,
                }
                if norm_video:
                    video_to_task_id[norm_video] = pid
    except Exception as exc:
        logger.debug(f"could not merge sqlite projects into tasks: {exc}")

    # Deduplicate tasks that share the exact same video file
    try:
        from app.studio import db as studio_db
        seen_videos = set()
        deduped_tasks = []
        all_tasks = list(task_map.values())
        all_tasks.sort(key=lambda x: x.get("created_at") or 0, reverse=True)
        for t in all_tasks:
            videos = t.get("videos") or []
            if videos:
                primary_v = studio_db.normalize_video_path(videos[0])
                if primary_v in seen_videos:
                    continue
                seen_videos.add(primary_v)
            deduped_tasks.append(t)
        merged_tasks = deduped_tasks
    except Exception:
        merged_tasks = list(task_map.values())
        merged_tasks.sort(key=lambda x: x.get("created_at") or 0, reverse=True)

    response = {
        "tasks": merged_tasks,
        "total": max(total, len(merged_tasks)),
        "page": page,
        "page_size": page_size,
    }
    return utils.get_response(200, response)


@router.get(
    "/tasks/{task_id}", response_model=TaskQueryResponse, summary="Query task status"
)
def get_task(
    request: Request,
    task_id: str = Path(..., description="Task ID"),
    query: TaskQueryRequest = Depends(),
):
    request_id = base.get_task_id(request)
    endpoint = config.app.get("endpoint", "").rstrip("/")
    task_dir = utils.task_dir()
    task = sm.state.get_task(task_id)

    # Check by studio_project_id in sm.state if not matched by task_id directly
    if not task:
        all_sm_tasks, _ = sm.state.get_all_tasks(1, 100)
        for t in all_sm_tasks:
            if t.get("studio_project_id") == task_id or t.get("params", {}).get("studio_project_id") == task_id:
                task = t
                break

    if task:
        response_task = _public_task_data(task)

        if "videos" in task and task["videos"]:
            response_task["videos"] = [
                _task_file_to_uri(v, endpoint, task_dir, request_id)
                for v in task["videos"]
            ]
        if "combined_videos" in task and task["combined_videos"]:
            response_task["combined_videos"] = [
                _task_file_to_uri(v, endpoint, task_dir, request_id)
                for v in task["combined_videos"]
            ]
        return utils.get_response(200, response_task)

    # Fallback to SQLite if task not in memory (e.g. server restarted)
    try:
        from app.models import const
        from app.studio import db as studio_db

        projects = studio_db.query("SELECT * FROM projects WHERE id = ?", (task_id,))
        if projects:
            p = projects[0]
            renders = studio_db.query(
                "SELECT * FROM renders WHERE project_id = ? ORDER BY created_at DESC",
                (task_id,),
            )
            video_path = renders[0]["video_path"] if renders else None
            formatted_video_path = (
                _task_file_to_uri(video_path, endpoint, task_dir, request_id)
                if video_path
                else None
            )
            title = p.get("title") or "Untitled Project"
            topic = p.get("topic") or ""

            fallback_task = {
                "task_id": task_id,
                "state": const.TASK_STATE_COMPLETE if formatted_video_path else const.TASK_STATE_DRAFT,
                "progress": 100 if formatted_video_path else 0,
                "videos": [formatted_video_path] if formatted_video_path else [],
                "combined_videos": [],
                "params": {
                    "video_subject": title,
                    "video_topic": topic,
                },
                "title": title,
                "topic": topic,
                "created_at": p.get("created_at") or 0,
            }
            return utils.get_response(200, fallback_task)
    except Exception as exc:
        logger.debug(f"failed SQLite fallback lookup for task_id {task_id}: {exc}")

    raise HttpException(
        task_id=task_id, status_code=404, message=f"{request_id}: task not found"
    )


@router.delete(
    "/tasks/{task_id}",
    response_model=TaskDeletionResponse,
    summary="Delete a generated short video task",
)
def delete_video(request: Request, task_id: str = Path(..., description="Task ID")):
    request_id = base.get_task_id(request)
    task = sm.state.get_task(task_id)
    if task and tm.is_task_busy(task):
        logger.warning(
            f"refuse to delete busy task, request_id: {request_id}, "
            f"task_id: {task_id}, state: {task.get('state')}, "
            f"cross_post_state: {task.get('cross_post_state')}"
        )
        raise HttpException(
            task_id=task_id,
            status_code=409,
            message=f"{request_id}: task is still running",
        )

    deleted_anything = False
    tasks_dir = utils.task_dir()

    # 1. Delete task directory if it matches task_id directly
    current_task_dir = os.path.join(tasks_dir, task_id)
    if os.path.exists(current_task_dir):
        shutil.rmtree(current_task_dir, ignore_errors=True)
        deleted_anything = True

    # 2. Look up SQLite renders and project media associated with task_id or project_id
    try:
        from app.studio import db as studio_db

        renders = studio_db.query(
            "SELECT * FROM renders WHERE project_id = ? OR id = ? OR video_path LIKE ?",
            (task_id, task_id, f"%{task_id}%"),
        )
        for r in renders:
            video_path = r.get("video_path") or ""
            if "tasks/" in video_path:
                parts = video_path.replace("\\", "/").split("tasks/")[-1].split("/")
                if parts and parts[0]:
                    render_task_folder = os.path.join(tasks_dir, parts[0])
                    if os.path.exists(render_task_folder):
                        shutil.rmtree(render_task_folder, ignore_errors=True)
                        deleted_anything = True

        studio_media_dir = os.path.join(
            utils.storage_dir("local_videos"), "studio", task_id
        )
        if os.path.exists(studio_media_dir):
            shutil.rmtree(studio_media_dir, ignore_errors=True)
            deleted_anything = True

        r_deleted = studio_db.execute(
            "DELETE FROM renders WHERE project_id = ? OR id = ? OR video_path LIKE ?",
            (task_id, task_id, f"%{task_id}%"),
        )
        m_deleted = studio_db.execute("DELETE FROM media_items WHERE project_id = ?", (task_id,))
        p_deleted = studio_db.execute("DELETE FROM projects WHERE id = ?", (task_id,))
        if (r_deleted or 0) > 0 or (m_deleted or 0) > 0 or (p_deleted or 0) > 0:
            deleted_anything = True
    except Exception as exc:
        logger.warning(f"error cleaning up SQLite project records for {task_id}: {exc}")

    # 3. Clean up in-memory task state (both by task_id and by studio_project_id)
    if task:
        sm.state.delete_task(task_id)
        deleted_anything = True

    all_sm_tasks, _ = sm.state.get_all_tasks(1, 100)
    for t in all_sm_tasks:
        if t.get("studio_project_id") == task_id or (t.get("params") or {}).get("studio_project_id") == task_id:
            sm.state.delete_task(t.get("task_id") or t.get("id"))
            deleted_anything = True

    if deleted_anything:
        logger.success(f"task and local folders deleted: task_id={task_id}")
        return utils.get_response(200)

    raise HttpException(
        task_id=task_id, status_code=404, message=f"{request_id}: task not found"
    )


@router.get(
    "/musics", response_model=BgmRetrieveResponse, summary="Retrieve local BGM files"
)
def get_bgm_list(request: Request):
    bgm_list = []
    for file in bgm_service.list_bgm_files():
        filename = os.path.basename(file)
        bgm_list.append(
            {
                "name": filename,
                "size": os.path.getsize(file),
                # Return filename only to prevent exposing host absolute paths
                "file": filename,
            }
        )
    response = {"files": bgm_list}
    return utils.get_response(200, response)


@router.post(
    "/musics",
    response_model=BgmUploadResponse,
    summary="Upload a background music file",
    description=(
        "Validate an MP3, M4A, AAC, WAV, FLAC, OGG, OPUS, or WMA file up to "
        "30 MB and store it under an immutable UUID filename in storage/bgm."
    ),
    responses={
        400: {"description": "The filename, format, size, or audio stream is invalid"},
        500: {"description": "FFmpeg validation or persistent storage is unavailable"},
    },
)
def upload_bgm_file(request: Request, file: UploadFile = File(...)):
    request_id = base.get_task_id(request)
    try:
        safe_filename = bgm_service.save_bgm_upload(file.filename, file.file)
    except bgm_service.BgmUploadError as exc:
        logger.warning(
            f"background music upload rejected: request_id={request_id}, error={str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=400,
            message=f"{request_id}: {str(exc)}",
        )
    except bgm_service.BgmServiceError as exc:
        logger.error(
            f"background music upload failed: request_id={request_id}, error={str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=500,
            message=f"{request_id}: background music validation is unavailable",
        )

    response = {"file": safe_filename}
    return utils.get_response(200, response)

@router.get(
    "/video_materials", response_model=VideoMaterialRetrieveResponse, summary="Retrieve local video materials"
)
def get_video_materials_list(request: Request):
    allowed_suffixes = tuple(
        extension.removeprefix(".")
        for extension in material_upload_service.SUPPORTED_MATERIAL_EXTENSIONS
    )
    local_videos_dir = utils.storage_dir("local_videos", create=True)
    files = []
    for suffix in allowed_suffixes:
        files.extend(glob.glob(os.path.join(local_videos_dir, f"*.{suffix}")))
    # Predictable ordering by filename
    files.sort(key=lambda file_path: os.path.basename(file_path).lower())
    video_materials_list = []
    for file in files:
        filename = os.path.basename(file)
        video_materials_list.append(
            {
                "name": filename,
                "size": os.path.getsize(file),
                "file": filename,
            }
        )
    response = {"files": video_materials_list}
    return utils.get_response(200, response)


@router.post(
    "/video_materials",
    response_model=VideoMaterialUploadResponse,
    summary="Upload the video material file to the local videos directory",
)
def upload_video_material_file(request: Request, file: UploadFile = File(...)):
    request_id = base.get_task_id(request)
    try:
        # Keep accepting browser-supplied client paths, but persist an immutable
        # UUID storage key so repeated names cannot overwrite queued task inputs.
        safe_filename = _sanitize_upload_filename(file.filename, request_id)
        stored_filename = material_upload_service.save_material_upload(
            safe_filename, file.file
        )
    except material_upload_service.MaterialUploadError as exc:
        logger.warning(
            f"local material upload rejected: request_id={request_id}, "
            f"error={str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=400,
            message=f"{request_id}: {str(exc)}",
        )
    except material_upload_service.MaterialServiceError as exc:
        logger.error(
            f"local material upload failed: request_id={request_id}, "
            f"error={str(exc)}"
        )
        raise HttpException(
            task_id=request_id,
            status_code=500,
            message=f"{request_id}: local material validation is unavailable",
        )

    response = {"file": stored_filename}
    return utils.get_response(200, response)

@router.get("/stream/{file_path:path}")
async def stream_video(request: Request, file_path: str):
    request_id = base.get_task_id(request)
    tasks_dir = utils.task_dir()
    video_path = _resolve_path_within_directory(tasks_dir, file_path, request_id)
    range_header = request.headers.get("Range")
    video_size = os.path.getsize(video_path)
    start, end = _parse_byte_range(range_header, video_size, request_id)
    length = end - start + 1

    def file_iterator(file_path, offset=0, bytes_to_read=None):
        with open(file_path, "rb") as f:
            f.seek(offset, os.SEEK_SET)
            remaining = bytes_to_read or video_size
            while remaining > 0:
                bytes_to_read = min(4096, remaining)
                data = f.read(bytes_to_read)
                if not data:
                    break
                remaining -= len(data)
                yield data

    response = StreamingResponse(
        file_iterator(video_path, start, length), media_type="video/mp4"
    )
    response.headers["Content-Range"] = f"bytes {start}-{end}/{video_size}"
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Content-Length"] = str(length)
    response.status_code = 206  # Partial Content

    return response


@router.get("/download/{file_path:path}")
async def download_video(request: Request, file_path: str):
    """
    download video
    :param request: Request request
    :param file_path: video file path, eg: /cd1727ed-3473-42a2-a7da-4faafafec72b/final-1.mp4
    :return: video file
    """
    request_id = base.get_task_id(request)
    tasks_dir = utils.task_dir()
    video_path = _resolve_path_within_directory(tasks_dir, file_path, request_id)
    file_path = pathlib.Path(video_path)
    filename = file_path.stem
    extension = file_path.suffix
    headers = {"Content-Disposition": f"attachment; filename={filename}{extension}"}
    return FileResponse(
        path=video_path,
        headers=headers,
        filename=f"{filename}{extension}",
        media_type=f"video/{extension[1:]}",
    )
