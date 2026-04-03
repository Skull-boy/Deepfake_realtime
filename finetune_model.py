import os
import random
import shutil
import datetime
import torch
import torch.nn as nn
from torch import optim
from torch.utils.data import DataLoader, Dataset, ConcatDataset
from torchvision import datasets, transforms
from facenet_pytorch import InceptionResnetV1, fixed_image_standardization
from PIL import Image
from tqdm import tqdm
import glob

# ─────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────

CUSTOM_DIR       = 'my_data'                   # Custom extracted faces (real/ and fake/ inside)
ORIGINAL_DIR     = 'extracted_faces/train'     # Original Kaggle DFD 67k dataset
MODEL_PATH       = 'models/best_model.pt'      # Load FROM here (starting point)
OUTPUT_PATH      = 'models/best_model.pt'      # Save TO here  ← directly updates server model
LOG_PATH         = 'models/finetune_log.txt'

EPOCHS           = 8                           # More epochs for clean custom data
BATCH_SIZE       = 32
LR               = 3e-5                        # Very low LR — don't break original weights
IMAGE_SIZE       = 299
WEIGHT_DECAY     = 1e-4

# Mix-in from original DFD to prevent catastrophic forgetting
NUM_FAKE_SAMPLES = 500
NUM_REAL_SAMPLES = 200


# ─────────────────────────────────────────────────────────
# DATASET HELPERS
# ─────────────────────────────────────────────────────────

class SubsetDataset(Dataset):
    """Loads a random subset of images from a folder with a fixed label."""
    EXTS = ('*.jpg', '*.jpeg', '*.png', '*.webp')

    def __init__(self, folder, label, num_samples=99999, transform=None):
        self.label     = label
        self.transform = transform
        self.paths     = []

        for ext in self.EXTS:
            self.paths.extend(glob.glob(os.path.join(folder, '**', ext), recursive=True))

        if len(self.paths) > num_samples:
            self.paths = random.sample(self.paths, num_samples)

        print(f"  [{('FAKE','REAL')[label]}] {len(self.paths):>5} images  ← {folder}")

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        img = Image.open(self.paths[idx]).convert('RGB')
        if self.transform:
            img = self.transform(img)
        return img, self.label


# ─────────────────────────────────────────────────────────
# MODEL DEFINITION  (must match Deepfake_Detection.ipynb)
# ─────────────────────────────────────────────────────────

class DeepfakeClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = InceptionResnetV1(classify=False, pretrained='vggface2')
        self.head = nn.Sequential(
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.4),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(0.3),
            nn.Linear(128, 2)
        )

    def forward(self, x):
        return self.head(self.backbone(x))


# ─────────────────────────────────────────────────────────
# MAIN FINETUNING FUNCTION
# ─────────────────────────────────────────────────────────

def finetune_model():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    use_amp = device.type == 'cuda'
    print(f"\n{'='*60}")
    print(f"  Deepfake Model Finetuner")
    print(f"  Device : {device}  |  AMP : {use_amp}")
    print(f"{'='*60}\n")

    # ── Safety check ──────────────────────────────────────
    if not os.path.exists(MODEL_PATH):
        print(f"[ERROR] Base model not found at {MODEL_PATH}")
        print("  → Train in Deepfake_Detection.ipynb first!")
        return

    # ── Auto-backup existing best_model.pt ────────────────
    os.makedirs(os.path.dirname(OUTPUT_PATH) if os.path.dirname(OUTPUT_PATH) else 'models', exist_ok=True)
    timestamp  = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = MODEL_PATH.replace('.pt', f'_backup_{timestamp}.pt')
    shutil.copy2(MODEL_PATH, backup_path)
    print(f"[BACKUP] {MODEL_PATH} → {backup_path}")

    # ─── Transforms ───────────────────────────────────────
    train_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(degrees=6),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
        transforms.RandomPerspective(distortion_scale=0.1, p=0.2),
        transforms.ToTensor(),
        fixed_image_standardization,
    ])

    # ─── Build dataset ───────────────────────────────────
    print("\n[DATA] Building finetuning dataset...")
    datasets_list = []

    # Custom data — ALL of it (from my_data/real/ and my_data/fake/)
    custom_real = os.path.join(CUSTOM_DIR, 'real')
    custom_fake = os.path.join(CUSTOM_DIR, 'fake')

    custom_real_count = 0
    custom_fake_count = 0

    if os.path.isdir(custom_real):
        ds = SubsetDataset(custom_real, label=1, transform=train_transform)
        if len(ds) > 0:
            datasets_list.append(ds)
            custom_real_count = len(ds)
        else:
            print(f"  [WARN] my_data/real/ is empty — run extract_clear_faces.py first!")
    else:
        print(f"  [WARN] my_data/real/ not found")

    if os.path.isdir(custom_fake):
        ds = SubsetDataset(custom_fake, label=0, transform=train_transform)
        if len(ds) > 0:
            datasets_list.append(ds)
            custom_fake_count = len(ds)
        else:
            print(f"  [INFO] my_data/fake/ is empty (no fake videos extracted yet)")
    else:
        print(f"  [INFO] my_data/fake/ not found (add fake videos to my_videos/fake/ later)")

    if custom_real_count == 0 and custom_fake_count == 0:
        print("\n[ERROR] No custom data found. Run extract_clear_faces.py first!")
        return

    # Original DFD data (subset to prevent catastrophic forgetting)
    orig_fake = os.path.join(ORIGINAL_DIR, 'fake')
    orig_real = os.path.join(ORIGINAL_DIR, 'real')

    if os.path.isdir(orig_fake):
        datasets_list.append(SubsetDataset(orig_fake, label=0, num_samples=NUM_FAKE_SAMPLES, transform=train_transform))
    if os.path.isdir(orig_real):
        datasets_list.append(SubsetDataset(orig_real, label=1, num_samples=NUM_REAL_SAMPLES, transform=train_transform))

    train_dataset = ConcatDataset(datasets_list)
    train_loader  = DataLoader(
        train_dataset, batch_size=BATCH_SIZE,
        shuffle=True, num_workers=0, pin_memory=use_amp
    )

    print(f"\n[DATA] Total finetuning samples : {len(train_dataset):,}")
    print(f"       Custom real               : {custom_real_count}")
    print(f"       Custom fake               : {custom_fake_count}")
    print(f"       DFD mix-in real           : {NUM_REAL_SAMPLES}")
    print(f"       DFD mix-in fake           : {NUM_FAKE_SAMPLES}")

    # ─── Load model ──────────────────────────────────────
    model = DeepfakeClassifier().to(device)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    print(f"\n[MODEL] Loaded: {MODEL_PATH}")

    # Freeze most of backbone — only fine-tune last 2 blocks + head
    UNFREEZE = ('block8', 'block7', 'last_linear', 'last_bn', 'logits')
    frozen = 0
    for name, param in model.backbone.named_parameters():
        if any(u in name for u in UNFREEZE):
            param.requires_grad = True
        else:
            param.requires_grad = False
            frozen += 1

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total     = sum(p.numel() for p in model.parameters())
    print(f"[MODEL] Trainable: {trainable:,}  |  Frozen: {total - trainable:,}")

    # ─── Optimizer / loss ────────────────────────────────
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=WEIGHT_DECAY
    )
    scaler = torch.cuda.amp.GradScaler() if use_amp else None

    # ─── Training loop ───────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"  Starting Finetuning — {EPOCHS} epochs  |  LR={LR}")
    print(f"{'─'*60}\n")

    log_lines = [
        f"Finetune run: {datetime.datetime.now().isoformat()}",
        f"Base model  : {MODEL_PATH}",
        f"Output      : {OUTPUT_PATH}",
        f"Backup      : {backup_path}",
        f"Custom real : {custom_real_count}",
        f"Custom fake : {custom_fake_count}",
        f"DFD fake mix: {NUM_FAKE_SAMPLES}",
        f"DFD real mix: {NUM_REAL_SAMPLES}",
        f"Total       : {len(train_dataset)}",
        f"Epochs      : {EPOCHS}  |  LR: {LR}  |  Batch: {BATCH_SIZE}",
        "─" * 50,
    ]

    best_acc = 0.0
    model.train()

    for epoch in range(1, EPOCHS + 1):
        total_loss = 0.0
        correct    = 0

        pbar = tqdm(train_loader, desc=f"Epoch {epoch}/{EPOCHS}", ncols=80)
        for imgs, labels in pbar:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()

            if use_amp and scaler is not None:
                with torch.autocast(device_type='cuda', dtype=torch.float16):
                    outputs = model(imgs)
                    loss    = criterion(outputs, labels)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                outputs = model(imgs)
                loss    = criterion(outputs, labels)
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * imgs.size(0)
            preds       = torch.argmax(outputs, dim=1)
            correct    += (preds == labels).sum().item()

            pbar.set_postfix({'loss': f'{loss.item():.4f}'})

        epoch_loss = total_loss / len(train_dataset)
        epoch_acc  = correct   / len(train_dataset) * 100

        line = f"Epoch {epoch:02d}/{EPOCHS} | Loss: {epoch_loss:.4f} | Acc: {epoch_acc:.2f}%"
        print(f"\n  {line}")
        log_lines.append(line)

        if epoch_acc > best_acc:
            best_acc = epoch_acc

    # ─── Save directly to best_model.pt ──────────────────
    torch.save(model.state_dict(), OUTPUT_PATH)
    print(f"\n{'='*60}")
    print(f"[SAVED] Finetuned model → {OUTPUT_PATH}")
    print(f"[SAVED] Server will use this model on next restart")
    print(f"[SAVED] Backup at        → {backup_path}")
    print(f"[INFO]  Best training acc: {best_acc:.2f}%")
    print(f"{'='*60}\n")

    log_lines.append("─" * 50)
    log_lines.append(f"Best training acc : {best_acc:.2f}%")
    log_lines.append(f"Saved to          : {OUTPUT_PATH}")
    log_lines.append(f"Backup            : {backup_path}")

    with open(LOG_PATH, 'w') as f:
        f.write('\n'.join(log_lines))
    print(f"[LOG] Training summary saved to {LOG_PATH}")
    print("\n✅ Finetuning complete — restart the FastAPI server to use the updated model!")


if __name__ == '__main__':
    finetune_model()
