import React, { useState, useEffect } from 'react';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  CreditCard,
  Calendar,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { fetchTransactions } from '../services/api';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';

export default function Transactions() {
  const { user } = useUser();
  const { addToast } = useNotifications();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, successful, pending, cancelled

  useEffect(() => {
    const loadTransactions = async () => {
      setLoading(true);
      try {
        const response = await fetchTransactions();
        if (response.success) {
          setTransactions(response.data || []);
        } else {
          addToast(response.message || 'Failed to load transaction history', 'error');
        }
      } catch (error) {
        addToast('A connection error occurred while fetching transactions', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadTransactions();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
      case 'success':
        return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' };
      case 'pending':
      case 'processing':
        return { bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308' };
      case 'cancelled':
      case 'failed':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         String(t.id).includes(searchQuery);
    
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'successful') return matchesSearch && t.status === 'completed';
    if (filterType === 'pending') return matchesSearch && (t.status === 'pending' || t.status === 'processing');
    return matchesSearch;
  });

  return (
    <div className="transactions-page" style={{ padding: '24px 0', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{ 
            background: 'var(--primary-blue)', 
            color: 'white', 
            padding: '12px', 
            borderRadius: '16px',
            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)'
          }}>
            <History size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', margin: 0 }}>Payment History</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Track your previous order payments and gateway references.</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="filters-bar glass" style={{ 
        padding: '16px', 
        borderRadius: '20px', 
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Search by ID, reference or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%',
              padding: '12px 16px 12px 48px',
              borderRadius: '14px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="select-wrapper" style={{ position: 'relative' }}>
            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ 
                padding: '12px 20px 12px 36px',
                borderRadius: '14px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Transactions</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <button 
            onClick={loadTransactions}
            style={{ 
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <Calendar size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <History className="animate-spin" size={40} style={{ color: 'var(--primary-blue)', opacity: 0.5 }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Fetching your history...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '32px' }}>
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.05)', 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <CreditCard size={32} style={{ color: 'var(--primary-blue)' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No transactions found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            {searchQuery || filterType !== 'all' 
              ? "We couldn't find any transactions matching your filters." 
              : "You haven't made any payments yet. All your future order payments will appear here."}
          </p>
          {(searchQuery || filterType !== 'all') && (
            <button 
              className="btn-secondary"
              onClick={() => { setSearchQuery(''); setFilterType('all'); }}
              style={{ padding: '10px 24px', borderRadius: '12px' }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredTransactions.map((tx) => {
            const status = getStatusColor(tx.status);
            return (
              <div key={tx.id} className="transaction-card glass" style={{ 
                padding: '20px',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  background: tx.type === 'credit' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  color: tx.type === 'credit' ? '#22c55e' : 'var(--primary-blue)',
                  padding: '14px',
                  borderRadius: '16px',
                  display: 'flex'
                }}>
                  {tx.type === 'credit' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{tx.title}</h3>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '8px', 
                      background: status.bg, 
                      color: status.text,
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {tx.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       Ref: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{tx.reference?.slice(0, 10)}...</span>
                    </span>
                    <span>•</span>
                    <span>{new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                    GH₵ {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    via {tx.method || 'Paystack'}
                  </div>
                </div>

                <div style={{ paddingLeft: '8px', borderLeft: '1px solid var(--border-light)', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .transaction-card:hover {
          transform: translateX(4px);
          background: rgba(59, 130, 246, 0.03);
          border-color: var(--primary-blue);
        }
        .transaction-card:active {
          transform: scale(0.99);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 2s linear infinite;
        }
      `}} />
    </div>
  );
}
