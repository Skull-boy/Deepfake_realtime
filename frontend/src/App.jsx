import { Routes, Route, Navigate } from 'react-router-dom';
import { ClerkLoading, ClerkLoaded, SignedIn, SignedOut } from '@clerk/clerk-react';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import DetectorStudio from './pages/DetectorStudio';
import LandingPage from './pages/LandingPage';
import LiveCallDetector from './pages/LiveCallDetector';
import FrameReviewPage from './pages/FrameReviewPage';
import SessionReportPage from './pages/SessionReportPage';

function App() {
  return (
    <>
      <ClerkLoading>
        <div className="min-h-screen flex items-center justify-center bg-[#050505]" style={{ fontFamily: "'Inter', sans-serif" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[11px] text-slate-500 font-medium tracking-wide">Loading...</span>
          </div>
        </div>
      </ClerkLoading>

      <ClerkLoaded>
        <Routes>
          {/* Base Route */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth Routes */}
          <Route path="/sign-in/*" element={<AuthPage mode="signin" />} />
          <Route path="/sign-up/*" element={<AuthPage mode="signup" />} />

          {/* Secure Dashboard Route */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Detector Route */}
          <Route path="/detector" element={<DetectorStudio />} />

          {/* Live Call Detector Route — Phase 4 */}
          <Route path="/live-call" element={<LiveCallDetector />} />

          {/* Frame Review Dashboard — Admin Only */}
          <Route path="/review" element={<FrameReviewPage />} />

          {/* Session Reports — Forensic Audit */}
          <Route path="/reports" element={<SessionReportPage />} />
        </Routes>
      </ClerkLoaded>
    </>
  );
}

export default App;
