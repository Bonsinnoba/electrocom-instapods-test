import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, RotateCcw, Star, Check, ChevronDown } from 'lucide-react';

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
    <div className={`filter-panel ${isMobile ? 'mobile' : ''}`} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '20px' : '24px',
      height: '100%',
      padding: isMobile ? '0 8px' : '24px'
    }}>
      {isMobile && <div className="drawer-handle" style={{
        width: '40px',
        height: '4px',
        background: 'var(--border-light)',
        borderRadius: '2px',
        margin: '-20px auto 10px',
        opacity: 0.6
      }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
          <Filter size={18} /> Filters
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

      <div className="filter-group" ref={dropdownRef} style={{ margin: '0 -30px' }}>
        <label style={{ display: 'block', marginBottom: '14px', fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 15px' }}>Category</label>
        
        <button
          onClick={handleCategoryDropdownToggle}
          style={{
            width: 'calc(100% - 30px)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--border-light)',
            background: 'var(--bg-surface-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border-color 0.2s',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '0 6px'
          }}
        >
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
          <div style={{
            position: 'absolute',
            zIndex: 1000,
            width: 'calc(100% - 30px)',
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1.5px solid var(--border-light)',
            borderRadius: '12px',
            marginTop: '8px',
            padding: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            margin: '8px 6px 0 6px'
          }}>
            {categories.map(cat => {
              const isActive = tempCategories.includes(cat);
              return (
                <label
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    fontWeight: 600,
                    color: 'var(--text-main)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => handleCategoryChange(cat)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '6px',
                      accentColor: 'var(--primary-blue)',
                      cursor: 'pointer'
                    }}
                  />
                  {cat}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-group" style={{ margin: '0 -30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center', margin: '0 15px' }}>
          <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px' }}>Price Range</label>
        </div>

        {/* Min / Max Inputs */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', margin: '0 6px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <span style={{ 
              position: 'absolute', 
              left: '10px', 
              color: 'var(--text-muted)', 
              fontWeight: 800,
              fontSize: '11px',
              pointerEvents: 'none',
              textTransform: 'uppercase'
            }}>Min</span>
            <input 
              type="number"
              min="0"
              max={maxRange}
              value={filters.minPrice}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                setFilters(prev => ({ ...prev, minPrice: Math.max(0, val) }));
              }}
              style={{
                width: '100%',
                padding: '8px 15px 8px 40px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-light)',
                background: 'var(--bg-surface-secondary)',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-main)',
                outline: 'none',
                transition: 'border-color 0.2s',
                WebkitAppearance: 'none'
              }}
            />
          </div>

          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>-</span>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <span style={{ 
              position: 'absolute', 
              left: '10px', 
              color: 'var(--text-muted)', 
              fontWeight: 800,
              fontSize: '11px',
              pointerEvents: 'none',
              textTransform: 'uppercase'
            }}>Max</span>
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
              style={{
                width: '100%',
                padding: '8px 18px 8px 40px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-light)',
                background: 'var(--bg-surface-secondary)',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-main)',
                outline: 'none',
                transition: 'border-color 0.2s',
                WebkitAppearance: 'none'
              }}
            />
          </div>
        </div>

        <div className="slider-wrapper" style={{ position: 'relative', padding: '0 2px', margin: '0 6px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
            <span>GH₵0</span>
            <span>GH₵{maxRange}</span>
          </div>
        </div>
      </div>

      <div className="filter-group" style={{ margin: '0 -30px' }}>
        <label style={{ display: 'block', marginBottom: '18px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 15px' }}>Min Rating</label>
        <div style={{
          display: 'flex',
          gap: isMobile ? '6px' : '4px',
          background: 'var(--bg-surface-secondary)',
          padding: isMobile ? '12px' : '4px 100px',
          borderRadius: '16px',
          border: '1.5px solid var(--border-light)',
          justifyContent: 'center',
          margin: '0 6px'
        }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`rating-btn ${filters.minRating >= star ? 'active' : ''}`}
              style={{
                background: 'transparent',
                border: 'none',
                padding: isMobile ? '6px' : '6px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: filters.minRating >= star ? 'scale(1.1)' : 'scale(1)',
                filter: filters.minRating >= star ? 'drop-shadow(0 2px 8px rgba(251, 191, 36, 0.4))' : 'none'
              }}
            >
              <Star 
                size={isMobile ? 24 : 22} 
                fill={filters.minRating >= star ? "var(--warning)" : "none"} 
                stroke={filters.minRating >= star ? "var(--warning)" : "var(--text-muted)"}
                strokeWidth={2.5}
                style={{
                  transition: 'all 0.3s ease'
                }}
              />
            </button>
          ))}
        </div>
        {filters.minRating > 0 && (
          <div style={{ 
            marginTop: '10px', 
            textAlign: 'center', 
            fontSize: '13px', 
            fontWeight: 600,
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <Star size={14} fill="var(--warning)" stroke="var(--warning)" />
            {filters.minRating}+ stars and above
          </div>
        )}
      </div>

      <div className="filter-group" ref={discountDropdownRef}>
        <label style={{ display: 'block', marginBottom: '18px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 15px' }}>Min Discount</label>
        
        <button
          onClick={handleDiscountDropdownToggle}
          style={{
            width: 'calc(100% - 30px)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--border-light)',
            background: 'var(--bg-surface-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border-color 0.2s',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '0 6px'
          }}
        >
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
          <div style={{
            position: 'absolute',
            zIndex: 1000,
            width: 'calc(100% - 30px)',
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1.5px solid var(--border-light)',
            borderRadius: '12px',
            marginTop: '8px',
            padding: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            margin: '8px 6px 0 6px'
          }}>
            {[0, 10, 20, 30, 50].map(discount => (
              <label
                key={discount}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  fontWeight: 600,
                  color: 'var(--text-main)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="radio"
                  name="discount"
                  checked={tempDiscount === discount}
                  onChange={() => handleDiscountChange(discount)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    accentColor: 'var(--primary-blue)',
                    cursor: 'pointer'
                  }}
                />
                {discount === 0 ? 'All' : `${discount}%+`}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="filter-group" style={{ margin: '0 -30px' }}>
        <label style={{ display: 'block', marginBottom: '18px', fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 15px' }}>Availability</label>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          color: 'var(--text-main)',
          fontSize: '14px',
          fontWeight: 600,
          userSelect: 'none',
          margin: '0 6px'
        }}>
          <input 
            type="checkbox" 
            checked={filters.inStockOnly} 
            onChange={(e) => setFilters(prev => ({ ...prev, inStockOnly: e.target.checked }))}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '6px',
              accentColor: 'var(--primary-blue)',
              cursor: 'pointer'
            }}
          />
          Show In-Stock Only
        </label>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'row' : 'column', 
        gap: '12px', 
        marginTop: isMobile ? '12px' : 'auto',
        margin: '0 -30px'
      }}>
        <button 
          className="btn-secondary" 
          onClick={onReset}
          style={{ 
            flex: isMobile ? 1 : 'none',
            width: isMobile ? 'auto' : 'calc(100% - 30px)', 
            gap: '8px', 
            padding: '12px',
            borderRadius: '16px',
            fontWeight: 700,
            border: '1.5px solid var(--border-light)',
            fontSize: '14px',
            margin: '0 6px'
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
              padding: '12px',
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '14px'
            }}
          >
            Apply Filters
          </button>
        )}
      </div>
    </div>
  );
}
