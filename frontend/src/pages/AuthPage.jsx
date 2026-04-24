import { SignIn, SignUp } from '@clerk/clerk-react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage({ mode = 'signin' }) {
  const navigate = useNavigate();
  const isSignIn = mode === 'signin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#070710', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: '#fff', position: 'relative', overflow: 'hidden' }}>

      {/* ─── BACKGROUND ─── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.09) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }} />
        <div style={{ position: 'absolute', top: '-150px', left: '-100px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.11) 0%, transparent 70%)' }} />
      </div>

      {/* ─── LEFT PANEL ─── */}
      <div style={{ display: 'none', flex: '0 0 50%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 72px', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 1 }}
        className="lg-panel">

        {/* Logo */}
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }} onClick={() => navigate('/')}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert style={{ width: 15, height: 15, color: '#818cf8' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
            Deep<span style={{ color: '#818cf8' }}>Shield</span><span style={{ color: '#2a2a3a' }}>.ai</span>
          </span>
        </div>

        {/* Hero text */}
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20, padding: '5px 14px', borderRadius: 999, border: '1px solid rgba(20,184,166,0.28)', background: 'rgba(20,184,166,0.08)', color: '#5eead4', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', display: 'inline-block', animation: 'ping 2s infinite' }} />
            Secure Gateway
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 3vw, 2.8rem)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: 20, marginTop: 0 }}>
            Access the<br />
            <span style={{ background: 'linear-gradient(135deg, #2dd4bf, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Terminal.
            </span>
          </h1>
          <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.7, fontWeight: 300, margin: 0 }}>
            Authenticate to enter the DeepShield dashboard. All sessions are end-to-end encrypted and monitored.
          </p>
        </div>

        {/* Terminal Logs */}
        <div style={{ marginTop: 56, width: '100%', maxWidth: 420, padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#555', lineHeight: 1.8, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.5), transparent)' }} />
          <div style={{ color: '#2dd4bf', marginBottom: 12, fontWeight: 800, letterSpacing: '0.1em' }}>// SYSTEM STATUS</div>
          <div><span style={{ color: '#2dd4bf' }}>[OK]</span> Encrypted tunnel established.</div>
          <div><span style={{ color: '#2dd4bf' }}>[OK]</span> Forensic neural network active.</div>
          <div><span style={{ color: '#8b5cf6' }}>[SYNC]</span> Connecting to threat database...</div>
          <div><span style={{ color: '#f59e0b' }}>[WAIT]</span> Awaiting user authentication...</div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#818cf8' }}>root@deepshield:~$</span>
            <span style={{ display: 'inline-block', width: 8, height: 14, background: '#818cf8', animation: 'blink 1s step-end infinite' }} />
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL (auth form) ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

        {/* Top logo for mobile / solo layout */}
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }} onClick={() => navigate('/')}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert style={{ width: 14, height: 14, color: '#818cf8' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>
            Deep<span style={{ color: '#818cf8' }}>Shield</span><span style={{ color: '#333' }}>.ai</span>
          </span>
        </div>

        {/* Heading above the Clerk widget */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, marginTop: 0 }}>
            {isSignIn ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
            {isSignIn
              ? (<>No account? <span style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/sign-up')}>Sign up free →</span></>)
              : (<>Already have one? <span style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/sign-in')}>Sign in →</span></>)
            }
          </p>
        </div>

        {/* Clerk widget — dark theme */}
        {isSignIn ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            appearance={{
              variables: {
                colorPrimary: '#6366f1',
                colorBackground: '#0e0e1a',
                colorText: '#e2e4f0',
                colorTextSecondary: '#666',
                colorInputBackground: '#161625',
                colorInputText: '#e2e4f0',
                fontFamily: "'Inter', sans-serif",
                borderRadius: '12px',
              },
              elements: {
                card: {
                  background: '#0e0e1a',
                  border: '1px solid rgba(99,102,241,0.18)',
                  boxShadow: '0 0 60px rgba(99,102,241,0.10)',
                  borderRadius: '20px',
                },
                headerTitle: { display: 'none' },
                headerSubtitle: { display: 'none' },
                socialButtonsBlockButton: {
                  background: '#161625',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#ccc',
                },
                dividerText: { color: '#333' },
                dividerLine: { background: 'rgba(255,255,255,0.06)' },
                formFieldInput: {
                  background: '#161625',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e4f0',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
                },
                footerActionLink: { color: '#818cf8' },
                footerAction: { display: 'none' },
              },
            }}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            appearance={{
              variables: {
                colorPrimary: '#6366f1',
                colorBackground: '#0e0e1a',
                colorText: '#e2e4f0',
                colorTextSecondary: '#666',
                colorInputBackground: '#161625',
                colorInputText: '#e2e4f0',
                fontFamily: "'Inter', sans-serif",
                borderRadius: '12px',
              },
              elements: {
                card: {
                  background: '#0e0e1a',
                  border: '1px solid rgba(99,102,241,0.18)',
                  boxShadow: '0 0 60px rgba(99,102,241,0.10)',
                  borderRadius: '20px',
                },
                headerTitle: { display: 'none' },
                headerSubtitle: { display: 'none' },
                socialButtonsBlockButton: {
                  background: '#161625',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#ccc',
                },
                dividerText: { color: '#333' },
                dividerLine: { background: 'rgba(255,255,255,0.06)' },
                formFieldInput: {
                  background: '#161625',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e2e4f0',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
                },
                footerActionLink: { color: '#818cf8' },
                footerAction: { display: 'none' },
              },
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 0.75; } 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @media (min-width: 1024px) {
          .lg-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}