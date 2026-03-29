import { useEffect, useRef } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';

export default function Dashboard() {
  const { user } = useUser();
  const contentRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      );
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="fixed top-0 w-full px-8 py-4 flex justify-between items-center z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-linear-to-br from-violet-500 to-purple-600"></div>
          <span className="text-[13px] font-semibold tracking-tight">DeepfakeRT</span>
        </div>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { userButtonAvatarBox: "w-8 h-8 border border-white/10" }
          }}
        />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="absolute top-[-10%] right-[20%] w-[300px] h-[300px] bg-violet-600/4 blur-[100px] rounded-full pointer-events-none"></div>

        <div ref={contentRef} className="text-center max-w-md">
          {user?.imageUrl && (
            <div className="w-14 h-14 mx-auto mb-5 rounded-full overflow-hidden border-2 border-white/10 shadow-lg shadow-violet-500/10">
              <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight mb-2">
            Welcome, <span className="text-violet-400">{user?.firstName || 'User'}</span>
          </h1>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-7">
            You're authenticated and ready to go.
          </p>
          <button 
            onClick={() => navigate('/detector')}
            className="px-5 py-2 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Go to Detector
          </button>
        </div>
      </main>
    </div>
  );
}
