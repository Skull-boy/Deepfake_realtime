import { useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  Shield, Camera, Activity, ShieldAlert,
  ChevronRight, BarChart3, Database,
  User, CheckCircle2, Zap, ArrowUpRight, Layers, Video,
  Eye, Brain, Fingerprint, Waves, Scan, FileText, Radio
} from 'lucide-react';

/* ─────────────────────────────────────────────
   DESIGN SYSTEM — Forensic Terminal Luxury
   Tone: Luxury Minimal × Industrial Utilitarian
   DFII: 13/15
   Anchor: Asymmetric bento + dominant hero stat card
   Typography: Syne (display) + DM Sans (body)
───────────────────────────────────────────── */

export default function Dashboard() {
  /* ── auth & navigation (untouched) ── */
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  /* ── GSAP refs (untouched) ── */
  const headerRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(headerRef.current,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8 }
    )
      .fromTo(cardsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
        '-=0.6'
      );
  }, []);

  const addToRefs = (el) => {
    if (el && !cardsRef.current.includes(el)) {
      cardsRef.current.push(el);
    }
  };

  /* ── Clerk loading guard (untouched) ── */
  if (!isLoaded) return null;

  /* ── Quick Actions Data ── */
  const quickActions = [
    { icon: Camera, label: 'Live Webcam', action: () => navigate('/detector'), accent: '#34d399' },
    { icon: Video, label: 'Live Interview', action: () => navigate('/live-call'), accent: '#22d3ee' },
    { icon: Layers, label: 'Upload Media', action: () => navigate('/detector'), accent: '#818cf8' },
    { icon: Eye, label: 'Frame Review', action: () => navigate('/review'), accent: '#f59e0b' },
    { icon: FileText, label: 'Reports', action: () => navigate('/reports'), accent: '#f472b6' },
  ];

  /* ── AI Capabilities ── */
  const capabilities = [
    { icon: Scan, title: 'GradCAM', desc: 'Attention heatmaps', accent: '#818cf8' },
    { icon: Waves, title: 'Temporal', desc: 'Multi-frame drift', accent: '#22d3ee' },
    { icon: Fingerprint, title: 'TTA', desc: 'Adversarial defense', accent: '#c084fc' },
    { icon: Radio, title: 'Spectral', desc: 'Frequency analysis', accent: '#f472b6' },
    { icon: Brain, title: 'Trust Meta', desc: 'Confidence scoring', accent: '#f59e0b' },
  ];

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="h-screen w-screen bg-[#060606] text-white flex flex-col overflow-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.08); }
        }
        .orb-a { animation: drift-a 14s ease-in-out infinite; }

        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        .pulse-ring { animation: pulse-ring 1.8s ease-out infinite; }

        @keyframes shimmer-g {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .btn-shimmer {
          background: linear-gradient(90deg,#059669 0%,#34d399 40%,#059669 100%);
          background-size: 200% 100%;
          animation: shimmer-g 2.8s linear infinite;
        }

        @keyframes count-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stat-val { animation: count-up 0.6s ease forwards; }

        ::-webkit-scrollbar       { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(52,211,153,.12); border-radius: 10px; }
      `}</style>

      {/* Ambient glow — subtle single orb */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div className="orb-a" style={{
          position: 'absolute', top: '-8%', right: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 70%)',
        }} />
      </div>

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header
        ref={headerRef}
        style={{
          flexShrink: 0, height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(6,6,6,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          zIndex: 50, position: 'relative',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 10,
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg,#34d399,#22d3ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={13} color="#060606" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700,
              fontSize: 13, color: '#fff', lineHeight: 1, letterSpacing: '-0.01em',
            }}>
              DeepSheild<span style={{ color: '#34d399' }}>.ai</span>
            </p>
          </div>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            border: '1px solid rgba(52,211,153,0.15)',
            background: 'rgba(52,211,153,0.04)',
            fontSize: 10, color: '#34d399', fontWeight: 500,
          }}>
            <span style={{ position: 'relative', width: 6, height: 6, display: 'flex' }}>
              <span className="pulse-ring" style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: '#34d399',
              }} />
              <span style={{
                position: 'relative', width: 6, height: 6, borderRadius: '50%', background: '#34d399',
              }} />
            </span>
            Online
          </div>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { userButtonAvatarBox: 'w-7 h-7 border border-emerald-500/20' }
            }}
          />
        </div>
      </header>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 10 }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          padding: '32px 24px 48px',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>

          {/* ════ GREETING ════ */}
          <div ref={addToRefs} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <h1 style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800,
                fontSize: 'clamp(22px, 3.5vw, 32px)',
                letterSpacing: '-0.04em', lineHeight: 1.1,
                color: '#fff', margin: 0,
              }}>
                Welcome back,{' '}
                <span style={{
                  background: 'linear-gradient(135deg,#34d399,#22d3ee)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {user?.firstName || 'Agent'}
                </span>
              </h1>
              <p style={{ fontSize: 13, color: '#52525b', marginTop: 6, lineHeight: 1.5 }}>
                Monitor threats, analyze media, or launch a detection session.
              </p>
            </div>
            <button
              onClick={() => navigate('/detector')}
              className="btn-shimmer"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 12,
                border: 'none', color: '#060606',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', flexShrink: 0,
                fontFamily: 'DM Sans, sans-serif',
                boxShadow: '0 0 24px rgba(52,211,153,0.2)',
              }}
            >
              <Camera size={13} />
              Launch Studio
              <ArrowUpRight size={12} />
            </button>
          </div>

          {/* ════ STATS ROW — clean horizontal cards ════ */}
          <div ref={addToRefs} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

            {/* Model Accuracy */}
            <div style={{
              padding: '22px 24px', borderRadius: 18,
              border: '1px solid rgba(52,211,153,0.1)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>
                  Model Accuracy
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span className="stat-val" style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: 36, letterSpacing: '-0.04em', color: '#fff',
                  }}>96.64</span>
                  <span style={{ fontSize: 16, color: '#3f3f46', fontWeight: 600 }}>%</span>
                </div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(52,211,153,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShieldAlert size={18} color="#34d399" />
              </div>
            </div>

            {/* Engine Status */}
            <div style={{
              padding: '22px 24px', borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>
                  Engine Status
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="stat-val" style={{
                    fontFamily: 'Syne, sans-serif', fontWeight: 800,
                    fontSize: 22, letterSpacing: '-0.02em', color: '#34d399',
                  }}>Optimal</span>
                  <span style={{
                    fontSize: 10, color: '#3f3f46', padding: '2px 8px',
                    borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                  }}>{'< 50ms'}</span>
                </div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(34,211,238,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={18} color="#22d3ee" />
              </div>
            </div>

            {/* Scans */}
            <div style={{
              padding: '22px 24px', borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>
                  Scans Performed
                </p>
                <span className="stat-val" style={{
                  fontFamily: 'Syne, sans-serif', fontWeight: 800,
                  fontSize: 30, letterSpacing: '-0.03em', color: '#fff',
                }}>1,048</span>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Database size={18} color="#71717a" />
              </div>
            </div>
          </div>

          {/* ════ QUICK ACTIONS — icon row ════ */}
          <div ref={addToRefs}>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#3f3f46', marginBottom: 12,
            }}>Quick Actions</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {quickActions.map(({ icon: Icon, label, action, accent }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 8,
                    padding: '18px 12px', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.015)',
                    cursor: 'pointer', color: '#fff',
                    transition: 'all 0.2s ease',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${accent}08`;
                    e.currentTarget.style.borderColor = `${accent}25`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${accent}10`,
                    border: `1px solid ${accent}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={15} color={accent} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ════ AI CAPABILITIES — compact inline strip ════ */}
          <div ref={addToRefs}>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#3f3f46', marginBottom: 12,
            }}>AI Capabilities</p>
            <div style={{
              display: 'flex', gap: 8,
              padding: '14px 18px', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(255,255,255,0.015)',
            }}>
              {capabilities.map(({ icon: Icon, title, desc, accent }, i) => (
                <div key={title} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  borderRight: i < capabilities.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
                  onClick={() => navigate('/detector')}
                  onMouseEnter={e => e.currentTarget.style.background = `${accent}06`}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={14} color={accent} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d8', lineHeight: 1, marginBottom: 2 }}>{title}</p>
                    <p style={{ fontSize: 10, color: '#3f3f46', lineHeight: 1 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ════ TRUST META-CLASSIFIER + REPORTS — side by side ════ */}
          <div ref={addToRefs} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Trust */}
            <button
              onClick={() => navigate('/review')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 22px', borderRadius: 18, textAlign: 'left',
                border: '1px solid rgba(245,158,11,0.1)',
                background: 'rgba(255,255,255,0.015)',
                cursor: 'pointer', color: '#fff',
                transition: 'all 0.2s',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)';
                e.currentTarget.style.background = 'rgba(245,158,11,0.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Brain size={17} color="#f59e0b" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, lineHeight: 1, marginBottom: 4 }}>
                  Trust Meta-Classifier
                </p>
                <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.3 }}>
                  Review frames and retrain the trust layer
                </p>
              </div>
              <ChevronRight size={14} color="#3f3f46" style={{ flexShrink: 0 }} />
            </button>

            {/* Session Reports */}
            <button
              onClick={() => navigate('/reports')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 22px', borderRadius: 18, textAlign: 'left',
                border: '1px solid rgba(244,114,182,0.1)',
                background: 'rgba(255,255,255,0.015)',
                cursor: 'pointer', color: '#fff',
                transition: 'all 0.2s',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(244,114,182,0.25)';
                e.currentTarget.style.background = 'rgba(244,114,182,0.03)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(244,114,182,0.1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(244,114,182,0.08)',
                border: '1px solid rgba(244,114,182,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={17} color="#f472b6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, lineHeight: 1, marginBottom: 4 }}>
                  Session Reports
                </p>
                <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.3 }}>
                  Forensic audit logs and threat analysis
                </p>
              </div>
              <ChevronRight size={14} color="#3f3f46" style={{ flexShrink: 0 }} />
            </button>
          </div>

          {/* ════ RECENT SCANS ════ */}
          <div ref={addToRefs}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#3f3f46',
              }}>Recent Activity</p>
              <button
                onClick={() => navigate('/reports')}
                style={{
                  fontSize: 10, color: '#34d399', fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                View All <ChevronRight size={10} />
              </button>
            </div>

            <div style={{
              padding: '40px 28px', borderRadius: 18, textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.01)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(52,211,153,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BarChart3 size={20} color="#34d399" style={{ opacity: 0.5 }} />
              </div>
              <h4 style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 700,
                fontSize: 14, color: '#a1a1aa', margin: '0 0 6px',
              }}>
                No activity yet
              </h4>
              <p style={{ fontSize: 11, color: '#3f3f46', maxWidth: 300, margin: '0 auto 20px', lineHeight: 1.5 }}>
                Start a detection session — your secure logs will appear here.
              </p>
              <button
                onClick={() => navigate('/detector')}
                className="btn-shimmer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 10,
                  border: 'none', color: '#060606',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                <Zap size={11} />
                Analyze Media
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
