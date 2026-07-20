import React from 'react';
import { useAdminSettings } from '../context/AdminSettingsContext';

export default function POSReceipt({ orderId, cart, total, paymentMethod }) {
  const { settings, siteName } = useAdminSettings();
  const businessHours = settings?.businessHours;
  const storeAddress = settings?.storeAddress;
  const vatRate = settings?.vatRate !== undefined && settings?.vatRate !== null ? parseFloat(settings.vatRate) : 0;

  return (
    <div className="pos-receipt-print">
      <div className="receipt-header">
        <h2>{siteName || 'Retail Store'}</h2>
        {storeAddress && <p>{storeAddress}</p>}
        {businessHours && <p>{businessHours}</p>}
        <p>Tax ID: {siteName ? siteName.toUpperCase() : 'STORE'}-12345</p>
        <div className="receipt-divider"></div>
      </div>
      
      <div className="receipt-meta">
        <p>Order: #ORD-{orderId}</p>
        <p>Date: {new Date().toLocaleString()}</p>
        <p>Payment: {paymentMethod.toUpperCase()}</p>
        <p>Cashier: Terminal 01</p>
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-items">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #000' }}>
              <th style={{ paddingBottom: '4px' }}>Item</th>
              <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Qty</th>
              <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td style={{ paddingTop: '8px', wordBreak: 'break-word', paddingRight: '8px' }}>
                  {item.name}
                  <div style={{ fontSize: '10px', color: '#555' }}>@ GH₵ {item.price}</div>
                </td>
                <td style={{ paddingTop: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                <td style={{ paddingTop: '8px', textAlign: 'right', verticalAlign: 'top' }}>
                  GH₵ {(item.price * item.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-totals">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Subtotal</span>
          <span>GH₵ {total.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Tax ({vatRate}%)</span>
          <span>Included</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '8px', borderTop: '2px solid #000', paddingTop: '8px' }}>
          <span>TOTAL</span>
          <span>GH₵ {total.toLocaleString()}</span>
        </div>
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-footer">
        <p>Thank you for shopping with us!</p>
        <p>Items may be returned within 14 days<br />with original receipt.</p>
        
        {/* Simple barcode simulation using a standard font */}
        <div style={{ fontFamily: 'monospace', fontSize: '24px', letterSpacing: '2px', marginTop: '16px', marginBottom: '8px' }}>
          ||||| ||| || |||||| | |||
        </div>
        <p style={{ fontSize: '10px' }}>ORD-{orderId}</p>
      </div>
    </div>
  );
}
