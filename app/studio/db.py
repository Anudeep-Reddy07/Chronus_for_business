import os
import sqlite3
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
"""

def _connect():
    STUDIO_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn

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

def new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"
