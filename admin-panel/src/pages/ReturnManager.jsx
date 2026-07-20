import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RotateCcw,
  Search,
  Package,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  History,
  User,
  ShieldCheck,
  Banknote,
  CreditCard,
  SkipForward,
  Loader,
  BadgeDollarSign,
  XCircle,
  Star,
} from 'lucide-react';
import { fetchReturns, processReturn, fetchOrders, fetchRefundInfo, issueRefund } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

/* ─── tiny helpers ─────────────────────────────────────────────────── */
const statusBadge = (status) => {
  const map = {
    pending:   { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning)',      label: 'Pending' },
    processed: { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success)',      label: 'Processed' },
    inspected: { bg: 'rgba(99,102,241,0.12)',  color: 'var(--primary-blue)', label: 'Inspected' },
    rejected:  { bg: 'rgba(239,68,68,0.12)',   color: 'var(--danger)',       label: 'Rejected' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
};

const refundBadge = (refundable, alreadyRefunded) => {
  if (alreadyRefunded > 0) {
    return (
      <span style={{
        background: 'rgba(16,185,129,0.12)', color: 'var(--success)',
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        GH₵ {Number(alreadyRefunded).toFixed(2)} refunded
      </span>
    );
  }
  if (refundable > 0) {
    return (
      <span style={{
        background: 'rgba(245,158,11,0.10)', color: 'var(--warning)',
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        Awaiting refund
      </span>
    );
  }
  return null;
};

/* ─── component ────────────────────────────────────────────────────── */
export default function ReturnManager() {
  const { addToast } = useNotifications();
  const [returnHistory, setReturnHistory] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [foundOrders,   setFoundOrders]   = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [returnReason, setReturnReason]   = useState('');
  const [searchParams] = useSearchParams();

  // Refund step (shown after return is confirmed)
  const [refundStep,       setRefundStep]       = useState(false);
  const [refundInfo,       setRefundInfo]        = useState(null); // { order, already_refunded, refundable }
  const [refundAmount,     setRefundAmount]      = useState('');
  const [refundMethod,     setRefundMethod]      = useState('cash');
  const [refundNote,       setRefundNote]        = useState('');
  const [refundProcessing, setRefundProcessing]  = useState(false);
  const [lastReturnId,     setLastReturnId]      = useState(null);

  useEffect(() => { loadReturnHistory(); }, []);

  const handleSearchOrder = useCallback(async (query) => {
    if (!query) return;
    setLoading(true);
    try {
      const orders = await fetchOrders(query);
      setFoundOrders(orders);
      const q = query.toLowerCase();
      const exact = orders.find(o => String(o.id).toLowerCase() === q || String(o.id).toLowerCase() === `ord-${q}`);
      if (exact) setSelectedOrder(exact);
    } catch {
      addToast('Order search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) { setSearchQuery(orderId); handleSearchOrder(orderId); }
  }, [searchParams, handleSearchOrder]);

  const loadReturnHistory = async () => {
    setLoading(true);
    try {
      const res = await fetchReturns();
      if (res.success) setReturnHistory(res.data);
    } catch {
      addToast('Failed to load return history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const itemsPayload = Object.keys(selectedItems).map(pid => ({
      product_id: parseInt(pid, 10),
      quantity: selectedItems[pid]
    })).filter(i => i.quantity > 0);

    if (!selectedOrder || itemsPayload.length === 0) {
      addToast('Please select at least one item to return.', 'error');
      return;
    }
    if (!returnReason) {
      addToast('Please select a return reason.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await processReturn({ order_id: selectedOrder.id, items: itemsPayload, reason: returnReason });
      if (res.success) {
        addToast('Return authorized — stock updated.', 'success');
        setLastReturnId(res.return_ids ?? []);

        // Fetch refund info so we can pre-fill the refund step
        const orderId = String(selectedOrder.id).replace(/^ORD-/i, '');
        const rInfo = await fetchRefundInfo(orderId);
        if (rInfo?.success) {
          setRefundInfo(rInfo);
          
          let totalRefundValue = 0;
          itemsPayload.forEach(retItem => {
            const item = selectedOrder.items?.find(i => String(i.product_id ?? i.id) === String(retItem.product_id));
            const unitPrice = parseFloat(item?.price ?? item?.price_at_purchase ?? 0);
            totalRefundValue += unitPrice * retItem.quantity;
          });
          
          const suggested = totalRefundValue.toFixed(2);
          setRefundAmount(suggested !== '0.00' ? suggested : rInfo.refundable.toFixed(2));
          setRefundMethod(
            rInfo.order?.payment_method === 'paystack' ? 'paystack' : 'cash'
          );
        }

        setRefundStep(true);
        setSelectedItems({});
        setReturnReason('');
        setFoundOrders([]);
        setSearchQuery('');
        loadReturnHistory();
      } else {
        addToast(res.error || res.message || 'Return failed', 'error');
      }
    } catch {
      addToast('Connection error while processing return', 'error');
    } finally {
      setIsProcessing(false);
      setSelectedOrder(null);
    }
  };

  const handleIssueRefund = async () => {
    const amt = parseFloat(refundAmount);
    const orderId = refundInfo?.order?.id;
    if (!orderId || isNaN(amt) || amt <= 0) {
      addToast('Enter a valid refund amount', 'error');
      return;
    }
    if (amt > (refundInfo?.refundable ?? 0)) {
      addToast(`Amount exceeds refundable balance of GH₵ ${refundInfo.refundable.toFixed(2)}`, 'error');
      return;
    }
    setRefundProcessing(true);
    try {
      const res = await issueRefund({
        order_id: orderId,
        return_ids: lastReturnId,
        amount: amt,
        method: refundMethod,
        note: refundNote || 'Admin returns refund',
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
      setRefundInfo(null);
      setRefundNote('');
    }
  };

  const handleSkipRefund = () => {
    addToast('Refund skipped — return recorded.', 'info');
    setRefundStep(false);
    setRefundInfo(null);
  };

  /* ── render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <RotateCcw size={28} className="text-primary" />
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Returns Management</h1>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>
          Process customer returns, restock items, and issue refunds via Paystack or cash.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>

        {/* ── Left: Return History ── */}
        <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} /> Return History
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{returnHistory.length} Total</span>
          </div>

          <div style={{ maxHeight: '620px', overflowY: 'auto' }}>
            {loading && returnHistory.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              </div>
            ) : returnHistory.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ClipboardList size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                <p>No return records found.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 20px' }}>Order</th>
                    <th style={{ padding: '12px 20px' }}>Product</th>
                    <th style={{ padding: '12px 20px' }}>Qty</th>
                    <th style={{ padding: '12px 20px' }}>Status</th>
                    <th style={{ padding: '12px 20px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {returnHistory.map((ret, idx) => (
                    <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'rgba(var(--primary-blue-rgb), 0.02)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{ret.order_display_id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ret.customer_name}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{ret.product_name}</div>
                        <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ret.product_code}</code>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 700 }}>{ret.quantity}</td>
                      <td style={{ padding: '14px 20px' }}>{statusBadge(ret.status)}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(ret.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Process / Refund ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {refundStep ? (
            /* ── Step 3: Refund ── */
            <div className="card glass animate-fade-in" style={{ padding: '28px', border: '1px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BadgeDollarSign size={20} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px' }}>Issue Refund</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {refundInfo?.order
                      ? `ORD-${refundInfo.order.id} · Refundable: GH₵ ${Number(refundInfo.refundable).toFixed(2)}`
                      : 'Return confirmed'}
                  </div>
                </div>
              </div>

              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                REFUND AMOUNT (GH₵)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}
              />

              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                REFUND METHOD
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`btn ${refundMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setRefundMethod('cash')}
                >
                  <Banknote size={14} /> CASH
                </button>
                <button
                  type="button"
                  className={`btn ${refundMethod === 'paystack' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setRefundMethod('paystack')}
                >
                  <CreditCard size={14} /> PAYSTACK
                </button>
                <button
                  type="button"
                  className={`btn ${refundMethod === 'store_credit' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setRefundMethod('store_credit')}
                >
                  <Star size={14} /> STORE CREDIT
                </button>
              </div>

              {refundMethod === 'paystack' && !refundInfo?.order?.payment_reference && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.10)', borderRadius: '10px', marginBottom: '14px', fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>
                  ⚠ No Paystack reference on this order. Switch to Cash or verify the payment method.
                </div>
              )}
              {refundMethod === 'store_credit' && (
                <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.10)', borderRadius: '10px', marginBottom: '14px', fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 600 }}>
                  <Star size={12} style={{ marginRight: '4px' }} />
                  Customer will receive {Math.floor(parseFloat(refundAmount || 0) * 10)} loyalty points (1 point per GHS 10)
                </div>
              )}

              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>NOTE (OPTIONAL)</label>
              <input
                type="text"
                placeholder="e.g. Customer collected at front desk"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', marginBottom: '20px' }}
              />

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '52px', fontSize: '14px', fontWeight: 900, borderRadius: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleIssueRefund}
                disabled={refundProcessing}
              >
                {refundProcessing
                  ? <Loader size={18} className="animate-spin" />
                  : <><CheckCircle2 size={16} /> ISSUE REFUND · GH₵ {parseFloat(refundAmount || 0).toFixed(2)}</>
                }
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
              {/* Step 1: Find Order */}
              <div className="card glass" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={18} /> 1. Find Order
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); handleSearchOrder(searchQuery); }} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Order ID (e.g. ORD-12) or Customer Name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>Search</button>
                </form>

                {foundOrders.length > 0 && !selectedOrder && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {foundOrders.map(o => (
                      <button
                        key={o.id}
                        onClick={() => setSelectedOrder(o)}
                        style={{
                          width: '100%', padding: '12px', textAlign: 'left',
                          background: 'var(--bg-surface-secondary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>{o.id}</div>
                          <div style={{ fontSize: '13px' }}>{o.customer}</div>
                        </div>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Process Return */}
              {selectedOrder && (
                <div className="card glass animate-fade-in" style={{ padding: '24px', border: '1px solid var(--primary-blue)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} /> 2. Process Return
                    </h3>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      style={{ fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  </div>

                  <div style={{ background: 'rgba(var(--primary-blue-rgb), 0.05)', padding: '14px 16px', borderRadius: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <User size={15} className="text-primary" />
                      <span style={{ fontWeight: 600 }}>{selectedOrder.customer}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Order {selectedOrder.id} · {selectedOrder.date}
                    </div>
                  </div>

                  <form onSubmit={handleProcessReturn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Items to Return</label>
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead style={{ background: 'var(--bg-surface-secondary)' }}>
                            <tr>
                              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>Item</th>
                              <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border-light)', width: '100px' }}>Purchased</th>
                              <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border-light)', width: '120px' }}>Return Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.items?.map((item, i) => {
                              const pid = item.product_id ?? item.id;
                              const maxQty = item.qty ?? item.quantity;
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                  <td style={{ padding: '10px' }}>{item.name}</td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>{maxQty}</td>
                                  <td style={{ padding: '10px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxQty}
                                      value={selectedItems[pid] || 0}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setSelectedItems(prev => ({
                                          ...prev,
                                          [pid]: isNaN(val) ? 0 : val
                                        }));
                                      }}
                                      style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)', textAlign: 'center' }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>Reason</label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                        required
                      >
                        <option value="">-- Select Reason --</option>
                        <option value="Damaged">Damaged / Defective</option>
                        <option value="Wrong Item">Wrong Item Received</option>
                        <option value="Not as Described">Not as Described</option>
                        <option value="Customer Changed Mind">Customer Changed Mind</option>
                      </select>
                    </div>

                    <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <ShieldCheck size={18} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--success)', fontWeight: 600, lineHeight: 1.5 }}>
                        Authorizing this return will restock the item(s) and open the refund step.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="btn btn-primary"
                      style={{ height: '48px', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {isProcessing ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {isProcessing ? 'Processing…' : 'Authorize Return & Restock'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Manager Note */}
          <div className="card glass" style={{ padding: '18px 20px', borderLeft: '4px solid var(--warning)', background: 'rgba(245,158,11,0.05)' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 800 }}>Manager Note</h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Inspect returned items before restocking. If unsellable, adjust stock in the <strong>Products</strong> module.
                  Paystack refunds are instant but may take 3–5 business days to reflect with the customer's bank.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
