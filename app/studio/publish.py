"""Approve a finished render and publish it to selected platforms."""
import time
from loguru import logger

from app.services import state as sm
from app.services import upload_post
from app.studio import db

def approve_and_publish(render_id: str, platforms: list[str]) -> dict:
    render = db.query("SELECT * FROM renders WHERE id=?", (render_id,))
    if not render:
        return {"success": False, "error": "render not found"}
    render = render[0]
    if render["status"] != "approved":
        return {"success": False, "error": "render has not been approved"}

    results = {}
    for platform in platforms:
        result = upload_post.cross_post_video(
            video_path=render["video_path"],
            title="New video",
            platforms=[platform],
        )
        results[platform] = result
        db.insert(
            "publishes",
            id=db.new_id("pub"),
            render_id=render_id,
            platform=platform,
            status="success" if result.get("success") else "failed",
            detail=str(result.get("error", "")),
            created_at=time.time(),
        )
    return results
