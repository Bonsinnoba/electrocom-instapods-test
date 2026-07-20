import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardRevenueCharts({
  filteredRevenueChart,
  chartRange,
  setChartRange,
  chartMode,
  setChartMode,
  formatChartTick,
}) {
  return (
    <div className="card glass" style={{ gridColumn: 'span 2', padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Economic Velocity</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Revenue trends across selected period</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[7, 30, 90, 365].map((days) => (
            <button
              key={days}
              type="button"
              className={`btn ${chartRange === days ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 10px', fontSize: '11px' }}
              onClick={() => setChartRange(days)}
            >
              {days === 365 ? '1y' : `${days}d`}
            </button>
          ))}
          <button
            type="button"
            className={`btn ${chartMode === 'area' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 10px', fontSize: '11px' }}
            onClick={() => setChartMode('area')}
          >
            Area
          </button>
          <button
            type="button"
            className={`btn ${chartMode === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 10px', fontSize: '11px' }}
            onClick={() => setChartMode('bar')}
          >
            Bar
          </button>
        </div>
      </div>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'area' ? (
            <AreaChart data={filteredRevenueChart}>
              <defs>
                <linearGradient id="onlineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-gold)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={formatChartTick}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={(v) => `GH₵${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  color: 'var(--text-main)',
                }}
                formatter={(value, name, ctx) => {
                  const baseLabel = name === 'online_revenue' ? 'Online' : 'POS';
                  return [`GH₵ ${Number(value || 0).toLocaleString()}`, ctx?.payload?._isFilled ? `${baseLabel} (auto-filled)` : baseLabel];
                }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return Number.isNaN(d.getTime()) ? label : d.toLocaleDateString();
                }}
              />
              <Area type="monotone" dataKey="online_revenue" stroke="var(--accent-blue)" strokeWidth={2.5} fill="url(#onlineFill)" />
              <Area type="monotone" dataKey="pos_revenue" stroke="var(--accent-gold)" strokeWidth={2.5} fill="url(#posFill)" />
            </AreaChart>
          ) : (
            <BarChart data={filteredRevenueChart}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={formatChartTick}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={(v) => `GH₵${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  color: 'var(--text-main)',
                }}
                formatter={(value, name, ctx) => {
                  const baseLabel = name === 'online_revenue' ? 'Online' : 'POS';
                  return [`GH₵ ${Number(value || 0).toLocaleString()}`, ctx?.payload?._isFilled ? `${baseLabel} (auto-filled)` : baseLabel];
                }}
              />
              <Bar dataKey="online_revenue" fill="var(--accent-blue)" radius={[6, 6, 0, 0]} barSize={10} maxBarSize={12}>
                {filteredRevenueChart.map((entry, idx) => (
                  <Cell key={`online-cell-${idx}`} fill={entry._isFilled ? 'rgba(var(--accent-blue-rgb), 0.35)' : 'var(--accent-blue)'} />
                ))}
              </Bar>
              <Bar dataKey="pos_revenue" fill="var(--accent-gold)" radius={[6, 6, 0, 0]} barSize={10} maxBarSize={12}>
                {filteredRevenueChart.map((entry, idx) => (
                  <Cell key={`pos-cell-${idx}`} fill={entry._isFilled ? 'rgba(251, 191, 36, 0.35)' : 'var(--accent-gold)'} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
