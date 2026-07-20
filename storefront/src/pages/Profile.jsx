import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Camera, Star, ShieldCheck, RefreshCcw, Lock, Globe } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';
import { updateProfile } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import AlertModal from '../components/AlertModal';
import { compressImageAuto } from '../utils/imageCompression';


export default function Profile() {
  const { user, updateUser, resetUser } = useUser();
  const { confirm } = useConfirm();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    region: user?.region || 'Greater Accra'
  });

  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Keep form in sync if user state changes externally (like on reset)
  // This is intentional - we need to sync the form when user context changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        region: user.region || 'Greater Accra'
      });
    }
  }, [user]);

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <h2 style={{ color: 'var(--text-muted)' }}>Please login to view your profile</h2>
        <button className="btn-primary" onClick={() => navigate('/')} style={{ padding: '12px 24px', borderRadius: '12px' }}>
           Go to Home
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
        const response = await updateProfile(formData);
        if (response.success) {
            updateUser(formData);
            setAlert({
                isOpen: true,
                title: 'Profile Updated',
                message: 'Your personal information has been successfully saved to our servers.',
                type: 'success'
            });
        } else {
            setAlert({
                isOpen: true,
                title: 'Update Failed',
                message: response.message || 'We could not save your profile changes. Please try again.',
                type: 'error'
            });
        }
    } catch {
        setAlert({
            isOpen: true,
            title: 'Network Error',
            message: 'A connection problem prevented the update. Please check your internet.',
            type: 'error'
        });
    }
  };

  const handleReset = async () => {
    if (await confirm('Are you sure you want to reset your profile to defaults? All changes and your profile image will be removed.')) {
        try {
            const defaults = {
                name: 'Guest User', 
                address: '', 
                region: 'Greater Accra',
                profileImage: null,
                avatar: 'G'
            };
            const response = await updateProfile(defaults);
            if (response.success) {
                resetUser();
                setAlert({
                    isOpen: true,
                    title: 'Profile Reset',
                    message: 'Your profile has been restored to factory defaults.',
                    type: 'info'
                });
            } else {
                setAlert({
                    isOpen: true,
                    title: 'Reset Failed',
                    message: 'Failed to reset profile server-side.',
                    type: 'error'
                });
            }
        } catch {
            setAlert({
                isOpen: true,
                title: 'Network Error',
                message: 'A connection problem prevented the reset.',
                type: 'error'
            });
        }
    }
  };

  return (
    <div className="profile-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px'
    }}>
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '24px 0 8px' 
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>My Profile</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>View and update your personal information.</p>
        </div>
      </div>

      <div className="profile-content-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Profile Overview Card */}
          <div className="card glass" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 20px' }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '50%', 
                background: user.profileImage ? 'var(--bg-surface)' : 'linear-gradient(135deg, var(--primary-blue), var(--accent-blue))', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '40px',
                color: 'white',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                overflow: 'hidden',
                border: '4px solid var(--bg-main)'
              }}>
                {user.profileImage ? (
                    <img 
                        src={user.profileImage} 
                        alt={user.name} 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            borderRadius: '50%' 
                        }} 
                    />
                ) : (
                    user.avatar || 'BB'
                )}
              </div>
              <input 
                type="file" 
                id="profile-image-input" 
                accept="image/*" 
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (file.size > 5242880) { // 5MB limit
                        addToast('Image size too large. Please use an image under 5MB.', 'error');
                        return;
                    }
                    try {
                      addToast('Compressing profile image...', 'info');
                      const compressedImage = await compressImageAuto(file, { isProfile: true });
                      // Optimistically update context immediately for snappy UI
                      updateUser({ profileImage: compressedImage });
                      
                      const response = await updateProfile({ profileImage: compressedImage });
                      if (response.success) {
                        addToast('Profile image updated successfully', 'success');
                      } else {
                        addToast(response.message || 'Failed to update profile image', 'error');
                        // Revert on failure
                        updateUser({ profileImage: user.profileImage });
                      }
                    } catch (error) {
                      console.error('Image compression failed:', error);
                      addToast('Failed to compress image, using original', 'warning');
                      // Fallback to original
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64String = reader.result;
                        updateUser({ profileImage: base64String });
                        
                        try {
                            const response = await updateProfile({ profileImage: base64String });
                          if (response.success) {
                              addToast('Profile image uploaded successfully', 'success');
                          } else {
                              addToast(response.message || 'Failed to save image to server', 'error');
                              // Revert if failed? (Leaving optimistic for now)
                          }
                        } catch {
                          addToast('Network error while saving image', 'error');
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                }} 
                style={{ display: 'none' }} 
              />
              <button 
                onClick={() => document.getElementById('profile-image-input').click()}
                style={{ 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '4px', 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '50%', 
                  padding: '8px', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  color: 'var(--text-main)',
                  zIndex: 1
                }}
              >
                <Camera size={18} />
              </button>
            </div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800 }}>{user.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <Star size={14} fill="var(--warning)" color="var(--warning)" />
              <span>{user.level_name || 'Starter'} Level {user.level || 1}</span>
            </div>

            {/* Progression Progress Bar */}
            {user.level < 3 && (
              <div style={{ marginTop: '20px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Next Level: {user.level === 1 ? 'Elite' : 'VIP'}</span>
                  <span style={{ color: 'var(--primary-blue)' }}>{user.progress_percent || 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${user.progress_percent || 0}%`, height: '100%', background: 'linear-gradient(to right, var(--primary-blue), var(--accent-blue))', borderRadius: '3px' }}></div>
                </div>
              </div>
            )}

            {user?.role && user.role !== 'customer' && (
              <div style={{ 
                marginTop: '12px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '6px 12px', 
                borderRadius: '20px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                color: 'var(--primary-blue)',
                fontSize: '12px',
                fontWeight: 800,
                border: '1px solid rgba(59, 130, 246, 0.2)',
                textTransform: 'uppercase'
              }}>
                <ShieldCheck size={14} /> {user.role?.replace('_', ' ')} Account
              </div>
            )}
            
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{user.ordersCount || 0}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orders</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{user.loyalty_points || 0}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Points</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{user.reviewsCount || 0}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reviews</div>
              </div>
            </div>
          </div>


        </div>

        <div className="card glass" style={{ padding: '32px' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
            <User size={20} /> Personal Information
          </div>
          
          <div style={{ display: 'grid', gap: '24px' }}>
            <div className="form-group">
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                <User size={14} style={{ marginRight: '4px' }} /> Full Name
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-light)', 
                    background: 'var(--bg-main)', 
                    color: 'var(--text-main)',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }} 
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  <Mail size={14} style={{ marginRight: '4px' }} /> Email Address {user.email && <span style={{ fontSize: '10px', color: 'var(--primary-blue)', marginLeft: '4px' }}>(Permanent)</span>}
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={user.email}
                    placeholder="Add your email"
                    style={{ 
                      width: '100%', 
                      padding: '14px 16px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-light)', 
                      background: user.email ? 'var(--bg-surface-secondary)' : 'var(--bg-main)', 
                      color: user.email ? 'var(--text-muted)' : 'var(--text-main)',
                      fontSize: '15px',
                      outline: 'none',
                      cursor: user.email ? 'not-allowed' : 'text',
                      opacity: user.email ? 0.7 : 1
                    }} 
                  />
                  {user.email && <Lock size={14} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />}
                </div>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  <Phone size={14} style={{ marginRight: '4px' }} /> Phone Number
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Add your phone"
                    style={{ 
                      width: '100%', 
                      padding: '14px 16px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-light)', 
                      background: 'var(--bg-main)', 
                      color: 'var(--text-main)',
                      fontSize: '15px',
                      outline: 'none'
                    }} 
                  />
                </div>
              </div>
            </div>
 
            <div className="form-group">
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                <Globe size={14} style={{ marginRight: '4px' }} /> Delivery Region
              </label>
              <div className="input-wrapper">
                <select 
                  name="region" 
                  value={formData.region} 
                  onChange={handleChange} 
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-light)', 
                    background: 'var(--bg-main)', 
                    color: 'var(--text-main)',
                    fontSize: '15px',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer'
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

            <div className="form-group">
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                <MapPin size={14} style={{ marginRight: '4px' }} /> Delivery Address
              </label>
              <div className="input-wrapper">
                <input 
                  type="text" 
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-light)', 
                    background: 'var(--bg-main)', 
                    color: 'var(--text-main)',
                    fontSize: '15px',
                    outline: 'none'
                  }} 
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
              <button 
                className="btn-primary" 
                onClick={handleSave}
                style={{ 
                  padding: '10px 28px', 
                  borderRadius: '10px', 
                  fontWeight: 600, 
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)' 
                }}
              >
                Save Profile
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleReset}
                style={{ 
                  padding: '10px 24px', 
                  borderRadius: '10px', 
                  fontWeight: 600, 
                  fontSize: '14px',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  background: 'rgba(239, 68, 68, 0.05)'
                }}
              >
                <RefreshCcw size={14} /> Restore Defaults
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .profile-content-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
      <AlertModal 
        isOpen={alert.isOpen}
        onClose={() => setAlert(prev => ({ ...prev, isOpen: false }))}
        title={alert.title}
        message={alert.message}
        type={alert.type}
      />
    </div>
  );
}
