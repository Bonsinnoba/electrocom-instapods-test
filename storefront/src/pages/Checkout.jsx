import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';
import { useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { CreditCard, Truck, ShieldCheck, ArrowLeft, ChevronRight, CheckCircle, Smartphone, MapPin, Tag } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { createOrder, fetchPickupLocations, getShippingFee } from '../services/api';

import { usePaystackPayment } from 'react-paystack';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

const GHANA_REGIONS = [
  { code: 'GA', label: 'Greater Accra', city: 'Accra' },
  { code: 'AS', label: 'Ashanti', city: 'Kumasi' },
  { code: 'CR', label: 'Central', city: 'Cape Coast' },
  { code: 'ER', label: 'Eastern', city: 'Koforidua' },
  { code: 'WR', label: 'Western', city: 'Sekondi-Takoradi' },
  { code: 'VR', label: 'Volta', city: 'Ho' },
  { code: 'NR', label: 'Northern', city: 'Tamale' },
  { code: 'UE', label: 'Upper East', city: 'Bolgatanga' },
  { code: 'UW', label: 'Upper West', city: 'Wa' },
  { code: 'BE', label: 'Bono East', city: 'Techiman' },
  { code: 'BR', label: 'Bono', city: 'Sunyani' },
  { code: 'AH', label: 'Ahafo', city: 'Goaso' },
  { code: 'OT', label: 'Oti', city: 'Dambai' },
  { code: 'SV', label: 'Savannah', city: 'Damongo' },
  { code: 'NE', label: 'North East', city: 'Nalerigu' },
  { code: 'WN', label: 'Western North', city: 'Sefwi Wiawso' }
];

export default function Checkout() {
  const { cartItems, removeCheckedOutItems, appliedCoupon, applyCoupon, removeCoupon, isApplyingCoupon, couponError } = useCart();
  const location = useLocation();
  // Use items passed from Cart's selection; fall back to full cart
  const selectedItems = location.state?.selectedItems?.length ? location.state.selectedItems : cartItems;
  const subtotal = selectedItems.reduce((a, i) => a + parseFloat(i.price) * i.quantity, 0);
  const { addToast } = useNotifications();
  const { user } = useUser();
  const { siteSettings, formatPrice } = useSettings();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: user?.address || '',
    city: user?.city || '',
    region: user?.region || '',
    zip: user?.zip || '',
    deliveryMethod: 'pickup'
  });
  const [paymentMethod, setPaymentMethod] = useState(siteSettings?.allowCardPayment !== false ? 'card' : 'momo');
  const [couponCode, setCouponCode] = useState('');
  const [pickupLocations, setPickupLocations] = useState([]);
  const [selectedPickupId, setSelectedPickupId] = useState('');
  const [loadingPickupLocations, setLoadingPickupLocations] = useState(true);
  const [shippingData, setShippingData] = useState({ fee: 0, is_discounted: false, city: '' });

  useEffect(() => {
    const loadPickupLocations = async () => {
      setLoadingPickupLocations(true);
      const data = await fetchPickupLocations();
      setPickupLocations(Array.isArray(data) ? data : []);
      if (data?.length > 0) {
        setSelectedPickupId(String(data[0].id));
      }
      setLoadingPickupLocations(false);
    };
    loadPickupLocations();
  }, []);

  const fetchShipping = useCallback(async () => {
    if (formData.deliveryMethod !== 'door_to_door' || !formData.region) {
      setShippingData({ fee: 0, is_discounted: false, city: '' });
      return;
    }
    try {
      const res = await getShippingFee(formData.region, subtotal);
      if (res.success) {
        setShippingData({
          fee: Number(res.fee || 0),
          is_discounted: Boolean(res.is_discounted),
          city: res.city || ''
        });
      }
    } catch {
      setShippingData({ fee: 0, is_discounted: false, city: '' });
    }
  }, [formData.deliveryMethod, formData.region, subtotal]);

  useEffect(() => {
    fetchShipping();
  }, [fetchShipping]);

  const vatRate = siteSettings?.vatRate !== undefined && siteSettings?.vatRate !== null ? parseFloat(siteSettings.vatRate) : 0;
  const selectedPickup = pickupLocations.find((loc) => String(loc.id) === String(selectedPickupId));
  const shippingFee = formData.deliveryMethod === 'door_to_door'
    ? Number(shippingData.fee || 0)
    : (selectedPickup ? Number(selectedPickup.fee || 0) : 0);
  const estimatedDelivery = formData.deliveryMethod === 'pickup'
    ? 'Ready for pickup in 1-2 business days'
    : 'Door delivery in 2-4 business days';
  
  const discount = Math.round((appliedCoupon ? appliedCoupon.discountAmount : 0) * 100) / 100;

  const integrityDiscountThreshold = Number(siteSettings?.integrityDiscountThreshold || 0);
  const integrityDiscountPct = Number(siteSettings?.integrityDiscountPct || 0);
  const userIntegrityPoints = Number(user?.loyalty_points || 0);
  const hasIntegrityDiscount = integrityDiscountThreshold > 0 && userIntegrityPoints >= integrityDiscountThreshold && integrityDiscountPct > 0;
  const integrityDiscountAmount = hasIntegrityDiscount ? Math.round((subtotal * (integrityDiscountPct / 100)) * 100) / 100 : 0;

  const totalDiscount = discount + integrityDiscountAmount;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = Math.round((taxableAmount * (vatRate / 100)) * 100) / 100;
  
  const total = Math.round((taxableAmount + tax + shippingFee) * 100) / 100;

  const doorToDoorThreshold = Number(siteSettings?.doorToDoorThreshold || 0);
  const isDoorToDoorAllowed = siteSettings?.allowDoorToDoorDelivery !== false && subtotal >= doorToDoorThreshold;

  useEffect(() => {
    if (!isDoorToDoorAllowed && formData.deliveryMethod === 'door_to_door') {
      setFormData(prev => ({ ...prev, deliveryMethod: 'pickup' }));
    }
  }, [isDoorToDoorAllowed, formData.deliveryMethod]);

  const handleApplyCoupon = async () => {
    const success = await applyCoupon(couponCode);
    if (success) setCouponCode('');
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
  };

  // Paystack Configuration
  const [paystackConfig, setPaystackConfig] = useState({
    reference: (new Date()).getTime().toString(),
    email: formData.email || user?.email || '',
    amount: Math.ceil(total * 100),
    publicKey: PAYSTACK_PUBLIC_KEY,
    currency: 'GHS',
    channels: paymentMethod === 'momo' ? ['mobile_money'] : ['card', 'mobile_money'],
    metadata: {
      user_id: user?.id,
      type: 'order_payment'
    }
  });

  // Update dynamic parts of config when dependencies change
  useEffect(() => {
    setPaystackConfig(prev => ({
        ...prev,
        email: formData.email || user?.email || '',
        amount: Math.ceil(total * 100),
        channels: paymentMethod === 'momo' ? ['mobile_money'] : ['card', 'mobile_money'],
        metadata: { ...prev.metadata, user_id: user?.id }
    }));
  }, [formData.email, user?.email, user?.id, total, paymentMethod]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const onSuccess = useCallback(async (reference) => {
      // Payment was successful, order is already created as pending
      // We can just redirect to the success page now
      addToast('Payment successful! Your order is being processed.', 'success');
      removeCheckedOutItems(selectedItems);
      checkoutIdempotencyKeyRef.current = '';
      setReservationDeadlineMs(null);
      setPaymentInterrupted(false);
      navigate(`/order-success?ref=${reference.reference}`);
      setLoading(false);
      isProcessingOrder.current = false;
  }, [addToast, removeCheckedOutItems, selectedItems, navigate]);

  const onClose = useCallback(() => {
      setLoading(false);
      isProcessingOrder.current = false;
      setPaymentInterrupted(true);
      addToast('Payment window closed. Your stock hold may expire—try again or contact support if this persists.', 'info');
  }, [addToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isProcessingOrder = useRef(false);
  const checkoutIdempotencyKeyRef = useRef('');

  const handleCompletePurchase = async () => {
    if (isProcessingOrder.current) return;
    isProcessingOrder.current = true;
    setLoading(true);

    if (paymentMethod === 'card' || paymentMethod === 'momo') {
        try {
            if (!PAYSTACK_PUBLIC_KEY) {
                throw new Error('Payment gateway key is not configured. Please contact support.');
            }
            if (!checkoutIdempotencyKeyRef.current) {
              checkoutIdempotencyKeyRef.current = `ck_${user?.id || 'guest'}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            }
            // 1. Create Pending Order first
            const orderData = {
                total_amount: total,
                items: selectedItems.map(item => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: parseFloat(item.price)
                })),
                shipping_address: formData.deliveryMethod === 'door_to_door'
                  ? `${formData.address}, ${formData.city}, ${GHANA_REGIONS.find(r => r.code === formData.region)?.label || ''} ${formData.zip}`
                  : (selectedPickup
                    ? `${selectedPickup.name} - ${selectedPickup.address}${selectedPickup.city ? `, ${selectedPickup.city}` : ''}`
                    : 'Store Pickup'),
                payment_method: `${paymentMethod === 'momo' ? 'Mobile Money' : 'Card'}`,
                delivery_method: formData.deliveryMethod,
                pickup_location_id: formData.deliveryMethod === 'pickup' && selectedPickupId ? Number(selectedPickupId) : null,
                coupon_code: appliedCoupon ? appliedCoupon.code : null,
                discount_amount: totalDiscount,
                idempotency_key: checkoutIdempotencyKeyRef.current
            };

            const response = await createOrder(orderData);

            if (response.success && response.payment_reference) {
                if (response.reservation_expires_at) {
                  const t = Date.parse(response.reservation_expires_at);
                  if (!Number.isNaN(t)) setReservationDeadlineMs(t);
                } else if (response.reservation_minutes) {
                  setReservationDeadlineMs(Date.now() + Number(response.reservation_minutes) * 60 * 1000);
                }
                setPaymentInterrupted(false);
                // Trigger Paystack via the useEffect by setting the pending reference
                setPendingRef(response.payment_reference);
            } else {
                throw new Error(response.message || 'Failed to initialize order');
            }
        } catch (err) {
            addToast(err.message || 'Server error. Please try again.', 'error');
            setLoading(false);
            isProcessingOrder.current = false;
        }
    } else {
        addToast('Payment method not supported yet', 'info');
        setLoading(false);
    }
  };

  const [pendingRef, setPendingRef] = useState(null);
  const [reservationDeadlineMs, setReservationDeadlineMs] = useState(null);
  const [, setReservationTick] = useState(0);
  const [paymentInterrupted, setPaymentInterrupted] = useState(false);

  useEffect(() => {
    if (!reservationDeadlineMs) return undefined;
    const id = setInterval(() => setReservationTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [reservationDeadlineMs]);

  const reservationRemainingSec = reservationDeadlineMs != null
    ? Math.max(0, Math.floor((reservationDeadlineMs - Date.now()) / 1000))
    : null;
  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (pendingRef) {
        // Update config with the backend reference
        setPaystackConfig(prev => ({ ...prev, reference: pendingRef }));
    }
  }, [pendingRef]);

  // Trigger payment after config is updated with the new reference
  useEffect(() => {
    if (pendingRef && paystackConfig.reference === pendingRef) {
        initializePayment(onSuccess, onClose);
        setPendingRef(null); // Reset
    }
  }, [paystackConfig.reference, pendingRef, initializePayment, onSuccess, onClose]);

  // --- NEW: Proactive Reservation Hardening (Heartbeat & Beacon) ---
  useEffect(() => {
    // Only run if we have an active order reference and are in a 'Loading' (Payment) state
    if (!paystackConfig.reference || !loading) return;

    // 1. Activity Heartbeat (Every 30 seconds)
    const interval = setInterval(() => {
      fetch(`${API_BASE_URL}/orders.php`, {
        method: 'POST',
        body: JSON.stringify({ action: 'heartbeat', reference: paystackConfig.reference }),
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {}); // Silent fail
    }, 30000);

    // 2. Proactive Release (Beacon on Window Close)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
         // Optional: Short delay or logic to decide if hidden = abandoned
      }
    };

    const handleBeforeUnload = () => {
      // Navigator.sendBeacon is reliable for tab closing
      const data = JSON.stringify({ action: 'cancel', reference: paystackConfig.reference });
      navigator.sendBeacon(`${API_BASE_URL}/orders.php`, data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [paystackConfig.reference, loading]);
  // -----------------------------------------------------------------

  const [redirectTarget, setRedirectTarget] = useState(null);
  useEffect(() => {
    if (!user) {
      addToast('Please log in to proceed with checkout', 'info');
      setRedirectTarget('/login?redirect=/checkout');
    }
  }, [user, addToast]);

  const [errors, setErrors] = useState({});

  if (!user || selectedItems.length === 0) {
    if (selectedItems.length === 0) {
      return <Navigate to="/cart" replace />;
    }
    if (redirectTarget) {
      return <Navigate to={redirectTarget} replace />;
    }
    return null;
  }

  const validateShipping = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Valid email is required';
    if (formData.deliveryMethod === 'pickup' && !selectedPickupId) {
      newErrors.pickup = 'Please select a pickup location';
    }
    if (formData.deliveryMethod === 'door_to_door') {
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.region) newErrors.region = 'Region is required';
      if (!formData.zip.trim()) newErrors.zip = 'ZIP / GPS location is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors = {};
    // For Paystack, we largely rely on their modal, but we can validate basic contact info again
    if (paymentMethod === 'momo') {
        // Optional: Validate if we want to capture it in our DB even if Paystack asks for it
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = (nextStep) => {
    if (step === 1 && !validateShipping()) return;
    if (step === 2 && nextStep === 3 && !validatePayment()) return;
    setStep(nextStep);
  };


  return (
    <div className="animate-fade-in page-shell">
      <div className="page-header" style={{ alignItems: 'center', marginBottom: '24px' }}>
        <Link to="/cart" className="sidebar-icon" style={{ margin: 0 }} aria-label="Back to cart">
          <ArrowLeft size={20} />
        </Link>
        <div className="page-heading-group" style={{ flex: 1 }}>
          <h1 className="page-title">Checkout</h1>
          <p className="page-subtitle">Complete shipping, payment, and order review in 3 steps.</p>
        </div>
      </div>

      <div className="checkout-steps" style={{ display: 'flex', gap: '24px', marginBottom: '40px', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px' }}>
        {[
          { icon: <Truck size={18} />, label: 'Shipping' },
          { icon: <CreditCard size={18} />, label: 'Payment' },
          { icon: <CheckCircle size={18} />, label: 'Review' }
        ].map((s, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: step === i + 1 ? 'var(--primary-blue)' : 'var(--text-muted)',
            fontWeight: step === i + 1 ? 700 : 500,
            transition: 'all 0.3s'
          }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: step === i + 1 ? 'var(--primary-blue)' : 'var(--bg-main)',
              color: step === i + 1 ? 'white' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}>
              {i + 1}
            </div>
            <span>{s.label}</span>
            {i < 2 && <ChevronRight size={16} color="var(--border-light)" />}
          </div>
        ))}
      </div>

      <div className="checkout-content" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '40px' }}>
        <div className="form-section">
          {step === 1 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>Shipping Information</h3>

              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className={`input-premium ${errors.name ? 'error' : ''}`} placeholder="John Doe" />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={`input-premium ${errors.email ? 'error' : ''}`} placeholder="john@example.com" />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Delivery Method</label>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <label style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)', background: formData.deliveryMethod === 'pickup' ? 'var(--bg-surface)' : 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600 }}>Store Pick Up</span>
                      <input type="radio" name="deliveryMethod" value="pickup" checked={formData.deliveryMethod === 'pickup'} onChange={handleChange} />
                    </label>
                    <label style={{ padding: '14px', borderRadius: '12px', border: isDoorToDoorAllowed ? '1px solid var(--border-light)' : '1px dashed var(--border-light)', background: formData.deliveryMethod === 'door_to_door' ? 'var(--bg-surface)' : 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isDoorToDoorAllowed ? 1 : 0.6, cursor: isDoorToDoorAllowed ? 'pointer' : 'not-allowed' }}>
                      <span style={{ fontWeight: 600, display: 'flex', flexDirection: 'column' }}>
                        <span>Door to Door</span>
                        {siteSettings?.allowDoorToDoorDelivery === false ? (
                           <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>Temporarily unavailable</span>
                        ) : subtotal < doorToDoorThreshold ? (
                           <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 400 }}>Min order: {formatPrice(doorToDoorThreshold)}</span>
                        ) : null}
                      </span>
                      <input type="radio" name="deliveryMethod" value="door_to_door" checked={formData.deliveryMethod === 'door_to_door'} onChange={handleChange} disabled={!isDoorToDoorAllowed} />
                    </label>
                  </div>
                </div>

                {formData.deliveryMethod === 'pickup' && (
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Choose Pickup Location</label>
                  {loadingPickupLocations ? (
                    <div className="loading-state">
                      Loading pickup locations...
                    </div>
                  ) : (
                    <select
                      value={selectedPickupId}
                      onChange={(e) => setSelectedPickupId(e.target.value)}
                      className={`input-premium ${errors.pickup ? 'error' : ''}`}
                      style={{ appearance: 'auto' }}
                    >
                      <option value="">Select pickup location</option>
                      {pickupLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} - {loc.city || 'N/A'} ({formatPrice(Number(loc.fee || 0))})
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.pickup && <span className="form-error">{errors.pickup}</span>}
                  {selectedPickup && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <MapPin size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {selectedPickup.address}
                    </div>
                  )}
                </div>
                )}

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--info-bg)', border: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--text-main)' }}>
                  <strong>Estimated delivery window:</strong> {estimatedDelivery}
                </div>

                {formData.deliveryMethod === 'door_to_door' && (
                  <>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Street Address / Landmark</label>
                      <input type="text" name="address" value={formData.address} onChange={handleChange} className={`input-premium ${errors.address ? 'error' : ''}`} placeholder="e.g. Near Shell Fuel Station" />
                      {errors.address && <span className="form-error">{errors.address}</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Town / City</label>
                        <input type="text" name="city" value={formData.city} onChange={handleChange} className={`input-premium ${errors.city ? 'error' : ''}`} placeholder="e.g. Accra" />
                        {errors.city && <span className="form-error">{errors.city}</span>}
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Region</label>
                        <select name="region" value={formData.region} onChange={handleChange} className={`input-premium ${errors.region ? 'error' : ''}`} style={{ appearance: 'auto' }}>
                          <option value="">Select Region</option>
                          {GHANA_REGIONS.map(r => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                        {errors.region && <span className="form-error">{errors.region}</span>}
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>ZIP / GPS Location</label>
                      <input type="text" name="zip" value={formData.zip} onChange={handleChange} className={`input-premium ${errors.zip ? 'error' : ''}`} placeholder="e.g. GA-123-4567" />
                      {errors.zip && <span className="form-error">{errors.zip}</span>}
                    </div>
                  </>
                )}

              </div>
              <button className="btn-primary" style={{ marginTop: '32px', width: '100%' }} onClick={() => handleNextStep(2)}>
                Continue to Payment
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>Payment Method</h3>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
                <div 
                  onClick={() => { if (siteSettings.allowCardPayment !== false) setPaymentMethod('card'); }}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '16px', 
                    background: paymentMethod === 'card' ? 'var(--bg-surface)' : 'var(--bg-main)', 
                    border: paymentMethod === 'card' ? '2px solid var(--primary-blue)' : (siteSettings.allowCardPayment !== false ? '1px solid var(--border-light)' : '1px dashed var(--border-light)'), 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    cursor: siteSettings.allowCardPayment !== false ? 'pointer' : 'not-allowed',
                    opacity: siteSettings.allowCardPayment !== false ? 1 : 0.6,
                    transition: 'all 0.2s'
                  }}
                >
                  <CreditCard size={24} color={paymentMethod === 'card' ? 'var(--primary-blue)' : 'var(--text-muted)'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{siteSettings.allowCardPayment !== false ? 'Credit or Debit Card' : 'Credit or Debit Card (temporarily unavailable)'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pay securely with your Visa, Mastercard, or Amex</div>
                  </div>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'card' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-blue)' }}></div>}
                  </div>
                </div>


                <div 
                  onClick={() => setPaymentMethod('momo')}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '16px', 
                    background: paymentMethod === 'momo' ? 'var(--bg-surface)' : 'var(--bg-main)', 
                    border: paymentMethod === 'momo' ? '2px solid var(--primary-blue)' : '1px solid var(--border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Smartphone size={24} color={paymentMethod === 'momo' ? 'var(--primary-blue)' : 'var(--text-muted)'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>Mobile Money</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pay with M-Pesa, MTN, or Airtel Money</div>
                  </div>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'momo' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-blue)' }}></div>}
                  </div>
                </div>
              </div>

              {paymentMethod === 'card' && (
                <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CreditCard size={24} />
                    <div>
                        <strong>Secure Credit/Debit Card Payment</strong>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>You will be redirected to Paystack's secure checkout to enter your card details.</div>
                    </div>
                </div>
              )}

              {paymentMethod === 'momo' && (
                <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Smartphone size={24} />
                    <div>
                        <strong>Mobile Money Payment</strong>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>You will be redirected to Paystack to complete your payment via M-Pesa, MTN, or Airtel Money.</div>
                </div>
              </div>
              )}


              <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>
                  <ArrowLeft size={18} />
                  Back
                </button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>
                  Review Order
                  <ShieldCheck size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h3 style={{ marginBottom: '24px', fontSize: '20px' }}>Final Review</h3>
              <div style={{ display: 'grid', gap: '24px' }}>
                <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700 }}>Shipping to:</span>
                    <button className="btn-outline" onClick={() => setStep(1)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', borderWeight: '1px' }}>Edit</button>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {formData.name}<br />
                    {formData.deliveryMethod === 'door_to_door'
                      ? `${formData.address}, ${formData.city}, ${GHANA_REGIONS.find(r => r.code === formData.region)?.label || ''} ${formData.zip}`
                      : (selectedPickup ? `${selectedPickup.name} - ${selectedPickup.address}${selectedPickup.city ? `, ${selectedPickup.city}` : ''}` : 'Store Pickup')
                    }<br />
                    {formData.email}
                  </div>
                </div>
                <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-main)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700 }}>Payment Method:</span>
                    <button className="btn-outline" onClick={() => setStep(2)} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', borderWeight: '1px' }}>Edit</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    {paymentMethod === 'card' ? (
                      <>
                        <CreditCard size={16} />
                        <span>Credit/Debit Card (via Paystack)</span>
                      </>
                    ) : paymentMethod === 'paypal' ? (
                      <span>PayPal</span>
                    ) : paymentMethod === 'apple' ? (
                      <span>Apple Pay</span>
                    ) : (
                      <>
                        <Smartphone size={16} />
                        <span>Mobile Money (via Paystack)</span>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Delivery Method: <strong style={{ color: 'var(--text-main)' }}>{formData.deliveryMethod === 'pickup' ? 'Store Pick Up' : 'Door to Door'}</strong>
                  </div>
                </div>
              </div>
              {reservationRemainingSec != null && reservationRemainingSec > 0 && (
                <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '12px', background: 'var(--info-bg)', border: '1px solid var(--border-light)', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Stock reserved for checkout: <span style={{ color: reservationRemainingSec < 120 ? 'var(--danger)' : 'var(--primary-blue)' }}>{formatCountdown(reservationRemainingSec)}</span>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginTop: '6px' }}>
                    Complete payment before the timer ends to reduce the risk of an oversell. Low-stock carts get a shorter hold.
                  </span>
                </div>
              )}

              {paymentInterrupted && (
                <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>Payment did not finish</div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
                    You can safely try again. If Paystack closed or your bank timed out, use the button below to reopen checkout.
                  </p>
                  <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={() => { setPaymentInterrupted(false); handleCompletePurchase(); }}>
                    Retry payment
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>
                  <ArrowLeft size={18} />
                  Back
                </button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleCompletePurchase} disabled={loading}>
                  <CheckCircle size={18} />
                  {loading ? 'Processing...' : 'Complete Purchase'}
                </button>
              </div>
              <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-main)' }}>Returns:</strong>{' '}
                Unopened items in original packaging may be returned within 14 days of pickup or delivery, unless marked final sale.
                See our <Link to="/returns" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Returns</Link> page for steps and exceptions.
              </div>
              <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-main)' }}>What happens next:</strong><br />
                1) We secure your items and confirm payment.<br />
                2) You receive confirmation via in-app notification and email/SMS (if enabled).<br />
                3) We notify you once your order is ready for pickup or out for delivery.
              </div>
            </div>
          )}
        </div>

        <div className="summary-section">
          <div style={{ padding: '24px', borderRadius: '24px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', position: 'sticky', top: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedItems.map(item => (
                <div key={`${item.id}-${item.selectedColor}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{item.quantity}x {item.name}</span>
                    {item.selectedColor !== 'Default' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Color: {item.selectedColor}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontWeight: 700, color: item.discount_percent > 0 ? 'var(--success)' : 'inherit' }}>
                      {formatPrice(parseFloat(item.price) * item.quantity)}
                    </span>
                    {item.discount_percent > 0 && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          {formatPrice(parseFloat(item.original_price || item.price) * item.quantity)}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 4px', borderRadius: '3px' }}>
                          -{item.discount_percent}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '12px 0' }}></div>
              <div className="summary-row">
                <span className="text-muted">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span className="text-muted">Estimated Tax ({vatRate}%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              {appliedCoupon && (
                <div className="summary-row" style={{ color: 'var(--danger)' }}>
                  <span>Promo Code ({appliedCoupon.code})</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              {hasIntegrityDiscount && (
                <div className="summary-row" style={{ color: 'var(--danger)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} /> Loyalty Reward (-{integrityDiscountPct}%)
                  </span>
                  <span>-{formatPrice(integrityDiscountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Shipping</span>
                  <span style={{ fontSize: '10px', color: 'var(--primary-blue)', fontWeight: 600 }}>
                    {formData.deliveryMethod === 'pickup'
                      ? `Store Pick Up${selectedPickup?.city ? ` • ${selectedPickup.city}` : ''}`
                      : `${shippingData.is_discounted ? 'Regional Promo (50% Off)' : 'Standard Delivery'}${shippingData.city ? ` • Dispatched from ${shippingData.city}` : ''}`
                    }
                  </span>
                </div>
                <span style={{ color: shippingFee === 0 ? '#22c55e' : 'var(--text-main)', fontWeight: shippingFee === 0 ? 700 : 500 }}>
                   {shippingFee === 0 ? 'Free' : formatPrice(shippingFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 800, marginTop: '12px' }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary-blue)' }}>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Promo Code Input */}
            {!appliedCoupon ? (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed var(--border-light)' }}>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <input 
                    type="text" 
                    value={couponCode} 
                    onChange={(e) => setCouponCode(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                    placeholder="Enter Promo Code" 
                    className="input-premium" 
                    style={{ flex: 1, padding: '10px 14px' }} 
                  />
                  <button 
                    onClick={handleApplyCoupon} 
                    disabled={isApplyingCoupon || !couponCode.trim()} 
                    className="btn-secondary" 
                    style={{ padding: '10px 16px' }}
                  >
                    {isApplyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{couponError}</div>}
              </div>
            ) : (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed var(--border-light)' }}>
                 <button onClick={handleRemoveCoupon} className="btn-outline" style={{ width: '100%', fontSize: '13px', padding: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    Remove Coupon
                 </button>
              </div>
            )}
            
            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#166534', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={18} />
              <span>Secure checkout enabled</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
