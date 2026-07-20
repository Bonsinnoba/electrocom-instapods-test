import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Download, 
  Calendar, 
  ArrowUpRight, 
  CreditCard,
  PieChart,
  BarChart3,
  Search,
  ArrowRight,
  FileText
} from 'lucide-react';
import { fetchAnalytics } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush,
  BarChart, Bar, Cell
} from 'recharts';

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

export default function AccountantDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartRange, setChartRange] = useState(365);
  const [chartMode, setChartMode] = useState('area');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchAnalytics();
        if (res.success) setData(res.data);
      } catch (err) {
        setError('Failed to load financial records');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const exportFinancialReport = () => {
    if (!data) return;
    
    let csvRows = [];
    
    // Title & Metadata
    csvRows.push("ELECTRCOM FINANCIAL LEDGER REPORT");
    csvRows.push(`Generated On,${new Date().toLocaleString()}`);
    csvRows.push("");
    
    // Key Financial Metrics
    csvRows.push("KEY FINANCIAL METRICS");
    csvRows.push(`Metric,Value`);
    csvRows.push(`Gross Revenue (GHS),${data.total_revenue}`);
    csvRows.push(`Total Refunds (GHS),${data.total_refunds || 0}`);
    csvRows.push(`Net Revenue (GHS),${data.net_revenue || 0}`);
    csvRows.push(`POS Transactions (GHS),${data.revenue_pos}`);
    csvRows.push(`Online Transactions (GHS),${data.revenue_online}`);
    csvRows.push(`Average Order Value (GHS),${data.avg_order_value}`);
    csvRows.push(`Total Returns count,${data.total_returns_count || 0}`);
    csvRows.push(`Total Refunds count,${data.total_refunds_count || 0}`);
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

  if (loading) return <div className="loading-state">Synchronizing Financials...</div>;
  if (!data) return <div className="error-state">{error || 'No financial data available.'}</div>;
  const filteredRevenueChart = buildFilledSeries(data.revenue_chart, chartRange, ['daily_revenue']);
  const formatChartTick = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    if (chartRange === 7) return d.toLocaleString('en-US', { weekday: 'short' });
    return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em' }}>Financial Ledger</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Audited regional revenue, returns, and transactional insights.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={exportFinancialReportWord} 
            className="btn glass animate-hover" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              fontWeight: 700, 
              color: '#2b579a',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <FileText size={14} /> EXPORT WORD LEDGER
          </button>
          <button 
            onClick={exportFinancialReport} 
            className="btn glass animate-hover" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <Download size={14} /> EXPORT AUDIT CSV
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(var(--accent-blue-rgb), 0.1)', color: 'var(--primary-blue)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }}>GH₵ {Number(data.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Refunds</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px', color: '#ef4444' }}>GH₵ {Number(data.total_refunds || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px', color: '#10b981' }}>GH₵ {Number(data.net_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>POS Sales</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }}>GH₵ {Number(data.revenue_pos || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Returns</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '4px' }}>{data.total_returns_count || 0} items</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
         {/* Revenue Velocity */}
         <div className="card glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: 0 }}>Revenue Velocity</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[7, 30, 90, 365].map((days) => (
                  <button key={days} type="button" className={`btn ${chartRange === days ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => setChartRange(days)}>
                    {days === 365 ? '1y' : `${days}d`}
                  </button>
                ))}
                <button type="button" className={`btn ${chartMode === 'area' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => setChartMode('area')}>
                  Area
                </button>
                <button type="button" className={`btn ${chartMode === 'bar' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => setChartMode('bar')}>
                  Bar
                </button>
              </div>
            </div>
            <div style={{ width: '100%', height: '300px' }}>
               <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'area' ? (
                  <AreaChart data={filteredRevenueChart}>
                     <defs>
                       <linearGradient id="accountRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0} />
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-light)" />
                     <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickFormatter={formatChartTick}
                     />
                     <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickFormatter={(v) => `GH₵${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                     />
                     <Tooltip
                        contentStyle={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}
                        formatter={(value, _name, ctx) => [`GH₵ ${Number(value || 0).toLocaleString()}`, ctx?.payload?._isFilled ? 'Revenue (auto-filled)' : 'Revenue']}
                     />
                     <Area type="monotone" dataKey="daily_revenue" stroke="var(--primary-blue)" fill="url(#accountRevenueFill)" strokeWidth={3} />
                  </AreaChart>
                  ) : (
                  <BarChart data={filteredRevenueChart}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={formatChartTick} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `GH₵${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }} formatter={(value, _name, ctx) => [`GH₵ ${Number(value || 0).toLocaleString()}`, ctx?.payload?._isFilled ? 'Revenue (auto-filled)' : 'Revenue']} />
                    <Bar dataKey="daily_revenue" fill="var(--primary-blue)" radius={[8, 8, 0, 0]} barSize={14} maxBarSize={16}>
                      {filteredRevenueChart.map((entry, idx) => (
                        <Cell key={`acct-rev-cell-${idx}`} fill={entry._isFilled ? 'rgba(var(--primary-blue-rgb), 0.35)' : 'var(--primary-blue)'} />
                      ))}
                    </Bar>
                  </BarChart>
                  )}
               </ResponsiveContainer>
            </div>
         </div>

         {/* Category Breakdown */}
         <div className="card glass" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Top Categories</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sales_by_category.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-light)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `GH₵${v >= 1000 ? `${Math.round(v/1000)}k` : v}`} />
                  <YAxis type="category" dataKey="category" width={95} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(str) => String(str).length > 13 ? `${String(str).slice(0, 13)}...` : str} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}
                    formatter={(value) => [`GH₵ ${Number(value || 0).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
                    {data.sales_by_category.slice(0, 5).map((_, index) => (
                      <Cell key={`cat-cell-${index}`} fill={index === 0 ? 'var(--primary-blue)' : index === 1 ? 'var(--accent-blue)' : index === 2 ? '#8b5cf6' : index === 3 ? '#16a34a' : '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Transaction & Refunds Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
         <section>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>Recent Order Inflow</h3>
            <div className="card glass" style={{ padding: '0', overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                     <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '16px' }}>Order ID</th>
                        <th style={{ padding: '16px' }}>Customer</th>
                        <th style={{ padding: '16px' }}>Total Amount</th>
                        <th style={{ padding: '16px' }}>Type</th>
                        <th style={{ padding: '16px' }}>Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {data.recent_activity.map(order => (
                        <tr key={order.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                           <td style={{ padding: '16px', fontWeight: 700 }}>#ORD-{order.id}</td>
                           <td style={{ padding: '16px' }}>{order.customer_name || 'Walk-in'}</td>
                           <td style={{ padding: '16px', fontWeight: 800 }}>GH₵ {Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                           <td style={{ padding: '16px' }}>
                              <span style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }} className={order.order_type === 'pos' ? 'text-warning' : 'text-primary'}>
                                 {order.order_type || 'online'}
                              </span>
                           </td>
                           <td style={{ padding: '16px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', background: order.status === 'completed' || order.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: order.status === 'completed' || order.status === 'delivered' ? '#10b981' : '#f59e0b' }}>{order.status}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </section>

         <section>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#ef4444' }}>Recent Refund Outflow</h3>
            <div className="card glass" style={{ padding: '0', overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                     <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '16px' }}>Refund ID</th>
                        <th style={{ padding: '16px' }}>Order</th>
                        <th style={{ padding: '16px' }}>Amount</th>
                        <th style={{ padding: '16px' }}>Method</th>
                        <th style={{ padding: '16px' }}>Approved By</th>
                        <th style={{ padding: '16px' }}>Status</th>
                     </tr>
                  </thead>
                  <tbody>
                     {(!data.recent_refunds || data.recent_refunds.length === 0) ? (
                        <tr>
                           <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No recent refund logs found.</td>
                        </tr>
                     ) : (
                        data.recent_refunds.map(refund => (
                           <tr key={refund.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                              <td style={{ padding: '16px', fontWeight: 700 }}>#REF-{refund.id}</td>
                              <td style={{ padding: '16px', fontWeight: 600 }}>#ORD-{refund.order_id}</td>
                              <td style={{ padding: '16px', fontWeight: 800, color: '#ef4444' }}>GH₵ {Number(refund.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ padding: '16px', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>{refund.method}</td>
                              <td style={{ padding: '16px' }}>{refund.approved_by_name || 'System'}</td>
                              <td style={{ padding: '16px' }}>
                                 <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px', background: refund.status === 'processed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: refund.status === 'processed' ? '#10b981' : '#ef4444' }}>{refund.status}</span>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </section>
      </div>
    </div>
  );
}
