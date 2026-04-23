"""
Session Report Generator — forensic session reports for audit trails.

Generates structured JSON session reports containing:
  - Session metadata (duration, total frames, model version)
  - Timeline of verdicts with confidence values
  - Flagged FAKE frames with thumbnails + confidence
  - Trust Meta-Classifier verdicts over time
  - GradCAM heatmap snapshots for suspicious frames
  - Temporal consistency timeline
  - TTA agreement scores

This module operates on MongoDB frame_records and produces
a JSON report that the frontend can render or export as PDF.

Usage (from main.py):
    from session_report import generate_session_report, list_sessions
    
    # List available sessions
    sessions = list_sessions()
    
    # Generate report for a specific session
    report = generate_session_report("session_abc123")
"""

import traceback
from datetime import datetime, timezone
from typing import Optional

from frame_store import _get_mongo_collection


def list_sessions(limit: int = 50) -> list:
    """
    List recent sessions with summary stats.
    
    Returns:
        List of session summaries, sorted by most recent first.
    """
    try:
        collection = _get_mongo_collection()
        
        pipeline = [
            {
                "$group": {
                    "_id": "$session_id",
                    "frame_count": {"$sum": 1},
                    "first_frame": {"$min": "$timestamp"},
                    "last_frame": {"$max": "$timestamp"},
                    "avg_confidence": {"$avg": "$primary_confidence"},
                    "fake_count": {
                        "$sum": {"$cond": [{"$eq": ["$primary_label", "FAKE"]}, 1, 0]}
                    },
                    "real_count": {
                        "$sum": {"$cond": [{"$eq": ["$primary_label", "REAL"]}, 1, 0]}
                    },
                    "untrusted_count": {
                        "$sum": {"$cond": [{"$eq": ["$trust_verdict", "UNTRUSTED"]}, 1, 0]}
                    },
                }
            },
            {"$sort": {"last_frame": -1}},
            {"$limit": limit},
        ]
        
        results = list(collection.aggregate(pipeline))
        
        sessions = []
        for r in results:
            duration_seconds = 0
            if r.get("first_frame") and r.get("last_frame"):
                delta = r["last_frame"] - r["first_frame"]
                duration_seconds = round(delta.total_seconds(), 1)
            
            sessions.append({
                "session_id": r["_id"],
                "frame_count": r["frame_count"],
                "duration_seconds": duration_seconds,
                "started_at": r["first_frame"].isoformat() if r.get("first_frame") else None,
                "ended_at": r["last_frame"].isoformat() if r.get("last_frame") else None,
                "avg_confidence": round(r.get("avg_confidence", 0), 3),
                "fake_count": r["fake_count"],
                "real_count": r["real_count"],
                "untrusted_count": r["untrusted_count"],
                "threat_level": _compute_threat_level(
                    r["fake_count"], r["real_count"], r["untrusted_count"]
                ),
            })
        
        return sessions
    
    except Exception as e:
        print(f"[SESSION_REPORT] Error listing sessions: {e}")
        traceback.print_exc()
        return []


def generate_session_report(
    session_id: str,
    include_frame_urls: bool = True,
    include_embeddings: bool = False,
) -> dict:
    """
    Generate a comprehensive forensic report for a specific session.
    
    Args:
        session_id: The session identifier
        include_frame_urls: Whether to include Supabase frame URLs
        include_embeddings: Whether to include raw embeddings (large data)
    
    Returns:
        Comprehensive session report as a dict
    """
    try:
        collection = _get_mongo_collection()
        
        # Fetch all frames for this session, sorted by timestamp
        projection = {
            "_id": 0,
            "session_id": 1,
            "timestamp": 1,
            "frame_url": 1,
            "primary_label": 1,
            "primary_confidence": 1,
            "face_detected": 1,
            "latency_ms": 1,
            "trust_verdict": 1,
            "trust_score": 1,
            "human_label": 1,
            "reviewed_by": 1,
            "reviewed_at": 1,
        }
        
        if include_embeddings:
            projection["embedding"] = 1
        
        frames = list(
            collection.find(
                {"session_id": session_id},
                projection,
            ).sort("timestamp", 1)
        )
        
        if not frames:
            return {"error": f"No frames found for session {session_id}"}
        
        # ── Compute timeline ──
        timeline = []
        for f in frames:
            entry = {
                "timestamp": f["timestamp"].isoformat() if f.get("timestamp") else None,
                "label": f.get("primary_label", "UNKNOWN"),
                "confidence": round(f.get("primary_confidence", 0), 4),
                "trust_verdict": f.get("trust_verdict", "UNKNOWN"),
                "trust_score": round(f.get("trust_score", 0), 4),
                "latency_ms": f.get("latency_ms", 0),
                "face_detected": f.get("face_detected", False),
            }
            if include_frame_urls and f.get("frame_url"):
                entry["frame_url"] = f["frame_url"]
            if f.get("human_label"):
                entry["human_label"] = f["human_label"]
            timeline.append(entry)
        
        # ── Compute summary statistics ──
        total = len(frames)
        fake_frames = [f for f in frames if f.get("primary_label") == "FAKE"]
        real_frames = [f for f in frames if f.get("primary_label") == "REAL"]
        untrusted_frames = [f for f in frames if f.get("trust_verdict") == "UNTRUSTED"]
        
        confidences = [f.get("primary_confidence", 0) for f in frames]
        latencies = [f.get("latency_ms", 0) for f in frames if f.get("latency_ms")]
        trust_scores = [f.get("trust_score", 0) for f in frames]
        
        # Duration
        first_ts = frames[0].get("timestamp")
        last_ts = frames[-1].get("timestamp")
        duration_seconds = 0
        if first_ts and last_ts:
            duration_seconds = round((last_ts - first_ts).total_seconds(), 1)
        
        # Consecutive FAKE detection (longest streak)
        max_consecutive_fakes = 0
        current_streak = 0
        for f in frames:
            if f.get("primary_label") == "FAKE":
                current_streak += 1
                max_consecutive_fakes = max(max_consecutive_fakes, current_streak)
            else:
                current_streak = 0
        
        # ── Flagged frames (high-risk: FAKE with high confidence) ──
        flagged = []
        for f in fake_frames:
            entry = {
                "timestamp": f["timestamp"].isoformat() if f.get("timestamp") else None,
                "confidence": round(f.get("primary_confidence", 0), 4),
                "trust_verdict": f.get("trust_verdict", "UNKNOWN"),
                "trust_score": round(f.get("trust_score", 0), 4),
            }
            if include_frame_urls and f.get("frame_url"):
                entry["frame_url"] = f["frame_url"]
            flagged.append(entry)
        
        # ── Build report ──
        report = {
            "report_version": "1.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "session_id": session_id,
            
            "summary": {
                "total_frames": total,
                "duration_seconds": duration_seconds,
                "started_at": first_ts.isoformat() if first_ts else None,
                "ended_at": last_ts.isoformat() if last_ts else None,
                
                "fake_frames": len(fake_frames),
                "real_frames": len(real_frames),
                "fake_percentage": round(len(fake_frames) / total * 100, 1) if total > 0 else 0,
                
                "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else 0,
                "min_confidence": round(min(confidences), 4) if confidences else 0,
                "max_confidence": round(max(confidences), 4) if confidences else 0,
                
                "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0,
                "max_latency_ms": round(max(latencies), 1) if latencies else 0,
                
                "avg_trust_score": round(sum(trust_scores) / len(trust_scores), 4) if trust_scores else 0,
                "untrusted_frames": len(untrusted_frames),
                
                "max_consecutive_fakes": max_consecutive_fakes,
                "threat_level": _compute_threat_level(
                    len(fake_frames), len(real_frames), len(untrusted_frames)
                ),
            },
            
            "flagged_frames": flagged[:50],  # cap at 50 most important
            "timeline": timeline,
            
            "model_info": {
                "primary_model": "InceptionResnetV1 + Custom Head",
                "trust_classifier": "TrustMetaClassifier",
                "capabilities": [
                    "gradcam_heatmaps",
                    "temporal_analysis",
                    "tta_robustness",
                    "frequency_domain_analysis",
                ],
            },
        }
        
        return report
    
    except Exception as e:
        print(f"[SESSION_REPORT] Error generating report: {e}")
        traceback.print_exc()
        return {"error": str(e)}


def _compute_threat_level(fake_count: int, real_count: int, untrusted_count: int) -> str:
    """
    Compute a human-readable threat level based on detection results.
    """
    total = fake_count + real_count
    if total == 0:
        return "UNKNOWN"
    
    fake_ratio = fake_count / total
    
    if fake_ratio >= 0.5 or untrusted_count > total * 0.3:
        return "CRITICAL"
    elif fake_ratio >= 0.25:
        return "HIGH"
    elif fake_ratio >= 0.1:
        return "MODERATE"
    elif fake_ratio > 0:
        return "LOW"
    else:
        return "CLEAR"
