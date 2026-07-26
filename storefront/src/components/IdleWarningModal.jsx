import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Shown when the customer has been inactive for close to the idle-logout
 * window. Purely a UX courtesy — the real security boundary is enforced
 * server-side in refresh.php regardless of whether this modal is seen,
 * dismissed, or bypassed via devtools.
 */
export default function IdleWarningModal({ secondsLeft, onContinue, onLogoutNow }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;

  return (
    <div
      className="modal-backdrop active"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        className="card glass animate-scale-in"
        style={{
          maxWidth: '400px',
          width: '100%',
          padding: '40px 32px',
          textAlign: 'center'
        }}
      >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <Clock size={40} color="#f59e0b" />
        </div>

        <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-main)' }}>
          Still shopping?
        </h3>

        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '8px' }}>
          You've been inactive for a while. For your account's security, you'll be signed out automatically in:
        </p>

        <div style={{ fontSize: '32px', fontWeight: 800, color: '#f59e0b', marginBottom: '28px', fontVariantNumeric: 'tabular-nums' }}>
          {display}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            onClick={onLogoutNow}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '15px' }}
          >
            Log Out Now
          </button>
          <button
            className="btn-primary"
            onClick={onContinue}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', border: 'none' }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
