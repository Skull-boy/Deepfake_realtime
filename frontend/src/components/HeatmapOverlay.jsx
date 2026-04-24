/**
 * HeatmapOverlay.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GradCAM Explainability Heatmap — shows WHICH facial regions the AI
 * is looking at when making its REAL/FAKE prediction.
 *
 * Props:
 *   heatmapB64  — base64-encoded PNG of RGBA heatmap overlay (from /predict)
 *   label       — "FAKE" | "REAL" — determines border glow color
 *   visible     — boolean toggle
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function HeatmapOverlay({ heatmapB64, label, visible = true }) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  if (!heatmapB64 || !visible) return null;

  const isFake = label === 'FAKE';

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowHeatmap(!showHeatmap); }}
        title={showHeatmap ? 'Hide AI Heatmap' : 'Show AI Heatmap'}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 999,
          border: `1px solid ${isFake ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}`,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          zIndex: 20,
          fontSize: 10,
          fontWeight: 600,
          color: showHeatmap
            ? (isFake ? '#ef4444' : '#6366f1')
            : '#71717a',
          transition: 'all 0.2s ease',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {showHeatmap ? <EyeOff size={10} /> : <Eye size={10} />}
        {showHeatmap ? 'HIDE' : 'SHOW'} AI FOCUS
      </button>

      {/* Heatmap overlay image */}
      {showHeatmap && (
        <img
          src={`data:image/png;base64,${heatmapB64}`}
          alt="GradCAM heatmap"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 10,
            opacity: 0.55,
            mixBlendMode: 'screen',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Legend */}
      {showHeatmap && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 130,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.08)',
            zIndex: 20,
          }}
        >
          <div style={{
            width: 40,
            height: 6,
            borderRadius: 3,
            background: 'linear-gradient(90deg, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF0000)',
          }} />
          <span style={{ fontSize: 9, color: '#a1a1aa', fontWeight: 500 }}>
            Low → High focus
          </span>
        </div>
      )}
    </>
  );
}
