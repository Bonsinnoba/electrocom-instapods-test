import React, { useState } from 'react';
import { Search, Package, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { trackOrder, formatImageUrl } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import styles from './TrackOrder.module.css';


export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState(null);
  const { formatPrice } = useSettings();

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderId || !email) {
      setError('Please enter both Order ID and Email address.');
      return;
    }

    setLoading(true);
    setError('');
    setOrderData(null);

    try {
      const response = await trackOrder(orderId, email);
      if (response.success && response.data) {
        setOrderData(response.data);
      } else {
        setError(response.error || 'Order not found. Please check your details and try again.');
      }
    } catch (err) {
      setError('Failed to track order. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'var(--success)';
      case 'shipped': return 'var(--primary-blue)';
      case 'processing': return 'var(--warning)';
      case 'cancelled': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'delivered': return <CheckCircle size={20} />;
      case 'shipped': return <TrendingUp size={20} />;
      case 'cancelled': return <CheckCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '100%' }}>
      <div style={{ flex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className={styles.pageTitle}>Track Your Order</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>Enter your order ID and email address below to see the current status of your shipment.</p>
        </div>

        <div className="card glass animate-fade-in" style={{ padding: '32px', borderRadius: '24px', marginBottom: '40px' }}>
          <form onSubmit={handleTrack} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.inputsGrid}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. ORD-12345"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="The email used at checkout"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
                />
              </div>
            </div>
            <button
              type="submit"
              className={`btn-primary ${styles.trackBtn}`}
              disabled={loading}
            >
              {loading ? 'Searching...' : <><Search size={18} /> Track Order</>}
            </button>
          </form>
          {error && <p style={{ color: 'var(--danger)', marginTop: '16px', fontSize: '14px', textAlign: 'center', fontWeight: 500, background: 'var(--danger-bg)', padding: '10px', borderRadius: '8px' }}>{error}</p>}
        </div>

        {orderData && (
          <div className="card glass animate-fade-up" style={{ padding: '32px', borderRadius: '24px', animationDelay: '0.1s' }}>

            {/* Order Header */}
            <div className={styles.orderHeader}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={24} color="var(--primary-blue)" />
                  Order #{orderData.id}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Placed on {new Date(orderData.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '100px',
                  background: orderData.status === 'delivered' ? 'var(--success-bg)' :
                              orderData.status === 'cancelled' ? 'var(--danger-bg)' : 'rgba(59, 130, 246, 0.1)',
                  color: getStatusColor(orderData.status),
                  fontWeight: 700,
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {getStatusIcon(orderData.status)}
                  {orderData.status}
                </span>
              </div>
            </div>

            {/* Visual Timeline */}
            <div style={{ padding: '24px 0 40px 0', overflow: 'hidden' }}>
              <div className={styles.timelineContainer}>
                {/* Background Line - Hidden on very small screens or made relative */}
                <div className={styles.timelineLine}>
                  {/* Progress Fill */}
                  <div style={{
                    height: '100%',
                    background: getStatusColor(orderData.status),
                    borderRadius: '4px',
                    width: orderData.status === 'delivered' ? '100%' :
                           orderData.status === 'shipped' ? '66%' :
                           orderData.status === 'processing' ? '33%' :
                           orderData.status === 'cancelled' ? '100%' : '0%',
                    transition: 'width 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }} />
                </div>

                {orderData.timeline && orderData.timeline.map((step, idx) => (
                  <div key={idx} className={styles.timelineStep}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: step.completed ? (step.isError ? 'var(--danger)' : 'var(--primary-blue)') : 'var(--bg-surface)',
                      border: `3px solid ${step.completed ? 'var(--bg-surface)' : 'var(--border-light)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: step.completed ? 'white' : 'var(--text-muted)',
                      marginBottom: '12px',
                      boxShadow: step.completed ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                      transition: 'all 0.3s ease',
                      transform: step.completed ? 'scale(1.1)' : 'scale(1)',
                      flexShrink: 0,
                      zIndex: 2
                    }}>
                      {idx === 0 ? <CheckCircle size={18}/> :
                       idx === 1 ? <Package size={18}/> :
                       idx === 2 ? <TrendingUp size={18}/> :
                       <CheckCircle size={18}/>}
                    </div>
                    <span
                      className={styles.timelineLabel}
                      style={{ fontWeight: step.completed ? 700 : 500, color: step.completed ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '12px' }}
                    >
                      {step.label}
                    </span>
                    <span className={styles.timelineDate} style={{ fontSize: '10px' }}>
                      {step.date ? new Date(step.date).toLocaleDateString('en-GB') : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Items + Delivery Details */}
            <div className={styles.detailsGrid}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Order Items</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {orderData.items && orderData.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', background: 'var(--bg-surface-secondary)', borderRadius: '12px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'white', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.image_url ? (
                          <img 
                            src={formatImageUrl(item.image_url)} 
                            alt={item.name} 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain', 
                              borderRadius: '8px' 
                            }} 
                          />
                        ) : (
                          <Package size={24} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{item.name}</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Qty: {item.qty}</p>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                        {formatPrice(item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>Delivery Details</h3>
                <div style={{ padding: '16px', background: 'var(--bg-surface-secondary)', borderRadius: '12px' }}>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
                    <strong>Shipping To:</strong><br/>
                    {orderData.customer_name}<br />
                    {orderData.shipping_address}
                  </p>
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
                    <strong>Payment Method:</strong><br/>
                    {orderData.payment_method}
                  </p>
                  {orderData.pickup_location && (
                    <div style={{ margin: '0 0 12px 0', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700, color: 'var(--primary-blue)' }}>
                        Pickup Location: {orderData.pickup_location.name}
                      </p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', lineHeight: 1.5 }}>
                        {orderData.pickup_location.address}
                        {orderData.pickup_location.city && `, ${orderData.pickup_location.city}`}
                      </p>
                      {orderData.pickup_location.deadline_passed ? (
                        <p style={{ margin: '0', fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                          Pickup deadline passed
                        </p>
                      ) : (
                        <>
                          {orderData.pickup_location.contact_person && (
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                              <strong>Contact:</strong> {orderData.pickup_location.contact_person}
                              {orderData.pickup_location.contact_phone && ` • ${orderData.pickup_location.contact_phone}`}
                            </p>
                          )}
                          {orderData.pickup_location.pickup_instructions && (
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                              <strong>Instructions:</strong> {orderData.pickup_location.pickup_instructions}
                            </p>
                          )}
                          {orderData.pickup_location.what_to_bring && (
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                              <strong>What to Bring:</strong> {orderData.pickup_location.what_to_bring}
                            </p>
                          )}
                          {orderData.pickup_location.id_requirements && (
                            <p style={{ margin: '0', fontSize: '12px' }}>
                              <strong>ID Requirements:</strong> {orderData.pickup_location.id_requirements}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '16px' }}>
                      <span>Total</span>
                      <span style={{ color: 'var(--primary-blue)' }}>{formatPrice(orderData.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
