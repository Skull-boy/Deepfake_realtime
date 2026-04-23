import { useEffect, useRef } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { gsap } from 'gsap';

import { Link } from 'react-router-dom';

export default function AuthPage({ mode = 'signin' }) {
  const imageRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(imageRef.current, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 1.2 });
    tl.fromTo(cardRef.current, { opacity: 0, x: 30, filter: "blur(10px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.8 }, "-=0.7");
  }, []);

  return (
    <div className="min-h-screen flex bg-[#030303] text-slate-200" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* LEFT — Full-bleed Image */}
      <div ref={imageRef} className="hidden lg:block w-[55%] relative overflow-hidden">
        <img
          src="/signUpImg.jpg"
          alt="Authentication visual"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-[#030303]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

        <div className="absolute bottom-12 left-12 z-10">
          <p className="text-cyan-400 text-[10px] font-bold tracking-[0.25em] uppercase mb-2">
            Powered by AI
          </p>
          <h2 className="text-white text-3xl font-bold tracking-tight leading-snug mb-2">
            DeepSheild.ai
          </h2>
          <p className="text-slate-400 text-sm max-w-[320px] leading-relaxed">
            Uncover manipulated media with our enterprise-grade detection technology. Secure, fast, and highly accurate.
          </p>
        </div>
      </div>

      {/* RIGHT — Auth Card Container */}
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 relative overflow-hidden">

        {/* Background Ambient Glows */}
        <div className="absolute top-[15%] right-[20%] w-[400px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-[20%] right-[5%] w-[300px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>

        <div ref={cardRef} className="relative z-10 w-full flex flex-col items-center justify-center">
          {mode === 'signin' ? (
            <>
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                appearance={{
                  baseTheme: dark,
                  variables: {
                    colorPrimary: '#22d3ee', // DeepSheild Cyan
                    colorBackground: '#0a0a0a',
                  },
                  elements: {
                    card: "border border-white/10 shadow-2xl shadow-cyan-900/40",
                    footerAction: "hidden", // Hide Clerk's own sign-up link (we replace it below)
                  }
                }}
              />
            </>
          ) : (
            <>
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                appearance={{
                  baseTheme: dark,
                  variables: {
                    colorPrimary: '#22d3ee', // DeepSheild Cyan
                    colorBackground: '#0a0a0a',
                  },
                  elements: {
                    card: "border border-white/10 shadow-2xl shadow-cyan-900/40",
                    footerAction: "hidden", // Hide Clerk's own sign-in link
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}