/**
 * SessionReportPage.jsx
 * Forensic session report viewer with PDF-style layout.
 * Fetches session list + detailed reports from FastAPI /sessions endpoints.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ArrowLeft, Download, Shield, AlertTriangle,
  Clock, Layers, ChevronRight, Activity, Radio, Eye, Scan,
  CheckCircle2, AlertCircle, Crosshair
} from 'lucide-react';

const AI_SERVER = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';

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

const THREAT_COLORS = {
  CLEAR: { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  LOW: { color: '#a3e635', bg: 'rgba(163,230,53,0.1)' },
  MODERATE: { color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  HIGH: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  CRITICAL: { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
  UNKNOWN: { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
};

function ThreatBadge({ level }) {
  const theme = THREAT_COLORS[level] || THREAT_COLORS.UNKNOWN;
  return (
    <span style={{ ...MONO, padding: '4px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', border: `1px solid ${theme.color}`, background: theme.bg, color: theme.color, textTransform: 'uppercase' }}>
      {level}
    </span>
  );
}

function StatCard({ label, value, color = "#fff" }) {
  return (
    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
      <p style={{ ...SANS, fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>{value}</p>
      <p style={{ ...MONO, fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>{label}</p>
    </div>
  );
}

export default function SessionReportPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch sessions list
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AI_SERVER}/sessions?limit=50`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        setSessions(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load report for selected session
  const loadReport = useCallback(async (sessionId) => {
    setSelectedSession(sessionId);
    setReportLoading(true);
    setReport(null);
    try {
      const res = await fetch(`${AI_SERVER}/sessions/${sessionId}/report`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setReportLoading(false);
    }
  }, []);

  // Export report as JSON download
  const exportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepshield_report_${selectedSession}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = report?.summary;

  return (
    <div style={{ ...SANS, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#e2e4f0', overflow: 'hidden' }}>
      <GridBackground />

      {/* Header HUD */}
      <header style={{ position: 'relative', zIndex: 10, height: 60, borderBottom: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,5,8,0.7)', backdropFilter: 'blur(10px)', padding: '0 24px', flexShrink: 0, clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            onClick={() => report ? (setReport(null), setSelectedSession(null)) : navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', cursor: 'pointer', ...MONO, fontSize: 11 }}
          >
            <ArrowLeft size={14} /> {report ? 'BACK_TO_REGISTRY' : 'TERMINAL_OVERVIEW'}
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <Scan size={20} color="#818cf8" />
          <h1 style={{ ...SANS, fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>
            FORENSIC_REPORTS
          </h1>
        </div>
        
        {report && (
          <button 
            onClick={exportJSON} 
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f1', color: '#818cf8', cursor: 'pointer', ...MONO, fontSize: 11, fontWeight: 700 }}
          >
            <Download size={14} /> EXPORT_JSON
          </button>
        )}
      </header>

      <main style={{ position: 'relative', zIndex: 10, flex: 1, overflowY: 'auto', padding: '30px', width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '16px', marginBottom: 24, background: 'rgba(244,63,94,0.1)', border: '1px solid #f43f5e', color: '#f43f5e', ...MONO, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> SYS_ERR: {error}
          </div>
        )}

        {/* Sessions List View */}
        {!report && (
          <CyberPanel title="SESSION_REGISTRY" style={{ minHeight: 400 }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Layers size={18} color="#818cf8" />
                <span style={{ ...MONO, fontSize: 12, color: '#ccc', letterSpacing: '0.1em' }}>ARCHIVED_SESSIONS</span>
              </div>
              <span style={{ ...MONO, fontSize: 12, color: '#10b981' }}>
                {loading ? 'SYNCING...' : `${sessions.length} ENTRIES`}
              </span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sessions.map(sess => (
                <button 
                  key={sess.session_id} 
                  onClick={() => loadReport(sess.session_id)} 
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 24, alignItems: 'center', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div>
                    <p style={{ ...MONO, fontSize: 13, color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} color="#818cf8" />
                      {sess.session_id}
                    </p>
                    <p style={{ ...MONO, fontSize: 10, color: '#666' }}>
                      {sess.started_at ? new Date(sess.started_at).toLocaleString() : '—'} <span style={{ color: '#444', margin: '0 8px' }}>|</span> {sess.frame_count} FRAMES <span style={{ color: '#444', margin: '0 8px' }}>|</span> {sess.duration_seconds}S
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 16px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ ...SANS, fontSize: 18, fontWeight: 700, color: sess.fake_count > 0 ? '#f43f5e' : '#10b981', margin: 0 }}>
                      {sess.fake_count}
                    </p>
                    <p style={{ ...MONO, fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>FAKES</p>
                  </div>
                  <ThreatBadge level={sess.threat_level} />
                  <ChevronRight size={20} color="#666" />
                </button>
              ))}
              {!loading && sessions.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', color: '#666', ...MONO, fontSize: 12 }}>
                  NO_RECORDS_FOUND. INITIATE LIVE SCAN.
                </div>
              )}
            </div>
          </CyberPanel>
        )}

        {/* Report Detail View */}
        {reportLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#818cf8', ...MONO }}>
            <div style={{ width: 32, height: 32, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <p style={{ fontSize: 12, letterSpacing: '0.2em' }}>DECRYPTING_REPORT...</p>
          </div>
        )}

        {report && s && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.5s ease' }}>
            
            {/* Summary Header */}
            <CyberPanel title="ANALYSIS_SUMMARY" style={{ overflow: 'visible' }}>
              <div style={{ padding: '30px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, position: 'relative', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                      <Shield size={24} color="#818cf8" />
                    </div>
                    <div>
                      <h2 style={{ ...SANS, fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.05em' }}>FORENSIC_AUDIT_REPORT</h2>
                      <p style={{ ...MONO, fontSize: 11, color: '#888', marginTop: 4 }}>
                        SESSION: {report.session_id} <span style={{ margin: '0 8px', color: '#444' }}>|</span> GENERATED: {new Date(report.generated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ThreatBadge level={s.threat_level} />
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, position: 'relative', zIndex: 10 }}>
                  <StatCard label="TOTAL_FRAMES" value={s.total_frames} />
                  <StatCard label="DURATION" value={`${s.duration_seconds}s`} />
                  <StatCard label="FAKE_FRAMES" value={s.fake_frames} color={s.fake_frames > 0 ? '#f43f5e' : '#fff'} />
                  <StatCard label="FAKE_PERCENT" value={`${s.fake_percentage}%`} color={s.fake_percentage > 25 ? '#f43f5e' : s.fake_percentage > 0 ? '#facc15' : '#10b981'} />
                  <StatCard label="MAX_STREAK" value={s.max_consecutive_fakes} color={s.max_consecutive_fakes >= 3 ? '#f43f5e' : '#fff'} />
                </div>
              </div>
            </CyberPanel>

            {/* Performance & Trust Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <CyberPanel title="SYS_PERFORMANCE">
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <Activity size={16} color="#c084fc" />
                    <h3 style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.15em', margin: 0 }}>TELEMETRY</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <StatCard label="AVG_LATENCY" value={`${s.avg_latency_ms}ms`} />
                    <StatCard label="MAX_LATENCY" value={`${s.max_latency_ms}ms`} />
                    <StatCard label="CONFIDENCE" value={`${(s.avg_confidence * 100).toFixed(0)}%`} color="#c084fc" />
                  </div>
                </div>
              </CyberPanel>

              <CyberPanel title="TRUST_MATRIX">
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <Shield size={16} color="#10b981" />
                    <h3 style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.15em', margin: 0 }}>META_CLASSIFIER</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <StatCard label="AVG_TRUST_SCORE" value={`${(s.avg_trust_score * 100).toFixed(0)}%`} color="#10b981" />
                    <StatCard label="UNTRUSTED_SCANS" value={s.untrusted_frames} color={s.untrusted_frames > 0 ? '#fb923c' : '#10b981'} />
                  </div>
                </div>
              </CyberPanel>
            </div>

            {/* Flagged Frames */}
            {report.flagged_frames?.length > 0 && (
              <CyberPanel title={`FLAGGED_ANOMALIES [${report.flagged_frames.length}]`} style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
                <div style={{ padding: '24px', background: 'rgba(244,63,94,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {report.flagged_frames.slice(0, 20).map((f, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ ...MONO, fontSize: 11, color: '#ccc' }}>
                          {f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : `FRAME_#${i + 1}`}
                        </span>
                        <span style={{ ...SANS, fontSize: 14, fontWeight: 700, color: '#f43f5e' }}>
                          {(f.confidence * 100).toFixed(1)}% CONF
                        </span>
                        <span style={{ ...MONO, fontSize: 10, fontWeight: 700, padding: '4px 8px', letterSpacing: '0.1em', background: f.trust_verdict === 'UNTRUSTED' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', color: f.trust_verdict === 'UNTRUSTED' ? '#f43f5e' : '#10b981', border: `1px solid ${f.trust_verdict === 'UNTRUSTED' ? '#f43f5e' : '#10b981'}` }}>
                          {f.trust_verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CyberPanel>
            )}

            {/* Timeline */}
            <CyberPanel title="CHRONOLOGICAL_MAP">
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#10b981' }} /><span style={{ ...MONO, fontSize: 10, color: '#888' }}>AUTHENTIC</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, background: '#f43f5e' }} /><span style={{ ...MONO, fontSize: 10, color: '#888' }}>SYNTHETIC</span></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, background: 'rgba(0,0,0,0.3)', padding: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                  {(report.timeline || []).slice(0, 100).map((t, i) => (
                    <div 
                      key={i} 
                      style={{
                        flex: 1,
                        minWidth: 2,
                        height: `${Math.max(10, t.confidence * 100)}%`,
                        background: t.label === 'FAKE' ? '#f43f5e' : t.label === 'REAL' ? '#6366f1' : '#555',
                        opacity: 0.8,
                        transition: 'all 0.2s'
                      }} 
                      title={`Frame ${i + 1}: ${t.label} ${(t.confidence * 100).toFixed(0)}%`} 
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                  <span style={{ ...MONO, fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>T-0.00</span>
                  <span style={{ ...MONO, fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>T-END</span>
                </div>
              </div>
            </CyberPanel>

          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); }
      `}</style>
    </div>
  );
}
