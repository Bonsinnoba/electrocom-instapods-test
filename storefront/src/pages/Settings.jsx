import React, { useState } from 'react';
import { 
  Moon, Sun, Bell, Globe, Shield, Settings as SettingsIcon, 
  ChevronRight, User, MapPin, ShoppingBag, 
  Trash2, HelpCircle, Eye, EyeOff, Mail, Phone, CreditCard as PaymentIcon,
  History, Smartphone, Receipt, X, AlertTriangle, KeyRound
} from 'lucide-react';
import AlertModal from '../components/AlertModal';
import { useNotifications } from '../context/NotificationContext';
import { useSettings } from '../context/SettingsContext';
import { useUser } from '../context/UserContext';
import { deleteMyAccount, changePassword, updateProfile } from '../services/api'; // Added updateProfile
import { useNavigate, Link } from 'react-router-dom'; // Added Link

export default function Settings({ searchQuery, isDarkMode, toggleDarkMode }) {
  const { addToast } = useNotifications();
  const { settings, updateSetting, siteSettings } = useSettings();
  const { user, updateUser, logout } = useUser();
  const navigate = useNavigate();

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Sync profile form when user context changes
  React.useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || ''
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const result = await updateProfile(profileForm);
      if (result.success) {
        updateUser(profileForm);
        setAlert({
          isOpen: true,
          title: 'Profile Updated',
          message: 'Your profile changes have been successfully saved.',
          type: 'success'
        });
        setIsEditingProfile(false);
      } else {
        setAlert({
          isOpen: true,
          title: 'Update Failed',
          message: result.message || 'We could not save your profile changes.',
          type: 'error'
        });
      }
    } catch {
      setAlert({
        isOpen: true,
        title: 'Network Error',
        message: 'A connection problem prevented the update.',
        type: 'error'
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
// ... (rest of the state/hooks)

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);



  // ── Change Password ──────────────────────────────────────────────
  const openPasswordModal = () => {
    setPwForm({ current: '', next: '', confirm: '' });
    setPwError('');
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');

    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (pwForm.next === pwForm.current) {
      setPwError('New password cannot be the same as your current password.');
      return;
    }

    setPwLoading(true);
    try {
      const result = await changePassword(pwForm.current, pwForm.next);
      if (result.success) {
        addToast('Password changed successfully!', 'success');
        setShowPasswordModal(false);
      } else {
        setPwError(result.message || 'Failed to change password.');
      }
    } catch {
      setPwError('Connection error. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Account Deletion ─────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const result = await deleteMyAccount();
      if (result.success) {
        addToast('Your account has been deactivated. You can restore it anytime within the next 30 days.', 'success');
        logout();
        navigate('/');
      } else {
        addToast(result.message || 'Failed to delete account', 'error');
      }
    } catch {
      addToast('An error occurred during account deletion', 'error');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleToggle = (key) => {
    const newValue = !settings[key];
    updateSetting(key, newValue);
    addToast(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} ${newValue ? 'Enabled' : 'Disabled'}`, 'info');
  };

  const handleAction = (title, message) => {
    addToast(`${title}: ${message}`, 'info');
  };

  const shouldShow = (title) => {
    if (!searchQuery) return true;
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // ── Sub-components ───────────────────────────────────────────────
  const Toggle = ({ checked, onChange }) => (
    <div 
      onClick={onChange} 
      style={{ 
        width: '42px', height: '24px', 
        background: checked ? 'var(--primary-blue)' : 'rgba(255, 255, 255, 0.1)', 
        borderRadius: '20px', position: 'relative', cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid var(--border-light)'
      }}
    >
      <div style={{ 
        width: '18px', height: '18px', background: 'white', borderRadius: '50%', 
        position: 'absolute', top: '2px', left: checked ? '21px' : '2px', 
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
      }}></div>
    </div>
  );

  const SettingRow = ({ icon: Icon, title, description, action, onClick }) => (
    <div className="setting-row" 
      onClick={onClick}
      style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '12px', borderRadius: '16px', transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ 
          background: 'var(--bg-main)', padding: '10px', borderRadius: '12px', 
          color: 'var(--text-muted)', display: 'flex'
        }}>
          <Icon size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{title}</div>
          {description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
        </div>
      </div>
      {action}
    </div>
  );

  const ActionButton = ({ label, type = 'secondary', onClick }) => (
    <button 
      type="button"
      className={`btn-${type}`} 
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      style={{ 
        padding: '6px 12px', 
        borderRadius: '8px', 
        fontWeight: 700, 
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        width: '15%',
        minWidth: '85px'
      }}
    >
      {label}
    </button>
  );

  const SettingCard = ({ title, icon: Icon, children }) => (
    <div className="card glass setting-card" style={{ 
      padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '20px',
      transition: 'all 0.3s ease', width: '100%', boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          background: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '12px', 
          color: 'var(--primary-blue)', display: 'flex'
        }}>
          <Icon size={20} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="settings-page" style={{ 
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'
    }}>
      <div className="page-header-centered" style={{ 
        gridColumn: '1 / -1', 
        padding: '24px 0 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '8px' }}>Global Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Manage your account preferences, orders, and security.</p>
      </div>

      {/* Account Section */}
      {shouldShow('Account Information') && (
        <SettingCard title="Account Information" icon={User}>
          <div className="settings-action-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', width: '100%' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Update your personal details and delivery address.
            </span>
            <button 
              type="button"
              className={isEditingProfile ? "btn-primary" : "btn-secondary"}
              onClick={() => isEditingProfile ? handleSaveProfile() : setIsEditingProfile(true)}
              disabled={isSavingProfile}
              style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, width: '100%' }}
            >
              {isSavingProfile ? 'Saving...' : (isEditingProfile ? 'Save Changes' : 'Edit Profile')}
            </button>
          </div>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            <SettingRow 
              icon={User} title="Full Name" 
              description={isEditingProfile ? null : (user?.name || 'Guest User')}
              action={isEditingProfile ? (
                <input 
                  type="text" 
                  value={profileForm.name} 
                  onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                  className="input-premium"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '200px' }}
                />
              ) : null}
            />
            <SettingRow 
              icon={Mail} title="Email Address" 
              description={user?.email || siteSettings.siteEmail || 'your@email.com'}
              action={<span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>PERMANENT</span>} 
            />
            <SettingRow 
              icon={Phone} title="Phone Number" 
              description={isEditingProfile ? null : (user?.phone || '+233 53 668 3393')}
              action={isEditingProfile ? (
                <input 
                  type="tel" 
                  value={profileForm.phone} 
                  onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  className="input-premium"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '200px' }}
                />
              ) : null} 
            />
            <SettingRow 
              icon={MapPin} title="Shipping Address" 
              description={isEditingProfile ? null : (user?.address || 'Set your default address')}
              action={isEditingProfile ? (
                <input 
                  type="text" 
                  value={profileForm.address} 
                  onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))}
                  className="input-premium"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '200px' }}
                />
              ) : null}
            />
          </div>
          {isEditingProfile && (
            <button 
              type="button"
              className="btn-outline" 
              onClick={() => setIsEditingProfile(false)}
              style={{ marginTop: '8px', padding: '8px', fontSize: '12px', width: '100%' }}
            >
              Cancel Editing
            </button>
          )}
        </SettingCard>
      )}

      {/* Order Preferences */}
      {shouldShow('Shopping & Orders') && (
        <SettingCard title="Shopping & Orders" icon={ShoppingBag}>
          <SettingRow 
            icon={Eye} title="Order Tracking" description="Real-time SMS updates"
            action={<Toggle checked={settings.sms_tracking} onChange={() => handleToggle('sms_tracking')} />} 
          />
          <SettingRow 
            icon={History} title="Purchase History" description="Manage your previous orders"
            onClick={() => navigate('/orders')}
            action={<ChevronRight size={18} color="var(--text-muted)" />} 
          />
          <SettingRow 
            icon={HelpCircle} title="Return Policy" description="30-day money-back guarantee"
            onClick={() => navigate('/returns')}
            action={<ActionButton label="View" onClick={() => navigate('/returns')} />} 
          />
        </SettingCard>
      )}

      {/* Payment & Transactions */}
      {shouldShow('Payments & Transactions') && (
        <SettingCard title="Payments & Transactions" icon={Receipt}>
          <SettingRow 
            icon={PaymentIcon} title="Payment Methods" description="Visa, PayPal, Mobile Money"
            onClick={() => navigate('/transactions')}
            action={<ChevronRight size={18} color="var(--text-muted)" />} 
          />
          <SettingRow 
            icon={History} title="Transaction History" description="View all previous payments"
            onClick={() => navigate('/transactions')}
            action={<ChevronRight size={18} color="var(--text-muted)" />} 
          />
        </SettingCard>
      )}

      {/* Notifications Section */}
      {shouldShow('Notifications') && (
        <SettingCard title="Notifications" icon={Bell}>
          <SettingRow 
            icon={Mail} title="Email Alerts" description="Order confirmations & receipts"
            action={<Toggle checked={settings.email_notif} onChange={() => handleToggle('email_notif')} />} 
          />
          <SettingRow 
            icon={Smartphone} title="Push Notifications" description="Flash sales and promo alerts"
            action={<Toggle checked={settings.push_notif} onChange={() => handleToggle('push_notif')} />} 
          />
        </SettingCard>
      )}

      {/* Security Section */}
      {shouldShow('Security & Privacy') && (
        <SettingCard title="Security & Privacy" icon={Shield}>

          <SettingRow 
            icon={KeyRound} title="Change Password" description="Update your account password"
            action={<ActionButton label="Change" onClick={openPasswordModal} />} 
          />
          <SettingRow 
            icon={Eye} title="Privacy Guard" description="Manage personal data usage"
            onClick={() => navigate('/privacy-policy')}
            action={<ActionButton label="Manage" onClick={() => navigate('/privacy-policy')} />} 
          />
          <SettingRow 
            icon={Trash2} title="Account Deletion" description="Permanently remove your data"
            onClick={() => setShowDeleteConfirm(true)}
            action={
              <span 
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} 
                style={{ 
                  color: '#ef4444', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.1)'
                }}
              >
                Delete
              </span>
            } 
          />
        </SettingCard>
      )}

      {/* App Appearance */}
      {shouldShow('App Preferences') && (
        <SettingCard title="App Preferences" icon={SettingsIcon}>
          <SettingRow 
            icon={isDarkMode ? Moon : Sun} title="Interface Theme"
            description={`Currently in ${isDarkMode ? 'Dark' : 'Light'} mode`}
            action={<ActionButton label={isDarkMode ? "Light Mode" : "Dark Mode"} onClick={toggleDarkMode} />} 
          />
          <div style={{ padding: '12px', borderTop: '1px solid var(--border-light)', marginTop: '8px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Store Brand Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: siteSettings.primaryColor || 'var(--primary-blue)',
                border: '3px solid var(--border-light)',
                boxShadow: `0 0 14px ${siteSettings.primaryColor || 'var(--primary-blue)'}55`,
                flexShrink: 0
              }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{siteSettings.primaryColor || '#3b82f6'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Managed by store administrators
                </div>
              </div>
            </div>
          </div>
          <SettingRow 
            icon={Globe} title="Language" description={settings.language}
            action={
              <select 
                value={settings.language}
                onChange={(e) => {
                  updateSetting('language', e.target.value);
                  addToast(`Language set to ${e.target.value}`, 'info');
                }}
                style={{
                  padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="English (UK)">English (UK)</option>
                <option value="English (US)">English (US)</option>
                <option value="French">Français</option>
                <option value="German">Deutsch</option>
              </select>
            } 
          />
        </SettingCard>
      )}

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div 
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="card glass animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '100%', padding: '32px', textAlign: 'center' }}
          >
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Deactivate Account?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '28px' }}>
              Your account will be deactivated immediately. You will have a <strong>30-day grace period</strong> to restore your account by simply logging back in. After 30 days, your personal data will be permanently anonymized.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn-secondary" style={{ flex: 1 }} 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-danger" style={{ flex: 1 }}
                onClick={handleDeleteAccount}
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ──────────────────────────────────── */}
      {showPasswordModal && (
        <div 
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div 
            className="card glass animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '100%', padding: '32px', position: 'relative' }}
          >
            <button 
              type="button"
              onClick={() => setShowPasswordModal(false)}
              style={{ 
                position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '8px'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.1)', padding: '10px', borderRadius: '12px', 
                color: 'var(--primary-blue)', display: 'flex'
              }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Change Password</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Minimum 8 characters required</p>
              </div>
            </div>

            {pwError && (
              <div style={{ 
                padding: '10px 14px', marginBottom: '16px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Current Password */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showCurrentPw ? 'text' : 'password'}
                    value={pwForm.current}
                    onChange={(e) => setPwForm(prev => ({ ...prev, current: e.target.value }))}
                    placeholder="Enter current password"
                    required
                    autoFocus
                    style={{ 
                      width: '100%', padding: '10px 40px 10px 14px', borderRadius: '12px',
                      border: '1px solid var(--border-light)', background: 'var(--bg-surface)',
                      color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box',
                      fontSize: '14px'
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{ 
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0
                    }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showNewPw ? 'text' : 'password'}
                    value={pwForm.next}
                    onChange={(e) => setPwForm(prev => ({ ...prev, next: e.target.value }))}
                    placeholder="Enter new password"
                    required
                    style={{ 
                      width: '100%', padding: '10px 40px 10px 14px', borderRadius: '12px',
                      border: '1px solid var(--border-light)', background: 'var(--bg-surface)',
                      color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box',
                      fontSize: '14px'
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{ 
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0
                    }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwForm.next && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: pwForm.next.length >= 8 ? '#22c55e' : 'var(--text-muted)' }}>
                    {pwForm.next.length >= 8 ? '✓ Strong enough' : `${8 - pwForm.next.length} more characters needed`}
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Confirm New Password
                </label>
                <input 
                  type={showNewPw ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm(prev => ({ ...prev, confirm: e.target.value }))}
                  placeholder="Re-enter new password"
                  required
                  style={{ 
                    width: '100%', padding: '10px 14px', borderRadius: '12px',
                    border: `1px solid ${pwForm.confirm && pwForm.confirm !== pwForm.next ? '#ef4444' : 'var(--border-light)'}`,
                    background: 'var(--bg-surface)', color: 'var(--text-main)',
                    outline: 'none', boxSizing: 'border-box', fontSize: '14px'
                  }}
                />
                {pwForm.confirm && pwForm.confirm !== pwForm.next && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#ef4444' }}>Passwords do not match</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="button" className="btn-secondary" style={{ flex: 1 }}
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" className="btn-primary" style={{ flex: 2 }}
                  disabled={pwLoading || !pwForm.current || !pwForm.next || !pwForm.confirm}
                >
                  {pwLoading ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1024px) {
          .settings-page {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        .setting-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.15);
          border-color: rgba(59, 130, 246, 0.3) !important;
        }
        .setting-row:hover {
          background: rgba(59, 130, 246, 0.05);
        }
        .dark-mode .setting-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .btn-danger {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-danger:hover {
          background: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
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


