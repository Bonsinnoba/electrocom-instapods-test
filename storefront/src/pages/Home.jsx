import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import HeroSlider from '../components/HeroSlider';
import FlashSaleBanner from '../components/FlashSaleBanner';
import ProductSkeleton from '../components/ProductSkeleton';
import { useSettings } from '../context/SettingsContext';
import { useUser } from '../context/UserContext';

export default function Home({ products, onProductClick, searchQuery, loading }) {
  const { siteSettings } = useSettings();
  const { user } = useUser();
  const itemsPerPage = parseInt(siteSettings?.defaultItemsPerPage || 9);
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const [viewHistory, setViewHistory] = useState({});
  const [recentViews, setRecentViews] = useState([]);
  const [categoryAffinity, setCategoryAffinity] = useState({});

  useEffect(() => {
    try {
      const historyStr = localStorage.getItem('ehub_view_history');
      if (historyStr) {
        setViewHistory(JSON.parse(historyStr));
      }
      const recentStr = localStorage.getItem('ehub_recent_views');
      if (recentStr) {
        setRecentViews(JSON.parse(recentStr));
      }
      const affinityStr = localStorage.getItem('ehub_category_affinity');
      if (affinityStr) {
        setCategoryAffinity(JSON.parse(affinityStr));
      }
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading view history');
      } else {
        console.warn("Failed to parse view history:", e);
      }
    }
  }, []);

  const sortedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    const recentSet = new Set(recentViews);
    const maxPrice = Math.max(...products.map((p) => parseFloat(p.price) || 0), 1);
    return [...products]
      .map((p, idx) => {
        const views = Number(viewHistory[p.id] || 0);
        const categoryKey = String(p.category || 'uncategorized').toLowerCase();
        const affinity = Number(categoryAffinity[categoryKey] || 0);
        const rating = Math.min(5, Math.max(0, parseFloat(p.rating) || 0));
        const stock = Number(p.stock_quantity || 0);
        const popularity = Number(p.total_sold || p.sold || 0);
        const priceNorm = (parseFloat(p.price) || 0) / maxPrice;
        const recentlyViewedBoost = recentSet.has(p.id) ? -2 : 0;
        const score =
          views * 4 +
          affinity * 2.5 +
          rating * 3 +
          Math.min(stock, 30) * 0.15 +
          popularity * 0.05 +
          (1 - priceNorm) * 0.4 +
          recentlyViewedBoost;
        return { p, idx, score };
      })
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
      .map((item) => item.p);
  }, [products, viewHistory, recentViews, categoryAffinity]);

  const filteredProducts = useMemo(() => {
    return sortedProducts.filter(p => {
      const query = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(query) || 
             (p.category && p.category.toLowerCase().includes(query)) ||
             (p.product_code && p.product_code.toLowerCase().includes(query));
    });
  }, [sortedProducts, searchQuery]);

  useEffect(() => {
    setVisibleCount(itemsPerPage);
  }, [searchQuery, itemsPerPage]);

  const recommendedProducts = useMemo(() => {
    if (searchQuery || !user) return [];
    return sortedProducts.slice(0, Math.min(6, sortedProducts.length));
  }, [sortedProducts, searchQuery, user]);

  const eligibleProducts = useMemo(() => {
    if (searchQuery) return filteredProducts;
    const recommendedIds = new Set(recommendedProducts.map((p) => p.id));
    return filteredProducts.filter((p) => !recommendedIds.has(p.id));
  }, [filteredProducts, recommendedProducts, searchQuery]);

  const catalogProducts = useMemo(() => {
    return eligibleProducts.slice(0, visibleCount);
  }, [eligibleProducts, visibleCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {!searchQuery && <HeroSlider />}
      {!searchQuery && <FlashSaleBanner products={products} onProductClick={onProductClick} />}
      
      <div style={{ flex: 1 }}>
        {loading ? (
          <>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              {searchQuery ? `Search Results for "${searchQuery}"` : (siteSettings.homepageSectionTitle || 'Product Catalog')}
            </h2>
            <div className="product-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ProductSkeleton key={i} />)}
            </div>
          </>
        ) : filteredProducts.length === 0 ? (
          <>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
              {searchQuery ? `Search Results for "${searchQuery}"` : (siteSettings.homepageSectionTitle || 'Product Catalog')}
            </h2>
            <div className="card glass" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No products found matching "{searchQuery}"
            </div>
          </>
        ) : (
          <div className={`home-layout-container ${(!searchQuery && recommendedProducts.length > 0) ? 'has-sidebar' : ''}`}>
            
            {/* Recommendations Column */}
            {!searchQuery && recommendedProducts.length > 0 && (
              <aside className="home-side-recommendations">
                <h2 className="recommendations-title" style={{ fontSize: '22px', fontWeight: 800, marginBottom: '20px' }}>Recommended</h2>
                <div className="recommendations-list">
                  {recommendedProducts.map((p, idx) => (
                    <div
                      key={`rec-${p.id}`}
                      className="animate-slide-up"
                      style={{
                        animationDelay: `${idx * 0.04}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      <ProductCard
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
              </aside>
            )}

            {/* Main Catalog Column */}
            <div className="home-main-content">
              {searchQuery && (
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
                  Search Results for "{searchQuery}"
                </h2>
              )}

              {!searchQuery && (
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>
                  {siteSettings.homepageSectionTitle || 'Product Catalog'}
                </h2>
              )}

              <div className="product-grid">
                {catalogProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    className="animate-slide-up"
                    style={{
                      animationDelay: `${idx * 0.05}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <ProductCard
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

              {visibleCount < eligibleProducts.length && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px', marginBottom: '24px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => setVisibleCount(prev => prev + itemsPerPage)}
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
        )}
      </div>
    </div>
  );
}
