"""
Frame Store — persists prediction frames to MongoDB + Supabase for
post-session human review and meta-classifier retraining.

This module runs ASYNCHRONOUSLY (fire-and-forget) so it never blocks
the /predict response. If storage fails, it logs the error but does
not affect the user-facing prediction.
"""

import os
import io
import uuid
import traceback
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────
# MongoDB (direct pymongo — no Mongoose)
# ──────────────────────────────────────
_mongo_client = None
_mongo_db = None
_mongo_collection = None

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = "deepfake"
FRAME_COLLECTION = "frame_records"


def _get_mongo_collection():
    """Lazy-init MongoDB connection."""
    global _mongo_client, _mongo_db, _mongo_collection
    if _mongo_collection is None:
        from pymongo import MongoClient

        _mongo_client = MongoClient(MONGO_URI)
        _mongo_db = _mongo_client[MONGO_DB_NAME]
        _mongo_collection = _mongo_db[FRAME_COLLECTION]
        print(f"[FRAME_STORE] MongoDB connected → {MONGO_DB_NAME}.{FRAME_COLLECTION}")
    return _mongo_collection


# ──────────────────────────────────────
# Supabase (frame image upload via httpx — no heavy SDK needed)
# ──────────────────────────────────────
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FRAME_BUCKET = os.getenv("SUPABASE_FRAME_BUCKET", "frame-archive")


def _upload_frame_image(frame_bytes: bytes, session_id: str) -> str:
    """
    Uploads a JPEG frame to Supabase storage via REST API.
    Uses httpx directly to avoid heavy supabase SDK dependencies.

    Returns:
        str: Public URL of the uploaded frame
    """
    filename = f"{session_id}/{uuid.uuid4().hex}.jpg"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{FRAME_BUCKET}/{filename}"

    response = httpx.post(
        upload_url,
        content=frame_bytes,
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "image/jpeg",
        },
        timeout=15.0,
    )
    response.raise_for_status()

    # Build the public URL
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{FRAME_BUCKET}/{filename}"
    return public_url


# ──────────────────────────────────────
# Main API — called from main.py
# ──────────────────────────────────────

def save_frame_record(
    session_id: str,
    frame_bytes: bytes,
    primary_label: str,
    primary_confidence: float,
    face_detected: bool,
    latency_ms: float,
    embedding_list: list,
    trust_verdict: str,
    trust_score: float,
):
    """
    Saves a complete frame record to MongoDB + uploads the frame image
    to Supabase. This is designed to be called as a background task
    (fire-and-forget) so it never blocks the /predict response.

    Args:
        session_id:          str — groups frames from one live session
        frame_bytes:         bytes — raw JPEG of the frame
        primary_label:       str — "FAKE" / "REAL" / "UNKNOWN"
        primary_confidence:  float — 0.0–1.0
        face_detected:       bool
        latency_ms:          float — inference time
        embedding_list:      list — 512-dim face embedding as Python list
        trust_verdict:       str — "TRUSTED" / "UNTRUSTED" / "NEEDS_REVIEW"
        trust_score:         float — 0.0–1.0
    """
    try:
        # Upload frame image to Supabase
        frame_url = _upload_frame_image(frame_bytes, session_id)

        # Build the document
        record = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc),
            "frame_url": frame_url,

            # Primary model output
            "primary_label": primary_label,
            "primary_confidence": round(primary_confidence, 4),
            "face_detected": face_detected,
            "latency_ms": round(latency_ms, 1),

            # Embedding (stored for retraining — avoids re-running backbone)
            "embedding": embedding_list,

            # Meta-classifier output
            "trust_verdict": trust_verdict,
            "trust_score": round(trust_score, 4),

            # Human review — null until reviewed
            "human_label": None,
            "reviewed_by": None,
            "reviewed_at": None,

            # Training status
            "used_in_training": False,
        }

        # Insert into MongoDB
        collection = _get_mongo_collection()
        result = collection.insert_one(record)
        print(f"[FRAME_STORE] Saved frame {result.inserted_id} for session {session_id}")

    except Exception as e:
        # NEVER let storage failures break the prediction pipeline
        print(f"[FRAME_STORE] ERROR saving frame: {e}")
        traceback.print_exc()


def get_review_stats():
    """Returns frame review statistics for the retrain status panel."""
    try:
        collection = _get_mongo_collection()
        total = collection.count_documents({})
        reviewed = collection.count_documents({"human_label": {"$ne": None}})
        pending = collection.count_documents({"human_label": None})
        unreviewed_unused = collection.count_documents({
            "human_label": {"$ne": None},
            "used_in_training": False,
        })

        return {
            "total_frames": total,
            "reviewed": reviewed,
            "pending_review": pending,
            "available_for_training": unreviewed_unused,
        }
    except Exception as e:
        print(f"[FRAME_STORE] ERROR getting stats: {e}")
        return {"total_frames": 0, "reviewed": 0, "pending_review": 0, "available_for_training": 0}

def get_recent_threats(limit: int = 10):
    """Returns recent frames mapped to threat feed format for the dashboard."""
    try:
        collection = _get_mongo_collection()
        cursor = collection.find({}).sort("timestamp", -1).limit(limit)
        results = []
        for doc in cursor:
            conf = doc.get("primary_confidence", 0.0) * 100
            label = doc.get("primary_label", "UNKNOWN")
            
            threat_type = "GAN.Deepfake" if label == "FAKE" else "Real.Verified"
            
            trust = doc.get("trust_verdict", "TRUSTED")
            if trust == "UNTRUSTED":
                status = "BLOCKED"
            elif trust == "NEEDS_REVIEW":
                status = "REVIEW"
            else:
                status = "CLEAR" if label == "REAL" else "QUARANTINE"

            results.append({
                "id": f"0x{str(doc['_id'])[-4:].upper()}",
                "ts": doc["timestamp"].strftime("%H:%M:%S.%f")[:-3] if "timestamp" in doc and doc["timestamp"] else "",
                "type": threat_type,
                "node": doc.get("session_id", "unknown")[:10],
                "conf": round(conf, 1),
                "status": status,
                "hash": str(doc['_id']) * 3
            })
        return results
    except Exception as e:
        print(f"[FRAME_STORE] ERROR getting recent threats: {e}")
        return []
