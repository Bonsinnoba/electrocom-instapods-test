import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, RotateCcw, Star, Check, ChevronDown } from 'lucide-react';

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const dropdownTriggerStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border-light)',
  background: 'var(--bg-surface)',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-main)',
  outline: 'none',
  transition: 'border-color 0.2s',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const dropdownListStyle = {
  position: 'absolute',
  zIndex: 1000,
  width: '100%',
  maxHeight: '260px',
  overflowY: 'auto',
  background: 'var(--bg-surface)',
  border: '1.5px solid var(--border-light)',
  borderRadius: '12px',
  marginTop: '8px',
  padding: '8px',
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.12)',
};

const dropdownOptionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'background 0.15s',
  fontWeight: 600,
  color: 'var(--text-main)',
};

// Every group after the first gets a top divider + top padding instead of
// each label carrying its own ad hoc margin - keeps vertical rhythm driven
// by one place (the parent flex `gap`) rather than scattered magic numbers.
const groupDividerStyle = {
  borderTop: '1px solid var(--border-light)',
  paddingTop: '18px',
};

export default function FilterPanel({ filters, setFilters, onReset, isMobile, onClose, categories = [], maxRange = 1000, priceValue, onPriceChange }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDiscountDropdownOpen, setIsDiscountDropdownOpen] = useState(false);
  const [tempCategories, setTempCategories] = useState([]);
  const [tempDiscount, setTempDiscount] = useState(0);
  const dropdownRef = useRef(null);
  const discountDropdownRef = useRef(null);

  const handleCategoryChange = (cat) => {
    setTempCategories(prev => {
      const exists = prev.includes(cat);
      if (exists) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const handleDiscountChange = (discount) => {
    setTempDiscount(discount);
  };

  const handleCategoryDropdownToggle = () => {
    if (!isDropdownOpen) {
      setTempCategories(filters.categories);
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDiscountDropdownToggle = () => {
    if (!isDiscountDropdownOpen) {
      setTempDiscount(filters.minDiscount);
    }
    setIsDiscountDropdownOpen(!isDiscountDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (isDropdownOpen) {
          setFilters(prev => ({ ...prev, categories: tempCategories }));
        }
        setIsDropdownOpen(false);
      }
      if (discountDropdownRef.current && !discountDropdownRef.current.contains(event.target)) {
        if (isDiscountDropdownOpen) {
          setFilters(prev => ({ ...prev, minDiscount: tempDiscount }));
        }
        setIsDiscountDropdownOpen(false);
      }
    };

    if (isDropdownOpen || isDiscountDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isDiscountDropdownOpen, tempCategories, tempDiscount, setFilters]);

  const handleRatingChange = (rating) => {
    setFilters(prev => ({ ...prev, minRating: rating }));
  };

  return (
    // No padding here - the desktop <aside> (.card) and the mobile
    // drawer (.mobile-filter-content) each already provide their own
    // padding. Adding more here was doubling the inset on both, which
    // is what forced the negative-margin/calc() compensation hacks
    // that used to be scattered through this file.
    <div className={`filter-panel ${isMobile ? 'mobile' : ''}`} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '16px' : '20px',
      height: '100%',
    }}>
      {isMobile && <div className="drawer-handle" style={{
        width: '40px',
        height: '4px',
        background: 'var(--border-light)',
        borderRadius: '2px',
        margin: '0 auto',
        opacity: 0.6
      }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
          <Filter size={16} /> Filters
        </h3>
        {isMobile && (
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Category */}
      <div className="filter-group" ref={dropdownRef} style={{ position: 'relative' }}>
        <label style={labelStyle}>Category</label>

        <button onClick={handleCategoryDropdownToggle} style={dropdownTriggerStyle}>
          <span>
            {isDropdownOpen && tempCategories.length > 0
              ? `${tempCategories.length} categor${tempCategories.length === 1 ? 'y' : 'ies'} selected`
              : (filters.categories.length > 0
                  ? `${filters.categories.length} categor${filters.categories.length === 1 ? 'y' : 'ies'} selected`
                  : 'Select categories')}
          </span>
          <ChevronDown size={18} style={{
            transition: 'transform 0.2s ease',
            transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} />
        </button>

        {isDropdownOpen && (
          <div style={dropdownListStyle}>
            {categories.map(cat => {
              const isActive = tempCategories.includes(cat);
              return (
                <label
                  key={cat}
                  style={dropdownOptionStyle}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => handleCategoryChange(cat)}
                    style={{ width: '18px', height: '18px', borderRadius: '6px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
                  />
                  {cat}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Price Range */}
      <div className="filter-group" style={groupDividerStyle}>
        <label style={{ ...labelStyle, marginBottom: '12px' }}>Price Range</label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '10px', pointerEvents: 'none', textTransform: 'uppercase' }}>Min</span>
            <input
              type="number"
              min="0"
              max={maxRange}
              value={filters.minPrice}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                setFilters(prev => ({ ...prev, minPrice: Math.max(0, val) }));
              }}
              className="input-with-icon"
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                outline: 'none',
                transition: 'border-color 0.2s',
                WebkitAppearance: 'none'
              }}
            />
          </div>

          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>-</span>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '10px', pointerEvents: 'none', textTransform: 'uppercase' }}>Max</span>
            <input
              type="number"
              min="0"
              max={maxRange}
              value={priceValue !== undefined ? priceValue : filters.maxPrice}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value);
                if (val === '') {
                  onPriceChange?.('');
                } else {
                  onPriceChange?.(Math.max(0, Math.min(val, maxRange)));
                }
              }}
              onBlur={() => {
                const finalVal = priceValue === '' ? maxRange : priceValue;
                onPriceChange?.(finalVal);
                setFilters(prev => ({ ...prev, maxPrice: finalVal }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const finalVal = priceValue === '' ? maxRange : priceValue;
                  onPriceChange?.(finalVal);
                  setFilters(prev => ({ ...prev, maxPrice: finalVal }));
                }
              }}
              className="input-with-icon"
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                outline: 'none',
                transition: 'border-color 0.2s',
                WebkitAppearance: 'none'
              }}
            />
          </div>
        </div>

        <div className="slider-wrapper" style={{ position: 'relative', padding: '4px 0 0 0' }}>
          <input
            type="range"
            min="0"
            max={maxRange}
            step="1"
            value={priceValue !== undefined ? priceValue : filters.maxPrice}
            onChange={(e) => onPriceChange?.(parseInt(e.target.value))}
            onMouseUp={() => setFilters(prev => ({ ...prev, maxPrice: priceValue !== undefined ? priceValue : filters.maxPrice }))}
            onTouchEnd={() => setFilters(prev => ({ ...prev, maxPrice: priceValue !== undefined ? priceValue : filters.maxPrice }))}
            className="filter-range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>GH₵0</span>
            <span>GH₵{maxRange}</span>
          </div>
        </div>
      </div>

      {/* Min Rating */}
      <div className="filter-group" style={groupDividerStyle}>
        <label style={labelStyle}>Min Rating</label>
        <div style={{
          display: 'flex',
          gap: isMobile ? '4px' : '3px',
          background: 'transparent',
          padding: '0',
          borderRadius: '0',
          border: 'none',
          justifyContent: 'space-between',
        }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`rating-btn ${filters.minRating >= star ? 'active' : ''}`}
            >
              <Star
                size={isMobile ? 20 : 18}
                fill={filters.minRating >= star ? "var(--warning)" : "none"}
                stroke={filters.minRating >= star ? "var(--warning)" : "var(--text-muted)"}
                strokeWidth={2}
              />
            </button>
          ))}
        </div>
        {filters.minRating > 0 && (
          <div style={{
            marginTop: '8px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <Star size={12} fill="var(--warning)" stroke="var(--warning)" />
            {filters.minRating}+ stars
          </div>
        )}
      </div>

      {/* Min Discount */}
      <div className="filter-group" ref={discountDropdownRef} style={{ ...groupDividerStyle, position: 'relative' }}>
        <label style={labelStyle}>Min Discount</label>

        <button onClick={handleDiscountDropdownToggle} style={dropdownTriggerStyle}>
          <span>
            {isDiscountDropdownOpen && tempDiscount > 0
              ? `${tempDiscount}%+ discount`
              : (filters.minDiscount > 0
                  ? `${filters.minDiscount}%+ discount`
                  : 'All discounts')}
          </span>
          <ChevronDown size={18} style={{
            transition: 'transform 0.2s ease',
            transform: isDiscountDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} />
        </button>

        {isDiscountDropdownOpen && (
          <div style={dropdownListStyle}>
            {[0, 10, 20, 30, 50].map(discount => (
              <label
                key={discount}
                style={dropdownOptionStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="radio"
                  name="discount"
                  checked={tempDiscount === discount}
                  onChange={() => handleDiscountChange(discount)}
                  style={{ width: '18px', height: '18px', borderRadius: '50%', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
                />
                {discount === 0 ? 'All' : `${discount}%+`}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="filter-group" style={groupDividerStyle}>
        <label style={labelStyle}>Availability</label>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          color: 'var(--text-main)',
          fontSize: '14px',
          fontWeight: 600,
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => setFilters(prev => ({ ...prev, inStockOnly: e.target.checked }))}
            style={{ width: '18px', height: '18px', borderRadius: '6px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
          />
          Show In-Stock Only
        </label>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        gap: '10px',
        marginTop: isMobile ? '4px' : 'auto',
        paddingTop: '18px',
        borderTop: '1px solid var(--border-light)',
      }}>
        <button
          className="btn-secondary"
          onClick={onReset}
          style={{
            flex: isMobile ? 1 : 'none',
            width: isMobile ? 'auto' : '100%',
            gap: '6px',
            padding: '10px',
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid var(--border-light)',
            fontSize: '13px',
          }}
        >
          <RotateCcw size={16} /> Reset
        </button>

        {isMobile && (
          <button
            className="btn-primary"
            onClick={onClose}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px'
            }}
          >
            Apply Filters
          </button>
        )}
      </div>
    </div>
  );
}
