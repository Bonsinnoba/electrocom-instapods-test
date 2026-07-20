import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, ShoppingBag, MapPin } from 'lucide-react';
import { trackOrder } from '../services/api';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get('ref');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderRef) {
        setLoading(false);
        return;
      }

      try {
        // Get user email from localStorage or context
        const userEmail = localStorage.getItem('user_email');
        if (userEmail) {
          const response = await trackOrder(orderRef, userEmail);
          if (response.success && response.data) {
            setOrderData(response.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch order data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderRef]);

  return (
    <div className="animate-fade-in" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '80px 20px',
      textAlign: 'center',
      minHeight: '60vh'
    }}>
      <div style={{ 
        width: '80px', 
        height: '80px', 
        borderRadius: '50%', 
        background: 'rgba(34, 197, 94, 0.1)', 
        color: '#22c55e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px'
      }}>
        <CheckCircle size={48} />
      </div>

      <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}>Order Confirmed!</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '500px', fontSize: '18px', lineHeight: '1.6' }}>
        Thank you for your purchase. Your order has been received and is now being processed.
      </p>

      {orderRef && (
        <div style={{ 
          marginTop: '32px', 
          padding: '16px 24px', 
          background: 'var(--bg-surface)', 
          borderRadius: '16px', 
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>ORDER REFERENCE</span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-blue)', letterSpacing: '1px' }}>{orderRef}</span>
        </div>
      )}

      {orderData && orderData.pickup_location && (
        <div style={{ 
          marginTop: '24px', 
          padding: '20px', 
          background: 'rgba(59, 130, 246, 0.05)', 
          borderRadius: '16px', 
          border: '1px solid rgba(59, 130, 246, 0.2)',
          maxWidth: '500px',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <MapPin size={20} style={{ color: 'var(--primary-blue)' }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-blue)' }}>
              Pickup Location
            </span>
          </div>
          <div style={{ fontSize: '14px', marginBottom: '12px' }}>
            <strong>{orderData.pickup_location.name}</strong><br />
            {orderData.pickup_location.address}
            {orderData.pickup_location.city && `, ${orderData.pickup_location.city}`}
          </div>
          {orderData.pickup_location.deadline_passed ? (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--danger)', fontWeight: 600 }}>
              Pickup deadline has passed
            </div>
          ) : (
            <>
              {orderData.pickup_location.contact_person && (
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>Contact:</strong> {orderData.pickup_location.contact_person}
                  {orderData.pickup_location.contact_phone && ` • ${orderData.pickup_location.contact_phone}`}
                </div>
              )}
              {orderData.pickup_location.pickup_instructions && (
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>Pickup Instructions:</strong> {orderData.pickup_location.pickup_instructions}
                </div>
              )}
              {orderData.pickup_location.what_to_bring && (
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>What to Bring:</strong> {orderData.pickup_location.what_to_bring}
                </div>
              )}
              {orderData.pickup_location.id_requirements && (
                <div style={{ fontSize: '13px' }}>
                  <strong>ID Requirements:</strong> {orderData.pickup_location.id_requirements}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginTop: '48px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <Link to="/orders" className="btn-primary" style={{ flex: 1 }}>
          <Package size={18} />
          View Orders
        </Link>
        <Link to="/shop" className="btn-secondary" style={{ flex: 1 }}>
          <ShoppingBag size={18} />
          Shop More
        </Link>
      </div>

      <Link to="/" style={{ 
        marginTop: '24px', 
        color: 'var(--text-muted)', 
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none'
      }}>
        Return to Home <ArrowRight size={14} />
      </Link>
    </div>
  );
}
