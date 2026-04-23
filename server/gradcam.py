"""
GradCAM — Gradient-weighted Class Activation Mapping for DeepfakeClassifier.

Generates a heatmap overlay showing which facial regions the model
focuses on when making its REAL/FAKE prediction.

Usage (from main.py):
    from gradcam import generate_gradcam_heatmap
    heatmap_b64 = generate_gradcam_heatmap(model, inp_tensor, pred_idx, device)

The heatmap is returned as a base64-encoded PNG string that the
frontend can overlay on the original face crop.
"""

import io
import base64

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image


class GradCAM:
    """
    GradCAM for InceptionResnetV1 + classification head.

    Hooks into the backbone's last block (block8) to capture
    activations and gradients, then computes a class-discriminative
    heatmap.
    """

    def __init__(self, model, target_layer_name="block8"):
        self.model = model
        self.activations = None
        self.gradients = None
        self._hooks = []

        # Find the target layer in the backbone
        target_layer = None
        for name, module in model.backbone.named_modules():
            if name == target_layer_name:
                target_layer = module
                break

        if target_layer is None:
            # Fallback: use the last conv2d in the backbone
            for module in reversed(list(model.backbone.modules())):
                if isinstance(module, torch.nn.Conv2d):
                    target_layer = module
                    break

        if target_layer is not None:
            self._hooks.append(
                target_layer.register_forward_hook(self._save_activation)
            )
            self._hooks.append(
                target_layer.register_full_backward_hook(self._save_gradient)
            )

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, class_idx):
        """
        Generate a GradCAM heatmap for the given class index.

        Args:
            input_tensor: (1, 3, H, W) preprocessed face tensor
            class_idx:    int — the predicted class (0=FAKE, 1=REAL)

        Returns:
            numpy array of shape (H, W) with values in [0, 1],
            or None if hooks failed.
        """
        self.model.eval()

        # Enable gradients temporarily for GradCAM
        input_tensor = input_tensor.clone().requires_grad_(True)

        # Forward pass through backbone
        embedding = self.model.backbone(input_tensor)
        logits = self.model.head(embedding)

        if self.activations is None:
            return None

        # Backward pass for the target class
        self.model.zero_grad()
        one_hot = torch.zeros_like(logits)
        one_hot[0, class_idx] = 1.0
        logits.backward(gradient=one_hot, retain_graph=False)

        if self.gradients is None:
            return None

        # Compute weights: global average pool of gradients
        weights = self.gradients.mean(dim=[2, 3], keepdim=True)  # (1, C, 1, 1)

        # Weighted combination of activation maps
        cam = (weights * self.activations).sum(dim=1, keepdim=True)  # (1, 1, h, w)
        cam = F.relu(cam)  # Only positive contributions

        # Normalize to [0, 1]
        cam = cam.squeeze()
        if cam.max() > 0:
            cam = cam / cam.max()

        # Resize to input image size
        cam_np = cam.cpu().numpy()
        cam_resized = np.array(
            Image.fromarray((cam_np * 255).astype(np.uint8)).resize(
                (input_tensor.shape[3], input_tensor.shape[2]),
                Image.BILINEAR,
            )
        ).astype(np.float32) / 255.0

        return cam_resized

    def cleanup(self):
        """Remove hooks to prevent memory leaks."""
        for hook in self._hooks:
            hook.remove()
        self._hooks.clear()


def _apply_colormap(heatmap_np, colormap="jet"):
    """
    Apply a colormap to a [0,1] heatmap array.
    Returns an RGBA PIL image where alpha = heatmap intensity.

    Uses a manual jet-like colormap to avoid matplotlib dependency.
    """
    h, w = heatmap_np.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    for i in range(h):
        for j in range(w):
            v = heatmap_np[i, j]
            # Jet-like colormap
            if v < 0.25:
                r, g, b = 0, int(v * 4 * 255), 255
            elif v < 0.5:
                r, g, b = 0, 255, int((0.5 - v) * 4 * 255)
            elif v < 0.75:
                r, g, b = int((v - 0.5) * 4 * 255), 255, 0
            else:
                r, g, b = 255, int((1.0 - v) * 4 * 255), 0

            alpha = int(v * 180)  # Semi-transparent overlay
            rgba[i, j] = [r, g, b, alpha]

    return Image.fromarray(rgba, "RGBA")


def _apply_colormap_vectorized(heatmap_np):
    """
    Fast vectorized jet-like colormap application.
    Returns an RGBA PIL image.
    """
    h, w = heatmap_np.shape
    v = heatmap_np

    r = np.zeros_like(v)
    g = np.zeros_like(v)
    b = np.zeros_like(v)

    # Blue → Cyan (0 - 0.25)
    mask = v < 0.25
    r[mask] = 0
    g[mask] = v[mask] * 4 * 255
    b[mask] = 255

    # Cyan → Green (0.25 - 0.5)
    mask = (v >= 0.25) & (v < 0.5)
    r[mask] = 0
    g[mask] = 255
    b[mask] = (0.5 - v[mask]) * 4 * 255

    # Green → Yellow (0.5 - 0.75)
    mask = (v >= 0.5) & (v < 0.75)
    r[mask] = (v[mask] - 0.5) * 4 * 255
    g[mask] = 255
    b[mask] = 0

    # Yellow → Red (0.75 - 1.0)
    mask = v >= 0.75
    r[mask] = 255
    g[mask] = (1.0 - v[mask]) * 4 * 255
    b[mask] = 0

    alpha = (v * 180).astype(np.uint8)

    rgba = np.stack([
        r.astype(np.uint8),
        g.astype(np.uint8),
        b.astype(np.uint8),
        alpha,
    ], axis=-1)

    return Image.fromarray(rgba, "RGBA")


def generate_gradcam_heatmap(model, input_tensor, pred_idx, device="cpu"):
    """
    High-level API: generate a base64-encoded GradCAM heatmap PNG.

    Args:
        model:        DeepfakeClassifier instance
        input_tensor: (1, 3, 299, 299) preprocessed face tensor
        pred_idx:     int — predicted class index (0=FAKE, 1=REAL)
        device:       str — torch device

    Returns:
        str: base64-encoded PNG of the RGBA heatmap overlay,
             or None if generation failed.
    """
    cam = GradCAM(model)
    try:
        heatmap = cam.generate(input_tensor, pred_idx)
        if heatmap is None:
            return None

        # Apply colormap
        heatmap_img = _apply_colormap_vectorized(heatmap)

        # Encode to base64 PNG
        buffer = io.BytesIO()
        heatmap_img.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return b64
    except Exception as e:
        print(f"[GRADCAM] Error generating heatmap: {e}")
        return None
    finally:
        cam.cleanup()
