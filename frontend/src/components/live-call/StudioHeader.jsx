import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudioHeader() {
  const navigate = useNavigate();

  return (
    <header
      style={{
        flexShrink: 0,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 50,
      }}
    >
      {/* Logo — click to go home */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 6px',
          borderRadius: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
        title="Back to home"
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#22d3ee)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Shield size={15} color="#080808" strokeWidth={2.5} />
          {/* Online dot */}
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6366f1',
              border: '2px solid #080808',
            }}
          />
        </div>
        <div>
          <p
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              color: '#fff',
              letterSpacing: '-0.01em',
              lineHeight: 1,
              textAlign: 'left'
            }}
          >
            DeepSheild<span style={{ color: '#6366f1' }}>.ai</span>
          </p>
          <p style={{ fontSize: 10, color: '#52525b', marginTop: 2, lineHeight: 1, textAlign: 'left' }}>
            Live Interview
          </p>
        </div>
      </button>

      {/* Right: status + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 999,
            border: '1px solid rgba(99,102,241,0.2)',
            background: 'rgba(99,102,241,0.06)',
            fontSize: 11,
            color: '#6366f1',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#6366f1',
              display: 'inline-block',
            }}
          />
          AI Engine Ready
        </div>
        <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
      </div>
    </header>
  );
}
