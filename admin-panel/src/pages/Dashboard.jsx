import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ShoppingBag,
  Users,
  ArrowUpRight,
  TrendingUp,
  Calendar,
  Activity,
  Zap,
  Layers,
  AlertTriangle,
  Download,
  FileText,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { fetchAnalytics } from '../services/api';
import { useAdminSettings } from '../context/AdminSettingsContext';
import { useAuth } from '../context/AuthContext';

const DashboardRevenueCharts = lazy(() => import('./DashboardRevenueCharts'));

const toDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const buildFilledSeries = (source, days, numericKeys) => {
  const list = Array.isArray(source) ? source : [];
  if (days !== 7) return list.slice(-days);
  const mapped = new Map();
  list.forEach((entry) => {
    const key = toDateKey(entry?.date);
    if (key) mapped.set(key, entry);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filled = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateKey(d);
    const base = mapped.get(key) || {};
    const row = { ...base, date: d.toISOString().slice(0, 10), _isFilled: !mapped.has(key) };
    numericKeys.forEach((k) => {
      row[k] = Number(base[k] || 0);
    });
    filled.push(row);
  }
  return filled;
};

const StatCard = ({ icon, label, value, trend, trendLabel, color = 'var(--primary-blue)', loading }) => (
  <div className={`card glass animate-fade-in ${loading ? 'shimmer' : ''}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        borderRadius: '12px', 
        background: `rgba(var(--accent-blue-rgb), 0.1)`, 
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      {trend && (
        <div style={{ 
          fontSize: '12px', 
          fontWeight: 700, 
          color: trend.startsWith('+') ? 'var(--success)' : 'var(--accent-blue)',
          background: trend.startsWith('+') ? 'var(--success-bg)' : 'var(--info-bg)',
          padding: '4px 8px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {trend} <ArrowUpRight size={12} />
        </div>
      )}
    </div>
    <div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }}>{loading ? '---' : value}</div>
      {trendLabel && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{trendLabel}</div>}
    </div>
  </div>
);

export default function Dashboard() {
  const { siteName } = useAdminSettings();
  const { user } = useAuth();
  const role = user?.role || 'store_manager';
  const isMarketing = role === 'marketing';
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartRange, setChartRange] = useState(365);
  const [chartMode, setChartMode] = useState('area');
  const hasLoadedAnalytics = useRef(false);
  
  const exportFinancialReport = () => {
    if (!data) return;
    
    let csvRows = [];
    
    // Title & Metadata
    csvRows.push("ELECTRCOM FINANCIAL LEDGER REPORT");
    csvRows.push(`Generated On,${new Date().toLocaleString()}`);
    csvRows.push("");
    
    // Key Financial Metrics
    csvRows.push("KEY FINANCIAL METRICS");
    csvRows.push(`Metric,Value (GHS)`);
    csvRows.push(`Gross Revenue,${data.total_revenue || 0}`);
    csvRows.push(`Total Refunds (Outflow),-${data.total_refunds || 0}`);
    csvRows.push(`Net Audited Revenue,${data.net_revenue || 0}`);
    csvRows.push(`POS Transactions,${data.revenue_pos || 0}`);
    csvRows.push(`Online Transactions,${data.revenue_online || 0}`);
    csvRows.push(`Average Order Value,${data.avg_order_value || 0}`);
    csvRows.push(`Total Returns Volume Count,${data.total_returns_count || 0}`);
    csvRows.push(`Total Approved Refunds Count,${data.total_refunds_count || 0}`);
    csvRows.push("");
    
    // Daily Revenue Velocity (Last 30 Days)
    csvRows.push("DAILY REVENUE VELOCITY (LAST 30 DAYS)");
    csvRows.push("Date,Online Revenue (GHS),POS Revenue (GHS),Total Daily Revenue (GHS)");
    if (Array.isArray(data.revenue_chart)) {
      data.revenue_chart.forEach(row => {
        csvRows.push(`${row.date},${row.online_revenue || 0},${row.pos_revenue || 0},${row.daily_revenue || 0}`);
      });
    }
    csvRows.push("");
    
    // Top Categories
    csvRows.push("TOP PRODUCT CATEGORIES BY REVENUE");
    csvRows.push("Category,Revenue (GHS)");
    if (Array.isArray(data.sales_by_category)) {
      data.sales_by_category.forEach(row => {
        csvRows.push(`"${String(row.category || '').replace(/"/g, '""')}",${row.revenue || 0}`);
      });
    }
    csvRows.push("");
    
    // Recent Transactions
    csvRows.push("RECENT TRANSACTIONS AUDIT TRAIL");
    csvRows.push("Order ID,Customer,Total Amount (GHS),Fulfillment Type,Status");
    if (Array.isArray(data.recent_activity)) {
      data.recent_activity.forEach(row => {
        csvRows.push(`ORD-${row.id},"${(row.customer_name || 'Walk-in').replace(/"/g, '""')}",${row.total_amount},${row.order_type || 'online'},${row.status}`);
      });
    }
    csvRows.push("");

    // Recent Refunds Audit Trail
    csvRows.push("REFUNDS AUDIT TRAIL");
    csvRows.push("Refund ID,Order ID,Amount (GHS),Refund Method,Status,Created At,Approved By,Note");
    if (Array.isArray(data.recent_refunds)) {
      data.recent_refunds.forEach(row => {
        csvRows.push(`${row.id},ORD-${row.order_id},${row.amount},${row.method},${row.status},${row.created_at},"${(row.approved_by_name || 'System').replace(/"/g, '""')}","${(row.note || '').replace(/"/g, '""')}"`);
      });
    }
    
    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `electrcom_financial_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialReportWord = () => {
    if (!data) return;

    let revenueChartRows = '';
    if (Array.isArray(data.revenue_chart)) {
      data.revenue_chart.forEach(row => {
        revenueChartRows += '<tr>' +
          '<td>' + row.date + '</td>' +
          '<td style="text-align: right;">GH₵ ' + Number(row.online_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="text-align: right;">GH₵ ' + Number(row.pos_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="text-align: right; font-weight: bold;">GH₵ ' + Number(row.daily_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '</tr>';
      });
    } else {
      revenueChartRows = '<tr><td colspan="4">No daily velocity logs found.</td></tr>';
    }

    let salesByCategoryRows = '';
    if (Array.isArray(data.sales_by_category)) {
      data.sales_by_category.forEach(row => {
        salesByCategoryRows += '<tr>' +
          '<td>' + (row.category || 'Uncategorized') + '</td>' +
          '<td style="text-align: right; font-weight: bold;">GH₵ ' + Number(row.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '</tr>';
      });
    } else {
      salesByCategoryRows = '<tr><td colspan="2">No category logs found.</td></tr>';
    }

    let recentActivityRows = '';
    if (Array.isArray(data.recent_activity)) {
      data.recent_activity.forEach(row => {
        recentActivityRows += '<tr>' +
          '<td><strong>#ORD-' + row.id + '</strong></td>' +
          '<td>' + (row.customer_name || 'Walk-in Customer') + '</td>' +
          '<td style="text-align: right; font-weight: bold;">GH₵ ' + Number(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="text-transform: uppercase; font-size: 8pt;">' + (row.order_type || 'online') + '</td>' +
          '<td style="font-weight: bold; color: ' + (row.status === 'completed' || row.status === 'delivered' ? '#10b981' : '#f59e0b') + ';">' + row.status + '</td>' +
          '</tr>';
      });
    } else {
      recentActivityRows = '<tr><td colspan="5">No recent activity logs found.</td></tr>';
    }

    let recentRefundsRows = '';
    if (Array.isArray(data.recent_refunds) && data.recent_refunds.length > 0) {
      data.recent_refunds.forEach(row => {
        recentRefundsRows += '<tr>' +
          '<td><strong>#REF-' + row.id + '</strong></td>' +
          '<td>#ORD-' + row.order_id + '</td>' +
          '<td style="text-align: right; font-weight: bold; color: #ef4444;">GH₵ ' + Number(row.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="text-transform: uppercase; font-size: 8pt;">' + row.method + '</td>' +
          '<td style="font-weight: bold; color: ' + (row.status === 'processed' ? '#10b981' : '#ef4444') + ';">' + row.status + '</td>' +
          '<td>' + row.created_at + '</td>' +
          '<td>' + (row.approved_by_name || 'System') + '</td>' +
          '<td><i>' + (row.note || 'None') + '</i></td>' +
          '</tr>';
      });
    } else {
      recentRefundsRows = '<tr><td colspan="8" style="text-align: center;">No refund audit trails logged.</td></tr>';
    }

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>ElectrCom Financial Ledger Audit Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #333333;
            line-height: 1.6;
          }
          h1 {
            color: #1e3a8a;
            font-size: 24pt;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 5px;
            margin-bottom: 5px;
          }
          .subtitle {
            color: #666666;
            font-size: 11pt;
            margin-bottom: 30px;
          }
          h2 {
            color: #1e3a8a;
            font-size: 16pt;
            margin-top: 25px;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 3px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 10pt;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            border: 1px solid #d1d5db;
          }
          td {
            padding: 8px;
            border: 1px solid #d1d5db;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .metric-name {
            font-weight: bold;
            width: 50%;
          }
          .metric-value {
            text-align: right;
            font-weight: bold;
          }
          .refund-row {
            color: #ef4444;
          }
          .footer {
            margin-top: 40px;
            font-size: 8pt;
            color: #999999;
            text-align: center;
            border-top: 1px dashed #cccccc;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <h1>ELECTRCOM FINANCIAL LEDGER REPORT</h1>
        <div class="subtitle">
          <strong>Generated On:</strong> ${new Date().toLocaleString()}<br/>
          <strong>Auditing Scope:</strong> Regional Revenue, Returns, & Cashflow Reversals
        </div>

        <h2>KEY FINANCIAL METRICS</h2>
        <table>
          <thead>
            <tr>
              <th>Financial Metric</th>
              <th style="text-align: right;">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="metric-name">Gross Revenue</td>
              <td class="metric-value">GH₵ ${Number(data.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr class="refund-row">
              <td class="metric-name">Total Refunds (Outflow)</td>
              <td class="metric-value">- GH₵ ${Number(data.total_refunds || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="metric-name" style="background-color: #f0fdf4; color: #15803d;">Net Audited Revenue</td>
              <td class="metric-value" style="background-color: #f0fdf4; color: #15803d;">GH₵ ${Number(data.net_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="metric-name">POS Sales Outflow Volume</td>
              <td class="metric-value">GH₵ ${Number(data.revenue_pos || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="metric-name">Online Sales Outflow Volume</td>
              <td class="metric-value">GH₵ ${Number(data.revenue_online || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="metric-name">Average Order Value (AOV)</td>
              <td class="metric-value">GH₵ ${Number(data.avg_order_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="metric-name">Total Returns Volume Count</td>
              <td class="metric-value">${data.total_returns_count || 0} items</td>
            </tr>
            <tr>
              <td class="metric-name">Total Approved Refunds Count</td>
              <td class="metric-value">${data.total_refunds_count || 0} transactions</td>
            </tr>
          </tbody>
        </table>

        <h2>DAILY REVENUE VELOCITY (LAST 30 DAYS)</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th style="text-align: right;">Online Revenue</th>
              <th style="text-align: right;">POS Revenue</th>
              <th style="text-align: right;">Total Daily Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${revenueChartRows}
          </tbody>
        </table>

        <h2>TOP PRODUCT CATEGORIES BY REVENUE</h2>
        <table>
          <thead>
            <tr>
              <th>Category Name</th>
              <th style="text-align: right;">Revenue Contributed</th>
            </tr>
          </thead>
          <tbody>
            ${salesByCategoryRows}
          </tbody>
        </table>

        <h2>RECENT TRANSACTION AUDIT TRAIL</h2>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer Name</th>
              <th style="text-align: right;">Total Amount</th>
              <th>Fulfillment Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${recentActivityRows}
          </tbody>
        </table>

        <h2>REFUNDS & REVERSALS AUDIT TRAIL</h2>
        <table>
          <thead>
            <tr>
              <th>Refund ID</th>
              <th>Order ID</th>
              <th style="text-align: right;">Amount</th>
              <th>Refund Method</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Approved By</th>
              <th>Auditor Note</th>
            </tr>
          </thead>
          <tbody>
            ${recentRefundsRows}
          </tbody>
        </table>

        <div class="footer">
          ElectrCom Administration & Auditing Protocol &copy; ${new Date().getFullYear()}. All Rights Reserved. Confidential financial records.
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `electrcom_financial_ledger_${new Date().toISOString().slice(0, 10)}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadAnalytics = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetchAnalytics();
      if (res.success) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedAnalytics.current) {
      hasLoadedAnalytics.current = true;
      loadAnalytics(true);
      const interval = setInterval(() => loadAnalytics(false), 30000);
      return () => clearInterval(interval);
    }
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <Activity className="animate-pulse" size={48} color="var(--primary-blue)" />
        <p>Synchronizing Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card glass animate-fade-in" style={{ padding: '60px', textAlign: 'center', margin: '40px auto', maxWidth: '500px' }}>
        <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '24px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Analytics Unavailable</h2>
        <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => loadAnalytics(true)}>Retry Connection</button>
      </div>
    );
  }

  const filteredRevenueChart = buildFilledSeries(data?.revenue_chart, chartRange, ['online_revenue', 'pos_revenue']);
  const suggestedActions = [
    (data?.low_stock_count || 0) > 0 ? {
      level: 'high',
      title: 'Prioritize restock workflow',
      detail: `${data.low_stock_count} products are low in stock and may block new sales.`,
      actionPath: '/catalog',
    } : null,
    !isMarketing && (data?.strategic_insights?.ship_efficiency || 0) > 24 ? {
      level: 'medium',
      title: 'Speed up dispatch operations',
      detail: `Average dispatch time is ${data.strategic_insights.ship_efficiency} hours. Consider assigning more picker capacity.`,
      actionPath: '/sales',
    } : null,
    Number(data?.revenue_online || 0) < Number(data?.revenue_pos || 0) * 0.5 ? {
      level: 'medium',
      title: 'Boost online conversion',
      detail: 'Online sales are trailing POS sales significantly. Consider a targeted broadcast campaign and homepage offers.',
      actionPath: '/marketing',
    } : null,
    (data?.total_customers || 0) > 0 && (data?.total_orders || 0) / (data?.total_customers || 1) < 1.2 ? {
      level: 'low',
      title: 'Increase repeat purchase rate',
      detail: 'Customer-to-order ratio suggests low repeat buying. Add loyalty offers or reorder reminders.',
      actionPath: '/marketing',
    } : null,
  ].filter(Boolean).slice(0, 3);
  const formatChartTick = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    if (chartRange === 7) return d.toLocaleString('en-US', { weekday: 'short' });
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.02em' }}>{siteName || 'Dashboard'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
            Real-time business performance overview.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
           {(role === 'super' || role === 'store_manager' || role === 'accountant') && (
              <>
                <button 
                  onClick={exportFinancialReportWord}
                  className="btn-primary animate-hover" 
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontWeight: 800, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    background: 'linear-gradient(135deg, #2b579a 0%, #1e3a8a 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 10px rgba(43, 87, 154, 0.2)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                   <FileText size={14} /> EXPORT WORD LEDGER
                </button>
                <button 
                  onClick={exportFinancialReport}
                  className="glass animate-hover" 
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                   <Download size={14} /> EXPORT AUDIT CSV
                </button>
              </>
            )}
           <div className="glass" style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} className="text-success animate-pulse" /> LIVE FEED
           </div>
           <div className="glass" style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} /> {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
           </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
        <StatCard
          icon={<DollarSign size={24} />}
          label="Total Revenue"
          value={`GH₵ ${Number(data?.total_revenue || 0).toLocaleString()}`}
          trend="+15.4%"
          trendLabel="Combined Growth"
          color="var(--primary-blue)"
        />
        <StatCard
          icon={<ShoppingBag size={24} />}
          label="Online Sales"
          value={`GH₵ ${Number(data?.revenue_online || 0).toLocaleString()}`}
          trendLabel="Platform Revenue"
        />
        {!isMarketing && (
          <StatCard
            icon={<Zap size={24} />}
            label="POS Sales"
            value={`GH₵ ${Number(data?.revenue_pos || 0).toLocaleString()}`}
            color="var(--accent-gold)"
            trendLabel="Store Revenue"
          />
        )}
        <StatCard
          icon={<Layers size={24} />}
          label="Total Orders"
          value={String(data?.total_orders || 0)}
          color="var(--primary-blue)"
          trendLabel="Completed Volume"
        />
        {!isMarketing && (
          <StatCard
            icon={<Activity size={24} />}
            label="Avg Order"
            value={`GH₵ ${Number(data?.avg_order_value || 0).toLocaleString()}`}
            color="var(--info)"
            trendLabel="Per Transaction"
          />
        )}
        <StatCard
          icon={<Users size={24} />}
          label="Customers"
          value={String(data?.total_customers || 0)}
          color="var(--success)"
          trendLabel="Direct Reach"
        />
        <StatCard
          icon={<DollarSign size={24} />}
          label="Net Revenue"
          value={`GH₵ ${Number(data?.net_revenue || 0).toLocaleString()}`}
          color="var(--success)"
          trendLabel="After Refunds"
        />
        <StatCard
          icon={<RotateCcw size={24} />}
          label="Returns Rate"
          value={data?.total_orders > 0 ? `${((data?.total_returns_count || 0) / data.total_orders * 100).toFixed(1)}%` : '0.0%'}
          color="var(--warning)"
          trendLabel="Of Total Orders"
        />
        {data?.pending_orders !== undefined && (
          <StatCard
            icon={<Clock size={24} />}
            label="Pending Orders"
            value={String(data.pending_orders)}
            color="var(--info)"
            trendLabel="Awaiting Processing"
          />
        )}
      </div>

      {suggestedActions.length > 0 && (
        <div className="card glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="var(--primary-blue)" /> Suggested Actions
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {suggestedActions.map((item, idx) => (
              <button
                key={`${item.title}-${idx}`}
                type="button"
                onClick={() => item.actionPath && navigate(item.actionPath)}
                style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', textAlign: 'left', cursor: item.actionPath ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '14px' }}>{item.title}</strong>
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: item.level === 'high' ? 'var(--danger)' : item.level === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                    {item.level}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.detail}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        <Suspense
          fallback={(
            <div className="card glass shimmer" style={{ gridColumn: 'span 2', padding: '32px', minHeight: '360px' }}>
              <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading charts…</p>
            </div>
          )}
        >
          <DashboardRevenueCharts
            filteredRevenueChart={filteredRevenueChart}
            chartRange={chartRange}
            setChartRange={setChartRange}
            chartMode={chartMode}
            setChartMode={setChartMode}
            formatChartTick={formatChartTick}
          />
        </Suspense>

        {/* Strategic Insights */}
        <div className="card glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Strategic Insights</h3>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {!isMarketing && (
              <div style={{ borderLeft: '4px solid var(--primary-blue)', paddingLeft: '16px' }}>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fulfillment Efficiency</div>
                 <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>{data?.strategic_insights?.ship_efficiency ?? '—'} Hours</div>
                 <div style={{ fontSize: '10px', color: 'var(--success)', marginTop: '4px' }}>Avg time to dispatch</div>
              </div>
              )}

              <div style={{ borderLeft: '4px solid var(--accent-gold)', paddingLeft: '16px' }}>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revenue Peak</div>
                 <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>GH₵ {Number(data?.strategic_insights?.revenue_peak || 0).toLocaleString()}</div>
                 <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Highest daily volume</div>
              </div>

              {!isMarketing && (
              <div style={{ borderLeft: '4px solid var(--danger)', paddingLeft: '16px' }}>
                 <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Stock Alert</div>
                 <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>{data?.low_stock_count ?? 0} Products</div>
                 <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '4px' }}>Requires immediate restocking</div>
              </div>
              )}
           </div>

            <div className="glass" style={{ marginTop: 'auto', padding: '16px', borderRadius: '12px', background: 'rgba(var(--accent-blue-rgb), 0.05)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                 <TrendingUp size={16} color={(data?.strategic_insights?.health_score || 0) > 80 ? 'var(--success)' : (data?.strategic_insights?.health_score || 0) > 60 ? 'var(--accent-gold)' : 'var(--danger)'} /> Business Health ({data?.strategic_insights?.health_score ?? '—'}%)
               </div>
               <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                 {data?.strategic_insights?.health_message ?? 'No data available.'}
               </p>
            </div>
        </div>

        {/* Category Breakdown */}
        <div className="card glass" style={{ padding: '32px' }}>
           <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Category Sales</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(data?.sales_by_category || []).slice(0, 5).map(cat => (
                <div key={cat.category}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                      <span>{cat.category}</span>
                      <span style={{ color: 'var(--primary-blue)' }}>GH₵ {Number(cat.revenue || 0).toLocaleString()}</span>
                   </div>
                   <div style={{ height: '4px', background: 'var(--bg-surface-secondary)', borderRadius: '10px' }}>
                      <div style={{ 
                        height: '100%', 
                        background: 'var(--primary-blue)', 
                        width: `${(data?.total_revenue || 0) > 0 ? (Number(cat.revenue || 0) / data.total_revenue) * 100 : 0}%` 
                      }}></div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Recent Transactions */}
        <div className="card glass" style={{ gridColumn: 'span 2', padding: '32px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Recent Transactions</h3>
              <Layers size={18} color="var(--text-muted)" />
           </div>
           <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                       <th style={{ padding: '12px' }}>Order ID</th>
                       <th style={{ padding: '12px' }}>Customer</th>
                       <th style={{ padding: '12px' }}>Type</th>
                       <th style={{ padding: '12px' }}>Amount</th>
                       <th style={{ padding: '12px' }}>Status</th>
                    </tr>
                 </thead>
                 <tbody>
                    {data.recent_activity?.map(order => (
                       <tr key={order.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                          <td style={{ padding: '12px', fontWeight: 700 }}>#{order.id}</td>
                          <td style={{ padding: '12px' }}>{order.customer_name || 'Walk-in Customer'}</td>
                          <td style={{ padding: '12px' }}>
                             <span style={{ 
                               background: order.order_type === 'pos' ? 'rgba(var(--accent-gold-rgb), 0.1)' : 'rgba(var(--accent-blue-rgb), 0.1)',
                               color: order.order_type === 'pos' ? 'var(--accent-gold)' : 'var(--accent-blue)',
                               padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'
                             }}>
                                {order.order_type || 'online'}
                             </span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>GH₵ {Number(order.total_amount).toLocaleString()}</td>
                          <td style={{ padding: '12px' }}>
                             <span style={{ 
                               color: order.status === 'delivered' ? 'var(--success)' : 'var(--warning)',
                               fontWeight: 600, fontSize: '11px'
                             }}>
                                {order.status}
                             </span>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
