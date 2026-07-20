import React, { useState, useEffect } from 'react';
import { Trash2, Star, Search, Filter, AlertCircle, ShoppingBag, User } from 'lucide-react';
import { fetchAllReviews, deleteReview } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

export default function ReviewManager() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('All');
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const result = await fetchAllReviews();
      if (result.success) {
        setReviews(result.data);
      }
    } catch (error) {
      addToast("Failed to load reviews", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Are you sure you want to delete this review? This will also update the product's average rating."))) return;
    try {
      const result = await deleteReview(id);
      if (result.success) {
        setReviews(prev => prev.filter(r => r.id !== id));
        addToast("Review deleted successfully", "success");
      }
    } catch (error) {
      addToast("Failed to delete review", "error");
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.comment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = filterRating === 'All' || parseInt(r.rating) === parseInt(filterRating);
    return matchesSearch && matchesRating;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Review Management</h1>
        <p style={{ color: 'var(--text-muted)' }}>Moderate customer feedback and ratings across all products.</p>
      </header>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by customer, product, or comment..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 40px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Filter size={18} style={{ color: 'var(--text-muted)' }} />
            <select 
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none', fontWeight: 600 }}
            >
              <option value="All">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reviews...</div>
        ) : filteredReviews.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px 24px' }}>Customer</th>
                  <th style={{ padding: '16px 24px' }}>Product</th>
                  <th style={{ padding: '16px 24px' }}>Rating</th>
                  <th style={{ padding: '16px 24px' }}>Comment</th>
                  <th style={{ padding: '16px 24px' }}>Date</th>
                  <th style={{ padding: '16px 24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                          {r.user_name.charAt(0)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{r.user_name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.user_email}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingBag size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{r.product_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={14} 
                            fill={i < r.rating ? '#f59e0b' : 'transparent'} 
                            color={i < r.rating ? '#f59e0b' : 'var(--text-muted)'} 
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', maxWidth: '300px' }}>
                      <p style={{ margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.comment}>
                        {r.comment}
                      </p>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button 
                        onClick={() => handleDelete(r.id)}
                        className="btn-icon" 
                        style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}
                        title="Delete Review"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p>No reviews found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
