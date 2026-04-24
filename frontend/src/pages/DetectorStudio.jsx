import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  Camera, CameraOff, UploadCloud, Video, Image as ImageIcon,
  Activity, CheckCircle2, AlertCircle, Zap, Shield,
  ChevronRight, Layers
} from 'lucide-react';
import { io } from 'socket.io-client';
import HeatmapOverlay from '../components/HeatmapOverlay';
import AdvancedAnalyticsPanel from '../components/AdvancedAnalyticsPanel';
import FrequencyAnalysisPanel from '../components/FrequencyAnalysisPanel';

/* ─────────────────────────────────────────────
   BACKEND / SOCKET — DO NOT TOUCH
───────────────────────────────────────────── */
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(backendUrl);

const NAV_ITEMS = [
  { id: 'live', label: 'Live Analysis', icon: Camera, desc: 'Real-time webcam' },
  { id: 'video', label: 'Video Upload', icon: Video, desc: 'MP4, WebM files' },
  { id: 'image', label: 'Image Upload', icon: ImageIcon, desc: 'JPG, PNG files' },
];

export default function DetectorStudio() {
  const navigate = useNavigate();

  /* ── state (unchanged) ── */
  const [activeTab, setActiveTab] = useState('live');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);
  const [livePrediction, setLivePrediction] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  /* ── effects (unchanged) ── */
  useEffect(() => {
    if (activeTab === 'live' && isCameraActive) startCamera();
    else { stopCamera(); setIsLiveAnalyzing(false); }
    return () => stopCamera();
  }, [activeTab, isCameraActive]);

  useEffect(() => {
    let id;
    if (isLiveAnalyzing) id = setInterval(captureAndSendFrame, 2000);
    return () => clearInterval(id);
  }, [isLiveAnalyzing]);

  /* ── camera logic (unchanged) ── */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera denied:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureAndSendFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fd = new FormData();
      fd.append('chunk', blob, 'frame.jpg');
      try {
        const res = await fetch(`${backendUrl}/api/detect`, { method: 'POST', body: fd });
        if (res.ok) setLivePrediction(await res.json());
      } catch (e) { console.error(e); }
    }, 'image/jpeg', 0.8);
  };

  /* ── file handling (unchanged) ── */
  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;
    const filesArray = Array.from(files);
    setSelectedFile(filesArray[0]);
    setSelectedFiles(filesArray);
    setPreviewUrl(URL.createObjectURL(filesArray[0]));
    setUploadResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadResult({ status: 'uploading' });
    const fd = new FormData();
    if (selectedFiles && selectedFiles.length > 0) {
      selectedFiles.forEach(file => fd.append('media', file));
    } else {
      fd.append('media', selectedFile);
    }
    try {
      const res = await fetch(`${backendUrl}/api/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { documentId } = await res.json();
      setUploadResult({ status: 'processing' });
      socket.once(`analysis_complete_${documentId}`, (doc) => {
        setUploadResult({
          status: doc.status || 'completed',
          label: doc.result?.label || 'UNKNOWN',
          confidence: doc.result?.confidence || 0,
          error: doc.result?.error || null,
        });
        setIsUploading(false);
      });
    } catch (err) {
      console.error(err);
      setUploadResult({ status: 'failed' });
      setIsUploading(false);
    }
  };

  /* ── derived (unchanged) ── */
  const isFake = livePrediction?.label === 'FAKE' || uploadResult?.label === 'FAKE';

  /* ─────────────────────────────────────────────
     RENDER — redesigned UI, all logic wired same
  ───────────────────────────────────────────── */
  return (
    <div className="h-screen w-screen bg-black text-gray-200 flex flex-col overflow-hidden relative z-0 font-sans">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-10"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[150px]"></div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes scan-line {
          0%   { top: 0%;   opacity: 1; }
          49%  { top: 100%; opacity: 1; }
          50%  { top: 100%; opacity: 0; }
          51%  { top: 0%;   opacity: 0; }
          100% { top: 100%; opacity: 1; }
        }
        @keyframes pulse-dot {
          0%   { transform: scale(1);   opacity: .8; }
          100% { transform: scale(1.9); opacity: 0;  }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0);    }
          50%      { transform: translateY(-7px);  }
        }
        @keyframes spin-fade {
          to { transform: rotate(360deg); }
        }
        .scan-anim {
          position: absolute; left: 0; width: 100%; height: 1.5px;
          background: linear-gradient(90deg, transparent 0%, #6366f1 50%, transparent 100%);
          box-shadow: 0 0 14px 4px rgba(99,102,241,.5);
          animation: scan-line 2s linear infinite;
        }
        .pulse-dot  { animation: pulse-dot 1.6s ease-out infinite; }
        .float-anim { animation: float-up 3.5s ease-in-out infinite; }
        .spin-anim  { animation: spin-fade 0.8s linear infinite; }

        /* Green shimmer CTA */
        @keyframes shimmer-g {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .btn-shimmer {
          background: linear-gradient(90deg,#4f46e5 0%,#6366f1 40%,#4f46e5 100%);
          background-size: 200% 100%;
          animation: shimmer-g 2.5s linear infinite;
        }

        /* Scrollbar */
        ::-webkit-scrollbar       { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.15); border-radius: 10px; }
      `}</style>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className="flex-shrink-0 h-[60px] flex items-center justify-between px-6 bg-[#0a0a0a]/90 premium-glass border-b border-[#222] z-50">
        {/* Logo — click to go home */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 10,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          title="Back to home"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg,#6366f1,#22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Shield size={15} color="#080808" strokeWidth={2.5} />
            {/* Online dot */}
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#6366f1',
                border: '2px solid #080808',
              }}
            />
          </div>
          <div>
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              DeepSheild<span style={{ color: '#6366f1' }}>.ai</span>
            </p>
            <p style={{ fontSize: 10, color: '#52525b', marginTop: 2, lineHeight: 1 }}>
              Detection Studio
            </p>
          </div>
        </button>

        {/* Right: status + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'rgba(99,102,241,0.06)',
              fontSize: 11,
              color: '#6366f1',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#6366f1',
                display: 'inline-block',
              }}
            />
            AI Engine Ready
          </div>
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
        </div>
      </header>

      {/* ══════════════════════════════════════
          BODY  (sidebar + main)
      ══════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ──────────────────── SIDEBAR ──────────────────── */}
        <aside className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden bg-[#0a0a0a]/90 premium-glass border-r border-[#222]">
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
              {/* eslint-disable-next-line no-unused-vars */}
              {NAV_ITEMS.map(({ id, label, icon: Icon, desc }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTab(id);
                      setUploadResult(null);
                      setPreviewUrl(null);
                      setSelectedFile(null);
                      setSelectedFiles([]);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 10px',
                      borderRadius: 12,
                      border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                      background: active ? 'rgba(99,102,241,0.07)' : 'transparent',
                      color: active ? '#fff' : '#71717a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Active left bar */}
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 2,
                          height: 18,
                          borderRadius: 10,
                          background: '#6366f1',
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                        color: active ? '#6366f1' : '#52525b',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1, marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: 10, color: '#52525b', lineHeight: 1 }}>{desc}</p>
                    </div>
                    {active && <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#6366f1', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live result — only show when there is real data */}
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
                border: (livePrediction || uploadResult?.label)
                  ? isFake
                    ? '1px solid rgba(239,68,68,0.25)'
                    : '1px solid rgba(99,102,241,0.25)'
                  : '1px solid rgba(255,255,255,0.06)',
                background: (livePrediction || uploadResult?.label)
                  ? isFake
                    ? 'rgba(239,68,68,0.06)'
                    : 'rgba(99,102,241,0.06)'
                  : 'rgba(255,255,255,0.02)',
                transition: 'all 0.4s ease',
              }}
            >
              {uploadResult?.status === 'failed' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#ef4444', lineHeight: 1, marginBottom: 4 }}>
                      ANALYSIS FAILED
                    </p>
                    <p style={{ fontSize: 10, color: '#71717a' }}>{uploadResult.error || 'Server error occurred'}</p>
                  </div>
                </div>
              ) : (livePrediction || uploadResult?.label) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isFake
                    ? <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                    : <CheckCircle2 size={18} style={{ color: '#6366f1', flexShrink: 0 }} />}
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        fontFamily: 'Syne, sans-serif',
                        fontWeight: 700,
                        color: isFake ? '#ef4444' : '#6366f1',
                        lineHeight: 1,
                        marginBottom: 4,
                      }}
                    >
                      {livePrediction?.label || uploadResult?.label}
                    </p>
                    <p style={{ fontSize: 10, color: '#71717a' }}>
                      {((livePrediction?.confidence || uploadResult?.confidence || 0) * 100).toFixed(1)}% confidence
                    </p>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: '#3f3f46', fontStyle: 'italic' }}>Awaiting analysis…</p>
              )}
            </div>
          </div>
        </aside>

        {/* ──────────────────── MAIN ──────────────────── */}
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
            <span style={{ color: '#6366f1' }}>
              {activeTab === 'live' ? 'Live Analysis' : activeTab === 'video' ? 'Video Upload' : 'Image Upload'}
            </span>
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
              {activeTab === 'live' && 'Live Stream Analysis'}
              {activeTab === 'video' && 'Video Deepfake Analysis'}
              {activeTab === 'image' && 'Image Deepfake Analysis'}
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
              {activeTab === 'live' && 'Analyze your webcam feed in real-time using AI inference every 2 seconds.'}
              {activeTab === 'video' && 'Upload a video file and let the AI engine run deepfake detection.'}
              {activeTab === 'image' && 'Upload an image to instantly check if it is AI-generated or real.'}
            </p>
          </div>

          {/* ─────────── LIVE TAB ─────────── */}
          {activeTab === 'live' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 220px',
                gap: 18,
                flex: 1,
                minHeight: 0,
                alignItems: 'start',
              }}
            >
              {/* Video panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Viewport */}
                <div className="bg-[#0a0a0a] border border-[#222] rounded-[18px] overflow-hidden relative aspect-video w-full premium-shadow">
                  {isCameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
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
                          }}
                        >
                          <CameraOff size={26} color="#3f3f46" />
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: '#52525b', fontWeight: 500 }}>Camera is off</p>
                      <p style={{ fontSize: 11, color: '#3f3f46' }}>Enable camera below to begin</p>
                    </div>
                  )}

                  {/* Scan laser */}
                  {isCameraActive && isLiveAnalyzing && <div className="scan-anim" />}

                  {/* LIVE badge */}
                  {isLiveAnalyzing && (
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
                  {livePrediction && isCameraActive && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 14,
                        left: 14,
                        right: 14,
                        padding: '10px 14px',
                        borderRadius: 12,
                        backdropFilter: 'blur(12px)',
                        border: livePrediction.label === 'FAKE'
                          ? '1px solid rgba(239,68,68,0.35)'
                          : '1px solid rgba(99,102,241,0.35)',
                        background: livePrediction.label === 'FAKE'
                          ? 'rgba(20,5,5,0.75)'
                          : 'rgba(5,20,12,0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {livePrediction.label === 'FAKE'
                          ? <AlertCircle size={14} style={{ color: '#ef4444' }} />
                          : <CheckCircle2 size={14} style={{ color: '#6366f1' }} />}
                        <span
                          style={{
                            fontFamily: 'Syne, sans-serif',
                            fontWeight: 700,
                            fontSize: 13,
                            color: livePrediction.label === 'FAKE' ? '#ef4444' : '#6366f1',
                          }}
                        >
                          {livePrediction.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                        {(livePrediction.confidence * 100).toFixed(1)}% confident
                      </span>
                    </div>
                  )}

                  {/* GradCAM Heatmap Overlay */}
                  <HeatmapOverlay
                    heatmapB64={livePrediction?.heatmap_b64}
                    label={livePrediction?.label}
                    visible={isCameraActive && isLiveAnalyzing && !!livePrediction}
                  />

                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Controls row */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setIsCameraActive(!isCameraActive)}
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
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
                  >
                    {isCameraActive ? <><CameraOff size={13} /> Disable Camera</> : <><Camera size={13} /> Enable Camera</>}
                  </button>

                  <button
                    onClick={() => setIsLiveAnalyzing(!isLiveAnalyzing)}
                    disabled={!isCameraActive}
                    className={!isLiveAnalyzing ? 'btn-shimmer' : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '10px 22px',
                      borderRadius: 12,
                      border: isLiveAnalyzing ? '1px solid rgba(239,68,68,0.3)' : 'none',
                      background: isLiveAnalyzing ? 'rgba(239,68,68,0.08)' : undefined,
                      color: isLiveAnalyzing ? '#ef4444' : '#080808',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: !isCameraActive ? 0.4 : 1,
                      pointerEvents: !isCameraActive ? 'none' : 'auto',
                      transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <Zap size={13} />
                    {isLiveAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
                  </button>
                </div>
              </div>

              {/* How it works panel */}
              <div className="bg-[#111] border border-[#222] rounded-[18px] p-5 premium-shadow">
                <p
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#3f3f46',
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  How It Works
                </p>
                {[
                  { step: '01', text: 'Enable your webcam' },
                  { step: '02', text: 'Click Start Analysis' },
                  { step: '03', text: 'Frames captured every 2s' },
                  { step: '04', text: 'AI returns REAL / FAKE verdict' },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: 'rgba(99,102,241,0.1)',
                        color: '#6366f1',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {step}
                    </span>
                    <p style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, paddingTop: 4 }}>{text}</p>
                  </div>
                ))}
              </div>

              {/* Advanced AI Analytics Panel */}
              <AdvancedAnalyticsPanel
                prediction={livePrediction}
                isActive={isLiveAnalyzing && isCameraActive}
              />

              {/* Frequency Domain Analysis Panel */}
              <FrequencyAnalysisPanel
                prediction={livePrediction}
                isActive={isLiveAnalyzing && isCameraActive}
              />
            </div>
          )}

          {/* ─────────── UPLOAD TABS (video / image) ─────────── */}
          {(activeTab === 'video' || activeTab === 'image') && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 260px',
                gap: 18,
                flex: 1,
                minHeight: 0,
                alignItems: 'start',
              }}
            >
              {/* Drop zone / preview */}
              <div>
                {!previewUrl ? (
                  <label
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 340,
                      borderRadius: 18,
                      border: isDragging
                        ? '2px dashed #6366f1'
                        : '2px dashed rgba(255,255,255,0.08)',
                      background: isDragging
                        ? 'rgba(99,102,241,0.05)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      className="float-anim"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 18,
                          border: '1px solid rgba(255,255,255,0.07)',
                          background: isDragging ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UploadCloud size={28} color={isDragging ? '#6366f1' : '#52525b'} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: isDragging ? '#fff' : '#a1a1aa', marginBottom: 4 }}>
                          {isDragging ? 'Drop it here!' : 'Drag & drop or click to upload'}
                        </p>
                        <p style={{ fontSize: 12, color: '#52525b' }}>
                          {activeTab === 'video' ? 'MP4, WebM — max 50MB' : 'JPG, PNG, WEBP — max 10MB'}
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept={activeTab === 'video' ? 'video/*' : 'image/*'}
                      style={{ display: 'none' }}
                      multiple
                      webkitdirectory={activeTab === 'image' ? "" : undefined}
                      onChange={e => handleFileSelect(e.target.files)}
                    />
                  </label>
                ) : (
                    <div className="relative min-h-[340px] rounded-[18px] overflow-hidden border border-[#222] bg-[#000] premium-shadow">
                    {activeTab === 'video'
                      ? <video src={previewUrl} controls style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }} />
                      : <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }} />}

                    {/* Gradient overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)',
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Bottom bar */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 14,
                        left: 14,
                        right: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '5px 12px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)',
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.7)',
                          maxWidth: '55%',
                          overflow: 'hidden',
                        }}
                      >
                        {activeTab === 'video'
                          ? <Video size={10} color="#6366f1" />
                          : <ImageIcon size={10} color="#6366f1" />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFiles?.length > 1 ? `${selectedFiles.length} files selected` : selectedFile?.name}
                        </span>
                      </div>
                      <button
                        onClick={() => { setPreviewUrl(null); setSelectedFile(null); setSelectedFiles([]); setUploadResult(null); setIsUploading(false); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(8px)',
                          fontSize: 11,
                          color: '#a1a1aa',
                          cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif',
                        }}
                      >
                        Change file
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Main card */}
                <div className="bg-[#111] border border-[#222] rounded-[18px] p-5 premium-shadow">
                  {/* Panel header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: 'rgba(99,102,241,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Activity size={14} color="#6366f1" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, fontFamily: 'Syne, sans-serif' }}>
                        Analysis Panel
                      </p>
                      <p style={{ fontSize: 10, color: '#52525b', marginTop: 3 }}>AI-powered detection</p>
                    </div>
                  </div>

                  {/* File info */}
                  {selectedFile && (
                    <div
                      style={{
                        marginBottom: 14,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <p style={{ fontSize: 10, color: '#52525b', marginBottom: 4 }}>Selected file</p>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#d4d4d8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedFiles?.length > 1 ? `${selectedFiles.length} files selected` : selectedFile.name}
                      </p>
                      <p style={{ fontSize: 10, color: '#3f3f46', marginTop: 3 }}>
                        {selectedFiles?.length > 1 ? 'Batch Upload' : `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`}
                      </p>
                    </div>
                  )}

                  {/* CTA button */}
                  <button
                    onClick={handleUploadAndAnalyze}
                    disabled={!selectedFile || isUploading}
                    className={!selectedFile || isUploading ? '' : 'btn-shimmer'}
                    style={{
                      width: '100%',
                      padding: '11px 0',
                      borderRadius: 12,
                      border: !selectedFile || isUploading ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      background: !selectedFile || isUploading ? 'rgba(255,255,255,0.04)' : undefined,
                      color: !selectedFile || isUploading ? '#52525b' : '#080808',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                      opacity: !selectedFile || isUploading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    {isUploading
                      ? (
                        <>
                          <span
                            className="spin-anim"
                            style={{
                              width: 13,
                              height: 13,
                              border: '2px solid rgba(99,102,241,0.3)',
                              borderTopColor: '#6366f1',
                              borderRadius: '50%',
                              display: 'inline-block',
                            }}
                          />
                          {uploadResult?.status === 'uploading' ? 'Uploading…' : 'Processing…'}
                        </>
                      )
                      : <><Zap size={13} /> Run Deepfake Scan</>}
                  </button>

                  {/* Status / Result */}
                  {uploadResult && (
                    <div style={{ marginTop: 16 }}>
                      <p
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: '#3f3f46',
                          fontWeight: 600,
                          marginBottom: 10,
                        }}
                      >
                        Status &amp; Result
                      </p>

                      {/* Processing state */}
                      {(uploadResult.status === 'uploading' || uploadResult.status === 'processing') && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: '1px solid rgba(99,102,241,0.15)',
                            background: 'rgba(99,102,241,0.05)',
                          }}
                        >
                          <span
                            className="spin-anim"
                            style={{
                              width: 14,
                              height: 14,
                              border: '2px solid rgba(99,102,241,0.3)',
                              borderTopColor: '#6366f1',
                              borderRadius: '50%',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 500, color: '#6366f1' }}>
                              {uploadResult.status === 'uploading' ? 'Uploading to cloud…' : 'AI running inference…'}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(99,102,241,0.4)', marginTop: 2 }}>Please wait</p>
                          </div>
                        </div>
                      )}

                      {/* Completed */}
                      {uploadResult.status === 'completed' && (
                        <div
                          style={{
                            padding: '18px 16px',
                            borderRadius: 14,
                            border: uploadResult.label === 'REAL'
                              ? '1px solid rgba(99,102,241,0.25)'
                              : '1px solid rgba(239,68,68,0.25)',
                            background: uploadResult.label === 'REAL'
                              ? 'rgba(99,102,241,0.05)'
                              : 'rgba(239,68,68,0.05)',
                            textAlign: 'center',
                          }}
                        >
                          {uploadResult.label === 'REAL'
                            ? <CheckCircle2 size={32} style={{ color: '#6366f1', margin: '0 auto 8px' }} />
                            : <AlertCircle size={32} style={{ color: '#ef4444', margin: '0 auto 8px' }} />}
                          <p
                            style={{
                              fontFamily: 'Syne, sans-serif',
                              fontWeight: 800,
                              fontSize: 22,
                              letterSpacing: '-0.03em',
                              color: uploadResult.label === 'REAL' ? '#6366f1' : '#ef4444',
                              marginBottom: 8,
                            }}
                          >
                            {uploadResult.label}
                          </p>
                          {/* Confidence bar */}
                          <div
                            style={{
                              width: '100%',
                              height: 4,
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                              marginBottom: 6,
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                borderRadius: 10,
                                background: uploadResult.label === 'REAL' ? '#6366f1' : '#ef4444',
                                width: `${(uploadResult.confidence * 100).toFixed(0)}%`,
                                transition: 'width 1s ease',
                              }}
                            />
                          </div>
                          <p style={{ fontSize: 11, color: '#71717a' }}>
                            <span style={{ color: '#fff', fontWeight: 600 }}>
                              {(uploadResult.confidence * 100).toFixed(1)}%
                            </span>{' '}
                            confidence
                          </p>
                        </div>
                      )}

                      {/* Failed */}
                      {uploadResult.status === 'failed' && (
                        <div
                          style={{
                            padding: '14px',
                            borderRadius: 12,
                            border: '1px solid rgba(239,68,68,0.2)',
                            background: 'rgba(239,68,68,0.05)',
                            textAlign: 'center',
                          }}
                        >
                          <AlertCircle size={20} style={{ color: '#ef4444', margin: '0 auto 6px' }} />
                          <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>Analysis failed</p>
                          <p style={{ fontSize: 10, color: 'rgba(239,68,68,0.65)', marginTop: 3 }}>
                            {uploadResult.error || 'Check connection and retry'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tips card */}
                <div className="bg-[#111] border border-[#222] rounded-[16px] px-[18px] py-[16px] premium-shadow">
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
                    Tips
                  </p>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(activeTab === 'video'
                      ? ['Clear face visibility improves accuracy', 'Shorter clips process faster', 'MP4 recommended']
                      : ['Use high resolution images', 'Face should be clearly visible', 'Avoid heavy filters']
                    ).map(tip => (
                      <li
                        key={tip}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#71717a' }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#6366f1',
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
