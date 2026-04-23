"""
Deepfake Detection API — real-time interview frame analysis
with Trust Meta-Classifier middleware + GradCAM + Temporal + TTA
+ Frequency Domain Analysis + Session Reports + Performance Optimizations.

Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import io, base64, time, uuid
import torch
import torch.nn as nn
import numpy as np
import tempfile
import os
import json
import urllib.request
import traceback
try:
    import cv2
except ImportError:
    pass

from PIL import Image
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from torchvision import transforms
from facenet_pytorch import InceptionResnetV1, fixed_image_standardization, MTCNN

# ──────────────────────────────────────
# Trust Meta-Classifier imports
# ──────────────────────────────────────
from trust_model import (
    load_trust_model,
    build_trust_input,
    predict_trust,
)
from frame_store import save_frame_record, get_review_stats

# ──────────────────────────────────────
# Game-Changer modules (additive)
# ──────────────────────────────────────
from gradcam import generate_gradcam_heatmap
from temporal_analyzer import TemporalAnalyzer
from tta import predict_with_tta

# ──────────────────────────────────────
# Priority 4-6: Frequency, Reports, Performance
# ──────────────────────────────────────
from frequency_analyzer import analyze_frequency
from session_report import generate_session_report, list_sessions
from performance import FrameDeduplicator

WEIGHTS_PATH = "../models/best_model.pt"
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE     = 299
CONF_THRESH  = 0.60
print(f"[SERVER] Device: {DEVICE}")

class DeepfakeClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = InceptionResnetV1(classify=False, pretrained='vggface2').to(DEVICE)
        self.head = nn.Sequential(
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.4),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(0.3),
            nn.Linear(128, 2)
        ).to(DEVICE)
    def forward(self, x):
        return self.head(self.backbone(x))

model = DeepfakeClassifier()
model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
model.eval()
print(f"[SERVER] Primary model loaded")

# ──────────────────────────────────────
# Initialize Temporal Analyzer (singleton)
# ──────────────────────────────────────
temporal_analyzer = TemporalAnalyzer()
print(f"[SERVER] Temporal Analyzer initialized")

# ──────────────────────────────────────
# Initialize Frame Deduplicator (performance)
# ──────────────────────────────────────
frame_deduplicator = FrameDeduplicator(threshold=0.97, ttl_seconds=10.0)
print(f"[SERVER] Frame Deduplicator initialized")

# ──────────────────────────────────────
# Load Trust Meta-Classifier
# ──────────────────────────────────────
trust_model, TRUST_COLD_START = load_trust_model(device=str(DEVICE))

mtcnn = MTCNN(image_size=IMG_SIZE, keep_all=False, min_face_size=40,
              device=DEVICE, post_process=False, margin=20)

transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    fixed_image_standardization,
])

CLASS_NAMES = {0: "FAKE", 1: "REAL"}

app = FastAPI(title="Deepfake Detection API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ──────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────

class FrameRequest(BaseModel):
    image_b64: str
    session_id: Optional[str] = None  # Optional: groups frames from one live session

class ProcessRequest(BaseModel):
    documentId: str
    fileUrl: str
    mediaType: str
    callbackUrl: str

class PredictionResponse(BaseModel):
    label: str
    confidence: float
    uncertain: bool
    face_detected: bool
    latency_ms: float
    # Trust meta-classifier fields (additive — frontend can ignore)
    trust_verdict: str = "TRUSTED"
    trust_score: float = 1.0
    # ── GradCAM explainability (additive) ──
    heatmap_b64: Optional[str] = None
    # ── Temporal consistency analysis (additive) ──
    temporal_consistency: float = 1.0
    temporal_anomaly: bool = False
    temporal_drift: float = 0.0
    temporal_details: str = "stable"
    # ── TTA adversarial robustness (additive) ──
    tta_confidence: Optional[float] = None
    tta_agreement: float = 1.0
    tta_label: Optional[str] = None
    # ── Frequency domain analysis (additive) ──
    spectral_score: float = 0.5
    spectral_anomaly: bool = False
    high_freq_energy: float = 0.0
    spectral_details: str = "unavailable"
    # ── Performance dedup (additive) ──
    dedup_cache_hit: bool = False

# ──────────────────────────────────────
# Background media processing (unchanged)
# ──────────────────────────────────────

def process_media_task(req: ProcessRequest):
    try:
        req_download = urllib.request.Request(req.fileUrl, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req_download)
        content = response.read()

        preds = []
        confs = []

        if req.mediaType == 'video':
            fd, temp_path = tempfile.mkstemp(suffix=".mp4")
            with os.fdopen(fd, 'wb') as f:
                f.write(content)
            
            cap = cv2.VideoCapture(temp_path)
            frame_count = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_count += 1
                if frame_count % 30 == 0:
                    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    face_tensor = mtcnn(img)
                    if face_tensor is not None:
                        face_pil = Image.fromarray(face_tensor.permute(1,2,0).byte().cpu().numpy())
                        inp = transform(face_pil).unsqueeze(0).to(DEVICE)
                        with torch.no_grad():
                            probs = torch.softmax(model(inp), dim=1)[0]
                            pred  = int(torch.argmax(probs))
                            conf  = float(probs[pred])
                        preds.append(pred)
                        confs.append(conf)
            cap.release()
            os.remove(temp_path)

            if not preds:
                raise Exception("No face detected in video")
            avg_pred = int(round(sum(preds)/len(preds)))
            avg_conf = sum(confs)/len(confs)
            final_pred = avg_pred
            final_conf = avg_conf

        else: # image
            img = Image.open(io.BytesIO(content)).convert("RGB")
            face_tensor = mtcnn(img)
            if face_tensor is None:
                raise Exception("No face detected")
            face_pil = Image.fromarray(face_tensor.permute(1,2,0).byte().cpu().numpy())
            inp = transform(face_pil).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                probs = torch.softmax(model(inp), dim=1)[0]
                pred  = int(torch.argmax(probs))
                conf  = float(probs[pred])
            final_pred = pred
            final_conf = conf

        label = CLASS_NAMES[final_pred]

        # Send callback
        payload = json.dumps({
            "documentId": req.documentId,
            "result": {"label": label, "confidence": final_conf}
        }).encode('utf-8')
        cb_req = urllib.request.Request(req.callbackUrl, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        urllib.request.urlopen(cb_req)
        print(f"[PROCESS] Done process for {req.documentId}")

    except Exception as e:
        traceback.print_exc()
        print(f"[PROCESS] Error processing {req.documentId}: {e}")
        try:
            payload = json.dumps({
                "documentId": req.documentId,
                "result": {"error": str(e)}
            }).encode('utf-8')
            cb_req = urllib.request.Request(req.callbackUrl, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
            urllib.request.urlopen(cb_req)
        except Exception as cb_err:
            print(f"[PROCESS] Callback error for {req.documentId}: {cb_err}")

@app.post("/process")
def process_media(req: ProcessRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_media_task, req)
    return {"message": "Processing started"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(DEVICE),
        "trust_cold_start": TRUST_COLD_START,
        "capabilities": {
            "gradcam": True,
            "temporal_analysis": True,
            "tta_robustness": True,
            "trust_meta_classifier": not TRUST_COLD_START,
            "frequency_domain": True,
            "session_reports": True,
            "frame_deduplication": True,
        },
        "active_temporal_sessions": len(temporal_analyzer._sessions),
        "dedup_cache_sessions": frame_deduplicator.active_sessions,
    }

# ──────────────────────────────────────
# /predict — with Trust Meta-Classifier
# ──────────────────────────────────────

@app.post("/predict", response_model=PredictionResponse)
def predict(req: FrameRequest, background_tasks: BackgroundTasks):
    global TRUST_COLD_START

    t0 = time.perf_counter()
    session_id = req.session_id or f"session_{uuid.uuid4().hex[:12]}"

    # Decode image
    try:
        raw_bytes = base64.b64decode(req.image_b64)
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad image: {e}")

    # Detect face
    face_tensor = mtcnn(img)
    if face_tensor is None:
        latency = round((time.perf_counter() - t0) * 1000, 1)
        return PredictionResponse(
            label="UNKNOWN", confidence=0.0,
            uncertain=True, face_detected=False,
            latency_ms=latency,
            trust_verdict="UNTRUSTED", trust_score=0.0,
        )

    # Prepare input
    face_pil = Image.fromarray(face_tensor.permute(1, 2, 0).byte().cpu().numpy())
    inp = transform(face_pil).unsqueeze(0).to(DEVICE)

    # ── Step 0: Frame Deduplication (performance optimization) ──
    dedup_result = None
    try:
        dedup_result = frame_deduplicator.check(session_id, face_pil)
    except Exception as e:
        print(f"[PREDICT] Dedup check error (non-fatal): {e}")

    if dedup_result is not None:
        # Cache hit — skip all inference
        latency = round((time.perf_counter() - t0) * 1000, 1)
        return PredictionResponse(
            label=dedup_result.get("label", "UNKNOWN"),
            confidence=dedup_result.get("confidence", 0.0),
            uncertain=dedup_result.get("uncertain", False),
            face_detected=True,
            latency_ms=latency,
            trust_verdict=dedup_result.get("trust_verdict", "TRUSTED"),
            trust_score=dedup_result.get("trust_score", 1.0),
            heatmap_b64=dedup_result.get("heatmap_b64"),
            temporal_consistency=dedup_result.get("temporal_consistency", 1.0),
            temporal_anomaly=dedup_result.get("temporal_anomaly", False),
            temporal_drift=dedup_result.get("temporal_drift", 0.0),
            temporal_details=dedup_result.get("temporal_details", "stable"),
            tta_confidence=dedup_result.get("tta_confidence"),
            tta_agreement=dedup_result.get("tta_agreement", 1.0),
            tta_label=dedup_result.get("tta_label"),
            spectral_score=dedup_result.get("spectral_score", 0.5),
            spectral_anomaly=dedup_result.get("spectral_anomaly", False),
            high_freq_energy=dedup_result.get("high_freq_energy", 0.0),
            spectral_details=dedup_result.get("spectral_details", "unavailable"),
            dedup_cache_hit=True,
        )

    # ── Step 1: Primary model inference (split backbone + head) ──
    with torch.no_grad():
        embedding = model.backbone(inp)             # 512-dim face embedding
        logits = model.head(embedding)               # classification logits
        probs = torch.softmax(logits, dim=1)[0]
        pred = int(torch.argmax(probs))
        conf = float(probs[pred])

    latency = round((time.perf_counter() - t0) * 1000, 1)

    # ── Step 2: Trust Meta-Classifier ──
    trust_input = build_trust_input(
        embedding=embedding[0],
        primary_pred_idx=pred,
        confidence=conf,
        latency_ms=latency,
        device=str(DEVICE),
    )
    trust_result = predict_trust(trust_model, trust_input, cold_start=TRUST_COLD_START)

    # ── Step 3: GradCAM Heatmap (explainability) ──
    heatmap_b64 = None
    try:
        heatmap_b64 = generate_gradcam_heatmap(model, inp, pred, device=str(DEVICE))
    except Exception as e:
        print(f"[PREDICT] GradCAM error (non-fatal): {e}")

    # ── Step 4: Temporal Consistency Analysis ──
    temporal_result = {
        "consistency": 1.0, "anomaly": False,
        "drift": 0.0, "details": "stable",
    }
    try:
        temporal_result = temporal_analyzer.analyze(session_id, embedding[0])
    except Exception as e:
        print(f"[PREDICT] Temporal error (non-fatal): {e}")

    # ── Step 5: Test-Time Augmentation (adversarial robustness) ──
    tta_result = {"tta_confidence": None, "tta_agreement": 1.0, "tta_label": None}
    try:
        tta_data = predict_with_tta(face_pil, model, transform, DEVICE)
        tta_result = {
            "tta_confidence": tta_data["tta_confidence"],
            "tta_agreement": tta_data["tta_agreement"],
            "tta_label": tta_data["tta_label"],
        }
    except Exception as e:
        print(f"[PREDICT] TTA error (non-fatal): {e}")

    # ── Step 5.5: Frequency Domain Analysis ──
    freq_result = {
        "spectral_score": 0.5, "high_freq_energy": 0.0,
        "spectral_anomaly": False, "spectral_details": "unavailable",
    }
    try:
        freq_result = analyze_frequency(face_pil)
    except Exception as e:
        print(f"[PREDICT] Frequency analysis error (non-fatal): {e}")

    # ── Step 6: Save frame record in background (fire-and-forget) ──
    # Convert frame to JPEG bytes for storage
    frame_buffer = io.BytesIO()
    img.save(frame_buffer, format="JPEG", quality=75)
    frame_jpeg = frame_buffer.getvalue()

    background_tasks.add_task(
        save_frame_record,
        session_id=session_id,
        frame_bytes=frame_jpeg,
        primary_label=CLASS_NAMES[pred],
        primary_confidence=conf,
        face_detected=True,
        latency_ms=latency,
        embedding_list=embedding[0].cpu().tolist(),
        trust_verdict=trust_result["trust_verdict"],
        trust_score=trust_result["trust_score"],
    )

    # ── Step 7: Cache result for dedup ──
    dedup_cache_data = {
        "label": CLASS_NAMES[pred],
        "confidence": round(conf, 3),
        "uncertain": (conf < CONF_THRESH),
        "trust_verdict": trust_result["trust_verdict"],
        "trust_score": trust_result["trust_score"],
        "heatmap_b64": heatmap_b64,
        "temporal_consistency": temporal_result.get("consistency", 1.0),
        "temporal_anomaly": temporal_result.get("anomaly", False),
        "temporal_drift": temporal_result.get("drift", 0.0),
        "temporal_details": temporal_result.get("details", "stable"),
        "tta_confidence": tta_result.get("tta_confidence"),
        "tta_agreement": tta_result.get("tta_agreement", 1.0),
        "tta_label": tta_result.get("tta_label"),
        "spectral_score": freq_result.get("spectral_score", 0.5),
        "spectral_anomaly": freq_result.get("spectral_anomaly", False),
        "high_freq_energy": freq_result.get("high_freq_energy", 0.0),
        "spectral_details": freq_result.get("spectral_details", "unavailable"),
    }
    try:
        frame_deduplicator.store(session_id, face_pil, dedup_cache_data)
    except Exception as e:
        print(f"[PREDICT] Dedup store error (non-fatal): {e}")

    # ── Step 8: Return response (backward-compatible + new fields) ──
    return PredictionResponse(
        label=CLASS_NAMES[pred],
        confidence=round(conf, 3),
        uncertain=(conf < CONF_THRESH),
        face_detected=True,
        latency_ms=latency,
        trust_verdict=trust_result["trust_verdict"],
        trust_score=trust_result["trust_score"],
        # Game-changer fields
        heatmap_b64=heatmap_b64,
        temporal_consistency=temporal_result.get("consistency", 1.0),
        temporal_anomaly=temporal_result.get("anomaly", False),
        temporal_drift=temporal_result.get("drift", 0.0),
        temporal_details=temporal_result.get("details", "stable"),
        tta_confidence=tta_result.get("tta_confidence"),
        tta_agreement=tta_result.get("tta_agreement", 1.0),
        tta_label=tta_result.get("tta_label"),
        # Frequency domain fields
        spectral_score=freq_result.get("spectral_score", 0.5),
        spectral_anomaly=freq_result.get("spectral_anomaly", False),
        high_freq_energy=freq_result.get("high_freq_energy", 0.0),
        spectral_details=freq_result.get("spectral_details", "unavailable"),
        dedup_cache_hit=False,
    )


# ──────────────────────────────────────
# Session Report Endpoints
# ──────────────────────────────────────

@app.get("/sessions")
def get_sessions(limit: int = Query(default=50, le=200)):
    """List recent sessions with summary stats."""
    return list_sessions(limit=limit)

@app.get("/sessions/{session_id}/report")
def get_session_report(session_id: str):
    """Generate a comprehensive forensic report for a specific session."""
    report = generate_session_report(session_id)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])
    return report

# ──────────────────────────────────────
# Retraining Endpoints
# ──────────────────────────────────────

@app.get("/retrain/status")
def retrain_status():
    """Returns review/training statistics."""
    stats = get_review_stats()
    stats["cold_start"] = TRUST_COLD_START
    stats["min_frames_for_training"] = 50
    stats["ready_to_train"] = stats["available_for_training"] >= 50
    return stats

@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    """Triggers retraining of the trust meta-classifier."""
    try:
        from retrain_trust_model import retrain
        result = retrain(device=str(DEVICE))
        
        # Hot-reload the newly saved model so it applies instantly
        global trust_model, TRUST_COLD_START
        trust_model, TRUST_COLD_START = load_trust_model(device=str(DEVICE))
        result["hot_reloaded"] = True
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Retrain failed: {e}")

@app.post("/retrain/approve")
def approve_retrain():
    """Promotes the candidate model to production."""
    global trust_model, TRUST_COLD_START
    try:
        from retrain_trust_model import approve
        result = approve()

        # Hot-reload the new model
        trust_model, TRUST_COLD_START = load_trust_model(device=str(DEVICE))
        result["hot_reloaded"] = True
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Approve failed: {e}")