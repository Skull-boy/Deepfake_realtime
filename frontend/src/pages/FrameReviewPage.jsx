import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton, useUser, useAuth } from '@clerk/clerk-react';
import {
  Shield, ChevronLeft, ChevronRight, Eye, EyeOff,
  RefreshCw, CheckCircle2, AlertCircle, Zap, Filter,
  BarChart3, Brain, ArrowRight, Clock, Layers, Sparkles,
} from 'lucide-react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/* ─────────────────────────────────────
   FRAME REVIEW PAGE
   Admin-only post-session review dashboard
───────────────────────────────────── */

export default function FrameReviewPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();

  /* ── Auth helper — Clerk SPA uses Bearer tokens, not cookies ── */
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  }, [getToken]);

  /* ── State ── */
  const [frames, setFrames] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [filter, setFilter] = useState('pending');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [approving, setApproving] = useState(false);

  /* ── Fetch Frames ── */
  const fetchFrames = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filter,
        page: String(page),
        limit: '1',
      });
      if (selectedSession) params.set('session_id', selectedSession);

      const res = await authFetch(`${backendUrl}/api/review/frames?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFrames(data.frames);
      setPagination(data.pagination);
      setCurrentIdx(0);
    } catch (e) {
      console.error('Fetch frames error:', e);
      setFrames([]);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedSession, authFetch]);

  /* ── Fetch Sessions ── */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await authFetch(`${backendUrl}/api/review/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error('Fetch sessions error:', e);
    }
  }, [authFetch]);

  /* ── Fetch Stats ── */
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(`${backendUrl}/api/review/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Fetch stats error:', e);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchFrames(1);
    fetchSessions();
    fetchStats();
  }, [fetchFrames, fetchSessions, fetchStats]);

  /* ── Label a frame ── */
  const handleLabel = async (label) => {
    const frame = frames[currentIdx];
    if (!frame) return;
    setSaving(true);
    try {
      const res = await authFetch(`${backendUrl}/api/review/frames/${frame._id}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_label: label }),
      });
      if (res.ok) {
        // Move to next frame
        fetchFrames(pagination.page < pagination.totalPages ? pagination.page + 1 : pagination.page);
        fetchStats();
      }
    } catch (e) {
      console.error('Label error:', e);
    } finally {
      setSaving(false);
    }
  };

  /* ── Skip ── */
  const handleSkip = () => {
    if (pagination.page < pagination.totalPages) {
      fetchFrames(pagination.page + 1);
    }
  };

  /* ── Retrain ── */
  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await authFetch(`${backendUrl}/api/review/retrain`, {
        method: 'POST',
      });
      const data = await res.json();
      setRetrainStatus(data);
      fetchStats();
    } catch (e) {
      setRetrainStatus({ error: e.message });
    } finally {
      setRetraining(false);
    }
  };

  /* ── Approve ── */
  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await authFetch(`${backendUrl}/api/review/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      setRetrainStatus(data);
      fetchStats();
    } catch (e) {
      setRetrainStatus({ error: e.message });
    } finally {
      setApproving(false);
    }
  };

  const currentFrame = frames[currentIdx] || null;
  const progressPct = stats
    ? stats.total_frames > 0
      ? Math.round((stats.reviewed / stats.total_frames) * 100)
      : 0
    : 0;

  /* ─────────────────────────────────────
     RENDER
  ───────────────────────────────────── */
  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="h-screen w-screen bg-[#080808] text-white flex flex-col overflow-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); }
          50%       { box-shadow: 0 0 20px 4px rgba(52,211,153,0.15); }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .spin-slow  { animation: spin-slow 1.5s linear infinite; }
        ::-webkit-scrollbar       { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,.15); border-radius: 10px; }
      `}</style>

      {/* ══ HEADER ══ */}
      <header
        style={{
          flexShrink: 0, height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 50,
        }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 10,
          }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Eye size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1 }}>
              DeepSheild<span style={{ color: '#f59e0b' }}>.review</span>
            </p>
            <p style={{ fontSize: 10, color: '#52525b', marginTop: 2, lineHeight: 1 }}>
              Frame Review Dashboard
            </p>
          </div>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              border: '1px solid rgba(245,158,11,0.2)',
              background: 'rgba(245,158,11,0.06)',
              fontSize: 11, color: '#f59e0b', fontWeight: 500,
            }}
          >
            <Shield size={10} />
            Admin Only
          </div>
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
        </div>
      </header>

      {/* ══ BODY ══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── SIDEBAR ── */}
        <aside
          style={{
            width: 240, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'auto',
            background: 'rgba(255,255,255,0.015)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Filter buttons */}
          <div style={{ padding: '20px 14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 10, paddingLeft: 6 }}>
              Review Filter
            </p>
            {[
              { id: 'pending', label: 'Pending Review', icon: Clock, color: '#f59e0b' },
              { id: 'reviewed', label: 'Reviewed', icon: CheckCircle2, color: '#34d399' },
              { id: 'all', label: 'All Frames', icon: Layers, color: '#a1a1aa' },
            ].map(({ id, label, icon: Icon, color }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  onClick={() => { setFilter(id); setSelectedSession(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 10px', borderRadius: 12, width: '100%',
                    border: active ? `1px solid ${color}33` : '1px solid transparent',
                    background: active ? `${color}11` : 'transparent',
                    color: active ? '#fff' : '#71717a',
                    cursor: 'pointer', textAlign: 'left', marginBottom: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
                      color: active ? color : '#52525b', flexShrink: 0,
                    }}
                  >
                    <Icon size={13} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Sessions */}
          <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flex: 1, overflow: 'auto' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 10, paddingLeft: 6 }}>
              Sessions ({sessions.length})
            </p>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 11, color: '#3f3f46', fontStyle: 'italic', paddingLeft: 6 }}>No sessions yet</p>
            ) : (
              sessions.map((s) => {
                const active = selectedSession === s.session_id;
                return (
                  <button
                    key={s.session_id}
                    onClick={() => setSelectedSession(active ? null : s.session_id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 10, marginBottom: 3,
                      border: active ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                      background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontSize: 11, color: active ? '#f59e0b' : '#a1a1aa', fontWeight: 500, marginBottom: 2 }}>
                      {s.session_id.slice(0, 20)}…
                    </p>
                    <p style={{ fontSize: 10, color: '#52525b' }}>
                      {s.frame_count} frames · {s.pending} pending
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Stats */}
          <div style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 10, paddingLeft: 6 }}>
              <BarChart3 size={10} style={{ display: 'inline', marginRight: 4 }} />
              Review Progress
            </p>
            {stats ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#71717a', marginBottom: 6 }}>
                  <span>{stats.reviewed} reviewed</span>
                  <span>{stats.total_frames} total</span>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 10, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 10, background: 'linear-gradient(90deg, #f59e0b, #34d399)', transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: 10, color: '#52525b' }}>
                  {stats.pending_review} pending · {stats.available_for_training} ready for training
                </p>
              </>
            ) : (
              <p style={{ fontSize: 11, color: '#3f3f46', fontStyle: 'italic' }}>Loading…</p>
            )}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '28px', display: 'flex', flexDirection: 'column', minWidth: 0,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, color: '#52525b' }}>
            <Eye size={10} />
            <span>Review</span>
            <span style={{ color: '#27272a' }}>/</span>
            <span style={{ color: '#f59e0b' }}>
              {filter === 'pending' ? 'Pending' : filter === 'reviewed' ? 'Reviewed' : 'All Frames'}
            </span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.03em', color: '#fff', marginBottom: 4 }}>
              Frame Review Dashboard
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
              Review model predictions and correct labels to improve accuracy over time.
            </p>
          </div>

          {/* Frame Card */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={24} className="spin-slow" style={{ color: '#3f3f46' }} />
            </div>
          ) : !currentFrame ? (
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}
            >
              <div
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={28} color="#34d399" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#a1a1aa' }}>
                {filter === 'pending' ? 'All frames reviewed!' : 'No frames found'}
              </p>
              <p style={{ fontSize: 12, color: '#52525b' }}>
                {filter === 'pending' ? 'Ready to retrain the model below.' : 'Adjust your filters to see frames.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, flex: 1, minHeight: 0, alignItems: 'start' }}>

              {/* Frame viewer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    position: 'relative', borderRadius: 18, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.07)', background: '#0a0a0a',
                  }}
                >
                  <img
                    src={currentFrame.frame_url}
                    alt="Frame for review"
                    style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />

                  {/* Model prediction overlay */}
                  <div
                    style={{
                      position: 'absolute', bottom: 14, left: 14, right: 14,
                      padding: '10px 14px', borderRadius: 12,
                      backdropFilter: 'blur(12px)',
                      border: currentFrame.primary_label === 'FAKE'
                        ? '1px solid rgba(239,68,68,0.35)'
                        : '1px solid rgba(52,211,153,0.35)',
                      background: currentFrame.primary_label === 'FAKE'
                        ? 'rgba(20,5,5,0.75)'
                        : 'rgba(5,20,12,0.75)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {currentFrame.primary_label === 'FAKE'
                        ? <AlertCircle size={14} style={{ color: '#ef4444' }} />
                        : <CheckCircle2 size={14} style={{ color: '#34d399' }} />}
                      <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: currentFrame.primary_label === 'FAKE' ? '#ef4444' : '#34d399' }}>
                        Model: {currentFrame.primary_label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                        {(currentFrame.primary_confidence * 100).toFixed(1)}% conf
                      </span>
                      <span
                        style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                          background: currentFrame.trust_verdict === 'TRUSTED' ? 'rgba(52,211,153,0.15)' :
                                      currentFrame.trust_verdict === 'UNTRUSTED' ? 'rgba(239,68,68,0.15)' :
                                      'rgba(245,158,11,0.15)',
                          color: currentFrame.trust_verdict === 'TRUSTED' ? '#34d399' :
                                 currentFrame.trust_verdict === 'UNTRUSTED' ? '#ef4444' : '#f59e0b',
                        }}
                      >
                        {currentFrame.trust_verdict}
                      </span>
                    </div>
                  </div>

                  {/* Frame counter */}
                  <div
                    style={{
                      position: 'absolute', top: 14, right: 14,
                      padding: '5px 12px', borderRadius: 999,
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                      fontSize: 11, color: '#a1a1aa', fontWeight: 500,
                    }}
                  >
                    {pagination.page} / {pagination.totalPages}
                  </div>
                </div>

                {/* Label buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => handleLabel('REAL')}
                    disabled={saving}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 20px', borderRadius: 14,
                      border: '1px solid rgba(52,211,153,0.3)',
                      background: 'rgba(52,211,153,0.08)',
                      color: '#34d399', fontSize: 14, fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                      opacity: saving ? 0.5 : 1, transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    REAL
                  </button>
                  <button
                    onClick={() => handleLabel('FAKE')}
                    disabled={saving}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 20px', borderRadius: 14,
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      color: '#ef4444', fontSize: 14, fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                      opacity: saving ? 0.5 : 1, transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <AlertCircle size={16} />
                    FAKE
                  </button>
                  <button
                    onClick={handleSkip}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '14px 18px', borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#71717a', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    Skip <ChevronRight size={14} />
                  </button>
                </div>

                {/* Already reviewed badge */}
                {currentFrame.human_label && (
                  <div
                    style={{
                      padding: '10px 14px', borderRadius: 12,
                      border: '1px solid rgba(52,211,153,0.2)',
                      background: 'rgba(52,211,153,0.06)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <CheckCircle2 size={14} color="#34d399" />
                    <span style={{ fontSize: 12, color: '#34d399' }}>
                      Previously labeled <strong>{currentFrame.human_label}</strong> by reviewer
                    </span>
                  </div>
                )}
              </div>

              {/* Right panel — frame details + retrain */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Frame details card */}
                <div
                  style={{
                    padding: 18, borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 14 }}>
                    Frame Details
                  </p>
                  {[
                    { label: 'Session', value: currentFrame.session_id?.slice(0, 16) + '…' },
                    { label: 'Timestamp', value: new Date(currentFrame.timestamp).toLocaleString() },
                    { label: 'Model Prediction', value: currentFrame.primary_label, color: currentFrame.primary_label === 'FAKE' ? '#ef4444' : '#34d399' },
                    { label: 'Confidence', value: `${(currentFrame.primary_confidence * 100).toFixed(1)}%` },
                    { label: 'Trust Verdict', value: currentFrame.trust_verdict, color: currentFrame.trust_verdict === 'TRUSTED' ? '#34d399' : currentFrame.trust_verdict === 'UNTRUSTED' ? '#ef4444' : '#f59e0b' },
                    { label: 'Trust Score', value: `${(currentFrame.trust_score * 100).toFixed(1)}%` },
                    { label: 'Latency', value: `${currentFrame.latency_ms}ms` },
                    { label: 'Face Detected', value: currentFrame.face_detected ? 'Yes' : 'No' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: '#52525b' }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: color || '#a1a1aa' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Retrain card */}
                <div
                  style={{
                    padding: 18, borderRadius: 16,
                    border: '1px solid rgba(245,158,11,0.15)',
                    background: 'rgba(245,158,11,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Brain size={14} color="#f59e0b" />
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', fontWeight: 600 }}>
                      Model Training
                    </p>
                  </div>

                  {stats && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <span style={{ color: '#71717a' }}>Available for training</span>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{stats.available_for_training}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <span style={{ color: '#71717a' }}>Minimum required</span>
                        <span style={{ color: '#52525b' }}>50</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 14 }}>
                        <span style={{ color: '#71717a' }}>Status</span>
                        <span style={{ color: stats.ready_to_train ? '#34d399' : '#f59e0b', fontSize: 10, fontWeight: 600 }}>
                          {stats.ready_to_train ? '✓ READY' : `Need ${50 - stats.available_for_training} more`}
                        </span>
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleRetrain}
                    disabled={retraining || !(stats?.ready_to_train)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px', borderRadius: 10,
                      border: 'none',
                      background: stats?.ready_to_train ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.06)',
                      color: stats?.ready_to_train ? '#fff' : '#3f3f46',
                      fontSize: 12, fontWeight: 600, cursor: stats?.ready_to_train ? 'pointer' : 'not-allowed',
                      opacity: retraining ? 0.5 : 1,
                      marginBottom: 8, transition: 'all 0.15s',
                    }}
                  >
                    {retraining ? <RefreshCw size={13} className="spin-slow" /> : <Zap size={13} />}
                    {retraining ? 'Training…' : 'Trigger Retrain'}
                  </button>

                  {retrainStatus?.candidate_accuracy != null && (
                    <>
                      <div
                        style={{
                          padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                          border: '1px solid rgba(52,211,153,0.2)',
                          background: 'rgba(52,211,153,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: '#71717a' }}>Old accuracy</span>
                          <span style={{ color: '#a1a1aa' }}>{(retrainStatus.old_accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#71717a' }}>New accuracy</span>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>{(retrainStatus.candidate_accuracy * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="pulse-glow"
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '10px', borderRadius: 10, border: 'none',
                          background: 'linear-gradient(135deg, #34d399, #22d3ee)',
                          color: '#080808', fontSize: 12, fontWeight: 700,
                          cursor: approving ? 'wait' : 'pointer',
                          opacity: approving ? 0.5 : 1, transition: 'all 0.15s',
                        }}
                      >
                        {approving ? <RefreshCw size={13} className="spin-slow" /> : <Sparkles size={13} />}
                        {approving ? 'Deploying…' : 'Approve & Deploy Model'}
                      </button>
                    </>
                  )}

                  {retrainStatus?.error && (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', marginTop: 8 }}>
                      <p style={{ fontSize: 10, color: '#ef4444' }}>{retrainStatus.error}</p>
                    </div>
                  )}

                  {retrainStatus?.message && (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(52,211,153,0.1)', marginTop: 8 }}>
                      <p style={{ fontSize: 10, color: '#34d399' }}>{retrainStatus.message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
