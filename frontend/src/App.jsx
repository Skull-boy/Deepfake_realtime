import { Routes, Route, Navigate } from 'react-router-dom';
import { ClerkLoading, ClerkLoaded, SignedIn, SignedOut } from '@clerk/clerk-react';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Detector from './pages/Detector';

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
          {/* Native Authentication Routes */}
          <Route path="/sign-in/*" element={
            <>
              <SignedIn><Navigate to="/dashboard" replace /></SignedIn>
              <SignedOut><AuthPage mode="signin" /></SignedOut>
            </>
          } />
          <Route path="/sign-up/*" element={
            <>
              <SignedIn><Navigate to="/dashboard" replace /></SignedIn>
              <SignedOut><AuthPage mode="signup" /></SignedOut>
            </>
          } />

          {/* Base Route */}
          <Route path="/" element={
            <>
              <SignedIn>
                <Navigate to="/dashboard" replace />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          } />

          {/* Secure Dashboard Route */}
          <Route path="/dashboard" element={
            <>
              <SignedIn>
                <Dashboard />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          } />

          {/* Detector Route */}
          <Route path="/detector" element={
            <>
              <SignedIn>
                <Detector />
              </SignedIn>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
            </>
          } />
        </Routes>
      </ClerkLoaded>
    </>
  );
}

export default App;
