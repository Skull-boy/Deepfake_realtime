"""
Trust Meta-Classifier — validates primary deepfake detector's predictions.

Architecture: 516-dim input → 128 → 64 → 3 classes
Input features:
  - 512-dim face embedding from InceptionResnetV1 backbone
  - 2-dim one-hot encoded primary label (FAKE/REAL)
  - 1-dim primary confidence (0.0–1.0)
  - 1-dim normalized latency

Output classes:
  0 = UNTRUSTED  — primary prediction is likely wrong
  1 = TRUSTED    — primary prediction is reliable
  2 = NEEDS_REVIEW — ambiguous, queue for human review
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F

TRUST_VERDICTS = {0: "UNTRUSTED", 1: "TRUSTED", 2: "NEEDS_REVIEW"}
TRUST_WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "trust_meta.pt")


class TrustMetaClassifier(nn.Module):
    """
    Lightweight MLP that evaluates whether the primary model's
    prediction should be trusted, flagged, or sent for human review.
    """

    def __init__(self, input_dim=516, hidden1=128, hidden2=64, num_classes=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden1),
            nn.BatchNorm1d(hidden1),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(hidden1, hidden2),
            nn.BatchNorm1d(hidden2),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(hidden2, num_classes),
        )

    def forward(self, x):
        return self.net(x)


def build_trust_input(embedding, primary_pred_idx, confidence, latency_ms, device="cpu"):
    """
    Constructs the 516-dim input tensor for the TrustMetaClassifier.

    Args:
        embedding:        torch.Tensor of shape (512,) — face embedding from backbone
        primary_pred_idx: int — 0 for FAKE, 1 for REAL
        confidence:       float — primary model's confidence (0.0–1.0)
        latency_ms:       float — inference latency in milliseconds
        device:           str — torch device

    Returns:
        torch.Tensor of shape (1, 516)
    """
    # One-hot encode primary label
    label_onehot = F.one_hot(
        torch.tensor([primary_pred_idx], dtype=torch.long), num_classes=2
    ).float().to(device)

    # Normalize latency: typical range 20-200ms → 0-1
    latency_norm = min(latency_ms / 200.0, 1.0)

    # Concatenate all features
    trust_input = torch.cat([
        embedding.unsqueeze(0) if embedding.dim() == 1 else embedding,
        label_onehot,
        torch.tensor([[confidence]], dtype=torch.float32).to(device),
        torch.tensor([[latency_norm]], dtype=torch.float32).to(device),
    ], dim=1)

    return trust_input


def load_trust_model(device="cpu"):
    """
    Loads the trust meta-classifier from disk.
    If no weights file exists (cold start), returns an untrained model
    that will default to TRUSTED for all predictions.

    Returns:
        tuple: (model, cold_start: bool)
    """
    trust_model = TrustMetaClassifier().to(device)

    if os.path.exists(TRUST_WEIGHTS_PATH):
        trust_model.load_state_dict(
            torch.load(TRUST_WEIGHTS_PATH, map_location=device)
        )
        trust_model.eval()
        print(f"[TRUST] Meta-classifier loaded from {TRUST_WEIGHTS_PATH}")
        return trust_model, False
    else:
        trust_model.eval()
        print("[TRUST] No weights found — running in COLD START mode (all predictions trusted)")
        return trust_model, True


def predict_trust(trust_model, trust_input, cold_start=False):
    """
    Runs the trust meta-classifier on the prepared input.

    In cold-start mode (no training data yet), returns TRUSTED by default
    so the system doesn't block predictions before any human review happens.

    Args:
        trust_model:  TrustMetaClassifier instance
        trust_input:  torch.Tensor of shape (1, 516)
        cold_start:   bool — if True, bypass model and return TRUSTED

    Returns:
        dict with keys: trust_verdict (str), trust_score (float), cold_start (bool)
    """
    if cold_start:
        return {
            "trust_verdict": "TRUSTED",
            "trust_score": 1.0,
            "cold_start": True,
        }

    with torch.no_grad():
        logits = trust_model(trust_input)
        probs = torch.softmax(logits, dim=1)[0]
        verdict_idx = int(torch.argmax(probs))
        score = float(probs[verdict_idx])

    return {
        "trust_verdict": TRUST_VERDICTS[verdict_idx],
        "trust_score": round(score, 4),
        "cold_start": False,
    }
