import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Shown when the admin has been inactive for close to the idle-logout window.
 * Purely a UX courtesy — the real security boundary is enforced server-side
 * in refresh.php regardless of whether this modal is seen, dismissed, or
 * bypassed via devtools.
 */
export default function IdleWarningModal({ secondsLeft, onContinue, onLogoutNow }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '16px'
    }}>
      <div
        className="card glass animate-slide-up"
        style={{
          maxWidth: '400px',
          width: '100%',
          padding: '32px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)',
          color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Clock size={24} />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Still there?</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.5', fontSize: '14px' }}>
          You've been inactive for a while. For security, you'll be signed out automatically in:
        </p>
        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--warning)', marginBottom: '24px', fontVariantNumeric: 'tabular-nums' }}>
          {display}
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={onLogoutNow}
            style={{ flex: 1 }}
          >
            Log Out Now
          </button>
          <button
            className="btn btn-primary"
            onClick={onContinue}
            style={{ flex: 1 }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
