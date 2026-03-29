"""
Deepfake Detection API — real-time interview frame analysis
Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""

import io, time, os, tempfile, pathlib
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from torchvision import transforms
from facenet_pytorch import InceptionResnetV1, fixed_image_standardization, MTCNN
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────
WEIGHTS_PATH   = "../models/deepfake_model_weights.pt"
DEVICE         = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE       = 299
CONF_THRESH    = 0.60
MONGO_URI      = os.getenv("MONGO_URI")
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET_NAME", "deepFake")

print(f"[SERVER] Device: {DEVICE}")

# ── Model definition (must match training Cell 4 exactly) ─────────
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


# ── Load weights ──────────────────────────────────────────────────
model = DeepfakeClassifier()
model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
model.eval()
print(f"[SERVER] Model loaded from {WEIGHTS_PATH}")

# ── MTCNN face detector ───────────────────────────────────────────
mtcnn = MTCNN(
    image_size=IMG_SIZE, keep_all=False, min_face_size=40,
    device=DEVICE, post_process=False, margin=20
)

# ── Transform (same as eval_transform in training) ────────────────
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    fixed_image_standardization,
])

CLASS_NAMES = {0: "FAKE", 1: "REAL"}

# ── MongoDB client (lazy init) ────────────────────────────────────
_mongo_collection = None

def get_collection():
    global _mongo_collection
    if _mongo_collection is None:
        if not MONGO_URI:
            raise RuntimeError("MONGO_URI not set in server/.env")
        import pymongo
        client = pymongo.MongoClient(MONGO_URI)
        # Mongoose model 'MediaAnalysis' → collection 'mediaanalyses'
        _mongo_collection = client["deepfake"]["mediaanalyses"]
    return _mongo_collection

# ── FastAPI app ───────────────────────────────────────────────────
app = FastAPI(title="Deepfake Detection API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Shared inference helper ───────────────────────────────────────
def run_inference_on_image(img: Image.Image):
    """Run MTCNN face detect + model on a PIL Image.
    Returns (label, confidence, face_detected).
    """
    face_tensor = mtcnn(img)
    if face_tensor is None:
        return "UNKNOWN", 0.0, False

    face_pil = Image.fromarray(face_tensor.permute(1, 2, 0).byte().cpu().numpy())
    inp = transform(face_pil).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        probs = torch.softmax(model(inp), dim=1)[0]
        pred  = int(torch.argmax(probs))
        conf  = float(probs[pred])

    return CLASS_NAMES[pred], round(conf, 3), True


# ── Response models ───────────────────────────────────────────────
class PredictionResponse(BaseModel):
    label: str
    confidence: float
    uncertain: bool
    face_detected: bool
    latency_ms: float

class ProcessRequest(BaseModel):
    documentId: str


# ══════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok", "device": str(DEVICE)}


# ── /predict — live webcam frames (multipart form-data) ──────────
@app.post("/predict", response_model=PredictionResponse)
async def predict(chunk: UploadFile = File(...)):
    """
    Accepts multipart/form-data with field 'chunk' (JPEG/PNG blob).
    Called every 2 seconds from the live webcam tab via Node backend.
    """
    t0 = time.perf_counter()
    try:
        img_bytes = await chunk.read()
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad image data: {e}")

    label, conf, face_detected = run_inference_on_image(img)

    return PredictionResponse(
        label=label,
        confidence=conf,
        uncertain=(conf < CONF_THRESH),
        face_detected=face_detected,
        latency_ms=round((time.perf_counter() - t0) * 1000, 1),
    )


# ── /process — async upload flow (image or video) ─────────────────
@app.post("/process")
async def process(req: ProcessRequest):
    """
    Called by Node backend after a user uploads a file.
    1. Fetches document from MongoDB by documentId.
    2. Downloads the media file from its Supabase public URL.
    3. Runs inference:
       - Image  → single face detection + classification.
       - Video  → sample 1 frame/second, majority-vote over all frames.
    4. Updates MongoDB document: status='completed', result={label, confidence}.
    """
    import httpx
    from bson import ObjectId

    # ── 1. Fetch MongoDB document ─────────────────────────────────
    try:
        collection = get_collection()
        doc = collection.find_one({"_id": ObjectId(req.documentId)})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DB error / bad documentId: {e}")

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in MongoDB")

    file_url   = doc.get("fileUrl")
    media_type = doc.get("mediaType", "image")

    if not file_url:
        raise HTTPException(status_code=400, detail="Document has no fileUrl")

    # ── 2. Download media from Supabase public URL ────────────────
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            media_bytes = resp.content
    except Exception as e:
        collection.update_one(
            {"_id": ObjectId(req.documentId)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"Failed to download from Supabase: {e}")

    # ── 3. Run inference ──────────────────────────────────────────
    try:
        if media_type == "image":
            img = Image.open(io.BytesIO(media_bytes)).convert("RGB")
            label, conf, face_detected = run_inference_on_image(img)

        elif media_type == "video":
            import cv2

            # Write bytes to a temp file so OpenCV can open it
            suffix = pathlib.Path(file_url.split("?")[0]).suffix or ".mp4"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(media_bytes)
                tmp_path = tmp.name

            predictions = []
            face_detected = False
            try:
                cap = cv2.VideoCapture(tmp_path)
                fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
                # Sample one frame every second
                frame_interval = max(1, int(fps))
                frame_idx = 0

                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if frame_idx % frame_interval == 0:
                        rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        pil_img = Image.fromarray(rgb)
                        lbl, c, detected = run_inference_on_image(pil_img)
                        if detected:
                            predictions.append((lbl, c))
                            face_detected = True
                    frame_idx += 1
            finally:
                cap.release()
                os.unlink(tmp_path)

            if not predictions:
                label, conf = "UNKNOWN", 0.0
            else:
                fake_votes = sum(1 for lbl, _ in predictions if lbl == "FAKE")
                label = "FAKE" if fake_votes > len(predictions) / 2 else "REAL"
                conf  = round(sum(c for _, c in predictions) / len(predictions), 3)

        else:
            label, conf, face_detected = "UNKNOWN", 0.0, False

    except Exception as e:
        collection.update_one(
            {"_id": ObjectId(req.documentId)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    # ── 4. Update MongoDB with result ─────────────────────────────
    collection.update_one(
        {"_id": ObjectId(req.documentId)},
        {"$set": {
            "status": "completed",
            "result": {"label": label, "confidence": conf},
        }}
    )

    print(f"[PROCESS] {req.documentId} → {label} ({conf:.1%}) [{media_type}]")

    return {
        "documentId": req.documentId,
        "label": label,
        "confidence": conf,
        "face_detected": face_detected,
    }