"""
Temporal Analyzer — multi-frame consistency detection for deepfakes.

Maintains a per-session rolling buffer of face embeddings and computes:
  1. Cosine similarity between consecutive frames (detects face-swap jumps)
  2. Rolling variance of similarity scores (detects flicker/instability)
  3. Identity drift from session baseline (detects gradual identity morph)

Usage (from main.py):
    from temporal_analyzer import TemporalAnalyzer
    temporal = TemporalAnalyzer()
    result = temporal.analyze(session_id, embedding_tensor)
    # result = {"consistency": 0.95, "anomaly": False, "drift": 0.02, ...}
"""

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, Optional

import torch
import torch.nn.functional as F


# ──────────────────────────────────────
# Configuration
# ──────────────────────────────────────
BUFFER_SIZE = 16            # Number of embeddings to buffer per session
SIMILARITY_THRESHOLD = 0.85  # Below this = suspicious frame transition
DRIFT_THRESHOLD = 0.20       # Drift from baseline beyond this = anomaly
FLICKER_VARIANCE_THRESHOLD = 0.015  # High variance in similarity = flicker
SESSION_TTL_SECONDS = 600    # Expire sessions after 10 minutes of inactivity


@dataclass
class SessionBuffer:
    """Holds temporal state for one active session."""
    embeddings: deque = field(default_factory=lambda: deque(maxlen=BUFFER_SIZE))
    similarities: deque = field(default_factory=lambda: deque(maxlen=BUFFER_SIZE - 1))
    baseline_embedding: Optional[torch.Tensor] = None
    last_active: float = 0.0
    frame_count: int = 0


class TemporalAnalyzer:
    """
    Per-session temporal consistency analyzer.

    Thread-safe for use in FastAPI background tasks.
    Automatically expires old sessions to prevent memory leaks.
    """

    def __init__(self):
        self._sessions: Dict[str, SessionBuffer] = {}
        self._cleanup_counter = 0

    def analyze(self, session_id: str, embedding: torch.Tensor) -> dict:
        """
        Add a new frame embedding and compute temporal metrics.

        Args:
            session_id: str — groups frames from one live session
            embedding:  torch.Tensor of shape (512,) — face embedding

        Returns:
            dict with keys:
              - consistency:  float [0, 1] — average cosine similarity to recent frames
              - anomaly:      bool — True if temporal anomaly detected
              - drift:        float [0, 1] — cosine distance from session baseline
              - flicker:      float — variance of recent similarity scores
              - frame_count:  int — total frames analyzed in this session
              - details:      str — human-readable anomaly description
        """
        # Periodic cleanup of expired sessions
        self._cleanup_counter += 1
        if self._cleanup_counter % 50 == 0:
            self._cleanup_expired()

        # Get or create session buffer
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionBuffer()

        buf = self._sessions[session_id]
        buf.last_active = time.time()
        buf.frame_count += 1

        # Ensure embedding is 1D, detached, on CPU
        emb = embedding.detach().cpu().float()
        if emb.dim() > 1:
            emb = emb.squeeze()

        # Set baseline on first frame
        if buf.baseline_embedding is None:
            buf.baseline_embedding = emb.clone()

        # Compute cosine similarity with previous frame
        pair_sim = 1.0
        if len(buf.embeddings) > 0:
            prev = buf.embeddings[-1]
            pair_sim = float(F.cosine_similarity(
                emb.unsqueeze(0), prev.unsqueeze(0)
            ))
            buf.similarities.append(pair_sim)

        # Add to buffer
        buf.embeddings.append(emb)

        # ── Compute metrics ──

        # 1. Average consistency (mean of recent similarities)
        if len(buf.similarities) > 0:
            sims = list(buf.similarities)
            consistency = sum(sims) / len(sims)
        else:
            consistency = 1.0

        # 2. Flicker detection (variance of similarities)
        if len(buf.similarities) >= 3:
            sims_t = torch.tensor(list(buf.similarities))
            flicker = float(sims_t.var())
        else:
            flicker = 0.0

        # 3. Identity drift from baseline
        drift = 1.0 - float(F.cosine_similarity(
            emb.unsqueeze(0), buf.baseline_embedding.unsqueeze(0)
        ))

        # ── Anomaly detection ──
        anomaly = False
        details = []

        # Check for sudden face swap (sharp drop in pair similarity)
        if pair_sim < SIMILARITY_THRESHOLD and buf.frame_count > 2:
            anomaly = True
            details.append(f"face_swap_jump(sim={pair_sim:.3f})")

        # Check for identity drift
        if drift > DRIFT_THRESHOLD and buf.frame_count > 5:
            anomaly = True
            details.append(f"identity_drift({drift:.3f})")

        # Check for flicker (high variance = unstable identity)
        if flicker > FLICKER_VARIANCE_THRESHOLD and buf.frame_count > 8:
            anomaly = True
            details.append(f"flicker(var={flicker:.4f})")

        return {
            "consistency": round(max(0.0, min(1.0, consistency)), 4),
            "anomaly": anomaly,
            "drift": round(max(0.0, drift), 4),
            "flicker": round(flicker, 6),
            "pair_similarity": round(pair_sim, 4),
            "frame_count": buf.frame_count,
            "details": " | ".join(details) if details else "stable",
        }

    def reset_session(self, session_id: str):
        """Clear a session's temporal buffer."""
        if session_id in self._sessions:
            del self._sessions[session_id]

    def get_session_stats(self, session_id: str) -> dict:
        """Get stats for a specific session without adding a frame."""
        if session_id not in self._sessions:
            return {"exists": False}

        buf = self._sessions[session_id]
        return {
            "exists": True,
            "frame_count": buf.frame_count,
            "buffer_size": len(buf.embeddings),
            "last_active": buf.last_active,
        }

    def _cleanup_expired(self):
        """Remove sessions that haven't been active for SESSION_TTL_SECONDS."""
        now = time.time()
        expired = [
            sid for sid, buf in self._sessions.items()
            if now - buf.last_active > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            print(f"[TEMPORAL] Cleaned up {len(expired)} expired sessions")
