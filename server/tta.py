"""
Test-Time Augmentation (TTA) — adversarial robustness for deepfake detection.

Runs multiple augmented versions of each face through the model and
averages predictions. This makes the system resistant to:
  - Adversarial perturbations (small pixel changes that flip predictions)
  - Compression artifacts that might confuse single-pass inference
  - Orientation-dependent biases in the model

Usage (from main.py):
    from tta import predict_with_tta
    result = predict_with_tta(face_pil, model, transform, device)
    # result = {"tta_confidence": 0.91, "tta_agreement": 0.8, ...}
"""

import io
import random

import torch
import numpy as np
from PIL import Image, ImageFilter


# ──────────────────────────────────────
# Augmentation functions (PIL → PIL)
# ──────────────────────────────────────

def _identity(img: Image.Image) -> Image.Image:
    """No-op augmentation (original image)."""
    return img


def _horizontal_flip(img: Image.Image) -> Image.Image:
    """Mirror the face horizontally."""
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def _slight_rotate(img: Image.Image) -> Image.Image:
    """Small rotation (±3°) — tests orientation robustness."""
    angle = random.choice([-3, -2, 2, 3])
    return img.rotate(angle, resample=Image.BILINEAR, expand=False, fillcolor=(0, 0, 0))


def _jpeg_compress(img: Image.Image) -> Image.Image:
    """
    Re-encode as JPEG at quality 60 — destroys adversarial perturbations
    while preserving genuine facial features.
    """
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=60)
    buffer.seek(0)
    return Image.open(buffer).convert("RGB")


def _gaussian_blur(img: Image.Image) -> Image.Image:
    """Light Gaussian blur — smooths out adversarial noise."""
    return img.filter(ImageFilter.GaussianBlur(radius=0.8))


# Default augmentation pipeline
DEFAULT_AUGMENTATIONS = [
    _identity,
    _horizontal_flip,
    _slight_rotate,
    _jpeg_compress,
    _gaussian_blur,
]


def predict_with_tta(
    face_pil: Image.Image,
    model,
    transform,
    device,
    augmentations=None,
) -> dict:
    """
    Run test-time augmentation on a single face crop.

    Args:
        face_pil:       PIL Image — the cropped face
        model:          DeepfakeClassifier instance (eval mode)
        transform:      torchvision transform pipeline
        device:         torch.device
        augmentations:  list of (PIL→PIL) functions, or None for defaults

    Returns:
        dict with keys:
          - tta_label:       str — consensus label ("FAKE" or "REAL")
          - tta_pred_idx:    int — consensus class index
          - tta_confidence:  float — average max confidence across augmentations
          - tta_agreement:   float — fraction of augmentations that agree with consensus
          - tta_probs:       list — per-augmentation [fake_prob, real_prob]
          - tta_embedding:   torch.Tensor — embedding from the original (unaugmented) pass
    """
    if augmentations is None:
        augmentations = DEFAULT_AUGMENTATIONS

    CLASS_NAMES = {0: "FAKE", 1: "REAL"}

    all_probs = []
    all_preds = []
    original_embedding = None

    model.eval()

    for i, aug_fn in enumerate(augmentations):
        try:
            aug_face = aug_fn(face_pil)
            inp = transform(aug_face).unsqueeze(0).to(device)

            with torch.no_grad():
                embedding = model.backbone(inp)
                logits = model.head(embedding)
                probs = torch.softmax(logits, dim=1)[0]

            # Save the original pass's embedding for trust model
            if i == 0:
                original_embedding = embedding

            pred_idx = int(torch.argmax(probs))
            all_probs.append(probs.cpu())
            all_preds.append(pred_idx)

        except Exception as e:
            print(f"[TTA] Augmentation {aug_fn.__name__} failed: {e}")
            continue

    if not all_probs:
        # Fallback: return empty result
        return {
            "tta_label": "UNKNOWN",
            "tta_pred_idx": -1,
            "tta_confidence": 0.0,
            "tta_agreement": 0.0,
            "tta_probs": [],
            "tta_embedding": None,
        }

    # Stack all probability vectors and compute consensus
    prob_stack = torch.stack(all_probs)           # (N, 2)
    avg_probs = prob_stack.mean(dim=0)             # (2,)
    consensus_idx = int(torch.argmax(avg_probs))
    consensus_conf = float(avg_probs[consensus_idx])

    # Agreement: fraction of augmentations that predict the consensus class
    agreement = sum(1 for p in all_preds if p == consensus_idx) / len(all_preds)

    return {
        "tta_label": CLASS_NAMES.get(consensus_idx, "UNKNOWN"),
        "tta_pred_idx": consensus_idx,
        "tta_confidence": round(consensus_conf, 4),
        "tta_agreement": round(agreement, 4),
        "tta_probs": [[round(float(p[0]), 4), round(float(p[1]), 4)] for p in all_probs],
        "tta_embedding": original_embedding,
    }
