/**
 * ScreenShareCapture.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 1 — Core Screen Capture Component
 *
 * Handles `getDisplayMedia()` screen sharing, exposes a `captureFrame()` helper
 * that returns a base64 JPEG of the current video frame, and passes the full
 * MediaStream (video + audio) back to the parent via callbacks.
 *
 * IMPORTANT:
 *  - Requires HTTPS or localhost (browser security requirement).
 *  - Audio is captured with `audio: true` but is NOT sent to /predict.
 *    The full stream is forwarded via `onStreamStarted(stream)` so the parent
 *    can hold the audio track for future audio-deepfake detection.
 *  - This component owns stream lifecycle — always stops tracks on unmount.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props:
 *   showPreview       {boolean}  — Whether to render the live screen preview <video>
 *   onFrameCaptured   {(base64: string) => void}  — Called each time captureFrame() fires
 *   onStreamStarted   {(stream: MediaStream) => void}  — Called when share begins (full stream)
 *   onStreamStopped   {() => void}  — Called when share ends (user stop OR track ended by OS)
 *   onError           {(err: string) => void}  — Called on getDisplayMedia or capture error
 *
 * Ref methods (via forwardRef):
 *   captureFrame()    {() => string | null}  — Returns base64 JPEG of the current frame
 *   stopStream()      {() => void}  — Programmatically stop the stream
 */
const ScreenShareCapture = forwardRef(function ScreenShareCapture(
  { showPreview = true, onFrameCaptured, onStreamStarted, onStreamStopped, onError, prediction, isAnalyzing },
  ref
) {
  const videoRef = useRef(null);   // <video> playing the screen stream
  const canvasRef = useRef(null);   // hidden <canvas> for frame extraction
  const streamRef = useRef(null);   // holds the live MediaStream

  const [isSharing, setIsSharing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [httpsWarning, setHttpsWarning] = useState(false);

  // ── Check browser support on mount ────────────────────────────────────────
  useEffect(() => {
    const supported = !!navigator.mediaDevices?.getDisplayMedia;
    if (!supported) {
      setIsSupported(false);
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setHttpsWarning(true);
    }
    // onError intentionally excluded — it's a stable prop callback, not state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop all tracks and notify parent ─────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    onStreamStopped?.();
  }, [onStreamStopped]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // ── captureFrame — draws current video frame to canvas, returns base64 ────
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) return null;  // not ready
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;  // no frame yet

    // Match canvas to current video resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Return as base64 JPEG (strip the data:... prefix for the AI server)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];

    onFrameCaptured?.(base64);
    return base64;
  }, [onFrameCaptured]);

  // ── Start screen share ─────────────────────────────────────────────────────
  const startShare = useCallback(async () => {
    if (!isSupported) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30 },  // smooth preview
          displaySurface: 'window',    // hint to prefer window picker (not tab/screen)
        },
        audio: true,   // audio captured — forwarded to parent for future audio deepfake detection
      });

      streamRef.current = stream;

      // Attach video tracks to the preview element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;  // mute preview locally to avoid echo
      }

      setIsSharing(true);
      onStreamStarted?.(stream);  // parent receives the full stream (incl. audio)

      // Listen for OS-level stop (user clicks "Stop Sharing" in browser toolbar)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopStream();
      });

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        onError?.('Screen share permission denied. Please allow screen sharing and try again.');
      } else if (err.name === 'NotSupportedError') {
        onError?.('Screen sharing is not supported in this browser.');
      } else {
        onError?.(`Failed to start screen share: ${err.message}`);
      }
    }
  }, [isSupported, onStreamStarted, onError, stopStream]);

  // ── Expose captureFrame + stopStream to parent via ref ────────────────────
  useImperativeHandle(ref, () => ({
    captureFrame,
    stopStream,
  }), [captureFrame, stopStream]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── HTTPS Warning ── */}
      {httpsWarning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 500 }}>
          <span>⚠️</span>
          <span>Screen sharing requires HTTPS. It will work on localhost during development.</span>
        </div>
      )}

      {/* ── Browser Not Supported ── */}
      {!isSupported && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 500 }}>
          <span>❌</span>
          <span>Screen capture is not supported in this browser. Please use Chrome or Edge.</span>
        </div>
      )}

      {/* ── Screen Share Preview Video ── */}
      {showPreview && (
        <div
          style={{
            position: 'relative',
            borderRadius: 18,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.07)',
            background: '#0a0a0a',
            aspectRatio: '16/9',
            width: '100%',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: isSharing ? 'block' : 'none' }}
          />
          {!isSharing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <div className="float-anim">
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                  }}
                >
                  🖥️
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#52525b', fontWeight: 500 }}>Screen is not shared</p>
              <p style={{ fontSize: 11, color: '#3f3f46' }}>Share your call window below to begin</p>
            </div>
          )}

          {/* Scan laser */}
          {isSharing && isAnalyzing && <div className="scan-anim" />}

          {/* LIVE badge */}
          {isSharing && (
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 12px',
                borderRadius: 999,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ position: 'relative', width: 8, height: 8, display: 'flex' }}>
                <span
                  className="pulse-dot"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: '#ef4444',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                  }}
                />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>
                LIVE
              </span>
            </div>
          )}

          {/* Result overlay on video */}
          {prediction && isSharing && (
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                right: 14,
                padding: '10px 14px',
                borderRadius: 12,
                backdropFilter: 'blur(12px)',
                border: prediction.label === 'FAKE'
                  ? '1px solid rgba(239,68,68,0.35)'
                  : '1px solid rgba(99,102,241,0.35)',
                background: prediction.label === 'FAKE'
                  ? 'rgba(20,5,5,0.75)'
                  : 'rgba(5,20,12,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {prediction.label === 'FAKE'
                  ? <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>🚫</span>
                  : <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}>✅</span>}
                <span
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    color: prediction.label === 'FAKE' ? '#ef4444' : '#6366f1',
                  }}
                >
                  {prediction.label}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {((prediction.confidence || 0) * 100).toFixed(1)}% confident
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Hidden Canvas for frame extraction (never rendered visually) ── */}
      <canvas
        id="screen-capture-offscreen-canvas"
        ref={canvasRef}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {!isSharing ? (
          <button
            onClick={startShare}
            disabled={!isSupported}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#a1a1aa',
              fontSize: 13,
              fontWeight: 500,
              cursor: isSupported ? 'pointer' : 'not-allowed',
              opacity: isSupported ? 1 : 0.4,
              transition: 'all 0.15s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => isSupported && (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => isSupported && (e.currentTarget.style.color = '#a1a1aa')}
          >
            🖥️ Share Interview Window
          </button>
        ) : (
          <button
            onClick={stopStream}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            ⏹ Stop Sharing
          </button>
        )}
      </div>
    </div>
  );
});

export default ScreenShareCapture;