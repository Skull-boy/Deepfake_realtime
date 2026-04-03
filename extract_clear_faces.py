# ─────────────────────────────────────────────────────────────────────────────
# extract_clear_faces.py
#
# PURPOSE: Extract HIGH-QUALITY faces from custom videos in my_videos/
#          with sharpness filtering (Laplacian), brightness checks,
#          and better MTCNN settings.
#
# HOW TO RUN FROM NOTEBOOK:
#   Add a new cell and type:   %run extract_clear_faces.py
#
# VIDEO FOLDER STRUCTURE (drop your videos here):
#   my_videos/real/   ← real person videos  (or just flat my_videos/*.mp4 = all real)
#   my_videos/fake/   ← deepfake videos     (add when ready)
#
# OUTPUT:
#   my_data/real/  ← clear face crops from real videos
#   my_data/fake/  ← clear face crops from fake videos
# ─────────────────────────────────────────────────────────────────────────────

import os
import cv2
import glob
import random
import torch
import numpy as np
from PIL import Image
from tqdm import tqdm

# ── Try importing MTCNN (auto-install if missing) ────────────────────────────
try:
    from facenet_pytorch import MTCNN
except ImportError:
    import subprocess, sys
    print("Installing facenet-pytorch...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "facenet-pytorch", "-q"])
    from facenet_pytorch import MTCNN

# ─────────────────────────────────────────────────────────────────────────────
# ── SETTINGS ─────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

MY_VIDEOS_DIR       = r'my_videos'         # Root folder for your custom videos
MY_DATA_DIR         = r'my_data'           # Where extracted faces are saved

FACE_SIZE           = 299                  # Match the model's input
MARGIN              = 30                   # Extra pixels around face (vs 20 before)
MIN_FACE_SIZE       = 60                   # Min face px — rejects tiny/far faces
FRAMES_PER_VIDEO    = 40                   # More frames for custom videos (was 20)
SHARPNESS_THRESHOLD = 80.0                 # Laplacian variance — below = blurry (skip)
MIN_BRIGHTNESS      = 40                   # Min mean pixel brightness (0-255)
MAX_BRIGHTNESS      = 220                  # Max mean pixel brightness (0-255)
SKIP_IF_EXISTS      = True                 # Skip already-extracted videos

VIDEO_EXTS          = ('*.mp4', '*.avi', '*.mov', '*.mkv', '*.MP4')

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"\n[extract_clear_faces] Device: {device}")
print(f"[extract_clear_faces] Face size: {FACE_SIZE}  |  Margin: {MARGIN}  |  Min face: {MIN_FACE_SIZE}px")
print(f"[extract_clear_faces] Sharpness threshold: {SHARPNESS_THRESHOLD}  |  Brightness: [{MIN_BRIGHTNESS}, {MAX_BRIGHTNESS}]")

# ── MTCNN with improved settings ─────────────────────────────────────────────
mtcnn = MTCNN(
    image_size=FACE_SIZE,
    keep_all=False,
    min_face_size=MIN_FACE_SIZE,
    device=device,
    post_process=False,
    margin=MARGIN,
    thresholds=[0.7, 0.8, 0.9],   # More conservative — fewer false positives
    factor=0.709,
)

# ─────────────────────────────────────────────────────────────────────────────
# ── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

def is_sharp(frame_bgr, threshold=SHARPNESS_THRESHOLD):
    """Laplacian variance — high = sharp, low = blurry."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var() >= threshold


def is_well_lit(frame_bgr, lo=MIN_BRIGHTNESS, hi=MAX_BRIGHTNESS):
    """Reject too-dark or overexposed frames."""
    mean_val = frame_bgr.mean()
    return lo <= mean_val <= hi


def collect_videos(folder):
    """Recursively collect all video files under folder."""
    videos = []
    for ext in VIDEO_EXTS:
        videos.extend(glob.glob(os.path.join(folder, '**', ext), recursive=True))
    return sorted(videos)


def find_video_sources():
    """
    Determine video sources and their labels.
    Priority:
      1. my_videos/real/ subfolder → label 'real'
      2. my_videos/fake/ subfolder → label 'fake'
      3. Flat my_videos/*.mp4       → label 'real'  (backward compatible)
    """
    sources = {}

    real_subdir = os.path.join(MY_VIDEOS_DIR, 'real')
    fake_subdir = os.path.join(MY_VIDEOS_DIR, 'fake')

    if os.path.isdir(real_subdir) or os.path.isdir(fake_subdir):
        # Subfolder mode
        if os.path.isdir(real_subdir):
            vids = collect_videos(real_subdir)
            if vids:
                sources['real'] = vids
                print(f"[INFO] Found real subfolder: {len(vids)} video(s)")
        if os.path.isdir(fake_subdir):
            vids = collect_videos(fake_subdir)
            if vids:
                sources['fake'] = vids
                print(f"[INFO] Found fake subfolder: {len(vids)} video(s)")
    else:
        # Flat mode — treat all as real
        vids = collect_videos(MY_VIDEOS_DIR)
        if vids:
            sources['real'] = vids
            print(f"[INFO] Flat mode (no subfolders): {len(vids)} video(s) → treated as REAL")
        else:
            print(f"[WARN] No videos found in {MY_VIDEOS_DIR}")

    return sources


def extract_faces_from_video(vpath, label, out_dir, done_set):
    """
    Extract clear, sharp, well-lit faces from a single video.
    Returns number of face images saved.
    """
    if SKIP_IF_EXISTS and vpath in done_set:
        return 0

    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(vpath)
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps      = cap.get(cv2.CAP_PROP_FPS) or 25

    if n_frames < 1:
        cap.release()
        done_set.add(vpath)
        return 0

    # Spread sample indices evenly across the video duration
    step = max(1, n_frames // FRAMES_PER_VIDEO)
    sample_idx = set(range(0, n_frames, step)[:FRAMES_PER_VIDEO])

    vid_stem   = os.path.splitext(os.path.basename(vpath))[0]
    saved      = 0
    skipped_blur = 0
    skipped_light = 0
    skipped_noface = 0
    frame_no   = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_no in sample_idx:
            # ── Quality filters ─────────────────────────────────────────────
            if not is_sharp(frame):
                skipped_blur += 1
                frame_no += 1
                continue

            if not is_well_lit(frame):
                skipped_light += 1
                frame_no += 1
                continue

            # ── MTCNN face detection ─────────────────────────────────────────
            pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            try:
                face_tensor = mtcnn(pil_img)
            except Exception:
                face_tensor = None

            if face_tensor is None:
                skipped_noface += 1
                frame_no += 1
                continue

            # ── Save face ────────────────────────────────────────────────────
            face_np  = face_tensor.permute(1, 2, 0).byte().cpu().numpy()
            face_pil = Image.fromarray(face_np)
            save_path = os.path.join(out_dir, f'{vid_stem}_f{frame_no:06d}.jpg')
            face_pil.save(save_path, quality=97)   # High quality JPEG
            saved += 1

        frame_no += 1

    cap.release()
    done_set.add(vpath)

    print(f"   ✓ {os.path.basename(vpath)}: "
          f"saved={saved}  blurry={skipped_blur}  dark/bright={skipped_light}  no_face={skipped_noface}")
    return saved


# ─────────────────────────────────────────────────────────────────────────────
# ── MAIN EXTRACTION ──────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

def run_extraction():
    if not os.path.isdir(MY_VIDEOS_DIR):
        print(f"[ERROR] my_videos/ directory not found at: {os.path.abspath(MY_VIDEOS_DIR)}")
        return

    sources = find_video_sources()
    if not sources:
        print("[WARN] No video sources found. Nothing to extract.")
        return

    done_set = set()  # Track processed videos
    total_saved = {'real': 0, 'fake': 0}
    grand_total = 0

    for label, video_list in sources.items():
        out_dir = os.path.join(MY_DATA_DIR, label)
        os.makedirs(out_dir, exist_ok=True)

        print(f"\n{'='*60}")
        print(f"Processing [{label.upper()}] — {len(video_list)} video(s) → {out_dir}")
        print(f"{'='*60}")

        n = 0
        for vpath in tqdm(video_list, desc=f"[{label}]", unit="video"):
            n += extract_faces_from_video(vpath, label, out_dir, done_set)

        total_saved[label] = n
        grand_total += n

    print(f"\n{'='*60}")
    print(f"[DONE] Clear Face Extraction Complete!")
    print(f"  Real faces saved : {total_saved.get('real', 0)}")
    print(f"  Fake faces saved : {total_saved.get('fake', 0)}")
    print(f"  Grand total      : {grand_total}")
    print(f"  Output directory : {os.path.abspath(MY_DATA_DIR)}")
    print(f"{'='*60}")
    print(f"\n✅ Now run finetune_model.py to update best_model.pt!")


# ─────────────────────────────────────────────────────────────────────────────
# Run directly or via %run extract_clear_faces.py in Jupyter
# ─────────────────────────────────────────────────────────────────────────────
run_extraction()
