/**
 * SessionReportPage.jsx
 * Forensic session report viewer with PDF-style layout.
 * Fetches session list + detailed reports from FastAPI /sessions endpoints.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ArrowLeft, Download, Shield, AlertTriangle,
  Clock, Layers, ChevronRight, Activity, Radio, Eye,
} from 'lucide-react';

const AI_SERVER = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';

const THREAT_COLORS = {
  CLEAR: '#34d399', LOW: '#a3e635', MODERATE: '#facc15',
  HIGH: '#f97316', CRITICAL: '#ef4444', UNKNOWN: '#71717a',
};

function ThreatBadge({ level }) {
  const color = THREAT_COLORS[level] || '#71717a';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.05em', border: `1px solid ${color}30`,
      background: `${color}15`, color,
    }}>{level}</span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)', textAlign: 'center',
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: color || '#fff', marginBottom: 2 }}>{value}</p>
      <p style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</p>
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
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', background: '#080808', color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,.15); border-radius: 10px; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)',
      }}>
        <button onClick={() => report ? (setReport(null), setSelectedSession(null)) : navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#a1a1aa', fontSize: 12,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>
          <ArrowLeft size={12} /> {report ? 'Back to Sessions' : 'Dashboard'}
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>
            Session Reports
          </h1>
        </div>
        {report && (
          <button onClick={exportJSON} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 10, border: 'none', background: 'rgba(52,211,153,0.15)',
            color: '#34d399', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            <Download size={12} /> Export JSON
          </button>
        )}
      </header>

      <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 12, marginBottom: 18,
            border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)',
            fontSize: 12, color: '#ef4444',
          }}>⚠ {error}</div>
        )}

        {/* Sessions List View */}
        {!report && (
          <>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>
              {loading ? 'Loading sessions…' : `${sessions.length} session(s) found`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map(sess => (
                <button key={sess.session_id} onClick={() => loadReport(sess.session_id)} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 18,
                  alignItems: 'center', padding: '16px 20px', borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                  transition: 'border-color 0.2s',
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d8', marginBottom: 3 }}>
                      <FileText size={11} style={{ marginRight: 6, verticalAlign: '-1px' }} />
                      {sess.session_id.slice(0, 16)}…
                    </p>
                    <p style={{ fontSize: 10, color: '#52525b' }}>
                      {sess.started_at ? new Date(sess.started_at).toLocaleString() : '—'} · {sess.frame_count} frames · {sess.duration_seconds}s
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: sess.fake_count > 0 ? '#ef4444' : '#34d399' }}>
                      {sess.fake_count}
                    </p>
                    <p style={{ fontSize: 8, color: '#52525b', textTransform: 'uppercase' }}>Fakes</p>
                  </div>
                  <ThreatBadge level={sess.threat_level} />
                  <ChevronRight size={14} color="#3f3f46" />
                </button>
              ))}
              {!loading && sessions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#3f3f46', fontSize: 13 }}>
                  No sessions recorded yet. Run a live detection scan first.
                </div>
              )}
            </div>
          </>
        )}

        {/* Report Detail View */}
        {reportLoading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#52525b' }}>
            <div className="spin-anim" style={{
              width: 24, height: 24, border: '2px solid rgba(52,211,153,0.3)',
              borderTopColor: '#34d399', borderRadius: '50%', margin: '0 auto 12px',
            }} />
            Generating report…
          </div>
        )}

        {report && s && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary Header */}
            <div style={{
              padding: '24px 28px', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <Shield size={20} color={THREAT_COLORS[s.threat_level]} />
                <div>
                  <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
                    Forensic Analysis Report
                  </h2>
                  <p style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
                    Session: {report.session_id} · Generated: {new Date(report.generated_at).toLocaleString()}
                  </p>
                </div>
                <div style={{ marginLeft: 'auto' }}><ThreatBadge level={s.threat_level} /></div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                <StatCard label="Total Frames" value={s.total_frames} />
                <StatCard label="Duration" value={`${s.duration_seconds}s`} />
                <StatCard label="Fake Frames" value={s.fake_frames} color="#ef4444" />
                <StatCard label="Fake %" value={`${s.fake_percentage}%`} color={s.fake_percentage > 25 ? '#ef4444' : '#facc15'} />
                <StatCard label="Max Streak" value={s.max_consecutive_fakes} color={s.max_consecutive_fakes >= 3 ? '#ef4444' : '#71717a'} />
              </div>
            </div>

            {/* Performance & Trust Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{
                padding: '20px 24px', borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
              }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 14 }}>
                  <Activity size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} /> Performance
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <StatCard label="Avg Latency" value={`${s.avg_latency_ms}ms`} />
                  <StatCard label="Max Latency" value={`${s.max_latency_ms}ms`} />
                  <StatCard label="Avg Confidence" value={`${(s.avg_confidence * 100).toFixed(0)}%`} />
                </div>
              </div>
              <div style={{
                padding: '20px 24px', borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
              }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 14 }}>
                  <Shield size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} /> Trust Analysis
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatCard label="Avg Trust" value={`${(s.avg_trust_score * 100).toFixed(0)}%`} color="#8b5cf6" />
                  <StatCard label="Untrusted" value={s.untrusted_frames} color={s.untrusted_frames > 0 ? '#f97316' : '#34d399'} />
                </div>
              </div>
            </div>

            {/* Flagged Frames */}
            {report.flagged_frames?.length > 0 && (
              <div style={{
                padding: '20px 24px', borderRadius: 18,
                border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.03)',
              }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', fontWeight: 600, marginBottom: 14 }}>
                  <AlertTriangle size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                  Flagged Frames ({report.flagged_frames.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                  {report.flagged_frames.slice(0, 20).map((f, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14,
                      alignItems: 'center', padding: '10px 14px', borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)',
                    }}>
                      <span style={{ fontSize: 11, color: '#a1a1aa' }}>
                        {f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : `Frame #${i + 1}`}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                        {(f.confidence * 100).toFixed(1)}%
                      </span>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 6,
                        background: f.trust_verdict === 'UNTRUSTED' ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
                        color: f.trust_verdict === 'UNTRUSTED' ? '#ef4444' : '#34d399',
                        fontWeight: 600,
                      }}>{f.trust_verdict}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div style={{
              padding: '20px 24px', borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
            }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', fontWeight: 600, marginBottom: 14 }}>
                <Clock size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />
                Detection Timeline ({report.timeline?.length || 0} frames)
              </p>
              <div style={{ display: 'flex', gap: 2, height: 40, alignItems: 'flex-end' }}>
                {(report.timeline || []).slice(0, 100).map((t, i) => (
                  <div key={i} style={{
                    flex: 1, minWidth: 2,
                    height: `${Math.max(10, t.confidence * 100)}%`,
                    borderRadius: '2px 2px 0 0',
                    background: t.label === 'FAKE' ? '#ef4444' : t.label === 'REAL' ? '#34d399' : '#3f3f46',
                    opacity: 0.8,
                    transition: 'height 0.3s ease',
                  }} title={`${t.label} ${(t.confidence * 100).toFixed(0)}%`} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 9, color: '#3f3f46' }}>Start</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 9, color: '#34d399' }}>■ Real</span>
                  <span style={{ fontSize: 9, color: '#ef4444' }}>■ Fake</span>
                </div>
                <span style={{ fontSize: 9, color: '#3f3f46' }}>End</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
