/**
 * AdvancedAnalyticsPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows Temporal Consistency + TTA Robustness + Trust Meta-Classifier
 * in a compact, premium analytics panel.
 *
 * Props:
 *   prediction — the full prediction response object from /predict
 *   isActive   — whether analysis is currently running
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import { Activity, ShieldCheck, Brain, Waves, AlertTriangle, Fingerprint } from 'lucide-react';

/**
 * Small progress ring SVG component.
 */
function MiniRing({ value, color, size = 32 }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, value)));

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export default function AdvancedAnalyticsPanel({ prediction, isActive = false }) {
  if (!prediction || !isActive) return null;

  const {
    temporal_consistency = 1,
    temporal_anomaly = false,
    temporal_drift = 0,
    temporal_details = 'stable',
    tta_confidence,
    tta_agreement = 1,
    tta_label,
    trust_verdict = 'TRUSTED',
    trust_score = 1,
    confidence = 0,
    label = 'UNKNOWN',
  } = prediction;

  const consistencyPct = (temporal_consistency * 100).toFixed(0);
  const driftPct = (temporal_drift * 100).toFixed(1);
  const agreementPct = (tta_agreement * 100).toFixed(0);

  // Color logic
  const consistencyColor = temporal_consistency > 0.9 ? '#6366f1'
    : temporal_consistency > 0.75 ? '#f59e0b' : '#ef4444';

  const agreementColor = tta_agreement > 0.8 ? '#6366f1'
    : tta_agreement > 0.6 ? '#f59e0b' : '#ef4444';

  const trustColor = trust_verdict === 'TRUSTED' ? '#6366f1'
    : trust_verdict === 'NEEDS_REVIEW' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Section Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 2,
      }}>
        <Brain size={11} color="#818cf8" />
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: '#818cf8', fontWeight: 700,
        }}>
          Advanced AI Analytics
        </span>
      </div>

      {/* ── Temporal Consistency ── */}
      <div style={{
        padding: '12px 14px', borderRadius: 14,
        border: temporal_anomaly
          ? '1px solid rgba(239,68,68,0.25)'
          : '1px solid rgba(255,255,255,0.06)',
        background: temporal_anomaly
          ? 'rgba(239,68,68,0.04)'
          : 'rgba(255,255,255,0.02)',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Waves size={11} color={consistencyColor} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#d4d4d8' }}>
              Temporal Consistency
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MiniRing value={temporal_consistency} color={consistencyColor} size={24} />
            <span style={{
              fontSize: 14, fontWeight: 800, color: consistencyColor,
              fontFamily: 'Syne, sans-serif',
            }}>
              {consistencyPct}%
            </span>
          </div>
        </div>

        {/* Details row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 600 }}>
              Drift
            </span>
            <p style={{
              fontSize: 12, fontWeight: 600, margin: '2px 0 0',
              color: temporal_drift > 0.15 ? '#ef4444' : '#71717a',
            }}>
              {driftPct}%
            </p>
          </div>
          <div style={{ flex: 2 }}>
            <span style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </span>
            <p style={{
              fontSize: 11, fontWeight: 500, margin: '2px 0 0',
              color: temporal_anomaly ? '#ef4444' : '#71717a',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {temporal_anomaly && <AlertTriangle size={10} color="#ef4444" />}
              {temporal_details}
            </p>
          </div>
        </div>
      </div>

      {/* ── TTA Robustness ── */}
      {tta_confidence !== null && tta_confidence !== undefined && (
        <div style={{
          padding: '12px 14px', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Fingerprint size={11} color={agreementColor} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#d4d4d8' }}>
                TTA Robustness
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MiniRing value={tta_agreement} color={agreementColor} size={24} />
              <span style={{
                fontSize: 14, fontWeight: 800, color: agreementColor,
                fontFamily: 'Syne, sans-serif',
              }}>
                {agreementPct}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 600 }}>
                TTA Conf.
              </span>
              <p style={{ fontSize: 12, fontWeight: 600, margin: '2px 0 0', color: '#a1a1aa' }}>
                {(tta_confidence * 100).toFixed(1)}%
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 600 }}>
                Consensus
              </span>
              <p style={{
                fontSize: 12, fontWeight: 600, margin: '2px 0 0',
                color: tta_label === 'FAKE' ? '#ef4444' : '#6366f1',
              }}>
                {tta_label}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', fontWeight: 600 }}>
                Agreement
              </span>
              <p style={{
                fontSize: 12, fontWeight: 600, margin: '2px 0 0',
                color: agreementColor,
              }}>
                {agreementPct}%
              </p>
            </div>
          </div>

          {/* Mismatch warning */}
          {tta_label && tta_label !== label && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 8,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertTriangle size={10} color="#f59e0b" />
              <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 500 }}>
                TTA disagrees with primary model ({label} vs {tta_label})
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Trust Meta-Classifier ── */}
      <div style={{
        padding: '10px 14px', borderRadius: 14,
        border: `1px solid ${trustColor}20`,
        background: `${trustColor}06`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={11} color={trustColor} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#d4d4d8' }}>
              Trust Verdict
            </span>
          </div>
          <div style={{
            padding: '3px 10px', borderRadius: 999,
            background: `${trustColor}15`,
            border: `1px solid ${trustColor}30`,
            fontSize: 10, fontWeight: 700, color: trustColor,
            letterSpacing: '0.05em',
          }}>
            {trust_verdict}
          </div>
        </div>
      </div>

    </div>
  );
}
