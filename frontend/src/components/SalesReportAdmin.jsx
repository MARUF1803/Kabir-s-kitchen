import { useState, useEffect, useCallback } from 'react';
import {
  Download, RefreshCw, Users, PieChart,
  CreditCard, AlertCircle, TrendingUp, TrendingDown,
  Calendar, DollarSign, Store, Award, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Layers, ShoppingBag
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { reportsApi } from '../services/api';

export default function SalesReportAdmin() {
  const { branches, selectedBranchId } = useApp();
  const [filterBranchId, setFilterBranchId] = useState(selectedBranchId || '');
  const [period, setPeriod] = useState('30days'); // 'today' | '7days' | '30days' | '90days' | '180days' | '1year' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active view tab inside Reports: 'overview' | 'products' | 'branches' | 'trends' | 'expenses'
  const [activeReportTab, setActiveReportTab] = useState('overview');

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      let fromUtc = null;
      let toUtc = null;

      if (period === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        fromUtc = start.toISOString();
      } else if (period === '7days') {
        const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === '30days') {
        const start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === '90days') {
        const start = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === '180days') {
        const start = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === '1year') {
        const start = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === 'custom' && customStartDate && customEndDate) {
        fromUtc = new Date(customStartDate).toISOString();
        toUtc = new Date(customEndDate + 'T23:59:59').toISOString();
      }

      const params = {};
      if (filterBranchId) params.branchId = filterBranchId;
      if (fromUtc) params.startDateUtc = fromUtc;
      if (toUtc) params.endDateUtc = toUtc;

      const data = await reportsApi.getSales(params);
      setReport(data);
      setError(null);
    } catch (requestError) {
      console.error('Unable to load sales report.', requestError);
      setError('Live backend report unavailable. Check API connection.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId, period, customStartDate, customEndDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRefresh = () => {
    fetchReport();
  };

  const handleExportCsv = () => {
    const params = {};
    if (filterBranchId) params.branchId = filterBranchId;
    const now = new Date();
    if (period === 'today') {
      params.startDateUtc = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === '7days') {
      params.startDateUtc = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === '30days') {
      params.startDateUtc = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === '90days') {
      params.startDateUtc = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === '180days') {
      params.startDateUtc = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === '1year') {
      params.startDateUtc = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === 'custom' && customStartDate && customEndDate) {
      params.startDateUtc = new Date(customStartDate).toISOString();
      params.endDateUtc = new Date(customEndDate + 'T23:59:59').toISOString();
    }
    const url = reportsApi.getCsvUrl(params);
    window.open(url, '_blank');
  };

  const summary = report?.summary || {
    grossSales: 0,
    totalDiscounts: 0,
    totalTax: 0,
    netSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalCOGS: 0,
    totalWastageCost: 0,
    totalPackagingCost: 0,
    totalDeliveryCost: 0,
    totalExpenses: 0,
    totalGrossProfit: 0,
    grossProfitMarginPercent: 0
  };

  const maxDaySales = Math.max(...(report?.byDayOfWeek?.map(d => d.totalSales) || [1]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Bar Controls ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Enterprise Financial Intelligence & P&L Analytics
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Executive Sales, Cost & Profit Dashboard
          </h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Branch filter */}
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1.5px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#f8fafc',
              color: '#1e293b'
            }}
          >
            <option value="">All 100 Branches (Consolidated)</option>
            {branches?.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Period selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: 8, flexWrap: 'wrap', gap: 2 }}>
            {[
              { id: 'today', label: 'Today (দৈনিক)' },
              { id: '7days', label: '7 Days (সাপ্তাহিক)' },
              { id: '30days', label: '30 Days (১ মাস)' },
              { id: '90days', label: '3 Months (৩ মাস)' },
              { id: '180days', label: '6 Months (৬ মাস)' },
              { id: '1year', label: '1 Year (বাৎসরিক)' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 0,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: period === p.id ? '#0c251c' : 'transparent',
                  color: period === p.id ? '#fff' : '#64748b'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 0,
              background: 'linear-gradient(135deg, #0c251c 0%, #ea580c 100%)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(234,88,12,0.2)'
            }}
          >
            <Download size={15} />
            Export Audit CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Highlight Banner: Best/Worst Insights ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0c251c 0%, #153c2e 100%)', color: '#fff', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,175,55,0.2)', color: '#d4af37', display: 'grid', placeItems: 'center' }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#c7d9d0', textTransform: 'uppercase', fontWeight: 700 }}>Top Performing Branch</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 2 }}>{report?.bestPerformingBranch || 'N/A'}</div>
            <div style={{ fontSize: '0.7rem', color: '#34d399' }}>Highest revenue contribution</div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', color: '#fff', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: '#60a5fa', display: 'grid', placeItems: 'center' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#bfdbfe', textTransform: 'uppercase', fontWeight: 700 }}>Peak Sales Day (বেশি বিক্রির দিন)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 2 }}>{report?.peakSalesDay || 'N/A'}</div>
            <div style={{ fontSize: '0.7rem', color: '#93c5fd' }}>Highest footfall and turnover</div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #831843 0%, #500724 100%)', color: '#fff', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: '#f472b6', display: 'grid', placeItems: 'center' }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#fbcfe8', textTransform: 'uppercase', fontWeight: 700 }}>Slowest Day (কম বিক্রির দিন)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 2 }}>{report?.slowestSalesDay || 'N/A'}</div>
            <div style={{ fontSize: '0.7rem', color: '#f472b6' }}>Opportunity for mid-week promo</div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #9a3412 0%, #7c2d12 100%)', color: '#fff', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: '#fdba74', display: 'grid', placeItems: 'center' }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#fed7aa', textTransform: 'uppercase', fontWeight: 700 }}>#1 Best Seller Item</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
              {report?.topSellingProducts?.[0]?.productName || 'N/A'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#fed7aa' }}>
              {report?.topSellingProducts?.[0]?.quantitySold || 0} units sold
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 8, background: '#fff', padding: '8px 12px', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Executive P&L Overview' },
          { id: 'products', label: 'Product Sales (বেশি ও কম বিক্রিত)' },
          { id: 'branches', label: 'Branch Comparison (কোন ব্রাঞ্চে বেশি সেল)' },
          { id: 'trends', label: 'Time Trends (মাস ও দিন ভিত্তিক)' },
          { id: 'expenses', label: 'Expense & Cost Breakdown (কোন খাতে কত খরচ)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReportTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 0,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeReportTab === tab.id ? '#ea580c' : 'transparent',
              color: activeReportTab === tab.id ? '#fff' : '#475569',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: EXECUTIVE P&L OVERVIEW ── */}
      {activeReportTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Revenue & Profit Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Revenue (মোট বিক্রয়)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                ৳{summary.grossSales.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>Across {summary.totalOrders} total orders</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Food BOM Cost (COGS)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>
                ৳{summary.totalCOGS.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Raw materials consumed</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kitchen Wastage & Loss</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', margin: '4px 0' }}>
                ৳{summary.totalWastageCost.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>Spoiled & expired stock</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Operating Expenses</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b91c1c', margin: '4px 0' }}>
                ৳{summary.totalExpenses.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>BOM + Wastage + Logistics</div>
            </div>

            <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Gross Profit (প্রকৃত লাভ)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#166534', margin: '4px 0' }}>
                ৳{summary.totalGrossProfit.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 800 }}>
                Margin: {summary.grossProfitMarginPercent}% of Revenue
              </div>
            </div>
          </div>

          {/* Secondary Financial Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Net Billed Sales</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>৳{summary.netSales.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Discounts Allowed</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>-৳{summary.totalDiscounts.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Govt VAT (5%)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7', marginTop: 4 }}>৳{summary.totalTax.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Average Order Value (AOV)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ea580c', marginTop: 4 }}>৳{summary.averageOrderValue.toFixed(1)}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Collected vs Due</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: summary.totalOutstanding > 0 ? '#b45309' : '#15803d', marginTop: 4 }}>
                ৳{summary.totalCollected.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: summary.totalOutstanding > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                {summary.totalOutstanding > 0 ? `৳${summary.totalOutstanding.toLocaleString()} Due` : '100% Collected'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PRODUCT SALES INTELLIGENCE (বেশি ও কম বিক্রিত) ── */}
      {activeReportTab === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
          {/* Top Selling Products */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#16a34a" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Top 10 Best Selling Items (সর্বাধিক বিক্রিত পণ্য)</h3>
              </div>
              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>High Demand</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '10px 16px' }}># Item Name</th>
                  <th style={{ padding: '10px 16px' }}>Category</th>
                  <th style={{ padding: '10px 16px' }}>Qty Sold</th>
                  <th style={{ padding: '10px 16px' }}>Total Revenue</th>
                  <th style={{ padding: '10px 16px' }}>% Share</th>
                </tr>
              </thead>
              <tbody>
                {report?.topSellingProducts && report.topSellingProducts.length > 0 ? (
                  report.topSellingProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ display: 'inline-block', width: 20, color: '#ea580c', fontWeight: 800 }}>#{idx + 1}</span> {p.productName}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b' }}>{p.categoryName}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 800, color: '#047857' }}>{p.quantitySold}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700 }}>৳{p.totalRevenue.toLocaleString()}</td>
                      <td style={{ padding: '11px 16px', color: '#2563eb', fontWeight: 700 }}>{p.percentageOfSales}%</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No item data available</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Low Selling Products (Underperforming) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#d97706" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Slow Moving Items (কম বিক্রিত পণ্য — নজর দেওয়া প্রয়োজন)</h3>
              </div>
              <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>Low Velocity</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '10px 16px' }}>Item Name</th>
                  <th style={{ padding: '10px 16px' }}>Category</th>
                  <th style={{ padding: '10px 16px' }}>Qty Sold</th>
                  <th style={{ padding: '10px 16px' }}>Total Revenue</th>
                  <th style={{ padding: '10px 16px' }}>% Share</th>
                </tr>
              </thead>
              <tbody>
                {report?.lowSellingProducts && report.lowSellingProducts.length > 0 ? (
                  report.lowSellingProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#334155' }}>{p.productName}</td>
                      <td style={{ padding: '11px 16px', color: '#64748b' }}>{p.categoryName}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#dc2626' }}>{p.quantitySold}</td>
                      <td style={{ padding: '11px 16px' }}>৳{p.totalRevenue.toLocaleString()}</td>
                      <td style={{ padding: '11px 16px', color: '#64748b' }}>{p.percentageOfSales}%</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No underperforming item data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: BRANCH COMPARISON (কোন ব্রাঞ্চে বেশি সেল) ── */}
      {activeReportTab === 'branches' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={20} color="#ea580c" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>
                  Branch Performance & Sales Leaderboard (শাখাভিত্তিক আয় তুলনা)
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Ranked by total revenue across all operating outlets.
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d' }}>
              {report?.byBranch?.length || 0} Outlets Reporting
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '12px 20px' }}>Rank & Branch Name</th>
                <th style={{ padding: '12px 20px' }}>Total Orders</th>
                <th style={{ padding: '12px 20px' }}>Gross Revenue (৳)</th>
                <th style={{ padding: '12px 20px' }}>Share of Enterprise Sales</th>
                <th style={{ padding: '12px 20px' }}>Visual Share</th>
              </tr>
            </thead>
            <tbody>
              {report?.byBranch && report.byBranch.length > 0 ? (
                report.byBranch.map((b, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a' }}>
                      <span style={{
                        display: 'inline-grid',
                        placeItems: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: idx === 0 ? '#fef3c7' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#ffedd5' : '#f1f5f9')),
                        color: idx === 0 ? '#b45309' : (idx === 1 ? '#475569' : (idx === 2 ? '#c2410c' : '#64748b')),
                        marginRight: 10,
                        fontSize: '0.75rem',
                        fontWeight: 900
                      }}>
                        {idx + 1}
                      </span>
                      {b.branchName}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 600 }}>{b.orderCount} orders</td>
                    <td style={{ padding: '14px 20px', fontWeight: 900, color: '#0c251c', fontSize: '0.95rem' }}>৳{b.totalSales.toLocaleString()}</td>
                    <td style={{ padding: '14px 20px', fontWeight: 800, color: '#2563eb' }}>{b.percentageOfTotal}%</td>
                    <td style={{ padding: '14px 20px', width: '220px' }}>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, b.percentageOfTotal)}%`, height: '100%', background: idx === 0 ? '#10b981' : '#3b82f6', borderRadius: '4px' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No branch data recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 4: TIME TRENDS (মাস ও দিন ভিত্তিক সেলস) ── */}
      {activeReportTab === 'trends' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Day of Week Analysis (কোন বারে বেশি সেল, কোন বারে কম সেল) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="#ea580c" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Day of Week Trend (সপ্তাহের বার অনুযায়ী সেলস)
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Peak: <strong style={{ color: '#15803d' }}>{report?.peakSalesDay}</strong> • Slowest: <strong style={{ color: '#dc2626' }}>{report?.slowestSalesDay}</strong>
              </p>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {report?.byDayOfWeek?.map((day, idx) => {
                const pct = maxDaySales > 0 ? (day.totalSales / maxDaySales) * 100 : 0;
                const isPeak = day.displayLabel === report.peakSalesDay;
                const isSlowest = day.displayLabel === report.slowestSalesDay;

                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: isPeak ? '#15803d' : (isSlowest ? '#b91c1c' : '#334155') }}>
                        {day.displayLabel} {isPeak && '🔥 (PEAK)'} {isSlowest && '📉 (LOW)'}
                      </span>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>
                        ৳{day.totalSales.toLocaleString()} <span style={{ color: '#64748b', fontWeight: 500 }}>({day.orderCount} orders)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isPeak ? '#16a34a' : (isSlowest ? '#f87171' : '#3b82f6'), borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Trend (কোন মাসে বেশি সেল) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#0c251c" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Monthly Sales Trajectory (মাসভিত্তিক বিক্রি ও ট্রেন্ড)
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Long-term revenue trajectory across months.
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '10px 16px' }}>Month</th>
                  <th style={{ padding: '10px 16px' }}>Orders</th>
                  <th style={{ padding: '10px 16px' }}>Total Sales (৳)</th>
                  <th style={{ padding: '10px 16px' }}>AOV</th>
                </tr>
              </thead>
              <tbody>
                {report?.byMonth && report.byMonth.length > 0 ? (
                  report.byMonth.map((m, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>{m.displayLabel}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{m.orderCount}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0c251c' }}>৳{m.totalSales.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', color: '#ea580c', fontWeight: 700 }}>৳{m.averageTicket}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No monthly records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: EXPENSE & COST BREAKDOWN (কোন খাতে কত খরচ) ── */}
      {activeReportTab === 'expenses' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={20} color="#dc2626" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>
                  Itemized Cost Breakdown & Expense Heads (কোন খাতে কত খরচ)
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Comprehensive breakdown of ingredients, kitchen wastage loss, logistics, and deductions.
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Operational Cost:</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#b91c1c' }}>
                ৳{summary.totalExpenses.toLocaleString()}
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
              <tr>
                <th style={{ padding: '12px 20px' }}>Expense Head / Sector</th>
                <th style={{ padding: '12px 20px' }}>Description</th>
                <th style={{ padding: '12px 20px' }}>Total Amount (৳)</th>
                <th style={{ padding: '12px 20px' }}>% of Gross Revenue</th>
              </tr>
            </thead>
            <tbody>
              {report?.costBreakdown?.map((cost, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a' }}>{cost.expenseCategory}</td>
                  <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.8rem' }}>{cost.description}</td>
                  <td style={{ padding: '14px 20px', fontWeight: 900, color: '#991b1b', fontSize: '0.92rem' }}>
                    ৳{cost.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: '#334155' }}>
                    {cost.percentageOfRevenue}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
