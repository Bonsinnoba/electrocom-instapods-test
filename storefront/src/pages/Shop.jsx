import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import FilterPanel from '../components/FilterPanel';
import ProductSkeleton from '../components/ProductSkeleton';
import { Filter as FilterIcon } from 'lucide-react';
import {
  normalizeSearchText,
  isFuzzyPartMatch,
  applySynonymsToQuery,
} from '../utils/searchUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Shop({ products, onProductClick, searchQuery, loading }) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9);
  const [sortBy, setSortBy] = useState('featured');
  const [categories, setCategories] = useState([]);
  const [localPrice, setLocalPrice] = useState(2000); // Local state for responsive slider
  const [filters, setFilters] = useState({
    categories: [],
    minPrice: 0,
    maxPrice: 2000, // Initial high default
    minRating: 0,
    minDiscount: 0,
    inStockOnly: false
  });

  // Sync local price with filters.maxPrice when filters change (e.g., on reset)
  useEffect(() => {
    setLocalPrice(filters.maxPrice);
  }, [filters.maxPrice]);

  const effectiveSearch = useMemo(
    () => applySynonymsToQuery(searchQuery).toLowerCase().trim(),
    [searchQuery],
  );

  // Reset visible count when filters or search change
  useEffect(() => {
    setVisibleCount(9);
  }, [filters, effectiveSearch]);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/get_categories.php`);
        const result = await res.json();
        if (result.success) {
          setCategories(result.data || []);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Dynamically extract categories from the product list and API
  const availableCategories = useMemo(() => {
    const apiCategories = categories.filter(c => c.is_active).map(c => c.name);
    return Array.from(apiCategories).sort();
  }, [categories]);

  // Find the maximum price among all products precisely
  const maxPriceInRange = useMemo(() => {
    if (products.length === 0) return 1000;
    const prices = products.map(p => {
      const rawPrice = String(p.price || '0').replace(/[^0-9.]/g, '');
      return parseFloat(rawPrice) || 0;
    });
    return Math.max(...prices, 1); // Ensure at least 1 to avoid slider errors
  }, [products]);

  // Sync maxPrice filter default ONLY on initial load or if maxPrice is currently at 2000 (unset)
  useEffect(() => {
    if (products.length > 0 && filters.maxPrice === 2000) {
      setFilters(f => ({ ...f, maxPrice: maxPriceInRange }));
    }
  }, [maxPriceInRange, products.length]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p => {
      const query = effectiveSearch;
      const normalizedQuery = normalizeSearchText(query);
      const name = String(p.name || '').toLowerCase();
      const category = String(p.category || 'Uncategorized').toLowerCase();
      const code = String(p.product_code || '').toLowerCase();

      // Convert specs object to searchable string
      const specsObj = p.specs || {};
      const specsString = Object.values(specsObj).join(' ').toLowerCase();

      const exactMatch = !query || name.includes(query) || category.includes(query) || code.includes(query) || specsString.includes(query);
      const fuzzyMatch = !exactMatch && (
        isFuzzyPartMatch(normalizedQuery, name) ||
        isFuzzyPartMatch(normalizedQuery, code) ||
        isFuzzyPartMatch(normalizedQuery, category) ||
        isFuzzyPartMatch(normalizedQuery, specsString)
      );
      const matchSearch = exactMatch || fuzzyMatch;
      
      const matchCategory = filters.categories.length === 0 || 
                            filters.categories.map(c => c.toLowerCase()).includes(category);
      
      const rawPrice = String(p.price || '0').replace(/[^0-9.]/g, '');
      const itemPrice = parseFloat(rawPrice) || 0;
      const matchPrice = itemPrice >= filters.minPrice && itemPrice <= (Number(filters.maxPrice) || Infinity);
      
      const itemRating = parseFloat(p.rating) || 0;
      const matchRating = itemRating >= filters.minRating;

      const getStock = (item) => Number(item.stock_quantity || 0);
      const matchStock = !filters.inStockOnly || getStock(p) > 0;

      const itemDiscount = parseInt(p.discount_percent) || 0;
      const matchDiscount = itemDiscount >= filters.minDiscount;

      return matchSearch && matchCategory && matchPrice && matchRating && matchDiscount && matchStock;
    });
    return filtered;
  }, [filters, effectiveSearch, products]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    const getPrice = (p) => parseFloat(String(p.price || '0').replace(/[^0-9.]/g, '')) || 0;
    const getStock = (p) => Number(p.stock_quantity || 0);
    const getSold = (p) => Number(p.total_sold || p.sold || 0);
    const getCreated = (p) => new Date(p.created_at || p.updated_at || 0).getTime() || 0;

    switch (sortBy) {
      case 'price_low':
        list.sort((a, b) => getPrice(a) - getPrice(b));
        break;
      case 'price_high':
        list.sort((a, b) => getPrice(b) - getPrice(a));
        break;
      case 'rating':
        list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        break;
      case 'new':
        list.sort((a, b) => getCreated(b) - getCreated(a));
        break;
      case 'stock_low':
        list.sort((a, b) => getStock(a) - getStock(b));
        break;
      case 'best_selling':
        list.sort((a, b) => getSold(b) - getSold(a));
        break;
      default:
        break;
    }
    return list;
  }, [filteredProducts, sortBy]);

  const displayedProducts = useMemo(() => {
    return sortedProducts.slice(0, visibleCount);
  }, [sortedProducts, visibleCount]);

  const popularFallback = useMemo(() => {
    const list = [...products];
    list.sort((a, b) => Number(b.total_sold || b.sold || 0) - Number(a.total_sold || a.sold || 0));
    return list.slice(0, 6);
  }, [products]);

  const resetFilters = () => {
    setFilters({
      categories: [],
      minPrice: 0,
      maxPrice: maxPriceInRange,
      minRating: 0,
      minDiscount: 0,
      inStockOnly: false
    });
    setLocalPrice(maxPriceInRange);
  };

  return (
    <div className="shop-container" style={{ 
      display: 'grid', 
      gridTemplateColumns: '280px 1fr', 
      gap: '24px'
    }}>
      {/* Desktop Filter Sidebar */}
      <aside className="desktop-filters card glass" style={{ height: 'fit-content', position: 'sticky', top: '24px' }}>
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onReset={resetFilters}
          categories={availableCategories}
          maxRange={maxPriceInRange}
          priceValue={localPrice}
          onPriceChange={setLocalPrice}
        />
      </aside>

      <div className="shop-content-area" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Secondary Mobile Navbar - Sticky filter & count */}
        <div className="shop-secondary-nav mobile-only" style={{ 
          display: 'none', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px max(20px, env(safe-area-inset-left))',
          margin: '16px 0 24px 0',
          borderRadius: '16px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        }}>
          <button 
            className="btn-primary" 
            onClick={() => setShowMobileFilters(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 20px', 
              fontSize: '14px', 
              borderRadius: '100px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            <FilterIcon size={16} /> Filter & Sort
          </button>
          
          <div style={{ 
            color: 'var(--text-main)', 
            fontSize: '13px', 
            fontWeight: 700,
            paddingRight: '8px'
          }}>
            {loading ? '...' : filteredProducts.length} <span style={{ color: 'var(--text-muted)' }}>Items</span>
          </div>
        </div>

        <div style={{ padding: '0 0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>Shop All</h1>
            
            <button 
              className="btn-secondary mobile-filter-trigger desktop-only-flex" 
              onClick={() => setShowMobileFilters(true)}
              style={{ display: 'none', gap: '8px' }}
            >
              <FilterIcon size={18} /> Filters
            </button>

            <div className="desktop-only-block" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                Showing {loading ? '...' : filteredProducts.length} Products
              </div>
              <select
                className="input-field"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '220px', padding: '8px 10px' }}
              >
                <option value="featured">Sort: Featured</option>
                <option value="best_selling">Sort: Best Selling</option>
                <option value="new">Sort: New Arrivals</option>
                <option value="rating">Sort: Highest Rated</option>
                <option value="price_low">Sort: Price Low to High</option>
                <option value="price_high">Sort: Price High to Low</option>
                <option value="stock_low">Sort: Low Stock First</option>
              </select>
            </div>
          </div>

          <div className="mobile-only" style={{ display: 'none', marginBottom: '16px' }}>
            <select
              className="input-field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: '100%', padding: '10px 12px' }}
            >
              <option value="featured">Featured</option>
              <option value="best_selling">Best Selling</option>
              <option value="new">New Arrivals</option>
              <option value="rating">Highest Rated</option>
              <option value="price_low">Price Low to High</option>
              <option value="price_high">Price High to Low</option>
              <option value="stock_low">Low Stock First</option>
            </select>
          </div>

          {loading ? (
            <div className="product-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => <ProductSkeleton key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="card glass" style={{ textAlign: 'center', padding: '48px 20px 64px', color: 'var(--text-muted)' }}>
              <div style={{ width: '64px', height: '64px', background: 'var(--bg-main)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <FilterIcon size={32} />
              </div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>No exact matches</h3>
              <p style={{ maxWidth: 480, margin: '0 auto 16px', lineHeight: 1.5 }}>
                Try a shorter keyword, check spelling, or browse a category below. We also expanded common typos (for example “capasitor” → capacitor).
              </p>
              {availableCategories.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                  {availableCategories.filter((c) => c !== 'All').slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="btn-outline"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => setFilters((f) => ({ ...f, categories: [cat] }))}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              <button className="btn-outline" onClick={resetFilters} style={{ marginBottom: '32px' }}>Clear All Filters</button>
              {popularFallback.length > 0 && (
                <>
                  <h4 style={{ color: 'var(--text-main)', marginBottom: '16px', fontSize: '16px' }}>Popular picks</h4>
                  <div className="product-grid" style={{
                    textAlign: 'left',
                    maxWidth: 900,
                    margin: '0 auto',
                  }}>
                    {popularFallback.map((p) => (
                      <ProductCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        price={p.price}
                        image={p.image}
                        rating={p.rating}
                        discount_percent={p.discount_percent}
                        sale_ends_at={p.sale_ends_at}
                        stock_quantity={p.stock_quantity}
                        description={p.description}
                        onClick={() => onProductClick(p)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="product-grid">
              {displayedProducts.map((p, idx) => (
                <div 
                  key={p.id} 
                  className="animate-slide-up" 
                  style={{ 
                    animationDelay: `${idx * 0.05}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    price={p.price}
                    image={p.image}
                    rating={p.rating}
                    discount_percent={p.discount_percent}
                    sale_ends_at={p.sale_ends_at}
                    stock_quantity={p.stock_quantity}
                    description={p.description}
                    onClick={() => onProductClick(p)}
                  />
                </div>
              ))}
            </div>
          )}

          {visibleCount < sortedProducts.length && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px', marginBottom: '24px' }}>
              <button 
                className="btn-primary" 
                onClick={() => setVisibleCount(prev => prev + 9)}
                style={{ 
                  padding: '14px 48px', 
                  borderRadius: '100px', 
                  fontWeight: 800,
                  fontSize: '15px',
                  boxShadow: '0 8px 24px rgba(var(--primary-rgb), 0.2)',
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                View More
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer Overlay - Styled in CSS */}
      <div className={`mobile-filter-drawer ${showMobileFilters ? 'active' : ''}`}>
        <div className="mobile-filter-content">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            onReset={resetFilters}
            categories={availableCategories}
            isMobile={true}
            onClose={() => setShowMobileFilters(false)}
            maxRange={maxPriceInRange}
            priceValue={localPrice}
            onPriceChange={setLocalPrice}
          />
        </div>
        <div className="mobile-filter-backdrop" onClick={() => setShowMobileFilters(false)}></div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1025px) {
          .mobile-filter-drawer {
            display: none !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
`}} />
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1024px) {
          .shop-container {
            grid-template-columns: 1fr !important;
            padding-top: 16px !important;
          }
          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
            gap: 16px !important;
          }
          .desktop-filters {
            display: none !important;
          }
          .desktop-only-flex {
            display: none !important;
          }
          .desktop-only-block {
            display: none !important;
          }
          .mobile-only {
            display: flex !important;
          }
          .shop-secondary-nav {
            display: flex !important;
          }
        }

        .mobile-filter-drawer {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5000;
          visibility: hidden;
          transition: visibility 0.3s;
        }
        .mobile-filter-drawer.active {
          visibility: visible;
        }
        .mobile-filter-content {
          position: absolute;
          bottom: 16px;
          left: 50%;
          width: calc(100% - 32px);
          max-width: 420px;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          z-index: 5002;
          background: var(--bg-surface);
          border-radius: 32px !important;
          padding: 24px 20px 32px;
          transform: translate(-50%, 120%);
          transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border-light);
          will-change: transform;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          -webkit-transform: translate3d(-50%, 120%, 0);
        }
        .category-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .dark-mode .mobile-filter-content {
          background: rgba(15, 23, 42, 0.98);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
        }
        .mobile-filter-drawer.active .mobile-filter-content {
          transform: translate(-50%, 0);
          -webkit-transform: translate3d(-50%, 0, 0);
        }
        .mobile-filter-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: 5001;
          will-change: opacity;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .mobile-filter-drawer.active .mobile-filter-backdrop {
          opacity: 1;
        }
      `}} />
    </div>
  );
}
