import React from 'react';
import { UserPlus, LogIn, Sparkles } from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function AuthPrompt() {
  const { openAuthModal } = useUser();

  return (
    <div className="glass" style={{
      padding: '24px',
      borderRadius: '16px',
      marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
      border: '1px solid rgba(59, 130, 246, 0.15)',
      textAlign: 'center'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--primary-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        color: 'white'
      }}>
        <Sparkles size={24} />
      </div>
      
      <h3 style={{
        fontSize: '18px',
        fontWeight: 700,
        margin: '0 0 8px',
        color: 'var(--text-main)'
      }}>
        Unlock Your Savings
      </h3>
      
      <p style={{
        fontSize: '14px',
        color: 'var(--text-muted)',
        marginBottom: '16px',
        lineHeight: '1.5'
      }}>
        Create an account to redeem coupons and access exclusive deals
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={() => openAuthModal('signup')}
          className="btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <UserPlus size={18} />
          Sign Up Free
        </button>
        
        <button
          onClick={() => openAuthModal('signin')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--bg-main)';
            e.currentTarget.style.borderColor = 'var(--primary-blue)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
          }}
        >
          <LogIn size={18} />
          Log In
        </button>
      </div>
      
      <p style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: '12px',
        fontStyle: 'italic'
      }}>
        Join 10,000+ happy customers
      </p>
    </div>
  );
}
