"""
realtime_deepfake_detector.py
─────────────────────────────────────────────────────────────────────────────
Real-Time Deepfake Detection for Video Calls / Webcam
With Trust Meta-Classifier Integration
─────────────────────────────────────────────────────────────────────────────

HOW IT WORKS:
  1. Opens your webcam (or any video file)
  2. Uses MTCNN to detect faces in each frame
  3. Crops each face → runs DeepfakeClassifier → gets REAL/FAKE + embedding
  4. Runs Trust Meta-Classifier on embedding → TRUSTED/UNTRUSTED/NEEDS_REVIEW
  5. Overlays bounding box + label + trust verdict on the video stream

USE CASES:
  • Run this alongside Zoom, Google Meet, Teams etc. (window overlay)
  • Can feed into OBS Virtual Camera so your video call shows the analysis

USAGE:
  python realtime_deepfake_detector.py
  python realtime_deepfake_detector.py --model models/best_model.pt
  python realtime_deepfake_detector.py --trust-model models/trust_meta.pt
  python realtime_deepfake_detector.py --source 0              # webcam 0
  python realtime_deepfake_detector.py --source video.mp4      # video file
  python realtime_deepfake_detector.py --threshold 0.65        # confidence threshold

REQUIREMENTS:
  pip install opencv-python facenet-pytorch torch torchvision
─────────────────────────────────────────────────────────────────────────────
"""

import argparse
import os
import sys
import time
import threading
from collections import deque

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F_torch
from facenet_pytorch import InceptionResnetV1, MTCNN, fixed_image_standardization
from PIL import Image
from torchvision import transforms

# Trust Meta-Classifier imports
from server.trust_model import (
    TrustMetaClassifier,
    load_trust_model,
    build_trust_input,
    predict_trust,
    TRUST_WEIGHTS_PATH,
)


# ─────────────────────────────────────────────────────────────────────────────
# Model Architecture  (must match training notebook)
# ─────────────────────────────────────────────────────────────────────────────

class DeepfakeClassifier(nn.Module):
    """
    InceptionResnetV1 backbone + 3-layer classification head.
    Architecture MUST match what was used during training.
    """
    def __init__(self, num_classes: int = 2, device: torch.device = None):
        super().__init__()
        if device is None:
            device = torch.device('cpu')

        self.backbone = InceptionResnetV1(
            classify=False,
            pretrained='vggface2'
        ).to(device)

        self.head = nn.Sequential(
            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.GELU(),
            nn.Dropout(p=0.4),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.Dropout(p=0.3),
            nn.Linear(128, num_classes)
        ).to(device)

    def forward(self, x):
        embeddings = self.backbone(x)
        return self.head(embeddings)


# ─────────────────────────────────────────────────────────────────────────────
# Inference Transform
# ─────────────────────────────────────────────────────────────────────────────

def get_inference_transform(image_size: int = 299):
    return transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        fixed_image_standardization,
    ])


# ─────────────────────────────────────────────────────────────────────────────
# Detector Class
# ─────────────────────────────────────────────────────────────────────────────

class RealtimeDeepfakeDetector:
    """
    Wraps MTCNN face detection + DeepfakeClassifier inference
    + Trust Meta-Classifier into a single real-time detector.

    The Trust Meta-Classifier validates each primary prediction:
      TRUSTED      → primary model's verdict is reliable
      UNTRUSTED    → primary model's verdict is likely wrong
      NEEDS_REVIEW → borderline case, treat with caution
    """

    CLASS_NAMES = {0: 'FAKE', 1: 'REAL'}
    # Color: BGR format for OpenCV
    COLORS = {
        'FAKE': (0, 60, 220),       # Red-ish
        'REAL': (50, 200, 50),      # Green
        'UNKNOWN': (150, 150, 150), # Grey
    }
    TRUST_COLORS = {
        'TRUSTED':      (50, 200, 50),    # Green
        'UNTRUSTED':    (0, 60, 220),      # Red
        'NEEDS_REVIEW': (0, 180, 255),     # Orange/Amber
    }

    def __init__(
        self,
        model_path: str,
        device: torch.device,
        threshold: float = 0.60,
        image_size: int = 299,
        face_min_size: int = 60,
        trust_model_path: str = None,
    ):
        self.device    = device
        self.threshold = threshold

        print(f'[INIT] Loading MTCNN face detector...')
        self.mtcnn = MTCNN(
            keep_all=True,          # detect multiple faces
            device=device,
            min_face_size=face_min_size,
            thresholds=[0.6, 0.7, 0.7],   # detection confidence
            post_process=False,
            select_largest=False,
        )

        print(f'[INIT] Loading DeepfakeClassifier from: {model_path}')
        self.model = DeepfakeClassifier(num_classes=2, device=device)

        if os.path.exists(model_path):
            state = torch.load(model_path, map_location=device, weights_only=False)
            self.model.load_state_dict(state)
            print(f'[OK]   Primary model weights loaded.')
        else:
            print(f'[WARN] Model file not found: {model_path}')
            print(f'       Running with random weights — train first!')

        self.model.eval()
        self.transform = get_inference_transform(image_size)

        # ── Load Trust Meta-Classifier ──
        trust_path = trust_model_path or TRUST_WEIGHTS_PATH
        self.trust_model, self.trust_cold_start = load_trust_model(
            device=str(device)
        )
        if not self.trust_cold_start:
            print(f'[OK]   Trust Meta-Classifier loaded from {trust_path}')
        else:
            print(f'[WARN] Trust Meta-Classifier in COLD START — all predictions default to TRUSTED')

        # Rolling FPS counter
        self._fps_times = deque(maxlen=30)

        print(f'[OK]   Device: {device}  |  Threshold: {threshold}')

    def _classify_face(self, face_pil: Image.Image) -> tuple[str, float, str, float]:
        """
        Run the primary classifier + trust meta-classifier on a single face.

        Returns:
            (label, confidence, trust_verdict, trust_score)
        """
        tensor = self.transform(face_pil).unsqueeze(0).to(self.device)

        with torch.no_grad():
            # Split inference: backbone → embedding, head → logits
            embedding = self.model.backbone(tensor)       # (1, 512)
            logits = self.model.head(embedding)            # (1, 2)
            probs  = torch.softmax(logits, dim=1)[0]

        fake_prob = probs[0].item()
        real_prob = probs[1].item()
        pred_idx  = int(torch.argmax(probs))
        max_prob  = max(fake_prob, real_prob)

        if max_prob < self.threshold:
            label = 'UNKNOWN'
        else:
            label = 'REAL' if real_prob > fake_prob else 'FAKE'

        # ── Trust Meta-Classifier ──
        trust_input = build_trust_input(
            embedding=embedding[0],
            primary_pred_idx=pred_idx,
            confidence=max_prob,
            latency_ms=0.0,  # not meaningful for local realtime
            device=str(self.device),
        )
        trust_result = predict_trust(
            self.trust_model, trust_input, cold_start=self.trust_cold_start
        )

        return label, max_prob, trust_result['trust_verdict'], trust_result['trust_score']

    def process_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """
        Detect faces in a BGR frame, classify each, draw overlays
        with trust meta-classifier verdict.
        Returns the annotated BGR frame.
        """
        t0 = time.perf_counter()

        # Convert BGR → RGB for MTCNN
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        pil_frame = Image.fromarray(frame_rgb)

        # Detect faces
        boxes, probs = self.mtcnn.detect(pil_frame)

        h, w = frame_bgr.shape[:2]

        if boxes is not None:
            for i, (box, det_conf) in enumerate(zip(boxes, probs)):
                if det_conf is None or det_conf < 0.85:
                    continue

                x1, y1, x2, y2 = [int(v) for v in box]
                # Clamp to frame bounds
                x1 = max(0, x1); y1 = max(0, y1)
                x2 = min(w, x2); y2 = min(h, y2)

                if x2 <= x1 or y2 <= y1:
                    continue

                # Crop face and classify (primary + trust)
                face_pil = pil_frame.crop((x1, y1, x2, y2))
                label, conf, trust_verdict, trust_score = self._classify_face(face_pil)

                # ── Determine effective label using trust verdict ──
                # If trust says UNTRUSTED, the primary prediction may be wrong
                if trust_verdict == 'UNTRUSTED' and label != 'UNKNOWN':
                    # Flip the label — trust model learned this prediction is wrong
                    effective_label = 'REAL' if label == 'FAKE' else 'FAKE'
                    color = self.COLORS.get(effective_label, self.COLORS['UNKNOWN'])
                    display_label = effective_label
                elif trust_verdict == 'NEEDS_REVIEW':
                    color = self.TRUST_COLORS['NEEDS_REVIEW']
                    display_label = label
                else:
                    color = self.COLORS.get(label, self.COLORS['UNKNOWN'])
                    display_label = label

                # ── Draw bounding box ──
                thickness = 3 if display_label == 'FAKE' else 2
                cv2.rectangle(frame_bgr, (x1, y1), (x2, y2), color, thickness)

                # ── Draw primary label background (top) ──
                label_text = f'{display_label}  {conf*100:.0f}%'
                font       = cv2.FONT_HERSHEY_DUPLEX
                font_scale = 0.7
                (tw, th_text), baseline = cv2.getTextSize(label_text, font, font_scale, 1)
                cv2.rectangle(frame_bgr,
                              (x1, y1 - th_text - baseline - 8),
                              (x1 + tw + 8, y1),
                              color, -1)  # filled
                cv2.putText(frame_bgr, label_text,
                            (x1 + 4, y1 - baseline - 4),
                            font, font_scale,
                            (255, 255, 255), 1, cv2.LINE_AA)

                # ── Draw trust verdict badge (below bbox) ──
                trust_text = f'{trust_verdict} ({trust_score*100:.0f}%)'
                trust_color = self.TRUST_COLORS.get(trust_verdict, (150, 150, 150))
                font_scale_sm = 0.5
                (tw2, th2), baseline2 = cv2.getTextSize(trust_text, font, font_scale_sm, 1)
                badge_y = y2 + 2
                cv2.rectangle(frame_bgr,
                              (x1, badge_y),
                              (x1 + tw2 + 8, badge_y + th2 + baseline2 + 6),
                              trust_color, -1)
                cv2.putText(frame_bgr, trust_text,
                            (x1 + 4, badge_y + th2 + 3),
                            font, font_scale_sm,
                            (255, 255, 255), 1, cv2.LINE_AA)

                # ── Corner markers for a modern look ──
                self._draw_corners(frame_bgr, x1, y1, x2, y2, color, size=15)

        # FPS
        self._fps_times.append(time.perf_counter() - t0)
        fps = 1.0 / (sum(self._fps_times) / len(self._fps_times)) if self._fps_times else 0

        self._draw_hud(frame_bgr, fps, w, h)
        return frame_bgr

    def _draw_corners(self, img, x1, y1, x2, y2, color, size=15):
        """Draw stylish corner markers."""
        t = 3
        # Top-left
        cv2.line(img, (x1, y1), (x1 + size, y1), color, t)
        cv2.line(img, (x1, y1), (x1, y1 + size), color, t)
        # Top-right
        cv2.line(img, (x2, y1), (x2 - size, y1), color, t)
        cv2.line(img, (x2, y1), (x2, y1 + size), color, t)
        # Bottom-left
        cv2.line(img, (x1, y2), (x1 + size, y2), color, t)
        cv2.line(img, (x1, y2), (x1, y2 - size), color, t)
        # Bottom-right
        cv2.line(img, (x2, y2), (x2 - size, y2), color, t)
        cv2.line(img, (x2, y2), (x2, y2 - size), color, t)

    def _draw_hud(self, img, fps, w, h):
        """Draw HUD overlay (FPS + title + trust status)."""
        overlay = img.copy()
        # Top bar background
        cv2.rectangle(overlay, (0, 0), (w, 38), (20, 20, 20), -1)
        cv2.addWeighted(overlay, 0.6, img, 0.4, 0, img)

        title = 'DEEPFAKE DETECTOR  |  Real-Time + Trust AI'
        cv2.putText(img, title,
                    (10, 25), cv2.FONT_HERSHEY_DUPLEX, 0.65,
                    (200, 200, 200), 1, cv2.LINE_AA)

        # Trust status indicator
        trust_status = 'COLD START' if self.trust_cold_start else 'ACTIVE'
        trust_color = (0, 180, 255) if self.trust_cold_start else (100, 255, 100)
        trust_indicator = f'Trust: {trust_status}'
        (tw_trust, _), _ = cv2.getTextSize(trust_indicator, cv2.FONT_HERSHEY_DUPLEX, 0.5, 1)

        fps_text = f'FPS: {fps:.1f}'
        (tw_fps, _), _ = cv2.getTextSize(fps_text, cv2.FONT_HERSHEY_DUPLEX, 0.55, 1)

        # FPS on the right
        cv2.putText(img, fps_text,
                    (w - tw_fps - 12, 25), cv2.FONT_HERSHEY_DUPLEX, 0.55,
                    (100, 255, 100), 1, cv2.LINE_AA)

        # Trust indicator left of FPS
        cv2.putText(img, trust_indicator,
                    (w - tw_fps - tw_trust - 30, 25), cv2.FONT_HERSHEY_DUPLEX, 0.5,
                    trust_color, 1, cv2.LINE_AA)

        # Bottom legend
        cv2.putText(img, 'Q: Quit  |  S: Screenshot  |  T: Toggle threshold',
                    (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                    (160, 160, 160), 1, cv2.LINE_AA)


# ─────────────────────────────────────────────────────────────────────────────
# Main Loop
# ─────────────────────────────────────────────────────────────────────────────

def run(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'\n[INFO] Device: {device}')
    if device.type == 'cuda':
        print(f'[INFO] GPU: {torch.cuda.get_device_name(0)}')

    detector = RealtimeDeepfakeDetector(
        model_path=args.model,
        device=device,
        threshold=args.threshold,
        image_size=299,
        face_min_size=args.min_face_size,
        trust_model_path=args.trust_model,
    )

    # Open source (webcam index or video file path)
    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f'[ERROR] Cannot open video source: {args.source}')
        sys.exit(1)

    # Set webcam resolution
    if isinstance(source, int):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f'[INFO] Video resolution: {actual_w}×{actual_h}')
    print(f'\n[READY] Press Q to quit | S to save screenshot | T to toggle threshold\n')

    screenshot_count = 0
    threshold_modes  = [0.50, 0.60, 0.65, 0.75]
    threshold_idx    = threshold_modes.index(args.threshold) if args.threshold in threshold_modes else 1

    window_name = 'Deepfake Detector — Press Q to quit'
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, min(actual_w, 1280), min(actual_h, 720))

    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str):   # end of video file
                print('[INFO] Video ended.')
                break
            continue

        annotated = detector.process_frame(frame)
        cv2.imshow(window_name, annotated)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('q') or key == 27:   # Q or Esc
            break
        elif key == ord('s'):
            screenshot_count += 1
            path = f'screenshot_{screenshot_count:04d}.jpg'
            cv2.imwrite(path, annotated)
            print(f'[SAVE] Screenshot saved: {path}')
        elif key == ord('t'):
            threshold_idx = (threshold_idx + 1) % len(threshold_modes)
            detector.threshold = threshold_modes[threshold_idx]
            print(f'[INFO] Threshold changed to: {detector.threshold}')

    cap.release()
    cv2.destroyAllWindows()
    print('[INFO] Detector closed.')


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description='Real-Time Deepfake Detection for Webcam / Video Calls (with Trust AI)'
    )
    p.add_argument('--model',
                   default='models/best_model.pt',
                   help='Path to primary model weights (.pt)')
    p.add_argument('--trust-model',
                   default='models/trust_meta.pt',
                   help='Path to trust meta-classifier weights (.pt)')
    p.add_argument('--source',
                   default='0',
                   help='Webcam index (0, 1, 2…) or path to a video file')
    p.add_argument('--threshold',
                   type=float, default=0.60,
                   help='Minimum confidence to show a prediction (0–1)')
    p.add_argument('--min-face-size',
                   type=int, default=60,
                   help='Minimum face size in pixels for MTCNN detection')
    return p.parse_args()


if __name__ == '__main__':
    args = parse_args()
    run(args)
