import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Minus, Trash2,
  Banknote, Package, Zap,
  CheckCircle2, Printer, Mail,
  Barcode, RotateCcw, Loader, CreditCard, SkipForward,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import POSReceipt from '../components/POSReceipt';

import { API_BASE_URL, formatImageUrl, fetchPosReturnOrder, processPosReturn, issueRefund, fetchBatch } from '../services/api';

export default function POSInterface() {
  const { addToast } = useNotifications();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerEmail, setCustomerEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [notes, setNotes] = useState('');
  const [lastOrderId, setLastOrderId] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const searchInputRef = useRef(null);

  const [posMode, setPosMode] = useState('sale');
  const [returnOrderInput, setReturnOrderInput] = useState('');
  const [returnLookupLoading, setReturnLookupLoading] = useState(false);
  const [returnOrderData, setReturnOrderData] = useState(null);
  const [returnQtyByProduct, setReturnQtyByProduct] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [returnProcessing, setReturnProcessing] = useState(false);

  // Refund step — shown after a return is confirmed
  const [refundStep, setRefundStep] = useState(false); // true = show refund panel
  const [refundOrderId, setRefundOrderId] = useState(null);
  const [refundReturnId, setRefundReturnId] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [refundNote, setRefundNote] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // --- Phase 2: Offline Mode Queue ---
  const [offlineOrders, setOfflineOrders] = useState(() => {
    const stored = localStorage.getItem('ehub_offline_orders');
    return stored ? JSON.parse(stored) : [];
  });

  const syncOfflineOrders = async () => {
    const currentOfflineOrders = JSON.parse(localStorage.getItem('ehub_offline_orders') || '[]');
    if (currentOfflineOrders.length === 0) return;
    const token = localStorage.getItem('ehub_token');
    let remaining = [...currentOfflineOrders];
    let syncedCount = 0;
    
    for (const order of currentOfflineOrders) {
      try {
        const response = await fetch(`${API_BASE_URL}/pos_checkout.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(order.payload)
        });
        if (response.ok) {
          remaining = remaining.filter(o => o.id !== order.id);
          syncedCount++;
        }
      } catch (err) {
        break; // Stop if network is still down
      }
    }
    
    setOfflineOrders(remaining);
    localStorage.setItem('ehub_offline_orders', JSON.stringify(remaining));
    if (syncedCount > 0) {
      addToast(`Successfully synced ${syncedCount} offline orders.`, 'success');
      fetchProducts();
    }
  };

  useEffect(() => {
    window.addEventListener('online', syncOfflineOrders);
    return () => window.removeEventListener('online', syncOfflineOrders);
  }, []);

  // --- Phase 2: Global Barcode Listener ---
  const productsRef = useRef(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    let barcodeString = '';
    let barcodeTimeout = null;

    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in a field, or dialog is open
      if (isSearchFocused || posMode !== 'sale' || showSuccess || refundStep || returnOrderData) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Enter' && barcodeString.length > 2) {
        const query = barcodeString.toLowerCase();
        barcodeString = '';
        const exactMatch = productsRef.current.find(p => p.product_code?.toLowerCase() === query);
        if (exactMatch) {
          setCart(prev => {
             const existing = prev.find(item => item.id === exactMatch.id);
             if (existing) {
               if (existing.quantity >= exactMatch.stock_quantity) {
                 addToast('Limited availability', 'warning');
                 return prev;
               }
               addToast(`Added ${exactMatch.name}`, 'success');
               return prev.map(item => item.id === exactMatch.id ? { ...item, quantity: item.quantity + 1 } : item);
             }
             addToast(`Added ${exactMatch.name}`, 'success');
             return [{ ...exactMatch, quantity: 1 }, ...prev];
          });
        }
        return;
      }

      if (e.key.length === 1) {
        barcodeString += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => { barcodeString = ''; }, 50); // fast scanner typing
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimeout);
    };
  }, [isSearchFocused, posMode, showSuccess, refundStep, returnOrderData, addToast]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (posMode === 'return') {
      setFilteredProducts([]);
      return;
    }
    if (searchQuery.trim() === '') {
      setFilteredProducts([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches = products.filter(p => 
      (p.name || '').toLowerCase().includes(query) || 
      (p.product_code || '').toLowerCase().includes(query)
    );
    setFilteredProducts(matches);

    // Exact match auto-add (for barcode scanners)
    const exactMatch = products.find(p => 
      p.product_code?.toLowerCase() === searchQuery.trim().toLowerCase()
    );
    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
      addToast(`Added ${exactMatch.name}`, 'success');
    }
  }, [searchQuery, products, posMode]);

  const handleLookupReturnOrder = async (e) => {
    e?.preventDefault();
    const raw = String(returnOrderInput || '').trim();
    if (!raw) {
      addToast('Enter an order number (e.g. ORD-42 or 42)', 'error');
      return;
    }
    setReturnLookupLoading(true);
    setReturnOrderData(null);
    setReturnQtyByProduct({});
    try {
      const res = await fetchPosReturnOrder(raw);
      if (res.success && res.items) {
        setReturnOrderData(res);
        const init = {};
        res.items.forEach((row) => {
          init[row.product_id] = 0;
        });
        setReturnQtyByProduct(init);
        addToast(`Loaded ${res.order?.display_id || 'order'} — ${res.order?.hours_remaining_return?.toFixed?.(1) ?? '?'}h left in return window`, 'success');
      } else {
        addToast(res.message || 'Could not load order', 'error');
      }
    } catch {
      addToast('Lookup failed', 'error');
    } finally {
      setReturnLookupLoading(false);
    }
  };

  const handleProcessPosReturn = async () => {
    if (!returnOrderData?.order?.id) return;
    const items = [];
    Object.entries(returnQtyByProduct).forEach(([pid, q]) => {
      const n = parseInt(q, 10);
      if (n > 0) items.push({ product_id: parseInt(pid, 10), quantity: n });
    });
    if (items.length === 0) {
      addToast('Enter a return quantity for at least one line', 'error');
      return;
    }
    setReturnProcessing(true);
    try {
      const res = await processPosReturn({
        order_id: returnOrderData.order.id,
        items,
        reason: returnReason || 'POS return',
      });
      if (res.success) {
        addToast(`Return confirmed — ${res.units_returned} unit(s) restocked.`, 'success');
        // Pre-fill refund step with the value of returned items
        const returnedValue = returnOrderData.items.reduce((sum, row) => {
          const qty = parseInt(returnQtyByProduct[row.product_id] ?? 0, 10);
          return sum + qty * parseFloat(row.price_at_purchase ?? 0);
        }, 0);
        setRefundOrderId(returnOrderData.order.id);
        setRefundReturnId(null); // backend will link via order_id
        setRefundAmount(returnedValue.toFixed(2));
        setRefundMethod(
          returnOrderData.order?.payment_method === 'momo' ? 'paystack' : 'cash'
        );
        setRefundNote('');
        setRefundStep(true);
        // Reset return form
        setReturnOrderData(null);
        setReturnOrderInput('');
        setReturnQtyByProduct({});
        setReturnReason('');
        fetchProducts();
      } else {
        addToast(res.message || 'Return failed', 'error');
      }
    } catch {
      addToast('Return request failed', 'error');
    } finally {
      setReturnProcessing(false);
    }
  };

  const handleIssueRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (!refundOrderId || isNaN(amt) || amt <= 0) {
      addToast('Enter a valid refund amount', 'error');
      return;
    }
    setRefundProcessing(true);
    try {
      const res = await issueRefund({
        order_id: refundOrderId,
        return_id: refundReturnId,
        amount: amt,
        method: refundMethod,
        note: refundNote || 'POS counter refund',
      });
      if (res.success) {
        addToast(`Refund of GH₵ ${amt.toFixed(2)} processed via ${refundMethod}.`, 'success');
      } else {
        addToast(res.message || 'Refund failed', 'error');
      }
    } catch {
      addToast('Refund request failed', 'error');
    } finally {
      setRefundProcessing(false);
      setRefundStep(false);
    }
  };

  const handleSkipRefund = () => {
    addToast('Refund skipped — return recorded.', 'info');
    setRefundStep(false);
  };

  const fetchProducts = async () => {
    try {
      const data = await fetchBatch(['products']);
      if (data.products) setProducts(data.products);
    } catch (error) {
      addToast('Inventory sync failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      addToast(`${product.name} is out of stock!`, 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          addToast('Limited availability', 'warning');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [{ ...product, quantity: 1 }, ...prev];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > item.stock_quantity) {
           addToast('Stock limit reached', 'warning');
           return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem('ehub_token');
      const response = await fetch(`${API_BASE_URL}/pos_checkout.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({ id: item.id, quantity: item.quantity, price: item.price })),
          total_amount: total,
          payment_method: paymentMethod,
          customer_email: customerEmail
        })
      });
      const result = await response.json();
      if (result.success) {
        setLastOrderId(result.order_id);
        setLastTransaction({
          cart: [...cart],
          total: total,
          paymentMethod: paymentMethod,
          customerEmail: customerEmail
        });
        setShowSuccess(true);
        setCart([]);
        setCustomerEmail('');
        fetchProducts();
      } else {
        addToast(result.message, 'error');
      }
    } catch (error) {
      // Offline fallback
      const offlineId = Date.now();
      const payload = {
        items: cart.map(item => ({ id: item.id, quantity: item.quantity, price: item.price })),
        total_amount: total,
        payment_method: paymentMethod,
        customer_email: customerEmail,
        notes: notes
      };
      const newOffline = [...offlineOrders, { id: offlineId, payload }];
      setOfflineOrders(newOffline);
      localStorage.setItem('ehub_offline_orders', JSON.stringify(newOffline));
      
      setLastOrderId('OFFLINE-' + offlineId);
      setLastTransaction({ cart: [...cart], total, paymentMethod, customerEmail });
      setShowSuccess(true);
      setCart([]);
      setCustomerEmail('');
      addToast('Network error. Order saved offline.', 'warning');
    } finally {
      setProcessing(false);
    }
  };

  const handleEmailReceipt = async () => {
    let email = lastTransaction?.customerEmail || '';
    if (!email) {
      email = prompt("Enter customer's email address:");
      if (!email || !email.includes('@')) {
        if (email) addToast('Invalid email address provided', 'error');
        return;
      }
    }
    
    setSendingEmail(true);
    try {
      const token = localStorage.getItem('ehub_token');
      const response = await fetch(`${API_BASE_URL}/pos_email_receipt.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: lastOrderId,
          email: email
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast(`Receipt emailed to ${email} successfully!`, 'success');
      } else {
        addToast(result.error || 'Failed to email receipt', 'error');
      }
    } catch (err) {
      addToast('Network error while sending email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (showSuccess) {
    return (
      <>
        <div className="card glass animate-fade-in pos-success-screen" style={{ padding: '60px', textAlign: 'center', margin: '40px auto', maxWidth: '500px' }}>
           <div style={{ width: '80px', height: '80px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={48} />
           </div>
           <h1 style={{ fontSize: '28px', fontWeight: 900 }}>Transaction Complete</h1>
           <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>Order #ORD-{lastOrderId} processed successfully.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => { setShowSuccess(false); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                style={{ height: '42px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                NEW CUSTOMER <Plus size={16} />
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => window.print()}
                style={{ height: '42px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                <Printer size={16} /> PRINT
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleEmailReceipt} 
                disabled={sendingEmail}
                style={{ height: '42px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                <Mail size={16} /> {sendingEmail ? 'SENDING...' : 'EMAIL'}
              </button>
           </div>
        </div>
        
        {lastTransaction && (
           <POSReceipt 
              orderId={lastOrderId}
              cart={lastTransaction.cart}
              total={lastTransaction.total}
              paymentMethod={lastTransaction.paymentMethod}
           />
        )}
      </>
    );
  }

  return (
    <div className="animate-fade-in pos-main-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header className="pos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>{posMode === 'sale' ? 'Active Checkout' : 'POS return'}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {posMode === 'sale'
              ? 'High-speed point of sale terminal for real-time transactions.'
              : 'In-store returns only — same POS receipt, within 48 hours of the sale. Stock is credited back when you confirm.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {offlineOrders.length > 0 && (
            <button
               onClick={syncOfflineOrders}
               className="btn"
               style={{ background: 'var(--warning)', color: '#000', fontSize: '12px', padding: '8px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', fontWeight: 'bold' }}
            >
              <RotateCcw size={14} /> Sync {offlineOrders.length} Offline
            </button>
          )}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className={`btn ${posMode === 'sale' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '10px' }}
              onClick={() => { setPosMode('sale'); setReturnOrderData(null); }}
            >
              Sale
            </button>
            <button
              type="button"
              className={`btn ${posMode === 'return' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                setPosMode('return');
                setReturnOrderData(null);
                setReturnQtyByProduct({});
                setSearchQuery('');
                setFilteredProducts([]);
              }}
            >
              <RotateCcw size={14} /> Return (48h)
            </button>
          </div>
           <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '11px', fontWeight: 800 }}>READY</span>
           </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
          {posMode === 'return' ? (
            <div className="card glass" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} /> Look up POS receipt
              </h3>
              <form onSubmit={handleLookupReturnOrder} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Order # e.g. ORD-128 or 128"
                  value={returnOrderInput}
                  onChange={(e) => setReturnOrderInput(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 600 }}
                />
                <button type="submit" className="btn btn-primary" disabled={returnLookupLoading} style={{ padding: '0 20px', height: '38px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                  {returnLookupLoading ? <Loader size={18} className="animate-spin" /> : 'Load'}
                </button>
              </form>

              {returnOrderData?.items && (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{returnOrderData.order.display_id}</strong>
                    {' · '}
                    {new Date(returnOrderData.order.created_at).toLocaleString()}
                    {' · '}
                    <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>
                      ~{Number(returnOrderData.order.hours_remaining_return || 0).toFixed(1)}h left to return
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ padding: '10px 8px' }}>Product</th>
                        <th style={{ padding: '10px 8px' }}>Sold</th>
                        <th style={{ padding: '10px 8px' }}>Already returned</th>
                        <th style={{ padding: '10px 8px' }}>Return now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnOrderData.items.map((row) => (
                        <tr key={row.product_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ fontWeight: 700 }}>{row.product_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.product_code || '—'}</div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>{row.purchased_qty}</td>
                          <td style={{ padding: '12px 8px' }}>{row.already_returned}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <input
                              type="number"
                              min={0}
                              max={row.returnable_qty}
                              value={returnQtyByProduct[row.product_id] ?? 0}
                              disabled={row.returnable_qty <= 0}
                              onChange={(e) => {
                                let v = parseInt(e.target.value, 10);
                                if (Number.isNaN(v)) v = 0;
                                v = Math.max(0, Math.min(row.returnable_qty, v));
                                setReturnQtyByProduct((prev) => ({ ...prev, [row.product_id]: v }));
                              }}
                              style={{ width: '64px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--bg-surface)', fontWeight: 600 }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>max {row.returnable_qty}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <label style={{ display: 'block', marginTop: '16px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>REASON (OPTIONAL)</label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. Wrong item / defective"
                    style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  />
                </>
              )}
            </div>
          ) : (
            <>
          <div 
            className="card glass" 
            style={{ 
              padding: '2px', 
              display: 'flex', 
              alignItems: 'center', 
              borderRadius: '12px', 
              border: isSearchFocused ? '2px solid var(--primary-blue)' : '1px solid var(--border-light)', 
              boxShadow: isSearchFocused ? '0 0 0 3px rgba(var(--primary-blue-rgb), 0.12)' : 'none',
              transition: 'all 0.2s ease',
              background: 'var(--bg-surface)'
            }}
          >
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', color: isSearchFocused ? 'var(--primary-blue)' : 'var(--text-muted)' }}>
              <Barcode size={20} />
            </div>
            <input 
              ref={searchInputRef}
              autoFocus
              type="text" 
              placeholder="Search product name or exact code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              style={{ 
                flex: 1, 
                border: 'none', 
                background: 'transparent', 
                outline: 'none', 
                fontSize: '14px', 
                color: 'var(--text-main)', 
                fontWeight: 600, 
                padding: '10px 0' 
              }}
            />
          </div>

          {searchQuery && filteredProducts.length > 0 && (
            <div className="card glass animate-fade-in" style={{ position: 'absolute', width: '100%', marginTop: '80px', zIndex: 100, padding: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
               {filteredProducts.slice(0, 6).map(p => {
                 const isOutOfStock = p.stock_quantity <= 0;
                 return (
                   <div 
                     key={p.id} 
                     onClick={() => { addToCart(p); setSearchQuery(''); }}
                     style={{ padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isOutOfStock ? 0.4 : 1 }}
                     className="hover-bg"
                   >
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--bg-surface-secondary)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           {p.image_url ? <img src={formatImageUrl(p.image_url)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} opacity={0.3} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Code: {p.product_code || '---'} | Stock: {p.stock_quantity}
                          </div>
                        </div>
                     </div>
                     <div style={{ fontWeight: 800, color: 'var(--primary-blue)' }}>GH₵ {Number(p.price || 0).toFixed(2)}</div>
                   </div>
                 );
               })}
            </div>
          )}
            </>
          )}

          <div className="card glass" style={{ padding: '0', minHeight: '400px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{posMode === 'return' ? 'Return queue' : 'Current Items'}</h3>
               <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{posMode === 'return' ? 'POS 48h window' : `Items: ${cart.length}`}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Description</th>
                  <th style={{ padding: '12px 24px' }}>Unit Price</th>
                  <th style={{ padding: '12px 24px', width: '120px' }}>Quantity</th>
                  <th style={{ padding: '12px 24px', textAlign: 'right' }}>Extension</th>
                  <th style={{ padding: '12px 24px', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {posMode === 'return' ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                      Use <strong style={{ color: 'var(--text-main)' }}>Load</strong> above to pull line items from a POS receipt.
                      Partial returns are allowed until each line is fully returned. Online orders must use <strong>Sales → Returns</strong>.
                    </td>
                  </tr>
                ) : cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '100px 0', textAlign: 'center' }}>
                       <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                          <Search size={48} opacity={0.2} />
                          <div style={{ maxWidth: '280px' }}>
                            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>No items added</p>
                            <p style={{ fontSize: '13px' }}>Scan a barcode or type a product name to begin.</p>
                          </div>
                       </div>
                    </td>
                  </tr>
                ) : (
                  cart.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.product_code || 'No Code'}</div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 600 }}>GH₵ {Number(item.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface-secondary)', borderRadius: '20px', padding: '2px 4px', width: 'fit-content' }}>
                          <button 
                            className="btn" 
                            style={{ 
                              padding: 0, 
                              minWidth: '24px', 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              background: 'var(--bg-surface)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              border: '1px solid var(--border-light)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              cursor: 'pointer'
                            }} 
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontWeight: 800, minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{item.quantity}</span>
                          <button 
                            className="btn" 
                            style={{ 
                              padding: 0, 
                              minWidth: '24px', 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              background: 'var(--bg-surface)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              border: '1px solid var(--border-light)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              cursor: 'pointer'
                            }} 
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, fontSize: '15px' }}>
                        GH₵ {(item.price * item.quantity).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <button onClick={() => updateQuantity(item.id, -item.quantity)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '32px' }}>
           <div className="card glass" style={{ padding: '32px' }}>
              {posMode === 'return' ? (
                <>
                  {refundStep ? (
                    /* ── Refund Step ── */
                    <div className="animate-fade-in">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px' }}>Return Confirmed</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Issue a refund for ORD-{refundOrderId}?</div>
                        </div>
                      </div>

                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>REFUND AMOUNT (GH₵)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}
                      />

                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>REFUND METHOD</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        <button
                          type="button"
                          className={`btn ${refundMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11px', height: '42px' }}
                          onClick={() => setRefundMethod('cash')}
                        >
                          <Banknote size={14} /> CASH
                        </button>
                        <button
                          type="button"
                          className={`btn ${refundMethod === 'paystack' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '11px', height: '42px' }}
                          onClick={() => setRefundMethod('paystack')}
                        >
                          <CreditCard size={14} /> PAYSTACK
                        </button>
                      </div>

                      <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>NOTE (OPTIONAL)</label>
                      <input
                        type="text"
                        placeholder="e.g. Handed cash at counter"
                        value={refundNote}
                        onChange={(e) => setRefundNote(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', marginBottom: '20px' }}
                      />

                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: '100%', height: '52px', fontSize: '14px', fontWeight: 900, borderRadius: '14px', marginBottom: '10px' }}
                        onClick={handleIssueRefund}
                        disabled={refundProcessing}
                      >
                        {refundProcessing ? <Loader size={18} className="animate-spin" /> : `ISSUE REFUND · GH₵ ${parseFloat(refundAmount || 0).toFixed(2)}`}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', height: '40px', fontSize: '12px', fontWeight: 700, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={handleSkipRefund}
                        disabled={refundProcessing}
                      >
                        <SkipForward size={14} /> SKIP REFUND
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                        Returns are limited to <strong>POS sales</strong> and must start within <strong>48 hours</strong> of the original transaction time. Inventory increases when you confirm.
                      </p>
                      <button
                        type="button"
                        className={`btn btn-primary ${returnProcessing ? 'spinning' : ''}`}
                        style={{ width: '100%', height: '56px', fontSize: '15px', fontWeight: 900, borderRadius: '16px' }}
                        onClick={handleProcessPosReturn}
                        disabled={returnProcessing || !returnOrderData?.items}
                      >
                        {returnProcessing ? 'PROCESSING…' : 'CONFIRM RETURN & RESTOCK'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: 32 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                    <span>Items Count</span>
                    <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                  </div>
                  <div style={{ marginTop: '12px', padding: '16px 0', borderTop: '2px dashed var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subtotal Due</span>
                      <span style={{ fontSize: '32px', fontWeight: 950, color: 'var(--primary-blue)', lineHeight: 1 }}>GH₵ {total.toLocaleString()}</span>
                    </div>
                  </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>PAYMENT METHOD</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('cash')} style={{ fontSize: '10px', height: '48px', padding: '0' }}><Banknote size={16} /> CASH</button>
                    <button className={`btn ${paymentMethod === 'momo' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('momo')} style={{ fontSize: '10px', height: '48px', padding: '0' }}><Zap size={16} /> MOMO</button>
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>CUSTOMER EMAIL (OPTIONAL)</label>
                <input 
                  type="email" 
                  placeholder="e.g. customer@example.com" 
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', fontWeight: 600 }}
                />
              </div>

              <button 
                className={`btn btn-primary ${processing ? 'spinning' : ''}`} 
                style={{ width: '100%', height: '64px', fontSize: '16px', fontWeight: 900, borderRadius: '16px' }}
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
              >
                {processing ? 'PROCESSING...' : 'PROCESS PAYMENT'}
              </button>
                </>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
