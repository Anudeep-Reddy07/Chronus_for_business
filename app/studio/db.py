import os
import sqlite3
import time
import uuid
from pathlib import Path

STUDIO_DIR = Path(__file__).resolve().parents[2] / "storage" / "studio"
DB_PATH = STUDIO_DIR / "studio.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS owners(
    id TEXT PRIMARY KEY, name TEXT, contact TEXT, created_at REAL);
CREATE TABLE IF NOT EXISTS projects(
    id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, topic TEXT,
    platform TEXT, status TEXT DEFAULT 'draft', created_at REAL);
CREATE TABLE IF NOT EXISTS media_items(
    id TEXT PRIMARY KEY, project_id TEXT, url TEXT, path TEXT, kind TEXT,
    duration REAL, width INTEGER, height INTEGER, orientation TEXT,
    tags TEXT DEFAULT '', created_at REAL);
CREATE TABLE IF NOT EXISTS renders(
    id TEXT PRIMARY KEY, project_id TEXT, video_path TEXT,
    status TEXT DEFAULT 'review', created_at REAL);
CREATE TABLE IF NOT EXISTS publishes(
    id TEXT PRIMARY KEY, render_id TEXT, platform TEXT, status TEXT,
    detail TEXT DEFAULT '', created_at REAL);
CREATE TABLE IF NOT EXISTS custom_voices(
    id TEXT PRIMARY KEY, name TEXT, provider TEXT, voice_id TEXT,
    created_at REAL);
"""

def _connect():
    STUDIO_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn

def normalize_video_path(video_path: str) -> str:
    """
    Normalize any absolute, storage, or relative video path into standard URI format '/tasks/<task_id>/<file>'.
    """
    if not video_path:
        return ""
    if video_path.startswith(("http://", "https://")):
        return video_path
    clean = video_path.replace("\\", "/")
    if "tasks/" in clean:
        suffix = clean.split("tasks/")[-1].lstrip("/")
        return f"/tasks/{suffix}"
    if not clean.startswith("/"):
        return f"/{clean}"
    return clean


def sync_existing_disk_renders():
    """
    Scan storage/tasks on disk and sync existing generated videos into SQLite if missing,
    cleaning up any duplicate or absolute-path render records.
    """
    try:
        import json
        tasks_dir = Path(__file__).resolve().parents[2] / "storage" / "tasks"
        if not tasks_dir.exists():
            return

        # 1. Clean up / normalize existing render paths and delete exact duplicates
        all_renders = query("SELECT id, project_id, video_path FROM renders")
        seen_renders = set()
        for r in all_renders:
            norm = normalize_video_path(r["video_path"])
            if norm != r["video_path"]:
                execute("UPDATE renders SET video_path = ? WHERE id = ?", (norm, r["id"]))
            
            key = (r["project_id"], norm)
            if key in seen_renders:
                execute("DELETE FROM renders WHERE id = ?", (r["id"],))
            else:
                seen_renders.add(key)

        # 2. Scan disk tasks
        for task_dir in tasks_dir.iterdir():
            if not task_dir.is_dir():
                continue
            task_id = task_dir.name
            final_video = task_dir / "final-1.mp4"
            if not final_video.exists():
                continue

            rel_video_path = f"/tasks/{task_id}/final-1.mp4"
            existing_renders = query(
                "SELECT id FROM renders WHERE video_path = ? OR video_path LIKE ?",
                (rel_video_path, f"%{task_id}%"),
            )
            if existing_renders:
                continue

            script_file = task_dir / "script.json"
            title = "Generated Video"
            topic = ""
            project_id = task_id

            if script_file.exists():
                try:
                    with open(script_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        params = data.get("params") or {}
                        if params.get("studio_project_id"):
                            project_id = params.get("studio_project_id")
                        subject = params.get("video_subject") or ""
                        if subject:
                            if "[Brand:" in subject:
                                brand_part = subject.split("]")[0].replace("[Brand:", "").strip()
                                title = brand_part or subject[:60]
                            else:
                                title = subject[:60]
                            topic = subject
                except Exception:
                    pass

            record_render(
                project_id=project_id,
                video_path=rel_video_path,
                title=title,
                topic=topic,
                render_status="approved",
            )
    except Exception:
        pass

def insert(table, **fields):
    conn = _connect()
    try:
        cols = ", ".join(fields)
        ph = ", ".join("?" * len(fields))
        cur = conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", list(fields.values()))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def query(sql, args=()):
    conn = _connect()
    try:
        rows = conn.execute(sql, args).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def execute(sql, args=()):
    conn = _connect()
    try:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()

def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def record_render(
    project_id: str,
    video_path: str,
    title: str = "",
    topic: str = "",
    render_status: str = "approved",
) -> str:
    """
    Ensure project exists in SQLite and record completed render video path (updating existing render if present).
    """
    now = time.time()
    effective_project_id = project_id or new_id("prj")
    title_text = title.strip() or "Untitled Video Project"
    normalized_path = normalize_video_path(video_path)

    existing = query("SELECT id, title FROM projects WHERE id = ?", (effective_project_id,))
    if not existing:
        insert(
            "projects",
            id=effective_project_id,
            owner_id="default",
            title=title_text,
            topic=topic.strip(),
            platform="all",
            status="complete",
            created_at=now,
        )
    else:
        execute(
            "UPDATE projects SET status = 'complete', title = CASE WHEN title = '' OR title IS NULL THEN ? ELSE title END WHERE id = ?",
            (title_text, effective_project_id),
        )

    # Check if a render for this project or normalized path already exists to avoid duplicate entries
    existing_render = query(
        "SELECT id FROM renders WHERE project_id = ? OR video_path = ? OR video_path = ?",
        (effective_project_id, normalized_path, video_path),
    )
    if existing_render:
        render_id = existing_render[0]["id"]
        execute(
            "UPDATE renders SET video_path = ?, status = ?, created_at = ? WHERE id = ?",
            (normalized_path, render_status, now, render_id),
        )
        return render_id

    render_id = new_id("rnd")
    insert(
        "renders",
        id=render_id,
        project_id=effective_project_id,
        video_path=normalized_path,
        status=render_status,
        created_at=now,
    )
    return render_id


def get_all_projects_with_renders() -> list[dict]:
    """
    Fetch all projects and their latest rendered video paths from SQLite without duplicates.
    """
    sync_existing_disk_renders()
    sql = """
    SELECT 
        p.id as project_id,
        p.owner_id,
        p.title,
        p.topic,
        p.platform,
        p.status as project_status,
        p.created_at,
        r.id as render_id,
        r.video_path,
        r.status as render_status,
        r.created_at as render_created_at
    FROM projects p
    INNER JOIN (
        SELECT id, project_id, video_path, status, created_at,
               ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) as rn
        FROM renders
    ) r ON p.id = r.project_id AND r.rn = 1
    WHERE r.video_path IS NOT NULL AND r.video_path != ''
    ORDER BY p.created_at DESC
    """
    try:
        rows = query(sql)
    except Exception:
        # Fallback without window function for older SQLite engines
        fallback_sql = """
        SELECT 
            p.id as project_id,
            p.owner_id,
            p.title,
            p.topic,
            p.platform,
            p.status as project_status,
            p.created_at,
            r.id as render_id,
            r.video_path,
            r.status as render_status,
            r.created_at as render_created_at
        FROM projects p
        INNER JOIN (
            SELECT id, project_id, video_path, status, MAX(created_at) as created_at
            FROM renders
            GROUP BY project_id
        ) r ON p.id = r.project_id
        WHERE r.video_path IS NOT NULL AND r.video_path != ''
        ORDER BY p.created_at DESC
        """
        rows = query(fallback_sql)

    # Normalize video paths and deduplicate in Python
    deduped = []
    seen_ids = set()
    for row in rows:
        pid = row.get("project_id")
        if pid in seen_ids:
            continue
        seen_ids.add(pid)
        if row.get("video_path"):
            row["video_path"] = normalize_video_path(row["video_path"])
        deduped.append(row)
    return deduped


def record_custom_voice(name: str, provider: str, voice_id: str) -> str:
    """Record a cloned voice into custom_voices table."""
    c_id = new_id("vce")
    insert("custom_voices", id=c_id, name=name, provider=provider, voice_id=voice_id, created_at=time.time())
    return c_id


def get_all_custom_voices() -> list[dict]:
    """Retrieve all cloned voices."""
    return query("SELECT * FROM custom_voices ORDER BY created_at DESC")


def delete_custom_voice(voice_id_or_id: str) -> bool:
    """Delete a custom voice by id or voice_id."""
    execute("DELETE FROM custom_voices WHERE id = ? OR voice_id = ?", (voice_id_or_id, voice_id_or_id))
    return True

