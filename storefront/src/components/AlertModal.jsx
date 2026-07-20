import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function AlertModal({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'success', 
  buttonText = 'Got it' 
}) {
  if (!isOpen) return null;

  const getConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: <XCircle size={48} color="#ef4444" />,
          bg: 'rgba(239, 68, 68, 0.1)',
          accent: '#ef4444'
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={48} color="#f59e0b" />,
          bg: 'rgba(245, 158, 11, 0.1)',
          accent: '#f59e0b'
        };
      case 'info':
        return {
          icon: <Info size={48} color="#3b82f6" />,
          bg: 'rgba(59, 130, 246, 0.1)',
          accent: '#3b82f6'
        };
      default: // success
        return {
          icon: <CheckCircle size={48} color="#10b981" />,
          bg: 'rgba(16, 185, 129, 0.1)',
          accent: '#10b981'
        };
    }
  };

  const config = getConfig();

  return (
    <div 
      className="modal-backdrop active" 
      onClick={onClose}
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.6)', 
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div 
        className="card glass animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '400px', 
          width: '100%', 
          padding: '40px 32px', 
          textAlign: 'center',
          position: 'relative' 
        }}
      >
        <button 
          onClick={onClose}
          style={{ 
            position: 'absolute', 
            top: '16px', 
            right: '16px', 
            background: 'none', 
            border: 'none',
            color: 'var(--text-muted)', 
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <X size={20} />
        </button>

        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          background: config.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {config.icon}
        </div>

        <h3 style={{ 
          fontSize: '22px', 
          fontWeight: 800, 
          marginBottom: '12px',
          color: 'var(--text-main)'
        }}>
          {title}
        </h3>
        
        <p style={{ 
          color: 'var(--text-muted)', 
          fontSize: '15px', 
          lineHeight: '1.6', 
          marginBottom: '32px' 
        }}>
          {message}
        </p>

        <button 
          className="btn-primary"
          onClick={onClose}
          style={{ 
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '15px',
            background: config.accent,
            border: 'none',
            boxShadow: `0 8px 20px ${config.bg.replace('0.1', '0.3')}`
          }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
