/**
 * FrequencyAnalysisPanel.jsx
 * Displays spectral/frequency domain analysis results from the AI server.
 * Shows spectral score, high-freq energy, and anomaly status.
 */
import React from 'react';
import { Radio } from 'lucide-react';

export default function FrequencyAnalysisPanel({ prediction, isActive }) {
  if (!isActive || !prediction) return null;

  const spectralScore = prediction.spectral_score ?? 0.5;
  const highFreqEnergy = prediction.high_freq_energy ?? 0;
  const spectralAnomaly = prediction.spectral_anomaly ?? false;
  const spectralDetails = prediction.spectral_details ?? 'unavailable';
  const dedupHit = prediction.dedup_cache_hit ?? false;

  const scoreColor = spectralScore >= 0.7 ? '#34d399' : spectralScore >= 0.4 ? '#facc15' : '#ef4444';
  const detailsLabel = {
    natural: 'Natural Spectrum',
    minor_artifacts: 'Minor Artifacts',
    suspicious_spectrum: 'Suspicious',
    gan_signature_detected: 'GAN Signature',
    unavailable: 'Unavailable',
  }[spectralDetails] || spectralDetails;

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 16,
      border: spectralAnomaly
        ? '1px solid rgba(239,68,68,0.2)'
        : '1px solid rgba(255,255,255,0.06)',
      background: spectralAnomaly
        ? 'rgba(239,68,68,0.03)'
        : 'rgba(255,255,255,0.02)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(139,92,246,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Radio size={12} color="#8b5cf6" />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>Frequency Domain</p>
          <p style={{ fontSize: 9, color: '#52525b', marginTop: 1 }}>DCT Spectral Analysis</p>
        </div>
        {dedupHit && (
          <span style={{
            marginLeft: 'auto', fontSize: 8, padding: '2px 6px',
            borderRadius: 6, background: 'rgba(52,211,153,0.1)',
            color: '#34d399', fontWeight: 600, letterSpacing: '0.05em',
          }}>CACHED</span>
        )}
      </div>

      {/* Spectral Score Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#71717a' }}>Spectral Score</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>
            {(spectralScore * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{
          width: '100%', height: 4, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 10, background: scoreColor,
            width: `${spectralScore * 100}%`, transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{
          padding: '8px 10px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <p style={{ fontSize: 9, color: '#52525b', marginBottom: 2 }}>HF Energy</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#d4d4d8' }}>
            {(highFreqEnergy * 100).toFixed(1)}%
          </p>
        </div>
        <div style={{
          padding: '8px 10px', borderRadius: 10,
          border: spectralAnomaly
            ? '1px solid rgba(239,68,68,0.15)'
            : '1px solid rgba(255,255,255,0.05)',
          background: spectralAnomaly
            ? 'rgba(239,68,68,0.05)'
            : 'rgba(255,255,255,0.02)',
        }}>
          <p style={{ fontSize: 9, color: '#52525b', marginBottom: 2 }}>Status</p>
          <p style={{
            fontSize: 11, fontWeight: 600,
            color: spectralAnomaly ? '#ef4444' : '#34d399',
          }}>
            {detailsLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
