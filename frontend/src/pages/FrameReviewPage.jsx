import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton, useUser, useAuth } from '@clerk/clerk-react';
import {
  ShieldAlert, ChevronRight, Eye, RefreshCw, CheckCircle2, 
  AlertCircle, Zap, Layers, Clock, BarChart3, Brain, Sparkles, Crosshair,
  Lock
} from 'lucide-react';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const MONO = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" };
const SANS = { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" };

function GridBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#020204' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center center' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)', backgroundSize: '100% 4px', zIndex: 100, pointerEvents: 'none', opacity: 0.4 }} />
    </div>
  );
}

function CyberPanel({ title, children, style = {} }) {
  return (
    <div style={{ position: 'relative', background: 'rgba(10,10,15,0.6)', border: '1px solid rgba(99,102,241,0.1)', display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: '2px solid #6366f1', borderLeft: '2px solid #6366f1', zIndex: 10 }} />
      <div style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderTop: '2px solid #6366f1', borderRight: '2px solid #6366f1', zIndex: 10 }} />
      <div style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8, borderBottom: '2px solid #6366f1', borderLeft: '2px solid #6366f1', zIndex: 10 }} />
      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: '2px solid #6366f1', borderRight: '2px solid #6366f1', zIndex: 10 }} />
      
      {title && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
          <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.15em' }}>{title}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: 4, height: 4, background: '#818cf8' }} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

export default function FrameReviewPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();

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
        fetchFrames(pagination.page < pagination.totalPages ? pagination.page + 1 : pagination.page);
        fetchStats();
      }
    } catch (e) {
      console.error('Label error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (pagination.page < pagination.totalPages) {
      fetchFrames(pagination.page + 1);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await authFetch(`${backendUrl}/api/review/retrain`, { method: 'POST' });
      const data = await res.json();
      setRetrainStatus(data);
      fetchStats();
    } catch (e) {
      setRetrainStatus({ error: e.message });
    } finally {
      setRetraining(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await authFetch(`${backendUrl}/api/review/approve`, { method: 'POST' });
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
  const progressPct = stats ? (stats.total_frames > 0 ? Math.round((stats.reviewed / stats.total_frames) * 100) : 0) : 0;

  return (
    <div style={{ ...SANS, minHeight: '100vh', display: 'flex', color: '#e2e4f0', overflow: 'hidden' }}>
      <GridBackground />

      {/* ═══ CYBER SIDEBAR ═══ */}
      <aside style={{ width: 320, borderRight: '1px solid rgba(99,102,241,0.15)', background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', zIndex: 20, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />

        <div style={{ padding: '30px 24px', borderBottom: '1px solid rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.1)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', border: '1px solid rgba(99,102,241,0.5)' }}>
            <Crosshair style={{ width: 20, height: 20, color: '#818cf8' }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.05em', color: '#fff', textTransform: 'uppercase' }}>DeepShield<span style={{ color: '#818cf8' }}>.review</span></div>
            <div style={{ ...MONO, fontSize: 10, color: '#10b981', letterSpacing: '0.1em' }}>SYS.ACTIVE // ADMIN</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: '0.2em', marginBottom: 12, paddingLeft: 4 }}>REVIEW_FILTER</div>
          {[
            { id: 'pending', label: 'PENDING_REVIEW', icon: Clock, color: '#10b981' },
            { id: 'reviewed', label: 'VERIFIED_FRAMES', icon: CheckCircle2, color: '#6366f1' },
            { id: 'all', label: 'ALL_RECORDS', icon: Layers, color: '#888' },
          ].map(({ id, label, icon: Icon, color }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => { setFilter(id); setSelectedSession(null); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: active ? 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, transparent 100%)' : 'transparent', border: 'none', borderLeft: active ? `2px solid ${color}` : '2px solid transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 4, transition: 'all 0.2s' }}
              >
                <Icon style={{ width: 16, height: 16, color: active ? color : '#555' }} />
                <span style={{ ...MONO, fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#fff' : '#888' }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Sessions */}
        <div style={{ flex: 1, padding: '24px 20px', borderBottom: '1px solid rgba(99,102,241,0.1)', overflowY: 'auto' }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: '0.2em', marginBottom: 12, paddingLeft: 4 }}>SESSIONS ({sessions.length})</div>
          {sessions.length === 0 ? (
            <div style={{ ...MONO, fontSize: 11, color: '#555', fontStyle: 'italic', paddingLeft: 4 }}>NO_DATA_FOUND</div>
          ) : (
            sessions.map((s) => {
              const active = selectedSession === s.session_id;
              return (
                <button
                  key={s.session_id}
                  onClick={() => setSelectedSession(active ? null : s.session_id)}
                  style={{ width: '100%', display: 'block', textAlign: 'left', padding: '12px', background: active ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${active ? 'rgba(99,102,241,0.3)' : 'transparent'}`, borderRadius: 4, marginBottom: 8, cursor: 'pointer' }}
                >
                  <div style={{ ...MONO, fontSize: 11, color: active ? '#818cf8' : '#ccc', marginBottom: 4 }}>{s.session_id.slice(0, 18)}...</div>
                  <div style={{ ...MONO, fontSize: 9, color: '#666', display: 'flex', gap: 8 }}>
                    <span>FRM:{s.frame_count}</span>
                    <span style={{ color: '#f59e0b' }}>PND:{s.pending}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Stats */}
        <div style={{ padding: '24px 20px', background: 'rgba(99,102,241,0.03)' }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.2em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={12} /> PROGRESS_TRACKER</div>
          {stats ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 10, color: '#888', marginBottom: 8 }}>
                <span>{stats.reviewed} VERIFIED</span>
                <span>{stats.total_frames} TOTAL</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', marginBottom: 12 }}>
                <div style={{ height: '100%', background: '#6366f1', width: `${progressPct}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ ...MONO, fontSize: 10, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>{stats.pending_review}</span> PEND</span>
                <span><span style={{ color: '#10b981', fontWeight: 700 }}>{stats.available_for_training}</span> RDY</span>
              </div>
            </div>
          ) : (
            <div style={{ ...MONO, fontSize: 10, color: '#555' }}>CALCULATING...</div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN DASHBOARD ═══ */}
      <main style={{ flex: 1, zIndex: 10, display: 'flex', flexDirection: 'column', height: '100vh', padding: '30px', gap: 24 }}>
        
        {/* Header HUD */}
        <header style={{ height: 60, borderBottom: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,5,8,0.7)', backdropFilter: 'blur(10px)', padding: '0 24px', flexShrink: 0, clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
          <div>
            <h1 style={{ ...SANS, fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '0.02em', margin: 0 }}>FRAME_ANALYSIS_HUB //</h1>
            <p style={{ ...MONO, fontSize: 11, color: '#888', marginTop: 4, letterSpacing: '0.05em' }}>Inspect model predictions and provide ground-truth labeling to calibrate neural networks.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ ...MONO, fontSize: 11, color: '#818cf8', letterSpacing: '0.1em' }}>QUEUE: {filter.toUpperCase()}</div>
            <div style={{ width: 8, height: 8, background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'blink 2s infinite' }} />
            <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32, borderRadius: 0, clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)' } } }} />
          </div>
        </header>

        {/* Content Area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 24 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 40, height: 40, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : !currentFrame ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CyberPanel title="SYSTEM_MESSAGE" style={{ width: 400, padding: 40, alignItems: 'center', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: 48, height: 48, color: '#10b981', marginBottom: 16 }} />
                <h2 style={{ ...MONO, fontSize: 16, color: '#fff', marginBottom: 8 }}>QUEUE_CLEARED</h2>
                <p style={{ ...MONO, fontSize: 11, color: '#888', lineHeight: 1.5 }}>{filter === 'pending' ? 'All pending frames have been reviewed. You can now compile the training dataset.' : 'Adjust your filters to see frames.'}</p>
              </CyberPanel>
            </div>
          ) : (
            <>
              {/* Left Column: Frame Viewer & Labeling */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
                <CyberPanel title={`FRAME_VIEW // ID: ${pagination.page}/${pagination.totalPages}`} style={{ flex: 1 }}>
                  <div style={{ flex: 1, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', position: 'relative' }}>
                    <img
                      key={currentFrame._id || currentIdx}
                      src={currentFrame.frame_url}
                      alt="Frame for review"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    
                    {/* Overlay badge */}
                    <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: currentFrame.primary_label === 'FAKE' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', backdropFilter: 'blur(10px)', border: `1px solid ${currentFrame.primary_label === 'FAKE' ? '#f43f5e' : '#10b981'}`, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24, clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         {currentFrame.primary_label === 'FAKE' ? <AlertCircle size={18} color="#f43f5e" /> : <CheckCircle2 size={18} color="#10b981" />}
                         <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: currentFrame.primary_label === 'FAKE' ? '#f43f5e' : '#10b981' }}>AI_VERDICT: {currentFrame.primary_label}</span>
                      </div>
                      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
                      <span style={{ ...MONO, fontSize: 12, color: '#fff' }}>CONF: {(currentFrame.primary_confidence * 100).toFixed(1)}%</span>
                      <span style={{ ...MONO, fontSize: 10, padding: '4px 8px', background: currentFrame.trust_verdict === 'TRUSTED' ? 'rgba(16,185,129,0.2)' : currentFrame.trust_verdict === 'UNTRUSTED' ? 'rgba(244,63,94,0.2)' : 'rgba(99,102,241,0.2)', color: currentFrame.trust_verdict === 'TRUSTED' ? '#10b981' : currentFrame.trust_verdict === 'UNTRUSTED' ? '#f43f5e' : '#818cf8', border: '1px solid currentColor' }}>{currentFrame.trust_verdict}</span>
                    </div>
                  </div>
                </CyberPanel>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <button onClick={() => handleLabel('REAL')} disabled={saving} style={{ flex: 1, padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)', opacity: saving ? 0.5 : 1 }}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: '#10b981', letterSpacing: '0.1em' }}>MARK_REAL</span>
                  </button>
                  <button onClick={() => handleLabel('FAKE')} disabled={saving} style={{ flex: 1, padding: '16px', background: 'rgba(244,63,94,0.1)', border: '1px solid #f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)', opacity: saving ? 0.5 : 1 }}>
                    <AlertCircle size={20} color="#f43f5e" />
                    <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.1em' }}>MARK_FAKE</span>
                  </button>
                  <button onClick={handleSkip} style={{ padding: '16px 32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                    <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: '#ccc', letterSpacing: '0.1em' }}>SKIP</span>
                    <ChevronRight size={20} color="#ccc" />
                  </button>
                </div>

                {currentFrame.human_label && (
                  <div style={{ padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', display: 'flex', alignItems: 'center', gap: 12, clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                    <CheckCircle2 size={20} color="#818cf8" />
                    <span style={{ ...MONO, fontSize: 12, color: '#fff' }}>VERIFIED_AS: <strong style={{ color: '#818cf8' }}>{currentFrame.human_label}</strong></span>
                  </div>
                )}
              </div>

              {/* Right Column: Meta & Retrain */}
              <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 0 }}>
                <CyberPanel title="FRAME_METADATA" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    {[
                      { label: 'SESSION_ID', value: currentFrame.session_id?.slice(0, 16) + '...' },
                      { label: 'TIMESTAMP', value: new Date(currentFrame.timestamp).toLocaleTimeString() },
                      { label: 'PREDICTION', value: currentFrame.primary_label, color: currentFrame.primary_label === 'FAKE' ? '#f43f5e' : '#10b981' },
                      { label: 'CONFIDENCE', value: `${(currentFrame.primary_confidence * 100).toFixed(1)}%` },
                      { label: 'TRUST_STATUS', value: currentFrame.trust_verdict, color: currentFrame.trust_verdict === 'TRUSTED' ? '#10b981' : currentFrame.trust_verdict === 'UNTRUSTED' ? '#f43f5e' : '#818cf8' },
                      { label: 'TRUST_SCORE', value: `${(currentFrame.trust_score * 100).toFixed(1)}%` },
                      { label: 'LATENCY', value: `${currentFrame.latency_ms}ms` },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...MONO, fontSize: 10, color: '#666' }}>{label}</span>
                        <span style={{ ...MONO, fontSize: 11, color: color || '#fff', fontWeight: color ? 700 : 400 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </CyberPanel>

                <CyberPanel title="NEURAL_CALIBRATION" style={{ padding: '20px' }}>
                  {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ ...MONO, fontSize: 10, color: '#666' }}>DATASET_SIZE</span>
                        <span style={{ ...MONO, fontSize: 11, color: '#818cf8', fontWeight: 700 }}>{stats.available_for_training}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ ...MONO, fontSize: 10, color: '#666' }}>REQUIRED_MIN</span>
                        <span style={{ ...MONO, fontSize: 11, color: '#ccc' }}>50</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                        <span style={{ ...MONO, fontSize: 10, color: '#666' }}>SYS_STATUS</span>
                        <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: stats.ready_to_train ? '#10b981' : '#f59e0b' }}>
                          {stats.ready_to_train ? 'READY_FOR_COMPILE' : `AWAITING_${50 - stats.available_for_training}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRetrain}
                    disabled={retraining || !(stats?.ready_to_train)}
                    style={{ width: '100%', padding: '16px', background: stats?.ready_to_train ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${stats?.ready_to_train ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: stats?.ready_to_train ? 'pointer' : 'not-allowed', transition: 'all 0.2s', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)', color: stats?.ready_to_train ? '#818cf8' : '#666' }}
                  >
                    {retraining ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                    <span style={{ ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>{retraining ? 'COMPILING...' : 'INIT_TRAINING'}</span>
                  </button>

                  {retrainStatus?.candidate_accuracy != null && (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ ...MONO, fontSize: 10, color: '#10b981' }}>BASELINE_ACC</span>
                          <span style={{ ...MONO, fontSize: 11, color: '#fff' }}>{(retrainStatus.old_accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ ...MONO, fontSize: 10, color: '#10b981' }}>CANDIDATE_ACC</span>
                          <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#10b981' }}>{(retrainStatus.candidate_accuracy * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        style={{ width: '100%', padding: '16px', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: approving ? 'wait' : 'pointer', transition: 'all 0.2s', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)', color: '#10b981' }}
                      >
                        {approving ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        <span style={{ ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>{approving ? 'DEPLOYING...' : 'DEPLOY_CANDIDATE'}</span>
                      </button>
                    </div>
                  )}

                  {retrainStatus?.error && (
                    <div style={{ marginTop: 16, padding: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid #f43f5e' }}>
                      <p style={{ ...MONO, fontSize: 10, color: '#f43f5e', margin: 0 }}>ERR: {retrainStatus.error}</p>
                    </div>
                  )}

                  {retrainStatus?.message && (
                    <div style={{ marginTop: 16, padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1' }}>
                      <p style={{ ...MONO, fontSize: 10, color: '#818cf8', margin: 0 }}>SYS: {retrainStatus.message}</p>
                    </div>
                  )}
                </CyberPanel>
              </div>
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); }
      `}</style>
    </div>
  );
}
