import React, { useState } from 'react';
import { loginUser, API_BASE_URL, fetchAnalytics, fetchProducts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAdminSettings } from '../context/AdminSettingsContext';
import { Lock, Mail, Loader, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const { siteName, siteEmail } = useAdminSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const result = await loginUser({ email, password });
        if (result.success) {
            const user = result.data.user;
            const allowedRoles = ['store_manager', 'super', 'accountant', 'marketing', 'picker'];
            
            if (!allowedRoles.includes(user.role)) {
                setError('Access denied: Unauthorized role.');
            } else {
                // Use the login function from context to update state reactively
                login(result.data.token, user);

                fetchAnalytics().catch(() => {});
                fetchProducts().catch(() => {});
                
                if (user.role === 'super') {
                    navigate('/super/dashboard');
                } else {
                    navigate('/');
                }
            }
        } else {
            setError(result.message || 'Invalid email or password');
        }
    } catch (err) {
        console.error('Detailed login error:', err);
        setError(`Connection error: ${err.message || 'Unknown network error'}. URL: ${API_BASE_URL}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '20px'
    }}>
      <div className="card glass" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        borderRadius: '32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: 'var(--primary-blue)', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px',
            color: 'white'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>Admin Login</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{siteName} Management Dashboard</p>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            fontSize: '14px', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field" 
                placeholder={siteEmail || 'admin@example.com'} 
                required
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field" 
                placeholder="••••••••" 
                required
                style={{ paddingLeft: '40px', paddingRight: '44px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '16px', 
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? <Loader className="animate-spin" size={20} /> : 'Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
