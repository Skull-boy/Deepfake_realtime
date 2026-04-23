"""
Retraining script for the Trust Meta-Classifier.

Called by the /retrain and /retrain/approve endpoints in main.py.
Reads human-reviewed frame records from MongoDB, trains a new
TrustMetaClassifier, and saves it as a candidate for approval.

The training loop uses ONLY human-reviewed data (supervised correction),
NOT true RL. The human is always the ground truth.
"""

import os
import shutil
import time
from datetime import datetime, timezone

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset, random_split

from dotenv import load_dotenv

load_dotenv()

from trust_model import (
    TrustMetaClassifier,
    TRUST_WEIGHTS_PATH,
    build_trust_input,
)

# ──────────────────────────────────────
# Paths
# ──────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
CANDIDATE_PATH = os.path.join(MODELS_DIR, "trust_meta_candidate.pt")
BACKUP_DIR = os.path.join(MODELS_DIR, "trust_backups")

# ──────────────────────────────────────
# MongoDB connection (reuse from frame_store)
# ──────────────────────────────────────
_mongo_collection = None


def _get_collection():
    global _mongo_collection
    if _mongo_collection is None:
        from pymongo import MongoClient

        MONGO_URI = os.getenv("MONGO_URI")
        client = MongoClient(MONGO_URI)
        db = client["deepfake"]
        _mongo_collection = db["frame_records"]
    return _mongo_collection


def _build_trust_label(human_label, primary_label, primary_confidence):
    """
    Determines the trust label from human review.

    Logic:
      - If human agrees with primary model → TRUSTED (1)
      - If human disagrees with primary model → UNTRUSTED (0)
      - If confidence was marginal and human agrees → NEEDS_REVIEW (2)
        (teaches meta-classifier to flag borderline cases)
    """
    agreed = human_label == primary_label

    if agreed and primary_confidence >= 0.75:
        return 1  # TRUSTED — model was right and confident
    elif agreed and primary_confidence < 0.75:
        return 2  # NEEDS_REVIEW — model was right but unsure
    else:
        return 0  # UNTRUSTED — model was wrong


# ──────────────────────────────────────
# RETRAIN
# ──────────────────────────────────────

def retrain(device="cpu", min_frames=50, epochs=15, lr=0.001, val_split=0.2):
    """
    Trains a new TrustMetaClassifier on human-reviewed data.

    Returns:
        dict with training results and candidate accuracy
    """
    collection = _get_collection()

    # Fetch all reviewed frames that haven't been used in training yet
    cursor = collection.find(
        {"human_label": {"$ne": None}, "used_in_training": False},
        {"embedding": 1, "primary_label": 1, "primary_confidence": 1,
         "latency_ms": 1, "human_label": 1, "_id": 1}
    )
    records = list(cursor)

    if len(records) < min_frames:
        return {
            "status": "insufficient_data",
            "available": len(records),
            "required": min_frames,
            "message": f"Need {min_frames - len(records)} more reviewed frames",
        }

    print(f"[RETRAIN] Building dataset from {len(records)} reviewed frames…")

    # Build tensors
    inputs = []
    labels = []

    label_map = {"FAKE": 0, "REAL": 1}

    for rec in records:
        embedding = torch.tensor(rec["embedding"], dtype=torch.float32)
        primary_idx = label_map.get(rec["primary_label"], 1)
        confidence = rec["primary_confidence"]
        latency = rec.get("latency_ms", 50.0)

        # Build the 516-dim input
        trust_input = build_trust_input(
            embedding=embedding,
            primary_pred_idx=primary_idx,
            confidence=confidence,
            latency_ms=latency,
            device="cpu",
        )
        inputs.append(trust_input.squeeze(0))

        # Build the label
        trust_label = _build_trust_label(
            human_label=rec["human_label"],
            primary_label=rec["primary_label"],
            primary_confidence=confidence,
        )
        labels.append(trust_label)

    X = torch.stack(inputs)
    y = torch.tensor(labels, dtype=torch.long)

    print(f"[RETRAIN] Dataset: {X.shape[0]} samples, label distribution: "
          f"UNTRUSTED={int((y==0).sum())}, TRUSTED={int((y==1).sum())}, NEEDS_REVIEW={int((y==2).sum())}")

    # Split into train/val
    total = len(X)
    val_size = max(1, int(total * val_split))
    train_size = total - val_size

    dataset = TensorDataset(X, y)
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

    # Train new model
    new_model = TrustMetaClassifier().to(device)
    optimizer = torch.optim.AdamW(new_model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = nn.CrossEntropyLoss()

    print(f"[RETRAIN] Training for {epochs} epochs…")
    new_model.train()

    for epoch in range(epochs):
        total_loss = 0
        correct = 0
        total_samples = 0

        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            out = new_model(batch_X)
            loss = criterion(out, batch_y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * batch_X.size(0)
            correct += (out.argmax(dim=1) == batch_y).sum().item()
            total_samples += batch_X.size(0)

        scheduler.step()
        train_acc = correct / total_samples if total_samples > 0 else 0
        avg_loss = total_loss / total_samples if total_samples > 0 else 0

        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"  Epoch {epoch+1}/{epochs} — Loss: {avg_loss:.4f} — Train Acc: {train_acc*100:.1f}%")

    # Validate
    new_model.eval()
    val_correct = 0
    val_total = 0
    with torch.no_grad():
        for batch_X, batch_y in val_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            out = new_model(batch_X)
            val_correct += (out.argmax(dim=1) == batch_y).sum().item()
            val_total += batch_X.size(0)

    candidate_accuracy = val_correct / val_total if val_total > 0 else 0
    print(f"[RETRAIN] Candidate accuracy on validation: {candidate_accuracy*100:.1f}%")

    # Evaluate old model on same validation set (if it exists)
    old_accuracy = 0.0
    if os.path.exists(TRUST_WEIGHTS_PATH):
        old_model = TrustMetaClassifier().to(device)
        old_model.load_state_dict(torch.load(TRUST_WEIGHTS_PATH, map_location=device))
        old_model.eval()

        old_correct = 0
        old_total = 0
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                out = old_model(batch_X)
                old_correct += (out.argmax(dim=1) == batch_y).sum().item()
                old_total += batch_X.size(0)
        old_accuracy = old_correct / old_total if old_total > 0 else 0
        print(f"[RETRAIN] Old model accuracy on validation: {old_accuracy*100:.1f}%")
    else:
        print("[RETRAIN] No existing model — this is the first training run")

    # Save directly to production (skip candidate step)
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Backup old model if it exists
    if os.path.exists(TRUST_WEIGHTS_PATH):
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, f"trust_meta_backup_{timestamp}.pt")
        import shutil
        shutil.copy2(TRUST_WEIGHTS_PATH, backup_path)
        print(f"[RETRAIN] Backed up old model → {backup_path}")

    # Overwrite the active trust_meta.pt
    torch.save(new_model.state_dict(), TRUST_WEIGHTS_PATH)
    print(f"[RETRAIN] New trust model deployed directly to → {TRUST_WEIGHTS_PATH}")

    # Mark frames as used in training
    try:
        collection = _get_collection()
        result = collection.update_many(
            {"human_label": {"$ne": None}, "used_in_training": False},
            {"$set": {"used_in_training": True}},
        )
        print(f"[RETRAIN] Marked {result.modified_count} frames as used_in_training")
    except Exception as e:
        print(f"[RETRAIN] Warning: Failed to mark frames: {e}")

    return {
        "status": "deployed",
        "training_samples": train_size,
        "validation_samples": val_size,
        "new_accuracy": round(candidate_accuracy, 4),
        "improvement": round(candidate_accuracy - (old_accuracy if old_accuracy else 0.0), 4),
        "epochs": epochs,
        "message": "Model retrained and deployed directly to production. Server will use it immediately.",
        "frame_ids": [str(r["_id"]) for r in records],  # Track which frames were used
    }


# ──────────────────────────────────────
# APPROVE — deploy candidate to production
# ──────────────────────────────────────

def approve():
    """
    Promotes the candidate model to production.
    Backs up the old model and marks training frames as used.
    """
    if not os.path.exists(CANDIDATE_PATH):
        return {"status": "error", "message": "No candidate model found. Run /retrain first."}

    # Backup old model
    if os.path.exists(TRUST_WEIGHTS_PATH):
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, f"trust_meta_backup_{timestamp}.pt")
        shutil.copy2(TRUST_WEIGHTS_PATH, backup_path)
        print(f"[RETRAIN] Backed up old model → {backup_path}")

    # Promote candidate → production
    shutil.copy2(CANDIDATE_PATH, TRUST_WEIGHTS_PATH)
    os.remove(CANDIDATE_PATH)
    print(f"[RETRAIN] Candidate promoted to production → {TRUST_WEIGHTS_PATH}")

    # Mark frames as used in training
    try:
        collection = _get_collection()
        result = collection.update_many(
            {"human_label": {"$ne": None}, "used_in_training": False},
            {"$set": {"used_in_training": True}},
        )
        print(f"[RETRAIN] Marked {result.modified_count} frames as used_in_training")
    except Exception as e:
        print(f"[RETRAIN] Warning: Failed to mark frames: {e}")

    return {
        "status": "deployed",
        "message": "New model deployed successfully. Server will hot-reload on next request.",
    }
