"""
Deepfake Detection API — real-time interview frame analysis
with Trust Meta-Classifier middleware.

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
    return {"status": "ok", "device": str(DEVICE), "trust_cold_start": TRUST_COLD_START}

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

    # ── Step 3: Save frame record in background (fire-and-forget) ──
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

    # ── Step 4: Return response (backward-compatible) ──
    return PredictionResponse(
        label=CLASS_NAMES[pred],
        confidence=round(conf, 3),
        uncertain=(conf < CONF_THRESH),
        face_detected=True,
        latency_ms=latency,
        trust_verdict=trust_result["trust_verdict"],
        trust_score=trust_result["trust_score"],
    )


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