/**
 * ConfidenceMeter.jsx
 * ─────────────────────────────────────────────
 * PHASE 2 — Animated confidence progress bar.
 * Color zones: green (>80%), amber (60–80%), red (<60%).
 * ─────────────────────────────────────────────
 * Props:
 *   confidence {number}  0.0 – 1.0
 *   label      {string}  "REAL" | "FAKE" | "UNCERTAIN" | "UNKNOWN" | null
 * ─────────────────────────────────────────────
 */

import React from 'react';

function getBarColor(label, confidence) {
  if (label === 'FAKE') return 'bg-red-500';
  if (label === 'REAL' && confidence > 0.8) return 'bg-emerald-500';
  if (label === 'REAL') return 'bg-emerald-400';
  if (label === 'UNCERTAIN') return 'bg-amber-400';
  return 'bg-slate-500';
}

function getGlowColor(label) {
  if (label === 'FAKE') return 'shadow-[0_0_12px_rgba(239,68,68,0.4)]';
  if (label === 'REAL') return 'shadow-[0_0_12px_rgba(52,211,153,0.4)]';
  if (label === 'UNCERTAIN') return 'shadow-[0_0_12px_rgba(251,191,36,0.4)]';
  return '';
}

export default function ConfidenceMeter({ confidence = 0, label = null }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const color = getBarColor(label, confidence);
  const glow = getGlowColor(label);

  const radius = 36;
  const circum = 2 * Math.PI * radius;
  const strokeDashoffset = label ? circum - (pct / 100) * circum : circum;

  return (
    <div id="confidence-meter" className="w-full flex items-center justify-between gap-6">
      
      {/* Label and Info */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${label === 'FAKE' ? 'bg-red-500' : label === 'REAL' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
          Confidence
        </span>
        <div className="text-3xl font-black tracking-tighter tabular-nums drop-shadow-md">
          {label ? `${pct}%` : '—'}
        </div>
        <div className="text-[10px] text-slate-500 font-medium">
          {label === 'FAKE' ? 'High Risk' : label === 'REAL' ? 'Authentic' : 'Awaiting Frame...'}
        </div>
      </div>

      {/* Circular Progress Ring */}
      <div className="relative flex items-center justify-center">
        {/* Background track */}
        <svg className="w-[100px] h-[100px] transform -rotate-90">
          <circle 
            cx="50" 
            cy="50" 
            r={radius} 
            stroke="currentColor" 
            strokeWidth="8" 
            fill="transparent" 
            className="text-white/5" 
          />
          {/* Animated Fill */}
          <circle 
            cx="50" 
            cy="50" 
            r={radius} 
            stroke="currentColor" 
            strokeWidth="8" 
            fill="transparent" 
            strokeLinecap="round"
            strokeDasharray={circum} 
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-1000 ease-out ${color} ${glow.replace('shadow-[0_0_12px_', 'drop-shadow-[0_0_8px_').replace(')]', ']')}`}
          />
        </svg>

        {/* Center Icon/Label */}
        <div className="absolute inset-0 flex items-center justify-center">
           {label === 'FAKE' && <span className="text-xl animate-pulse">⚠️</span>}
           {label === 'REAL' && <span className="text-xl">✅</span>}
           {(!label || label === 'UNKNOWN') && <span className="text-xl opacity-20">🛡️</span>}
        </div>
      </div>
      
    </div>
  );
}
