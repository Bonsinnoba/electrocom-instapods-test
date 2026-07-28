import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function CouponBanner() {
  const [coupons, setCoupons] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const { formatPrice } = useSettings();

  useEffect(() => {
    // Fetch active coupons from API
    // For now, using placeholder data - can be replaced with actual API call
    const fetchCoupons = async () => {
      try {
        // TODO: Replace with actual API call to get public active coupons
        // const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/coupons.php?action=public`);
        // const data = await response.json();
        // if (data.success) setCoupons(data.coupons);
        
        // Placeholder data for now
        setCoupons([
          {
            id: 1,
            code: 'WELCOME20',
            discount_type: 'percent',
            discount_value: 20,
            min_spend: 0,
            description: 'Get 20% off your first order'
          }
        ]);
      } catch (error) {
        console.error('Failed to fetch coupons:', error);
      }
    };

    fetchCoupons();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (coupons.length === 0) return null;

  return (
    <div className="glass" style={{
      padding: '20px',
      borderRadius: '16px',
      marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
      border: '1px solid rgba(59, 130, 246, 0.2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Gift size={24} color="var(--primary-blue)" />
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
          Limited Time Offer
        </h3>
      </div>
      
      {coupons.map((coupon) => (
        <div key={coupon.id} style={{
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          padding: '16px',
          border: '2px dashed var(--primary-blue)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: '40px',
            height: '40px',
            background: 'var(--primary-blue)',
            borderRadius: '50%',
            opacity: 0.1,
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--primary-blue)',
              marginBottom: '4px'
            }}>
              {coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : formatPrice(coupon.discount_value)} OFF
            </div>
            
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginBottom: '12px',
              lineHeight: '1.4'
            }}>
              {coupon.description || 'Use this coupon on your first order'}
            </p>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{
                background: 'var(--bg-main)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '1px',
                border: '1px solid var(--border-light)'
              }}>
                {coupon.code}
              </div>
              
              <button
                onClick={() => handleCopyCode(coupon.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: copiedCode === coupon.code ? 'var(--success)' : 'var(--primary-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {copiedCode === coupon.code ? <Check size={16} /> : <Copy size={16} />}
                {copiedCode === coupon.code ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            {coupon.min_spend > 0 && (
              <p style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                Min. spend: {formatPrice(coupon.min_spend)}
              </p>
            )}
          </div>
        </div>
      ))}
      
      <p style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: '12px',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        Sign up to redeem this coupon
      </p>
    </div>
  );
}
