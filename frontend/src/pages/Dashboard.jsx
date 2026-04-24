import { useUser, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Video, LayoutDashboard, FileText, ShieldAlert,
  Activity, ArrowRight, Scan, ShieldCheck, AlertTriangle,
  Fingerprint, Database, CheckCircle2, Zap, Terminal,
  Cpu, Network, Lock, Crosshair, Radio
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const MONO = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" };
const SANS = { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" };

/* ── FAKE THREAT DATA ── */
const FEED_INIT = [
  { id: '0x9F2A', ts: '01:31:44.120', type: 'GAN.FaceSwap', node: 'us-east-1a', conf: 98.4, status: 'BLOCKED', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { id: '0x8E1B', ts: '01:28:11.045', type: 'Voice.Clone', node: 'eu-central-1', conf: 91.2, status: 'QUARANTINE', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
  { id: '0x7D0C', ts: '01:24:59.882', type: 'LipSync.Mismatch', node: 'ap-south-1', conf: 88.7, status: 'BLOCKED', hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e' },
  { id: '0x6C3D', ts: '01:19:02.310', type: 'Temporal.Flicker', node: 'us-west-2c', conf: 76.5, status: 'REVIEW', hash: '9b752df81c8106a35012e84dcc6bc071a5c6d36e2f1f31f9b7c858c2e68cdbf7' },
  { id: '0x5B2E', ts: '01:12:37.551', type: 'Deepfake.Unknown', node: 'us-east-1b', conf: 99.1, status: 'BLOCKED', hash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' },
];

/* ── HELPERS ── */
const generateWave = (points, width, height, phase = 0) => {
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = (Math.sin(i * 0.5 + phase) * Math.cos(i * 0.2) * 0.4 + 0.5) * height;
    return `${x},${y}`;
  }).join(' ');
};

function RadarScan() {
  return (
    <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.2)', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 0deg, transparent 70%, rgba(16,185,129,0.4) 100%)', animation: 'radar 3s linear infinite', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 2, background: '#10b981', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 0 10px 2px #10b981' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(16,185,129,0.2)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(16,185,129,0.2)' }} />
      <style>{`@keyframes radar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function GridBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#020204' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center center' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 60%)' }} />
      {/* Scanline overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%)', backgroundSize: '100% 4px', zIndex: 100, pointerEvents: 'none', opacity: 0.4 }} />
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const [feed, setFeed] = useState(FEED_INIT);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhase(p => p + 0.1), 50);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch('http://localhost:8000/recent_threats');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setFeed(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch threat feed", err);
      }
    };
    
    fetchFeed();
    const t = setInterval(fetchFeed, 3000); // Poll every 3 seconds
    return () => clearInterval(t);
  }, []);

  if (!isLoaded) return <div style={{ minHeight: '100vh', background: '#020204', display: 'grid', placeItems: 'center' }}><div style={{ width: 40, height: 40, border: '2px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div style={{ ...SANS, minHeight: '100vh', display: 'flex', color: '#e2e4f0', overflow: 'hidden' }}>
      <GridBackground />

      {/* ═══ CYBER SIDEBAR ═══ */}
      <aside style={{ width: 280, borderRight: '1px solid rgba(99,102,241,0.15)', background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)', zIndex: 20, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Corner Accents */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />

        <div style={{ padding: '30px 24px', borderBottom: '1px solid rgba(99,102,241,0.1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.1)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', border: '1px solid rgba(99,102,241,0.5)' }}>
              <ShieldAlert style={{ width: 20, height: 20, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.05em', color: '#fff', textTransform: 'uppercase' }}>Deep<span style={{ color: '#818cf8' }}>Shield</span></div>
              <div style={{ ...MONO, fontSize: 10, color: '#10b981', letterSpacing: '0.1em' }}>SYS.ACTIVE // v3.0.1</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <NavGroup title="OPERATIONS" />
          <NavItem icon={LayoutDashboard} label="Command Center" active />
          <NavItem icon={Crosshair} label="Forensic Studio" onClick={() => navigate('/detector')} />
          <NavItem icon={Radio} label="Live Intercept" onClick={() => navigate('/live-call')} />
          <NavItem icon={Scan} label="Batch Review" onClick={() => navigate('/review')} />
          
          <NavGroup title="INTELLIGENCE" top={24} />
          <NavItem icon={FileText} label="Threat Logs" onClick={() => navigate('/reports')} />
          <NavItem icon={Network} label="Node Topography" />
          <NavItem icon={Cpu} label="Model Weights" />
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 40, height: 40, borderRadius: 0, clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)' } } }} />
            <div>
              <div style={{ ...MONO, fontSize: 12, fontWeight: 700, color: '#fff' }}>{user?.firstName?.toUpperCase() || 'OPERATOR'}</div>
              <div style={{ ...MONO, fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock style={{ width: 10, height: 10 }} /> CLEARANCE: Lvl 5
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN DASHBOARD ═══ */}
      <main style={{ flex: 1, zIndex: 10, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* Top HUD */}
        <header style={{ height: 50, borderBottom: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', padding: '0 30px', justifyContent: 'space-between', background: 'rgba(5,5,8,0.7)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'blink 2s infinite' }} />
              <span style={{ ...MONO, fontSize: 11, color: '#10b981', letterSpacing: '0.15em' }}>NET: SECURE</span>
            </div>
            <div style={{ ...MONO, fontSize: 11, color: '#666', letterSpacing: '0.1em' }}>
              LATENCY: <span style={{ color: '#fff' }}>14ms</span>
            </div>
            <div style={{ ...MONO, fontSize: 11, color: '#666', letterSpacing: '0.1em' }}>
              ENCRYPTION: <span style={{ color: '#fff' }}>AES-256-GCM</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ ...MONO, fontSize: 11, color: '#818cf8', letterSpacing: '0.1em' }}>T_MINUS: 00:00:00</div>
            <button onClick={() => navigate('/detector')} style={{ ...MONO, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', padding: '4px 16px', clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)', cursor: 'pointer', transition: 'all 0.2s' }}>
              INIT_SCAN //
            </button>
          </div>
        </header>

        {/* BENTO GRID AREA */}
        <div style={{ flex: 1, padding: 30, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridAutoRows: 'minmax(120px, auto)', gap: 24, alignContent: 'start' }}>
          
          {/* STATS STRIP (Span 12) */}
          <div style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            <HudStat label="TOTAL INTERCEPTS" value="14,291" trend="+8.4%" color="#6366f1" />
            <HudStat label="THREATS BLOCKED" value="482" trend="+12" color="#f43f5e" />
            <HudStat label="MODEL ACCURACY" value="99.8%" trend="STABLE" color="#10b981" />
            <HudStat label="ACTIVE NODES" value="64/64" trend="100%" color="#8b5cf6" />
          </div>

          {/* SPECTRAL ANALYSIS (Span 8) */}
          <div style={{ gridColumn: 'span 8', gridRow: 'span 3', position: 'relative' }}>
            <HudPanel title="SPECTRAL ANALYSIS // GLOBAL TRAFFIC">
              <div style={{ position: 'absolute', inset: '40px 20px 20px 20px', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                <svg width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  {/* Grid lines */}
                  <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                    {[0, 25, 50, 75, 100].map(p => <line key={p} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} />)}
                    {[0, 20, 40, 60, 80, 100].map(p => <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" />)}
                  </g>
                  {/* Multi-frequency sine waves simulating spectral data */}
                  <polyline points={generateWave(Array(100).fill(0), 1000, 200, phase)} fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <polyline points={generateWave(Array(100).fill(0), 1000, 150, phase * 1.5 + 2)} fill="none" stroke="rgba(16,185,129,0.5)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <polyline points={generateWave(Array(100).fill(0), 1000, 100, phase * 0.8 + 4)} fill="none" stroke="rgba(244,63,94,0.5)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div style={{ position: 'absolute', top: 50, right: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <LegendItem color="#6366f1" label="Base Carrier" />
                <LegendItem color="#10b981" label="Trust Embedded" />
                <LegendItem color="#f43f5e" label="Anomalous Frq" />
              </div>
            </HudPanel>
          </div>

          {/* NODE RADAR (Span 4) */}
          <div style={{ gridColumn: 'span 4', gridRow: 'span 2', position: 'relative' }}>
            <HudPanel title="NODE TOPOGRAPHY">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: 20 }}>
                <RadarScan />
              </div>
              <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 10, color: '#888' }}>
                <span>LAT: 34.0522</span>
                <span>LNG: -118.2437</span>
              </div>
            </HudPanel>
          </div>

          {/* QUICK LAUNCH (Span 4) */}
          <div style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: '100%' }}>
               <LaunchBtn icon={Camera} label="STUDIO" color="#6366f1" onClick={() => navigate('/detector')} />
               <LaunchBtn icon={Video} label="INTERCEPT" color="#f59e0b" onClick={() => navigate('/live-call')} />
            </div>
          </div>

          {/* THREAT FEED (Span 12) */}
          <div style={{ gridColumn: 'span 12', gridRow: 'span 3', position: 'relative' }}>
            <HudPanel title="LIVE THREAT INTERCEPT LOG">
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 120px 80px 100px 1fr', padding: '0 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', ...MONO, fontSize: 10, color: '#666', letterSpacing: '0.1em' }}>
                  <span>TIMESTAMP</span>
                  <span>THREAT_TYPE</span>
                  <span>ORIGIN_NODE</span>
                  <span>CONF.%</span>
                  <span>STATUS</span>
                  <span>SIGNATURE_HASH</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, maxHeight: 250, overflowY: 'auto' }}>
                  {feed.map((f, i) => (
                    <div key={f.id + i} style={{ display: 'grid', gridTemplateColumns: '120px 140px 120px 80px 100px 1fr', padding: '10px 20px', background: i === 0 ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)', borderLeft: i === 0 ? '2px solid #6366f1' : '2px solid transparent', alignItems: 'center' }}>
                      <span style={{ ...MONO, fontSize: 11, color: i === 0 ? '#fff' : '#aaa' }}>{f.ts}</span>
                      <span style={{ ...MONO, fontSize: 11, color: '#818cf8' }}>{f.type}</span>
                      <span style={{ ...MONO, fontSize: 11, color: '#888' }}>{f.node}</span>
                      <span style={{ ...MONO, fontSize: 11, color: f.conf > 95 ? '#f43f5e' : '#f59e0b', fontWeight: 700 }}>{f.conf}</span>
                      <span style={{ ...MONO, fontSize: 10, padding: '2px 6px', background: f.status === 'BLOCKED' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)', color: f.status === 'BLOCKED' ? '#f43f5e' : '#f59e0b', width: 'fit-content', border: `1px solid ${f.status === 'BLOCKED' ? '#f43f5e' : '#f59e0b'}40` }}>{f.status}</span>
                      <span style={{ ...MONO, fontSize: 10, color: '#444', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.hash}</span>
                    </div>
                  ))}
                </div>
              </div>
            </HudPanel>
          </div>

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

/* ── COMPONENTS ── */

function NavGroup({ title, top = 0 }) {
  return <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: '0.2em', marginTop: top, marginBottom: 8, paddingLeft: 12 }}>{title}</div>;
}

function NavItem({ icon: Icon, label, active, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: onClick ? 'pointer' : 'default', background: active ? 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, transparent 100%)' : h ? 'rgba(255,255,255,0.03)' : 'transparent', borderLeft: active ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.2s' }}>
      <Icon style={{ width: 16, height: 16, color: active ? '#818cf8' : h ? '#aaa' : '#555' }} />
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : h ? '#ccc' : '#888' }}>{label}</span>
    </div>
  );
}

function HudStat({ label, value, trend, color }) {
  return (
    <div style={{ position: 'relative', background: 'rgba(10,10,15,0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: `linear-gradient(90deg, ${color} 0%, transparent 100%)` }} />
      <div style={{ ...MONO, fontSize: 11, color: '#666', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ ...MONO, fontSize: 32, fontWeight: 700, color: '#fff', textShadow: `0 0 20px ${color}40` }}>{value}</div>
      <div style={{ ...MONO, fontSize: 11, color: color, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, background: color, borderRadius: '50%' }} /> {trend}
      </div>
    </div>
  );
}

function HudPanel({ title, children }) {
  return (
    <div style={{ position: 'relative', height: '100%', background: 'rgba(10,10,15,0.6)', border: '1px solid rgba(99,102,241,0.1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: -1, left: -1, width: 8, height: 8, borderTop: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />
      <div style={{ position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderTop: '2px solid #6366f1', borderRight: '2px solid #6366f1' }} />
      <div style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8, borderBottom: '2px solid #6366f1', borderLeft: '2px solid #6366f1' }} />
      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderBottom: '2px solid #6366f1', borderRight: '2px solid #6366f1' }} />
      
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.15em' }}>{title}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ width: 4, height: 4, background: '#818cf8' }} />
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 2, background: color }} />
      <span style={{ ...MONO, fontSize: 9, color: '#888' }}>{label}</span>
    </div>
  );
}

function LaunchBtn({ icon: Icon, label, color, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ height: '100%', background: h ? `${color}15` : 'rgba(10,10,15,0.6)', border: `1px solid ${h ? color : 'rgba(255,255,255,0.05)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s', clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}>
      <Icon style={{ width: 24, height: 24, color: h ? color : '#666', transition: 'color 0.2s' }} />
      <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: h ? '#fff' : '#888', letterSpacing: '0.1em' }}>{label}</span>
    </button>
  );
}
