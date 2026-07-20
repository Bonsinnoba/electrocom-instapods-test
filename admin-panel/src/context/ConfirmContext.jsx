/* @refresh reload */
import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmContext = createContext();

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    options: {},
    resolve: null,
  });

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState.resolve) {
        confirmState.resolve(true);
    }
    setConfirmState({ isOpen: false, message: '', resolve: null });
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.resolve) {
        confirmState.resolve(false);
    }
    setConfirmState({ isOpen: false, message: '', options: {}, resolve: null });
  }, [confirmState]);

  const { title = 'Confirmation Required', icon, iconColor = 'var(--danger)', confirmText = 'Confirm' } = confirmState.options || {};

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmState.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}
        onClick={handleCancel}
        >
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
            onClick={e => e.stopPropagation()}
          >
            {icon ? (
               <div style={{ 
                 width: '48px', height: '48px', borderRadius: '50%', background: `rgba(239, 68, 68, 0.1)`, 
                 color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 margin: '0 auto 16px auto' 
               }}>
                 {icon}
               </div>
            ) : (
               <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>{title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
                {confirmState.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleCancel}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={handleConfirm}
                style={{ flex: 1, background: iconColor, color: 'white', border: 'none' }}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
