import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { X, CheckCircle, Info, AlertTriangle, AlertCircle } from 'lucide-react';

const Toast = ({ toast, onRemove }) => {
  const icons = {
    success: <CheckCircle size={18} />,
    info: <Info size={18} />,
    warning: <AlertTriangle size={18} />,
    error: <AlertCircle size={18} />
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success': return { bg: 'var(--success-bg)', border: 'var(--success)', color: 'var(--success)' };
      case 'warning': return { bg: 'var(--warning-bg)', border: 'var(--warning)', color: 'var(--warning)' };
      case 'error': return { bg: 'var(--danger-bg)', border: 'var(--danger)', color: 'var(--danger)' };
      default: return { bg: 'var(--info-bg)', border: 'var(--primary-blue)', color: 'var(--primary-blue)' };
    }
  };

  const colors = getColors();

  return (
    <div 
      className="glass animate-fade-in"
      style={{
        padding: '12px 16px',
        borderRadius: '12px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        minWidth: '280px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        marginBottom: '10px'
      }}
    >
      <div style={{ flexShrink: 0 }}>{icons[toast.type] || icons.info}</div>
      <div style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{toast.text}</div>
      <button 
        onClick={() => onRemove(toast.id)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: 'inherit', 
          cursor: 'pointer', 
          opacity: 0.6,
          display: 'flex',
          padding: '4px'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default function ToastContainer() {
  const { toasts, removeToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '24px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column-reverse',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
