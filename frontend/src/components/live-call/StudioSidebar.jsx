import React from 'react';
import { Camera, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StudioSidebar({ prediction }) {
  const isFake = prediction?.label === 'FAKE';
  
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.015)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Mode selector */}
      <div style={{ padding: '20px 14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#3f3f46',
            fontWeight: 600,
            marginBottom: 10,
            paddingLeft: 6,
          }}
        >
          Detection Mode
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 10px',
              borderRadius: 12,
              border: '1px solid rgba(52,211,153,0.2)',
              background: 'rgba(52,211,153,0.07)',
              color: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {/* Active left bar */}
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 2,
                height: 18,
                borderRadius: 10,
                background: '#34d399',
              }}
            />
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(52,211,153,0.12)',
                color: '#34d399',
                flexShrink: 0,
              }}
            >
              <Camera size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1, marginBottom: 3 }}>Live Call</p>
              <p style={{ fontSize: 10, color: '#52525b', lineHeight: 1 }}>Real-time scan</p>
            </div>
            <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#34d399', flexShrink: 0 }} />
          </button>
        </div>
      </div>

      {/* Live result */}
      <div style={{ padding: '16px 14px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#3f3f46',
            fontWeight: 600,
            marginBottom: 10,
            paddingLeft: 6,
          }}
        >
          Last Verdict
        </p>
        <div
          style={{
            borderRadius: 12,
            padding: '12px 14px',
            border: prediction
              ? isFake
                ? '1px solid rgba(239,68,68,0.25)'
                : '1px solid rgba(52,211,153,0.25)'
              : '1px solid rgba(255,255,255,0.06)',
            background: prediction
              ? isFake
                ? 'rgba(239,68,68,0.06)'
                : 'rgba(52,211,153,0.06)'
              : 'rgba(255,255,255,0.02)',
            transition: 'all 0.4s ease',
          }}
        >
          {prediction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isFake
                ? <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                : <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} />}
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    color: isFake ? '#ef4444' : '#34d399',
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {prediction.label}
                </p>
                <p style={{ fontSize: 10, color: '#71717a' }}>
                  {((prediction.confidence || 0) * 100).toFixed(1)}% confidence
                </p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: '#3f3f46', fontStyle: 'italic' }}>Awaiting analysis…</p>
          )}
        </div>
      </div>
    </aside>
  );
}
