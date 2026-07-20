import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, ShoppingBag } from 'lucide-react';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get('ref');

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
