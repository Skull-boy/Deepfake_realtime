"""
Deepfake Detection API — real-time interview frame analysis
Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import io, base64, time
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from torchvision import transforms
from facenet_pytorch import InceptionResnetV1, fixed_image_standardization, MTCNN

WEIGHTS_PATH = "../models/deepfake_model_weights.pt"
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
print(f"[SERVER] Model loaded")

mtcnn = MTCNN(image_size=IMG_SIZE, keep_all=False, min_face_size=40,
              device=DEVICE, post_process=False, margin=20)

transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    fixed_image_standardization,
])

CLASS_NAMES = {0: "FAKE", 1: "REAL"}

app = FastAPI(title="Deepfake Detection API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

class FrameRequest(BaseModel):
    image_b64: str

class PredictionResponse(BaseModel):
    label: str
    confidence: float
    uncertain: bool
    face_detected: bool
    latency_ms: float

@app.get("/health")
def health():
    return {"status": "ok", "device": str(DEVICE)}

@app.post("/predict", response_model=PredictionResponse)
def predict(req: FrameRequest):
    t0 = time.perf_counter()
    try:
        img = Image.open(io.BytesIO(base64.b64decode(req.image_b64))).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad image: {e}")
    face_tensor = mtcnn(img)
    if face_tensor is None:
        return PredictionResponse(label="UNKNOWN", confidence=0.0,
                                  uncertain=True, face_detected=False,
                                  latency_ms=round((time.perf_counter()-t0)*1000,1))
    face_pil = Image.fromarray(face_tensor.permute(1,2,0).byte().cpu().numpy())
    inp = transform(face_pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = torch.softmax(model(inp), dim=1)[0]
        pred  = int(torch.argmax(probs))
        conf  = float(probs[pred])
    return PredictionResponse(
        label=CLASS_NAMES[pred], confidence=round(conf,3),
        uncertain=(conf < CONF_THRESH), face_detected=True,
        latency_ms=round((time.perf_counter()-t0)*1000,1)
    )