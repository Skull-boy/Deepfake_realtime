/**
 * LiveCallDetector.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 3 — Main "Live Interview Detector" page.
 *
 * Orchestrates:
 *   - ScreenShareCapture  →  grabs frames every `scanInterval` ms
 *   - POST /predict       →  FastAPI AI server (port 8000)
 *   - DetectionBadge      →  shows REAL / FAKE / UNCERTAIN
 *   - ConfidenceMeter     →  animated confidence bar
 *   - ScanHistoryLog      →  rolling 20-entry result log
 *   - AlertBanner         →  fires after 3 consecutive FAKEs
 *
 * Environment:
 *   VITE_AI_SERVER_URL  — FastAPI base URL (default: http://localhost:8000)
 *   (VITE_BACKEND_URL is the Node backend — NOT used here; /predict is called directly)
 *
 * Protected files guarantee: This file does NOT touch any .env, backend, or
 * model files. All server communication is via existing /predict endpoint only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Layers } from 'lucide-react';

import ScreenShareCapture from '../components/live-call/ScreenShareCapture';
import ConfidenceMeter from '../components/live-call/ConfidenceMeter';
import ScanHistoryLog from '../components/live-call/ScanHistoryLog';
import AlertBanner from '../components/live-call/AlertBanner';
import StudioHeader from '../components/live-call/StudioHeader';
import StudioSidebar from '../components/live-call/StudioSidebar';

// ─── Constants ───────────────────────────────────────────────────────────────
const AI_SERVER_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';
const MAX_HISTORY = 20;    // rolling log limit
const CONSECUTIVE_THRESHOLD = 3; // # of FAKEs before alert fires

// Scan interval options (ms)
const INTERVAL_OPTIONS = [
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LiveCallDetector() {
  // Screen share capture ref (access captureFrame / stopStream imperatively)
  const captureRef = useRef(null);

  // Polling interval ref
  const intervalRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isCapturing, setIsCapturing] = useState(false);
  const [prediction, setPrediction] = useState(null);    // latest AI result
  const [history, setHistory] = useState([]);       // last MAX_HISTORY results
  const [consecutiveFakes, setConsecutiveFakes] = useState(0);
  const [scanInterval, setScanInterval] = useState(2000);
  const [error, setError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);   // request in-flight
  const [totalScans, setTotalScans] = useState(0);
  const [fakeCount, setFakeCount] = useState(0);

  // ── Core: send one frame to /predict ──────────────────────────────────────
  const runPrediction = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return;

    const base64 = capture.captureFrame();
    if (!base64) return;  // video not ready or no frame

    setIsAnalyzing(true);

    try {
      const response = await fetch(`${AI_SERVER_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: base64 }),
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      // data: { label, confidence, uncertain, face_detected, latency_ms }

      // Resolve the display label
      let displayLabel = data.label;
      if (!data.face_detected) displayLabel = 'UNKNOWN';
      else if (data.uncertain) displayLabel = 'UNCERTAIN';

      const entry = {
        id: generateId(),
        label: displayLabel,
        confidence: data.confidence ?? 0,
        latency_ms: data.latency_ms ?? null,
        timestamp: Date.now(),
      };

      // Update latest prediction
      setPrediction(entry);

      // Update rolling history (max MAX_HISTORY)
      setHistory(prev => {
        const next = [entry, ...prev];
        return next.slice(0, MAX_HISTORY);
      });

      // Track total scans and FAKE count
      setTotalScans(n => n + 1);
      if (displayLabel === 'FAKE') setFakeCount(n => n + 1);

      // Update consecutive FAKE counter
      setConsecutiveFakes(prev => {
        if (displayLabel === 'FAKE') return prev + 1;
        return 0;  // any non-FAKE resets the streak
      });

      // Clear any connection error
      setError(null);

    } catch (err) {
      console.error('[LiveCallDetector] Prediction error:', err);
      setError(err.message || 'Failed to reach the AI server. Is it running on port 8000?');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // ── Start / stop polling loop ──────────────────────────────────────────────
  useEffect(() => {
    if (isCapturing) {
      // Immediate first scan, then interval
      runPrediction();
      intervalRef.current = setInterval(runPrediction, scanInterval);
    } else {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => clearInterval(intervalRef.current);
  }, [isCapturing, scanInterval, runPrediction]);

  // ── Stream lifecycle callbacks (from ScreenShareCapture) ──────────────────
  const handleStreamStarted = useCallback(() => {
    setIsCapturing(true);
    setError(null);
    setConsecutiveFakes(0);
  }, []);

  const handleStreamStopped = useCallback(() => {
    setIsCapturing(false);
    setIsAnalyzing(false);
    setPrediction(null);
    setConsecutiveFakes(0);
  }, []);

  const handleCaptureError = useCallback((msg) => {
    setError(msg);
    setIsCapturing(false);
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const fakeRate = totalScans > 0 ? ((fakeCount / totalScans) * 100).toFixed(0) : '—';

  // ── Dynamic Glowing Container based on Prediction ──
  const previewGlowClass = prediction && isCapturing && prediction.label === 'FAKE'
    ? 'shadow-[0_0_40px_rgba(239,68,68,0.2)] border-red-500/30'
    : prediction && isCapturing && prediction.label === 'REAL'
      ? 'shadow-[0_0_40px_rgba(52,211,153,0.15)] border-emerald-500/20'
      : 'shadow-[0_0_40px_rgba(139,92,246,0.1)] border-white/10';

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="h-screen w-screen bg-[#080808] text-white flex flex-col overflow-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        ::-webkit-scrollbar       { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,.15); border-radius: 10px; }
      `}</style>
      
      <StudioHeader />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        
        <StudioSidebar prediction={prediction} />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '28px 28px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              fontSize: 11,
              color: '#52525b',
            }}
          >
            <Layers size={10} />
            <span>Studio</span>
            <span style={{ color: '#27272a' }}>/</span>
            <span style={{ color: '#34d399' }}>Live Analysis</span>
          </div>

          {/* Page heading */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: '-0.03em',
                color: '#fff',
                marginBottom: 4,
              }}
            >
              Live Stream Analysis
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
              Analyze your call or webcam feed in real-time using AI inference.
            </p>
          </div>

          {/* Alert banner */}
          <div style={{ marginBottom: 18 }}>
            <AlertBanner
              consecutiveFakes={consecutiveFakes}
              threshold={CONSECUTIVE_THRESHOLD}
            />
          </div>

          {/* Split Wrapper */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 280px',
              gap: 18,
              flex: 1,
              minHeight: 0,
              alignItems: 'start',
            }}
          >
            {/* Left: Video & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ScreenShareCapture
                ref={captureRef}
                showPreview={true}
                onStreamStarted={handleStreamStarted}
                onStreamStopped={handleStreamStopped}
                onError={handleCaptureError}
                prediction={prediction}
                isAnalyzing={isAnalyzing}
              />
              
              {/* Error message inline */}
              {error && (
                <div
                  id="live-call-error"
                  className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                  <span className="shrink-0">❌</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Right: How it works / Stats / Widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Controls */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#3f3f46',
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Scan Interval
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {INTERVAL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setScanInterval(opt.value)}
                      disabled={isCapturing}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: scanInterval === opt.value ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        background: scanInterval === opt.value ? 'rgba(52,211,153,0.1)' : 'transparent',
                        color: scanInterval === opt.value ? '#34d399' : '#71717a',
                        cursor: isCapturing ? 'not-allowed' : 'pointer',
                        opacity: isCapturing ? 0.4 : 1,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Embedded ConfidenceMeter logic directly since it needs to fit this specific size well. Or just reuse component. */}
                <ConfidenceMeter
                  confidence={prediction?.confidence ?? 0}
                  label={prediction?.label ?? null}
                />
              </div>

              {/* Stats */}
              {totalScans > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Scans', value: totalScans },
                    { label: 'Fakes', value: fakeCount, color: '#ef4444' },
                    { label: 'Rate', value: `${fakeRate}%` },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 0',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.015)',
                      }}
                    >
                      <span style={{ fontSize: 18, fontWeight: 800, color: stat.color || '#fff', marginBottom: 2 }}>
                        {stat.value}
                      </span>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', color: '#52525b', fontWeight: 600, letterSpacing: '0.05em' }}>
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              <div
                style={{
                  padding: '16px 14px',
                  borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#3f3f46',
                      fontWeight: 600,
                    }}
                  >
                    History
                  </p>
                  {history.length > 0 && (
                    <span style={{ fontSize: 10, color: '#71717a' }}>{history.length}/{MAX_HISTORY}</span>
                  )}
                </div>
                <ScanHistoryLog history={history} />
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
