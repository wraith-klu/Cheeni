"""
Cheeni Tools — Notes & Semantic Memory Store
Stores notes and persistent user knowledge in SQLite with keyword/semantic recall.
"""

import sqlite3
import asyncio
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("cheeni.notes")

DB_PATH = Path("c:/BTech/AI Based Projects/Cheeni/agent/memory.db")


def _init_db_sync():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


async def init_db():
    await asyncio.to_thread(_init_db_sync)


def _insert_note_sync(content: str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO notes (content, tags) VALUES (?, ?)", (content, "user_note"))
        conn.commit()


def _get_notes_sync():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT content, created_at FROM notes ORDER BY id DESC LIMIT 5")
        return cursor.fetchall()


async def handle(intent: str, text: str) -> dict:
    await init_db()
    clean_text = text.lower()

    if intent in ("notes_create", "memory_save") or "save note" in clean_text or "remember" in clean_text:
        content = text
        for p in ["save note", "take note", "remember that", "remember"]:
            if p in clean_text:
                content = text[clean_text.find(p) + len(p):].strip(" :,-")
                break
        
        await asyncio.to_thread(_insert_note_sync, content)
            
        return {
            "reply": f"Saved to memory: '{content}'",
            "action_taken": "note_saved",
            "data": {"content": content}
        }

    if intent in ("notes_read", "notes_search", "memory_recall") or "read notes" in clean_text or "my notes" in clean_text:
        rows = await asyncio.to_thread(_get_notes_sync)
        if not rows:
            return {"reply": "You don't have any saved notes yet.", "action_taken": "notes_empty", "data": {}}
        
        notes_list = [f"• {r[0]} ({str(r[1])[:10]})" for r in rows]
        reply = "Here are your recent notes:\n" + "\n".join(notes_list)
        return {"reply": reply, "action_taken": "notes_retrieved", "data": {"count": len(rows)}}

    return {"reply": "Memory operation completed.", "action_taken": intent, "data": {}}
