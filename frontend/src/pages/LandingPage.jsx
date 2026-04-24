import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  ShieldAlert, ArrowRight, Scan, Cpu, Lock, Activity,
  Eye, ChevronRight, Terminal, Zap, Shield
} from 'lucide-react';

function Mono({ children, style = {}, className = '' }) {
  return (
    <span className={className} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', ...style }}>
      {children}
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", background: '#070710', color: '#fff', minHeight: '100vh' }}>

      {/* ─── BACKGROUND ─── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', background: '#020204' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'gridMove 20s linear infinite',
        }} />
        <div style={{ position: 'absolute', top: '-200px', left: '-100px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)', animation: 'floatOrb 15s ease-in-out infinite alternate' }} />
        <div style={{ position: 'absolute', bottom: '-150px', right: '-80px', width: '550px', height: '550px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', animation: 'floatOrb 12s ease-in-out infinite alternate-reverse' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)', backgroundSize: '100% 4px', zIndex: 10, opacity: 0.4 }} />
      </div>

      {/* ─── NAVBAR ─── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 64px', height: '64px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7,7,16,0.88)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert style={{ width: 14, height: 14, color: '#818cf8' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>
            Deep<span style={{ color: '#818cf8' }}>Shield</span><span style={{ color: '#333' }}>.ai</span>
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 32 }}>
          {['Features', 'How It Works', 'Docs'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
              style={{ fontSize: 13, color: '#666', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.2px' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = '#666'}>
              {l}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(isSignedIn ? '/dashboard' : '/sign-in')}
            style={{ background: 'none', border: 'none', color: '#666', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '6px 12px' }}
            onMouseEnter={e => e.target.style.color = '#fff'}
            onMouseLeave={e => e.target.style.color = '#666'}>
            Sign In
          </button>
          <button onClick={() => navigate(isSignedIn ? '/dashboard' : '/sign-up')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 10, border: 'none', color: '#fff', cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 20px rgba(79,70,229,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 32px rgba(79,70,229,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(79,70,229,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            Get Started <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section style={{ position: 'relative', zIndex: 1, paddingTop: 160, paddingBottom: 96, paddingLeft: 64, paddingRight: 64, maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>

        {/* Status pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#818cf8', opacity: 0.75, animation: 'ping 1.5s ease infinite' }} />
            <span style={{ position: 'relative', borderRadius: '50%', width: 6, height: 6, background: '#6366f1', display: 'inline-block' }} />
          </span>
          Forensic Neural Network — Active
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)', fontWeight: 900, lineHeight: 1.07, letterSpacing: '-0.04em', color: '#fff', marginBottom: 24, marginTop: 0 }}>
          Detect every deepfake.<br />
          <span style={{ 
            background: 'linear-gradient(to right, #818cf8, #a78bfa, #f0abfc, #818cf8)', 
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent', 
            backgroundClip: 'text',
            animation: 'gradientShine 4s linear infinite'
          }}>
            Before it deceives.
          </span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.1rem)', color: '#777', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7, fontWeight: 300 }}>
          Military-grade AI forensics that intercepts synthetic media in real time — frame by frame, face by face.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 56 }}>
          <button onClick={() => navigate(isSignedIn ? '/dashboard' : '/sign-up')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, padding: '14px 28px', borderRadius: 12, border: 'none', color: '#fff', cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 24px rgba(79,70,229,0.45)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 40px rgba(79,70,229,0.6)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(79,70,229,0.45)'; }}>
            Open Terminal <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={() => navigate('/detector')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, padding: '14px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
            <Terminal style={{ width: 16, height: 16, color: '#818cf8' }} />
            Try the Scanner
          </button>
        </div>

        {/* Trust indicators */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {[{ val: '99.8%', label: 'accuracy' }, { val: '<50ms', label: 'latency' }, { val: '12k+', label: 'scanned' }, { val: '347', label: 'threats blocked' }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mono style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.val}</Mono>
              <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DIVIDER STATS ─── */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.1)', padding: '40px 64px', background: 'rgba(99,102,241,0.02)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          {[
            { tag: 'Detection', val: '99.8%', sub: 'accuracy rate' },
            { tag: 'Analysis', val: '<50ms', sub: 'per frame' },
            { tag: 'Dataset', val: '12k+', sub: 'media processed' },
            { tag: 'Uptime', val: '99.9%', sub: 'availability' },
          ].map((s, i) => (
            <div key={s.tag} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', animation: `fadeInUp 0.6s ease-out ${i * 0.1}s both` }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#818cf8', marginBottom: 4 }}>{s.tag}</span>
              <Mono style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 0 20px rgba(99,102,241,0.5)' }}>{s.val}</Mono>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 500, marginTop: 4 }}>{s.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── FEATURES ─── */}
      <section id="features" style={{ position: 'relative', zIndex: 1, padding: '100px 64px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.07)', color: '#818cf8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            <Zap style={{ width: 11, height: 11 }} /> Capabilities
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#fff', marginBottom: 14, marginTop: 0 }}>
            Every layer of synthetic detection.
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#555', fontWeight: 300, maxWidth: 400, lineHeight: 1.6 }}>
            Not a single-trick classifier — a full forensic stack.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <FeatureCard icon={Activity} accent="#6366f1" eyebrow="Real-Time" title="Live Intercept"
            body="Hooks directly into WebRTC and conferencing streams. Detects face-swaps and audio spoofing with sub-50ms verdict latency." />
          <FeatureCard icon={Cpu} accent="#8b5cf6" eyebrow="Multi-Modal" title="Forensic Engine"
            body="GradCAM heatmaps, temporal frame analysis, and TTA augmentation running in parallel — catching what single-pass models miss." featured />
          <FeatureCard icon={Lock} accent="#a855f7" eyebrow="Zero-Trust" title="Air-Gapped Privacy"
            body="All inference happens locally. No media ever leaves your perimeter. No logs, no telemetry, no exposure." />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 1, padding: '60px 64px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(20,184,166,0.2)', background: 'rgba(20,184,166,0.07)', color: '#2dd4bf', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            <Eye style={{ width: 11, height: 11 }} /> Process
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#fff', marginBottom: 0, marginTop: 0 }}>
            Three steps to a verdict.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { n: '01', icon: Scan, title: 'Ingest', body: 'Upload a file, connect a stream, or hook into a live WebRTC session. All formats accepted.' },
            { n: '02', icon: Cpu, title: 'Analyze', body: 'The neural stack processes frequency domains, temporal patterns, and pixel-level artifacts simultaneously.' },
            { n: '03', icon: Shield, title: 'Verdict', body: 'Get a confidence-scored result with highlighted anomaly regions and a full downloadable audit report.' },
          ].map(({ n, icon: Icon, title, body }) => (
            <div key={n} className="step-card-hover" style={{ padding: '28px 28px 32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(20,20,25,0.6)', backdropFilter: 'blur(10px)', position: 'relative', overflow: 'hidden' }}>
              <Mono style={{ fontSize: 52, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, display: 'block', marginBottom: 20 }}>{n}</Mono>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, marginTop: -10 }}>
                <Icon style={{ width: 18, height: 18, color: '#818cf8' }} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10, marginTop: 0 }}>{title}</h3>
              <p style={{ fontSize: 13.5, color: '#aaa', lineHeight: 1.65, margin: 0, fontWeight: 300 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA BLOCK ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 64px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ position: 'relative', textAlign: 'center', padding: '72px 40px', borderRadius: 28, border: '1px solid rgba(99,102,241,0.22)', background: 'linear-gradient(135deg, rgba(79,70,229,0.09) 0%, rgba(124,58,237,0.06) 100%)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Mono style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 20 }}>// Ready to deploy</Mono>
            <h2 style={{ fontSize: 'clamp(2rem, 3.8vw, 3rem)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#fff', marginBottom: 16, marginTop: 0 }}>
              Start intercepting deepfakes today.
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#555', marginBottom: 40, fontWeight: 300, lineHeight: 1.6 }}>One click to the terminal. No setup required.</p>
            <button onClick={() => navigate(isSignedIn ? '/dashboard' : '/sign-up')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, padding: '15px 32px', borderRadius: 14, border: 'none', color: '#fff', cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 32px rgba(79,70,229,0.5)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 48px rgba(79,70,229,0.65)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 32px rgba(79,70,229,0.5)'; }}>
              Open DeepShield Terminal <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '24px 64px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert style={{ width: 12, height: 12, color: '#818cf8' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Deep<span style={{ color: '#818cf8' }}>Shield</span><span style={{ color: '#333' }}>.ai</span></span>
          </div>
          <Mono style={{ fontSize: 11, color: '#333' }}>© 2026 DeepShield.ai — Built for truth.</Mono>
        </div>
      </footer>

      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 0.75; } 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes floatOrb {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -50px) scale(1.05); }
          100% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes gridMove {
          0% { transform: translateY(0); }
          100% { transform: translateY(40px); }
        }
        @keyframes gradientShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feature-card-hover:hover .feature-icon-wrapper {
          transform: scale(1.1) rotate(5deg);
        }
        .step-card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .step-card-hover:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(99,102,241,0.3);
          background: rgba(255,255,255,0.04) !important;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon: Icon, accent, eyebrow, title, body, featured = false }) {
  return (
    <div
      className="feature-card-hover"
      style={{
        padding: '32px 28px', borderRadius: 20, position: 'relative', overflow: 'hidden',
        border: featured ? `1px solid ${accent}50` : '1px solid rgba(255,255,255,0.06)',
        background: featured ? `${accent}0e` : 'rgba(20,20,25,0.6)',
        backdropFilter: 'blur(12px)',
        boxShadow: featured ? `0 0 48px ${accent}14, inset 0 0 20px ${accent}0a` : 'inset 0 0 20px rgba(255,255,255,0.01)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 20px 48px ${accent}22, inset 0 0 20px ${accent}1a`; e.currentTarget.style.borderColor = `${accent}70`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = featured ? `0 0 48px ${accent}14, inset 0 0 20px ${accent}0a` : 'inset 0 0 20px rgba(255,255,255,0.01)'; e.currentTarget.style.borderColor = featured ? `${accent}50` : 'rgba(255,255,255,0.06)'; }}>
      {featured && (
        <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', padding: '4px 10px', borderRadius: 999, background: `${accent}22`, color: accent, border: `1px solid ${accent}40`, animation: 'ping 2s infinite alternate' }}>Core</div>
      )}
      <div className="feature-icon-wrapper" style={{ width: 44, height: 44, borderRadius: 14, background: `${accent}14`, border: `1px solid ${accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, transition: 'transform 0.3s' }}>
        <Icon style={{ width: 20, height: 20, color: accent }} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: accent, marginBottom: 10 }}>{eyebrow}</div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10, marginTop: 0, letterSpacing: '-0.02em' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: '#aaa', lineHeight: 1.65, margin: 0, fontWeight: 300 }}>{body}</p>
    </div>
  );
}
