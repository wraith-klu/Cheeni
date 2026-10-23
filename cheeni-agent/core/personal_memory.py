"""
Cheeni Desktop Agent -- Personal Memory Store (V15)
SQLite + sentence-transformers for persistent, semantically-searchable
user preferences, contacts, shortcuts, and interaction history.

Schema:
  preferences     -- user settings, habits, preferred apps
  contacts        -- name -> phone/email/social mappings
  shortcuts       -- "my college portal" -> URL mappings
  interaction_log -- all past voice commands + outcomes
  embeddings      -- vector cache for semantic search

Usage:
    mem = get_personal_memory()
    mem.remember("preference", "browser", "Chrome")
    mem.add_shortcut("college portal", "https://kluniversity.in")
    results = mem.recall("my browser preference")
    url = mem.get_shortcut("college website")
"""

import os
import json
import time
import sqlite3
import threading
from pathlib import Path
from utils.logging import logger

# -- sentence-transformers (optional, needed for semantic search)
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    EMBEDDER_OK = True
except ImportError:
    EMBEDDER_OK = False
    logger.warning(
        "[PersonalMemory] sentence-transformers not installed. "
        "Semantic search disabled. Run: pip install sentence-transformers"
    )

# DB lives in cheeni-agent/data/personal_memory.db
_DB_DIR  = Path(__file__).resolve().parent.parent / "data"
_DB_PATH = _DB_DIR / "personal_memory.db"
EMBED_MODEL = os.getenv("MEMORY_EMBED_MODEL", "all-MiniLM-L6-v2")


def _cosine_similarity(a, b) -> float:
    """Compute cosine similarity between two numpy arrays."""
    import numpy as np
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


class PersonalMemory:
    """
    Thread-safe persistent memory store with optional semantic search.
    """

    def __init__(self, db_path: Path = _DB_PATH):
        _DB_DIR.mkdir(parents=True, exist_ok=True)
        self._db_path = str(db_path)
        self._lock = threading.Lock()
        self._embedder = None  # lazy-loaded
        self._init_db()
        logger.info(f"[PersonalMemory] Initialized at {self._db_path}")

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._lock, self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS preferences (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    category  TEXT NOT NULL,
                    key       TEXT NOT NULL,
                    value     TEXT NOT NULL,
                    updated   REAL NOT NULL,
                    UNIQUE(category, key) ON CONFLICT REPLACE
                );

                CREATE TABLE IF NOT EXISTS contacts (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    name    TEXT NOT NULL UNIQUE,
                    data    TEXT NOT NULL,
                    updated REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS shortcuts (
                    id       INTEGER PRIMARY KEY AUTOINCREMENT,
                    phrase   TEXT NOT NULL UNIQUE,
                    target   TEXT NOT NULL,
                    updated  REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS interaction_log (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    command   TEXT NOT NULL,
                    intent    TEXT,
                    outcome   TEXT,
                    timestamp REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS embeddings (
                    id        INTEGER PRIMARY KEY,
                    table_ref TEXT NOT NULL,
                    row_id    INTEGER NOT NULL,
                    text      TEXT NOT NULL,
                    vector    TEXT NOT NULL,
                    UNIQUE(table_ref, row_id) ON CONFLICT REPLACE
                );
            """)

    def _get_embedder(self):
        if not EMBEDDER_OK:
            return None
        if self._embedder is None:
            try:
                logger.info(f"[PersonalMemory] Loading embedder '{EMBED_MODEL}'...")
                self._embedder = SentenceTransformer(EMBED_MODEL)
                logger.info("[PersonalMemory] Embedder ready.")
            except Exception as e:
                logger.error(f"[PersonalMemory] Embedder load failed: {e}")
        return self._embedder

    def _embed(self, text: str) -> list | None:
        emb = self._get_embedder()
        if emb is None:
            return None
        try:
            return emb.encode(text).tolist()
        except Exception:
            return None

    def _store_embedding(self, conn, table_ref: str, row_id: int, text: str):
        vec = self._embed(text)
        if vec is not None:
            conn.execute(
                "INSERT OR REPLACE INTO embeddings(table_ref, row_id, text, vector) VALUES (?,?,?,?)",
                (table_ref, row_id, text, json.dumps(vec)),
            )

    # ── Public Write API ──────────────────────────────────────────────────────

    def remember(self, category: str, key: str, value: str):
        """Store a fact about the user. e.g. remember('preference','browser','Chrome')"""
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO preferences(category,key,value,updated) VALUES (?,?,?,?)",
                (category.lower(), key.lower(), value, time.time()),
            )
            row_id = conn.execute(
                "SELECT id FROM preferences WHERE category=? AND key=?",
                (category.lower(), key.lower()),
            ).fetchone()["id"]
            self._store_embedding(conn, "preferences", row_id, f"{category} {key}: {value}")
        logger.info(f"[PersonalMemory] Remembered [{category}] {key} = {value}")

    def add_contact(self, name: str, data: dict):
        """Store a contact. data = {'phone': '...', 'email': '...'}"""
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO contacts(name,data,updated) VALUES (?,?,?)",
                (name.lower(), json.dumps(data), time.time()),
            )
            row_id = conn.execute("SELECT id FROM contacts WHERE name=?", (name.lower(),)).fetchone()["id"]
            summary = f"contact {name}: " + ", ".join(f"{k}={v}" for k, v in data.items())
            self._store_embedding(conn, "contacts", row_id, summary)
        logger.info(f"[PersonalMemory] Contact saved: {name}")

    def add_shortcut(self, phrase: str, target: str):
        """Map a phrase to a URL or app. e.g. 'my college portal' -> 'https://...'"""
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO shortcuts(phrase,target,updated) VALUES (?,?,?)",
                (phrase.lower(), target, time.time()),
            )
            row_id = conn.execute("SELECT id FROM shortcuts WHERE phrase=?", (phrase.lower(),)).fetchone()["id"]
            self._store_embedding(conn, "shortcuts", row_id, phrase)
        logger.info(f"[PersonalMemory] Shortcut: '{phrase}' -> '{target}'")

    def log_interaction(self, command: str, intent: str | None = None, outcome: str | None = None):
        """Log a voice command and its outcome for history/analytics."""
        with self._lock, self._get_conn() as conn:
            conn.execute(
                "INSERT INTO interaction_log(command,intent,outcome,timestamp) VALUES (?,?,?,?)",
                (command, intent, outcome, time.time()),
            )

    # ── Public Read API ───────────────────────────────────────────────────────

    def recall(self, query: str, top_k: int = 3) -> list[dict]:
        """
        Semantic search across all memory tables.
        Returns top-k matching facts sorted by similarity.
        Falls back to keyword search if embedder unavailable.
        """
        if not EMBEDDER_OK:
            return self._keyword_recall(query, top_k)

        query_vec = self._embed(query)
        if query_vec is None:
            return self._keyword_recall(query, top_k)

        with self._lock, self._get_conn() as conn:
            rows = conn.execute("SELECT table_ref, row_id, text, vector FROM embeddings").fetchall()

        scored = []
        for row in rows:
            try:
                stored_vec = json.loads(row["vector"])
                sim = _cosine_similarity(query_vec, stored_vec)
                scored.append({"text": row["text"], "score": sim, "table": row["table_ref"]})
            except Exception:
                pass

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = scored[:top_k]
        logger.debug(f"[PersonalMemory] Recall '{query}' -> {len(results)} results")
        return results

    def _keyword_recall(self, query: str, top_k: int) -> list[dict]:
        """Simple keyword match fallback when embedder is unavailable."""
        words = query.lower().split()
        results = []
        with self._lock, self._get_conn() as conn:
            prefs = conn.execute("SELECT category,key,value FROM preferences").fetchall()
            for p in prefs:
                text = f"{p['category']} {p['key']} {p['value']}".lower()
                if any(w in text for w in words):
                    results.append({"text": f"{p['category']} {p['key']}: {p['value']}", "score": 0.5, "table": "preferences"})
        return results[:top_k]

    def get_shortcut(self, phrase: str) -> str | None:
        """Lookup a shortcut by phrase. Uses semantic search if available."""
        phrase_lower = phrase.lower()
        with self._lock, self._get_conn() as conn:
            # Exact match first
            row = conn.execute("SELECT target FROM shortcuts WHERE phrase=?", (phrase_lower,)).fetchone()
            if row:
                return row["target"]

        # Semantic match
        results = self.recall(phrase, top_k=1)
        if results and results[0]["score"] > 0.7 and results[0]["table"] == "shortcuts":
            # Retrieve the actual shortcut target
            text_phrase = results[0]["text"].strip()
            with self._lock, self._get_conn() as conn:
                row = conn.execute("SELECT target FROM shortcuts WHERE phrase LIKE ?", (f"%{text_phrase[:20]}%",)).fetchone()
                if row:
                    return row["target"]
        return None

    def get_contact(self, name: str) -> dict | None:
        with self._lock, self._get_conn() as conn:
            row = conn.execute("SELECT data FROM contacts WHERE name=?", (name.lower(),)).fetchone()
            return json.loads(row["data"]) if row else None

    def list_preferences(self) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute("SELECT category,key,value FROM preferences ORDER BY category,key").fetchall()
            return [{"category": r["category"], "key": r["key"], "value": r["value"]} for r in rows]

    def list_shortcuts(self) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute("SELECT phrase,target FROM shortcuts ORDER BY phrase").fetchall()
            return [{"phrase": r["phrase"], "target": r["target"]} for r in rows]

    def list_contacts(self) -> list[dict]:
        with self._lock, self._get_conn() as conn:
            rows = conn.execute("SELECT name,data FROM contacts ORDER BY name").fetchall()
            return [{"name": r["name"], **json.loads(r["data"])} for r in rows]

    def forget(self, category: str, key: str):
        """Delete a preference."""
        with self._lock, self._get_conn() as conn:
            conn.execute("DELETE FROM preferences WHERE category=? AND key=?", (category.lower(), key.lower()))
        logger.info(f"[PersonalMemory] Forgot [{category}] {key}")

    def delete_shortcut(self, phrase: str):
        """Delete a shortcut."""
        with self._lock, self._get_conn() as conn:
            conn.execute("DELETE FROM shortcuts WHERE phrase=?", (phrase.lower(),))
        logger.info(f"[PersonalMemory] Deleted shortcut: {phrase}")

    def delete_contact(self, name: str):
        """Delete a contact."""
        with self._lock, self._get_conn() as conn:
            conn.execute("DELETE FROM contacts WHERE name=?", (name.lower(),))
        logger.info(f"[PersonalMemory] Deleted contact: {name}")

    def get_stats(self) -> dict:
        with self._lock, self._get_conn() as conn:
            return {
                "preferences": conn.execute("SELECT COUNT(*) FROM preferences").fetchone()[0],
                "contacts": conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
                "shortcuts": conn.execute("SELECT COUNT(*) FROM shortcuts").fetchone()[0],
                "interactions": conn.execute("SELECT COUNT(*) FROM interaction_log").fetchone()[0],
                "embeddings": conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0],
                "embedder_active": EMBEDDER_OK and self._embedder is not None,
            }


# ── Module-level singleton ─────────────────────────────────────────────────────
_personal_memory: PersonalMemory | None = None


def get_personal_memory() -> PersonalMemory:
    global _personal_memory
    if _personal_memory is None:
        _personal_memory = PersonalMemory()
    return _personal_memory
