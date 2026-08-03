import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { resetPassword } from '../services/api';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const token = query.get('token');
  const email = query.get('email');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!token || !email) {
      setStatus({ type: 'error', message: 'Invalid or missing reset link parameters.' });
    }
  }, [token, email]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setStatus({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword({
        email,
        token,
        password: formData.password
      });

      if (response.success) {
        setStatus({ type: 'success', message: response.message });
        setTimeout(() => navigate('/'), 3000);
      } else {
        setStatus({ type: 'error', message: response.message || 'Failed to reset password.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'A connection error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-page animate-fade-in" style={{ 
      maxWidth: '450px', 
      margin: '40px auto', 
      background: 'var(--bg-card)', 
      borderRadius: '24px', 
      border: '1px solid var(--border-light)',
      boxShadow: 'var(--shadow-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '32px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ 
          width: '64px', 
          height: '64px', 
          background: 'var(--accent-blue-bg)', 
          borderRadius: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 16px',
          color: 'var(--accent-blue)'
        }}>
          <Lock size={32} />
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Set New Password</h1>
        <p style={{ color: 'var(--text-muted)' }}>Secure your account with a strong password.</p>
      </div>

      {status.message && (
        <div className={`auth-status ${status.type}`} style={{ 
          padding: '12px 16px', 
          borderRadius: '12px', 
          marginBottom: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          fontSize: '14px',
          background: status.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
          color: status.type === 'success' ? 'var(--success)' : 'var(--error)',
          border: '1px solid currentColor'
        }}>
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {status.message}
        </div>
      )}

      {(!token || !email) ? (
        <button className="btn-primary" onClick={() => navigate('/')} style={{ width: '100%' }}>
          Back to Home
        </button>
      ) : status.type === 'success' ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Redirecting to login in 3 seconds...
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Account Email</label>
            <div className="input-wrapper" style={{ opacity: 0.7 }}>
              <Mail size={16} />
              <input type="email" value={email} disabled style={{ cursor: 'not-allowed' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>New Password</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <Lock size={16} />
              <input 
                type={showPassword ? "text" : "password"} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="Min. 8 characters" 
                required 
                autoFocus 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn" style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={16} />
              <input 
                type={showPassword ? "text" : "password"} 
                name="confirmPassword" 
                value={formData.confirmPassword} 
                onChange={handleChange} 
                placeholder="Repeat new password" 
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={18} /> : 'Update Password'}
          </button>
          
          <button type="button" className="btn-ghost" onClick={() => navigate('/')} style={{ width: '100%', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> Cancel
          </button>
        </form>
      )}
    </div>
  );
}
