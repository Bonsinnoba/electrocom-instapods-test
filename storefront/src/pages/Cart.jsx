import React, { useState, useEffect, startTransition } from 'react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Heart, X,
  AlertCircle, Tag, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TransitionLink from '../components/TransitionLink';
import { useUser } from '../context/UserContext';
import { useSettings } from '../context/SettingsContext';
import { formatImageUrl } from '../services/api';

const itemKey = (item) => `${item.id}-${item.selectedColor}`;

export default function Cart() {
  const { user, openAuthModal } = useUser();
  const {
    cartItems, addToCart, removeFromCart, updateQuantity,
    appliedCoupon, applyCoupon, removeCoupon, isApplyingCoupon, couponError
  } = useCart();
  const { wishlistItems, toggleWishlist, isInWishlist } = useWishlist();
  const { addToast } = useNotifications();
  const { siteSettings, formatPrice } = useSettings();
  const navigate = useNavigate();

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(Array.isArray(cartItems) ? cartItems.map(itemKey) : []));

  useEffect(() => {
    setSelectedKeys(prev => {
      const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
      const cartKeySet = new Set(safeCartItems.map(itemKey));
      const next = new Set();
      for (const k of prev) { if (cartKeySet.has(k)) next.add(k); }
      for (const k of cartKeySet) { if (!prev.has(k)) next.add(k); }
      return next;
    });
  }, [cartItems]);

  const allSelected  = cartItems.length > 0 && selectedKeys.size === cartItems.length;
  const noneSelected = selectedKeys.size === 0;

  const toggleSelectAll = () =>
    allSelected ? setSelectedKeys(new Set()) : setSelectedKeys(new Set(cartItems.map(itemKey)));

  const toggleItem = (item) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const k = itemKey(item);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const selectedItems = cartItems.filter(item => selectedKeys.has(itemKey(item)));

  // ── Totals (selected items only) ─────────────────────────────────────────
  const vatRate              = siteSettings?.vatRate !== undefined && siteSettings?.vatRate !== null ? parseFloat(siteSettings.vatRate) : 0;
  const selectedSubtotal     = selectedItems.reduce((a, i) => a + parseFloat(i.price) * i.quantity, 0);
  const couponDiscount       = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const intThreshold         = Number(siteSettings?.integrityDiscountThreshold || 0);
  const intPct               = Number(siteSettings?.integrityDiscountPct || 0);
  const userPts              = Number(user?.loyalty_points || 0);
  const hasLoyalty           = intThreshold > 0 && userPts >= intThreshold && intPct > 0;
  const loyaltyAmt           = hasLoyalty ? Math.round(selectedSubtotal * (intPct / 100) * 100) / 100 : 0;
  const totalDiscount        = couponDiscount + loyaltyAmt;
  const taxableAmount        = Math.max(0, selectedSubtotal - totalDiscount);
  const tax                  = taxableAmount * (vatRate / 100);
  const total                = Math.max(0, taxableAmount + tax);

  // ── Misc state ────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [couponInput, setCouponInput]     = useState('');

  const handleMoveToWishlist = () => {
    if (!confirmDelete) return;
    if (!isInWishlist(confirmDelete.id)) toggleWishlist(confirmDelete);
    removeFromCart(confirmDelete.id, confirmDelete.selectedColor);
    addToast(`${confirmDelete.name} moved to wishlist`, 'success');
    setConfirmDelete(null);
  };

  const handleFinalDelete = () => {
    if (!confirmDelete) return;
    removeFromCart(confirmDelete.id, confirmDelete.selectedColor);
    addToast(`${confirmDelete.name} removed from cart`, 'info');
    setConfirmDelete(null);
  };

  const handleCheckout = () => {
    startTransition(() => {
      navigate('/checkout', { state: { selectedItems } });
    });
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    const hasWishlistItems = wishlistItems.length > 0;

    const handleAddAllFromWishlist = () => {
      wishlistItems.forEach(item => addToCart(item, 1, item.selectedColor || 'Default'));
      addToast(`${wishlistItems.length} item${wishlistItems.length !== 1 ? 's' : ''} added to cart`, 'success');
    };

    return (
      <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'28px', alignItems:'center', padding:'48px 0', width:'100%' }}>
        {/* Bare icon — no ring */}
        <div style={{ textAlign:'center' }}>
          <ShoppingBag size={56} style={{ opacity:0.25, marginBottom:'12px' }} />
          <h2 className="cart-empty-title">Your cart is empty</h2>
          <p className="cart-empty-desc" style={{ maxWidth:'340px', margin:'0 auto' }}>
            {hasWishlistItems
              ? 'Pick items from your favorites to get started.'
              : "Looks like you haven't added anything yet. Explore our collection and find something you love."}
          </p>
        </div>

        {hasWishlistItems ? (
          <div style={{ width:'100%', maxWidth:'760px' }}>
            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', fontWeight:800, fontSize:'15px' }}>
                <Heart size={16} color="var(--danger)" fill="var(--danger)" />
                Your Favorites
                <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)' }}>({wishlistItems.length})</span>
              </div>
              <button
                onClick={handleAddAllFromWishlist}
                className="btn-primary"
                style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 16px', fontSize:'12px' }}
              >
                <ShoppingBag size={13} /> Add All to Cart
              </button>
            </div>

            {/* Grid of compact cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px' }}>
              {wishlistItems.map(item => (
                <div
                  key={item.id}
                  className="card glass animate-slide-up"
                  style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'10px', borderRadius:'12px' }}
                >
                  <img
                    src={formatImageUrl(item.image || item.image_url)}
                    alt={item.name}
                    style={{ width:'100%', aspectRatio:'1/1', objectFit:'cover', borderRadius:'8px', border:'1px solid var(--border-light)' }}
                  />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>{formatPrice(parseFloat(item.price))}</div>
                  </div>
                  <button
                    onClick={() => {
                      addToCart(item, 1, item.selectedColor || 'Default');
                      addToast(`${item.name} added to cart`, 'success');
                    }}
                    className="btn-primary"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', padding:'7px 10px', fontSize:'12px', width:'100%' }}
                  >
                    <Plus size={13} /> Add to Cart
                  </button>
                </div>
              ))}
            </div>

            {/* Browse button */}
            <div style={{ textAlign:'center', marginTop:'20px' }}>
              <TransitionLink to="/" className="btn-outline" style={{ display:'inline-flex', alignItems:'center', gap:'7px', padding:'10px 24px', fontSize:'13px', borderRadius:'12px' }}>
                <ArrowLeft size={14} /> Browse More Products
              </TransitionLink>
            </div>
          </div>
        ) : (
          <TransitionLink to="/" className="btn-primary cart-link-btn"><ArrowLeft size={18} /> Start Shopping</TransitionLink>
        )}
      </div>
    );
  }


  return (
    <div className="animate-fade-in cart-container">
      <div className="page-header cart-page-header">
        <h1 className="cart-title">Shopping Cart</h1>
        <p className="cart-subtitle">You have {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart.</p>
      </div>

      <div className="cart-content">
        <div className="cart-grid">
          {/* ── Items column ── */}
          <div className="cart-items-section">

            {/* Select-All bar */}
            <div className="cart-select-all-bar">
              <button
                onClick={toggleSelectAll}
                className="btn-select-all"
                title={allSelected ? 'Deselect All' : 'Select All'}
              >
                {allSelected
                  ? <CheckSquare size={20} color="var(--primary-blue)" />
                  : <Square size={20} color="var(--text-muted)" />
                }
                <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              </button>
              <span className="selected-items-count">
                {selectedKeys.size} of {cartItems.length} selected
              </span>
            </div>

            <div className="cart-items-wrapper">
              {cartItems.map((item, index) => {
                const k = itemKey(item);
                const isSelected = selectedKeys.has(k);
                const inWish = isInWishlist(item.id);
                return (
                  <div
                    key={`${item.id}-${item.selectedColor}-${index}`}
                    className={`cart-item-card animate-slide-up ${isSelected ? 'selected' : ''}`}
                    style={{ animationDelay:`${index * 0.05}s`, animationFillMode:'both', opacity: isSelected ? 1 : 0.5, transition:'all 0.3s ease' }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item)}
                      title={isSelected ? 'Deselect' : 'Select'}
                      className={`cart-item-checkbox ${isSelected ? 'selected' : ''}`}
                    >
                      {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>

                    <div className="cart-item-image-wrapper">
                      <img
                        src={formatImageUrl(item.image || item.image_url)}
                        alt={item.name}
                        className="cart-item-image"
                      />
                    </div>

                    <div className="cart-item-details">
                      {/* Left column: name, color, unit price, quantity */}
                      <div className="cart-item-left">
                        <div className="cart-item-info">
                          <h4 className="cart-item-name">{item.name}</h4>
                          <div className="cart-item-meta">
                            <span className={`cart-item-color ${(!item.selectedColor || item.selectedColor.toLowerCase() === 'default') ? 'default-badge' : 'color-badge'}`}>
                              {item.selectedColor || 'Default'}
                            </span>
                            <span className="cart-item-unit-price">{formatPrice(parseFloat(item.price))} each</span>
                          </div>
                        </div>

                        <div className="cart-qty-wrapper">
                          <div className="cart-qty-control">
                            <button onClick={() => updateQuantity(item.id, item.selectedColor, -1)} className="btn-qty btn" title="Decrease Quantity"><Minus size={14} /></button>
                            <span className="qty-display">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.selectedColor, 1)} className="btn-qty btn" title="Increase Quantity"><Plus size={14} /></button>
                          </div>
                        </div>
                      </div>

                      {/* Right column: subtotal, discount, actions */}
                      <div className="cart-item-right">
                        <div className="cart-item-price-wrapper">
                          <div className="item-total-price" style={{ color: item.discount_percent > 0 ? 'var(--success)' : 'inherit' }}>
                            {formatPrice(parseFloat(item.price) * item.quantity)}
                          </div>
                          {item.discount_percent > 0 && (
                            <div className="cart-item-discount-row">
                              <span className="original-price-strike">
                                {formatPrice(parseFloat(item.original_price || item.price) * item.quantity)}
                              </span>
                              <span className="discount-badge-percent">
                                -{item.discount_percent}%
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="cart-item-actions">
                          <button
                            onClick={() => {
                              toggleWishlist(item);
                              addToast(inWish ? `${item.name} removed from wishlist` : `${item.name} saved to wishlist`, 'success');
                            }}
                            className={`btn-wishlist-cart ${inWish ? 'active' : ''}`}
                            title={inWish ? 'Remove from Wishlist' : 'Save to Wishlist'}
                          >
                            <Heart size={18} fill={inWish ? 'var(--danger)' : 'none'} color={inWish ? 'var(--danger)' : 'currentColor'} />
                          </button>
                          <button onClick={() => setConfirmDelete(item)} className="btn-remove-cart" title="Remove Item">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Summary column ── */}
          <div className="cart-summary-section">
            <div className="cart-summary-card animate-fade-in" style={{ animationDelay:'0.3s', animationFillMode:'both' }}>
              <h3 className="cart-summary-title">Order Summary</h3>

              {siteSettings?.allowDoorToDoorDelivery !== false && Number(siteSettings?.doorToDoorThreshold || 0) > 0 && (
                <div className="cart-threshold-delivery-box">
                  {(() => {
                    const threshold = Number(siteSettings?.doorToDoorThreshold || 0);
                    const diff = threshold - selectedSubtotal;
                    if (diff > 0) {
                      const pct = Math.min(100, (selectedSubtotal / threshold) * 100);
                      return (
                        <>
                          <div className="threshold-status-row">
                            <span className="threshold-label">Door-to-Door Delivery</span>
                            <span className="threshold-value">Add {formatPrice(diff)}</span>
                          </div>
                          <div className="threshold-progress-bg">
                            <div className="threshold-progress-bar" style={{ width: `${pct}%` }}></div>
                          </div>
                        </>
                      );
                    } else {
                      return <div className="threshold-success-msg"><CheckSquare size={16} /> Eligible for Door-to-Door Delivery!</div>;
                    }
                  })()}
                </div>
              )}

              <div className="summary-rows">
                <div className="summary-row">
                  <span className="text-muted">Subtotal ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})</span>
                  <span className="font-bold">{formatPrice(selectedSubtotal)}</span>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Estimated Tax ({vatRate}%)</span>
                  <span className="font-bold">{formatPrice(tax)}</span>
                </div>
                <div className="summary-row">
                  <span className="text-muted">Shipping</span>
                  <span className="text-success">FREE</span>
                </div>

                {appliedCoupon && (
                  <div className="animate-fade-in cart-summary-discount-tag" style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'var(--danger)', background:'var(--danger-bg)', padding:'8px 12px', borderRadius:'8px', marginBottom:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><Tag size={14} /><span>Promo Code ({appliedCoupon.code})</span></div>
                    <span>-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                {hasLoyalty && (
                  <div className="animate-fade-in cart-summary-discount-tag" style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'var(--danger)', background:'var(--danger-bg)', padding:'8px 12px', borderRadius:'8px', marginBottom:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><ShieldCheck size={14} /><span>Loyalty Reward ({intPct}%)</span></div>
                    <span>-{formatPrice(loyaltyAmt)}</span>
                  </div>
                )}

                <div className="summary-divider-line" />
                <div className="summary-total-row">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {/* Coupon form */}
              <div className="cart-coupon-wrapper">
                {!appliedCoupon ? (
                  <div className="cart-coupon-form-group">
                    <div className="cart-coupon-input-row">
                      <input
                        type="text" value={couponInput}
                        onChange={e => setCouponInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(couponInput).then(ok => ok && setCouponInput('')); } }}
                        placeholder="Promo Code" className="cart-coupon-input input-premium"
                      />
                      <button
                        onClick={() => applyCoupon(couponInput).then(ok => ok && setCouponInput(''))}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="btn-primary btn-coupon-apply"
                      >
                        {isApplyingCoupon ? '...' : 'Apply'}
                      </button>
                    </div>
                    {couponError && <div className="coupon-error-message">{couponError}</div>}
                  </div>
                ) : (
                  <div className="cart-coupon-remove-group">
                    <button onClick={removeCoupon} className="btn-outline btn-coupon-remove">
                      Remove Coupon
                    </button>
                  </div>
                )}
              </div>

              {/* Checkout button */}
              {!user ? (
                <button className="btn-primary btn-checkout-summary btn" onClick={() => openAuthModal('signin')}>
                  Login to Checkout
                </button>
              ) : (
                <button
                  className="btn-primary btn-checkout-summary btn"
                  onClick={handleCheckout}
                  disabled={noneSelected}
                  style={{ opacity: noneSelected ? 0.5 : 1, cursor: noneSelected ? 'not-allowed' : 'pointer' }}
                >
                  {allSelected
                    ? `Checkout All (${selectedItems.length})`
                    : `Checkout Selected (${selectedItems.length})`
                  }
                </button>
              )}

              <div className="secure-checkout-text">Secure SSL Encrypted Checkout</div>
              <div style={{ marginTop:'10px', fontSize:'12px', color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>
                Tip: your cart is saved to your account and syncs across all your devices.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Remove confirmation modal ── */}
      {confirmDelete && (
        <div className="modal-overlay cart-modal-overlay">
          <div className="card glass modal-content cart-delete-modal animate-scale-in">
            <button onClick={() => setConfirmDelete(null)} className="modal-close-btn" title="Close">
              <X size={20} />
            </button>
            <div className="modal-icon-wrapper danger">
              <AlertCircle size={32} />
            </div>
            <h2 className="modal-title">Remove Item?</h2>
            <p className="modal-description">
              Would you like to move <strong>{confirmDelete.name}</strong> to your wishlist for later, or remove it permanently?
            </p>
            <div className="modal-actions-list">
              <button className="btn-primary btn-move-wishlist" onClick={handleMoveToWishlist}>
                <Heart size={18} fill="white" /> Move to Wishlist
              </button>
              <button className="btn-outline btn-delete-permanent" onClick={handleFinalDelete}>
                <Trash2 size={18} /> Remove Permanently
              </button>
              <button className="btn-secondary btn-cancel-delete" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
