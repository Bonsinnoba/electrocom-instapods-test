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
                // Access token is stored in memory, refresh token in HttpOnly cookie
                login(result.data.access_token, user);

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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '16px'
    }}>
      <div className="login-card glass" style={{
        width: '100%',
        maxWidth: '360px',
        padding: '28px',
        borderRadius: '24px',
        boxShadow: '0 18px 32px rgba(0,0,0,0.14)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: 'var(--primary-blue)', 
            borderRadius: '14px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 14px',
            color: 'white'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0' }}>Admin Login</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{siteName} Management Dashboard</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="login-label">Email Address</label>
            <div className="login-field-wrapper">
              <Mail size={18} className="login-field-icon" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field login-input" 
                placeholder={siteEmail || 'admin@example.com'} 
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="login-label">Password</label>
            <div className="login-field-wrapper">
              <Lock size={18} className="login-field-icon" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field login-input" 
                placeholder="••••••••" 
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="login-toggle"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary login-submit" 
            disabled={loading}
          >
            {loading ? <Loader className="animate-spin" size={18} /> : 'Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
