"""
Frequency Domain Analyzer — DCT/FFT spectral fingerprinting for deepfake detection.

GANs and diffusion models leave characteristic artifacts in the frequency domain
that are invisible in pixel space. This module extracts those signatures and
provides a secondary signal alongside the primary CNN classifier.

Key insight: Real faces have smooth, natural frequency roll-off. GAN-generated
faces exhibit abnormal high-frequency peaks (checkerboard artifacts from
transposed convolutions) or unnatural spectral uniformity (from diffusion
post-processing).

Usage (from main.py):
    from frequency_analyzer import analyze_frequency
    result = analyze_frequency(face_pil_image)
    # result = {
    #   "spectral_score": 0.85,        # 0=fake-like spectrum, 1=natural spectrum
    #   "high_freq_energy": 0.032,     # normalized high-freq energy ratio
    #   "spectral_anomaly": False,     # True if spectrum looks unnatural
    #   "spectral_details": "natural", # human-readable summary
    # }
"""

import numpy as np
from PIL import Image

# ──────────────────────────────────────
# DCT-based frequency analysis
# ──────────────────────────────────────

def _dct_2d(block: np.ndarray) -> np.ndarray:
    """Compute 2D DCT using scipy if available, else numpy approximation."""
    try:
        from scipy.fft import dctn
        return dctn(block, type=2, norm='ortho')
    except ImportError:
        # Fallback: use FFT-based approximation
        from numpy.fft import fft2, fftshift
        return np.abs(fftshift(fft2(block)))


def _compute_azimuthal_average(spectrum_2d: np.ndarray) -> np.ndarray:
    """
    Compute the azimuthal (radial) average of a 2D power spectrum.
    This collapses the 2D spectrum into a 1D curve showing energy vs frequency.
    """
    h, w = spectrum_2d.shape
    cy, cx = h // 2, w // 2
    
    # Build distance matrix from center
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2).astype(int)
    
    max_radius = min(cy, cx)
    radial_profile = np.zeros(max_radius)
    count = np.zeros(max_radius)
    
    for r in range(max_radius):
        mask = dist == r
        radial_profile[r] = spectrum_2d[mask].sum()
        count[r] = mask.sum()
    
    # Avoid division by zero
    count[count == 0] = 1
    return radial_profile / count


def analyze_frequency(face_pil: Image.Image) -> dict:
    """
    Analyze the frequency domain characteristics of a face crop.
    
    Args:
        face_pil: PIL Image of the cropped face (any size, will be resized)
    
    Returns:
        dict with spectral_score, high_freq_energy, spectral_anomaly, spectral_details
    """
    try:
        # Convert to grayscale and resize to standard analysis size
        gray = face_pil.convert('L').resize((256, 256), Image.LANCZOS)
        pixels = np.array(gray, dtype=np.float64) / 255.0
        
        # ── Step 1: Compute 2D DCT/FFT spectrum ──
        spectrum = _dct_2d(pixels)
        power_spectrum = np.abs(spectrum) ** 2
        
        # ── Step 2: Compute radial energy profile ──
        radial = _compute_azimuthal_average(power_spectrum)
        
        if len(radial) < 10:
            return _default_result()
        
        # Normalize
        total_energy = radial.sum()
        if total_energy < 1e-10:
            return _default_result()
        
        radial_norm = radial / total_energy
        
        # ── Step 3: Analyze frequency distribution ──
        n = len(radial_norm)
        low_band = radial_norm[:n // 4].sum()       # 0-25% of spectrum
        mid_band = radial_norm[n // 4:n // 2].sum()  # 25-50%
        high_band = radial_norm[n // 2:].sum()        # 50-100% (high frequencies)
        
        # ── Step 4: Compute spectral slope ──
        # Natural images follow a 1/f^α power law with α ≈ 2.0
        # GAN images deviate from this — either flatter (α < 1.5) or steeper
        log_freqs = np.log(np.arange(1, n) + 1)
        log_power = np.log(radial_norm[1:] + 1e-12)
        
        # Linear regression in log-log space to estimate spectral slope
        if len(log_freqs) > 2:
            coeffs = np.polyfit(log_freqs, log_power, 1)
            spectral_slope = abs(coeffs[0])
        else:
            spectral_slope = 2.0  # default natural slope
        
        # ── Step 5: Detect GAN checkerboard artifacts ──
        # Look for periodic peaks in mid-high frequencies
        if n > 20:
            mid_high = radial_norm[n // 3:]
            if len(mid_high) > 3:
                # Compute local variance (peak detection proxy)
                local_var = np.var(mid_high)
                peak_ratio = np.max(mid_high) / (np.mean(mid_high) + 1e-12)
            else:
                local_var = 0.0
                peak_ratio = 1.0
        else:
            local_var = 0.0
            peak_ratio = 1.0
        
        # ── Step 6: Score computation ──
        # Factors that indicate FAKE-like spectrum:
        #   - Unusually high "high_band" energy (GAN artifacts)
        #   - Spectral slope far from natural (α ≈ 2.0)
        #   - High peak_ratio (periodic artifacts)
        
        # Slope deviation from natural (2.0)
        slope_score = max(0, 1.0 - abs(spectral_slope - 2.0) / 2.0)
        
        # High-frequency energy penalty (real faces have low high-freq energy)
        hf_score = max(0, 1.0 - high_band * 10)  # penalize if high_band > 0.1
        
        # Peak ratio penalty (periodic artifacts)
        peak_score = max(0, 1.0 - (peak_ratio - 3.0) / 10.0) if peak_ratio > 3.0 else 1.0
        
        # Weighted combination
        spectral_score = round(
            0.40 * slope_score + 0.35 * hf_score + 0.25 * peak_score,
            3
        )
        spectral_score = max(0.0, min(1.0, spectral_score))
        
        # ── Step 7: Determine anomaly and details ──
        anomaly = spectral_score < 0.5
        
        if spectral_score >= 0.75:
            details = "natural"
        elif spectral_score >= 0.50:
            details = "minor_artifacts"
        elif spectral_score >= 0.30:
            details = "suspicious_spectrum"
        else:
            details = "gan_signature_detected"
        
        return {
            "spectral_score": spectral_score,
            "high_freq_energy": round(float(high_band), 4),
            "spectral_anomaly": anomaly,
            "spectral_details": details,
        }
        
    except Exception as e:
        print(f"[FREQUENCY] Analysis error: {e}")
        return _default_result()


def _default_result() -> dict:
    """Returns safe default when analysis fails or input is insufficient."""
    return {
        "spectral_score": 0.5,
        "high_freq_energy": 0.0,
        "spectral_anomaly": False,
        "spectral_details": "unavailable",
    }
