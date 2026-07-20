import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Lock, Mail, LogIn, UserPlus, Phone, Loader, Globe, Eye, EyeOff, Chrome, Github, ArrowLeft, MapPin } from 'lucide-react';
import { loginUser, registerUser, verifyUser, forgotPassword, resetPassword, recoverAccount } from '../services/api';
import { useUser } from '../context/UserContext';
import { useSettings } from '../context/SettingsContext';



export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }) {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(initialMode === 'signup');
      setStep(1);
    }
  }, [isOpen, initialMode]);


  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const { login: handleContextLogin } = useUser();
  const { siteSettings } = useSettings();
  const canRegister = siteSettings?.allowRegistration !== false;
  
  // AuthModal focused on local signin/signup

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'Ghana',
    region: 'Greater Accra',
    password: '',
    confirmPassword: '',
    verification_method: 'email'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [tempUser, setTempUser] = useState(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMethod, setForgotPasswordMethod] = useState('email'); // 'email' or 'sms'
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState({ type: '', message: '' });
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP, 3: Passwords
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetOtp, setResetOtp] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleNextStep = () => {
      setError('');
      if (step === 1) {
          if (!formData.name || !formData.email) {
              setError('Please enter both name and email.');
              return;
          }
          setStep(2);
      } else if (step === 2) {
          if (formData.country !== 'Ghana') {
              setError("Our products and services do not extend to your location yet. We are working hard to reach you soon!");
              return;
          }
          if (!formData.phone) {
              setError('Please enter your phone number.');
              return;
          }
          setStep(3); // Password step is now step 3
      }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp && step === 1) {
      handleNextStep();
      return;
    }

    if (isSignUp && step < 3) {
      return; // Only submit on step 3 (password step)
    }

    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      let response;
      if (isSignUp) {
        response = await registerUser(formData);
      } else {
        response = await loginUser({ email: formData.email, password: formData.password });
      }

      if (response.success && response.data && response.data.user) {
        if (isSignUp) {
          // Move to verification step
          setTempUser(response.data.user);
          setVerificationStep(true);
        } else {
          // Direct login
          handleContextLogin(response.data.user, response.data.token);
          onClose(response.data.user);
          setFormData({ name: '', email: '', phone: '', country: 'Ghana', password: '', confirmPassword: '', verification_method: 'email' });
        }
      } else if (response.needs_verification) {
          setTempUser(response.user);
          setVerificationStep(true);
          setError(response.message);
      } else if (response.recovery_required) {
          // Account is soft-deleted — switch to recovery mode
          setRecoveryEmail(formData.email);
          setIsRecoveryMode(true);
          setError('');
      } else {
          setError(response.message || "Authentication failed. Please check your credentials.");
      }

    } catch (err) {
      console.error(err);
      // Show a friendly message - never expose raw network/JS errors to the user
      const isNetworkError = err.message === 'Failed to fetch' || err.message?.includes('NetworkError') || err.message?.includes('network');
      setError(isNetworkError
        ? "Unable to connect. Please check your internet connection and try again."
        : "Something went wrong. Please try again.");

    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await recoverAccount({ email: recoveryEmail, password: formData.password });
      if (response.success && response.data?.user) {
        handleContextLogin(response.data.user, response.data.token);
        onClose(response.data.user);
        setIsRecoveryMode(false);
        setFormData({ name: '', email: '', phone: '', country: 'Ghana', password: '', confirmPassword: '', verification_method: 'email' });
      } else {
        setError(response.message || 'Recovery failed. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    if (!forgotPasswordEmail) return;
    setLoading(true);
    setForgotPasswordStatus({ type: '', message: '' });
    try {
        const response = await forgotPassword(forgotPasswordEmail, forgotPasswordMethod);
        if (response.success) {
            setForgotPasswordStatus({ type: 'success', message: response.message });
            setResetStep(2);
            setResendCooldown(60);
        } else {
            setForgotPasswordStatus({ type: 'error', message: response.message || 'Failed to send reset code.' });
        }
    } catch (err) {
        setForgotPasswordStatus({ type: 'error', message: 'Connection error. Please try again.' });
    } finally {
        setLoading(false);
    }
  };

  // Timer for resend cooldown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => {
          const next = prev - 1;
          if (next <= 0) return 0;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown > 0]);

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (resetStep === 2) {
      if (!resetOtp || resetOtp.length < 6) {
        setForgotPasswordStatus({ type: 'error', message: "Please enter the 6-digit code." });
        return;
      }
      setResetStep(3);
      setForgotPasswordStatus({ type: '', message: '' });
      return;
    }

    if (!resetOtp || !newResetPassword || newResetPassword !== confirmResetPassword) {
      if (newResetPassword !== confirmResetPassword) setForgotPasswordStatus({ type: 'error', message: "Passwords do not match." });
      return;
    }
    setLoading(true);
    setForgotPasswordStatus({ type: '', message: '' });
    try {
      const response = await resetPassword({ email: forgotPasswordEmail, token: resetOtp, password: newResetPassword });
      if (response.success) {
        setForgotPasswordStatus({ type: 'success', message: response.message });
        setTimeout(() => {
           setIsForgotPassword(false);
           setResetStep(1);
           setResetOtp('');
           setNewResetPassword('');
           setConfirmResetPassword('');
           setForgotPasswordEmail('');
           setForgotPasswordStatus({ type: '', message: '' });
        }, 3000);
      } else {
        setForgotPasswordStatus({ type: 'error', message: response.message });
      }
    } catch (err) {
      setForgotPasswordStatus({ type: 'error', message: 'Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verificationCode) return;
    
    setLoading(true);
    try {
      const response = await verifyUser(tempUser.id, verificationCode);
      if (response.success) {
        // use response.data.user because verify.php now returns the FULL user including token
        handleContextLogin(response.data.user, response.data.token);
        onClose(response.data.user);
        setFormData({ name: '', email: '', phone: '', country: 'Ghana', password: '', confirmPassword: '', verification_method: 'email' });
        setVerificationStep(false);
        setTempUser(null);
        navigate('/profile');
      } else {
        setError(response.message || "Invalid verification code.");
      }
    } catch (err) {
      console.error(err);
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-backdrop active`} onClick={onClose}>
      <div className={`auth-modal modal glass animate-scale-in ${isSignUp ? 'right-panel-active' : ''}`} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', overflow: 'hidden' }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            width: '32px', 
            height: '32px', 
            padding: 0, 
            borderRadius: '50%',
            zIndex: 1000,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'none'}
        >
          <X size={18} />
        </button>

        {/* --- SIGN UP CONTAINER --- */}
        <div className="form-container sign-up-container">
          {!canRegister ? (
            /* ── Registration Disabled State ── */
            <div className="animate-fade-in" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '32px 24px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: '1.5px solid rgba(99,102,241,0.2)'
              }}>
                <Lock size={28} style={{ color: 'var(--primary-blue, #6366f1)' }} />
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
                We&rsquo;ll Be Right Back!
              </h2>
              <p style={{ margin: '0 0 28px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '280px' }}>
                We&rsquo;re temporarily pausing new account creations while we upgrade a few things behind the scenes. We&rsquo;ll be back open shortly!{' '}
                <br /><br />
                If you&rsquo;re already part of the family, you can{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontSize: '14px',
                    color: 'var(--primary-blue, #6366f1)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px'
                  }}
                >
                  Sign In here
                </button>.
              </p>
            </div>
          ) : (
            <form onSubmit={verificationStep ? handleVerify : handleSubmit}>
              <h1>{verificationStep ? 'Verify' : 'Create Account'}</h1>
              {!verificationStep && isSignUp && (
                <div className="step-dots">
                  {[1,2,3].map(n => (
                    <span key={n} className={`dot${step===n ? ' active' : ''}`} />
                  ))}
                </div>
              )}

              <div className="auth-form-scroll">
                {error && <div className="auth-error">{error}</div>}

                {verificationStep ? (
                  <div className="animate-fade-in">
                    <div className="form-group">
                      <label>Verification Code</label>
                      <div className="input-wrapper">
                        <input 
                          type="text" 
                          value={verificationCode} 
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit code" 
                          required 
                          autoFocus 
                          style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 'bold' }}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                      {loading ? <Loader className="animate-spin" size={18} /> : 'Verify Account'}
                    </button>
                  </div>
                ) : (
                  <>
                    {step === 1 ? (
                      <div className="animate-slide-down">
                        <div className="form-group">
                          <label><User size={14} /> Full Name</label>
                          <div className="input-wrapper">
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Name" required autoFocus />
                          </div>
                        </div>
                        <div className="form-group">
                          <label><Mail size={14} /> Email</label>
                          <div className="input-wrapper">
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" required />
                          </div>
                        </div>
                        <button type="button" className="btn-primary" onClick={handleNextStep} style={{ width: '100%', marginTop: '10px' }}>Next Step</button>
                      </div>
                    ) : step === 2 ? (
                      <div className="animate-slide-down">
                        <div className="form-group">
                          <label><Phone size={14} /> Phone</label>
                          <div className="input-wrapper">
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" required autoFocus />
                          </div>
                        </div>
                        <div className="form-group">
                          <label><Globe size={14} /> Country</label>
                          <div className="input-wrapper">
                            <input type="text" name="country" value={formData.country} onChange={handleChange} placeholder="Country" required />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                          <label><MapPin size={14} /> Delivery Region</label>
                          <div className="input-wrapper">
                            <select 
                              name="region" 
                              value={formData.region} 
                              onChange={handleChange} 
                              required 
                              className="input-field" 
                              style={{ 
                                  width: '100%', 
                                  background: 'transparent', 
                                  border: 'none', 
                                  color: 'var(--text-main)',
                                  padding: '12px 14px',
                                  outline: 'none'
                               }}
                            >
                              <option value="Greater Accra">Greater Accra</option>
                              <option value="Ashanti">Ashanti (Kumasi)</option>
                              <option value="Upper West">Upper West (Wa)</option>
                              <option value="Western">Western</option>
                              <option value="Central">Central</option>
                              <option value="Eastern">Eastern</option>
                              <option value="Volta">Volta</option>
                              <option value="Northern">Northern</option>
                              <option value="Upper East">Upper East</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                          <button type="button" className="btn-primary" onClick={handleNextStep} style={{ flex: 2 }}>Next Step</button>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-slide-down">
                        <div className="form-group">
                          <label><Lock size={14} /> Password</label>
                          <div className="input-wrapper" style={{ position: 'relative' }}>
                            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="Password" required autoFocus />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn">
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div className="form-group">
                          <label><Lock size={14} /> Confirm</label>
                          <div className="input-wrapper">
                            <input type={showPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm" required />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <button type="button" className="btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                          <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
                            {loading ? <Loader className="animate-spin" size={18} /> : 'Sign Up'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Mobile Toggle */}
              <p className="mobile-only-text">
                Already have an account? <button type="button" className="toggle-auth-btn" onClick={() => setIsSignUp(false)}>Sign In</button>
              </p>
            </form>
          )}
        </div>

        {/* --- SIGN IN CONTAINER --- */}
        <div className="form-container sign-in-container">
          {!isForgotPassword && !isRecoveryMode ? (
            <form onSubmit={handleSubmit} className="animate-fade-in">
              <h1>Sign In</h1>
              <div className="social-container">
                <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/social_auth.php?provider=google`} className="social" title="Sign in with Google"><Chrome size={20} /></a>
                <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/social_auth.php?provider=github`} className="social" title="Sign in with GitHub" style={{ color: '#333' }}><Github size={20} /></a>
              </div>
              <span>or use your account</span>
              
              {error && <div className="auth-error">{error}</div>}

              <div className="form-group">
                <label><Mail size={14} /> Email</label>
                <div className="input-wrapper">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" required />
                </div>
              </div>
              <div className="form-group">
                <div className="label-row">
                  <label><Lock size={14} /> Password</label>
                  <button type="button" className="forgot-link" onClick={() => {
                    setIsForgotPassword(true);
                    setForgotPasswordEmail(formData.email);
                    setForgotPasswordStatus({ type: '', message: '' });
                  }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}>Forgot?</button>
                </div>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="Password" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? <Loader className="animate-spin" size={18} /> : 'Sign In'}
              </button>
              
              {canRegister && (
                <p className="mobile-only-text">
                    Don't have an account? <button type="button" className="toggle-auth-btn" onClick={() => setIsSignUp(true)}>Sign Up</button>
                </p>
              )}
            </form>
          ) : isForgotPassword ? (
            <div className="forgot-password-view animate-fade-in" style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '10px 0'
            }}>
              {resetStep === 1 && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ marginBottom: '8px' }}>Reset Password</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Enter your email to receive a password reset link.</p>
                  </div>

                  <div className="reset-method-selection" style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '20px',
                    background: 'var(--bg-surface-secondary)',
                    padding: '4px',
                    borderRadius: '12px'
                  }}>
                    <button 
                      type="button" 
                      onClick={() => setForgotPasswordMethod('email')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: forgotPasswordMethod === 'email' ? 'var(--bg-card)' : 'transparent',
                        color: forgotPasswordMethod === 'email' ? 'var(--primary-blue)' : 'var(--text-muted)',
                        boxShadow: forgotPasswordMethod === 'email' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Email
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setForgotPasswordMethod('sms')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: forgotPasswordMethod === 'sms' ? 'var(--bg-card)' : 'transparent',
                        color: forgotPasswordMethod === 'sms' ? 'var(--primary-blue)' : 'var(--text-muted)',
                        boxShadow: forgotPasswordMethod === 'sms' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      SMS
                    </button>
                  </div>
                </>
              )}

              <form onSubmit={resetStep === 1 ? handleForgotPassword : handleResetPasswordSubmit} className="animate-fade-in" key={`reset-step-${resetStep}`}>
                <h1>
                  {resetStep === 1 ? 'Forgot Password' : resetStep === 2 ? 'Verify Code' : 'New Password'}
                </h1>
                
                {forgotPasswordStatus.message && (
                  <div className={`auth-status ${forgotPasswordStatus.type}`} style={{ 
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    marginBottom: '16px', 
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: forgotPasswordStatus.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                    color: forgotPasswordStatus.type === 'success' ? 'var(--success)' : 'var(--error)',
                    border: '1px solid currentColor'
                  }}>
                    {forgotPasswordStatus.message}
                  </div>
                )}

                {resetStep === 2 ? (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '20px' }}>
                      Enter the 6-digit code sent to <strong>{forgotPasswordEmail}</strong>
                    </p>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label style={{ justifyContent: 'center' }}>Verification Code</label>
                      <div className="input-wrapper">
                        <input 
                          type="text" 
                          value={resetOtp} 
                          onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000" 
                          required 
                          autoFocus
                          style={{ textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold', fontSize: '20px' }}
                        />
                      </div>
                    </div>
                    
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }}>
                      Continue
                    </button>

                    <div style={{ textAlign: 'center' }}>
                      {resendCooldown > 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          Resend code in {resendCooldown}s
                        </span>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => handleForgotPassword()}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--primary-blue)', 
                            fontSize: '13px', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            padding: '4px 8px'
                          }}
                        >
                          Resend Code
                        </button>
                      )}
                    </div>
                  </>
                ) : resetStep === 3 ? (
                  <>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label><Lock size={14} /> Create New Password</label>
                      <div className="input-wrapper" style={{ position: 'relative' }}>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={newResetPassword} 
                          onChange={(e) => setNewResetPassword(e.target.value)}
                          placeholder="Min. 8 characters" 
                          required 
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-btn" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                      <label><Lock size={14} /> Confirm Password</label>
                      <div className="input-wrapper">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={confirmResetPassword} 
                          onChange={(e) => setConfirmResetPassword(e.target.value)}
                          placeholder="Repeat new password" 
                          required 
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                      {loading ? <Loader className="animate-spin" size={18} /> : 'Save & Login'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                      <label><Mail size={14} /> Your Email</label>
                      <div className="input-wrapper">
                        <input 
                          type="email" 
                          value={forgotPasswordEmail} 
                          onChange={(e) => setForgotPasswordEmail(e.target.value)} 
                          placeholder="Enter your account email" 
                          required 
                          autoFocus
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                      {loading ? <Loader className="animate-spin" size={18} /> : 'Send Reset Code'}
                    </button>
                  </>
                )}
                
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => {
                    if (resetStep > 1) {
                        setResetStep(resetStep - 1);
                        setForgotPasswordStatus({ type: '', message: '' });
                    } else {
                        setIsForgotPassword(false);
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    marginTop: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={16} /> {resetStep > 1 ? 'Go Back' : 'Back to Login'}
                </button>
              </form>
            </div>
          ) : (
            /* --- ACCOUNT RECOVERY VIEW --- */
            <div className="forgot-password-view animate-fade-in" style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '10px 0'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid rgba(245,158,11,0.3)'
                }}>
                  <User size={26} style={{ color: '#f59e0b' }} />
                </div>
                <h1 style={{ marginBottom: '8px' }}>Account Recovery</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.7, maxWidth: '280px', margin: '0 auto' }}>
                  The account <strong style={{ color: 'var(--text-main)' }}>{recoveryEmail}</strong> is scheduled for deletion.
                  Restoring it will immediately cancel the deletion and fully reactivate your account.
                </p>
              </div>

              {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', marginBottom: '12px' }}
                onClick={handleRecover}
                disabled={loading}
              >
                {loading ? <Loader className="animate-spin" size={18} /> : '✦ Restore My Account'}
              </button>

              <button
                type="button"
                onClick={() => { setIsRecoveryMode(false); setError(''); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', color: 'var(--text-muted)', fontSize: '14px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px'
                }}
              >
                <ArrowLeft size={16} /> No, go back to Login
              </button>
            </div>
          )}
        </div>

        {/* --- OVERLAY CONTAINER --- */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button className="ghost-btn" id="signIn" onClick={() => setIsSignUp(false)}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Enter your personal details and start your journey with us</p>
              {canRegister ? (
                <button className="ghost-btn" id="signUp" onClick={() => setIsSignUp(true)}>Sign Up</button>
              ) : (
                <div style={{
                  marginTop: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Lock size={18} style={{ color: 'rgba(255,255,255,0.9)' }} />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: 600 }}>
                    We&rsquo;ll Be Right Back!
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textAlign: 'center', maxWidth: '190px', lineHeight: 1.6 }}>
                    Temporarily pausing sign-ups while we upgrade things. Back open shortly!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
