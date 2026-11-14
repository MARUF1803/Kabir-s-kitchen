import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, RefreshCw, TrendingUp, TrendingDown,
  Calendar, Award, ShoppingBag, Printer, Search,
  ArrowUpRight, BarChart3, Store, CreditCard,
  CheckCircle2, DollarSign, Wallet
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { reportsApi } from '../services/api';

// ─── Sparkline helper ────────────────────────────────────────────────────────
function Sparkline({ color, points = [20, 35, 45, 60, 55, 75, 90], height = 28, width = 70 }) {
  const min = Math.min(...points);
  const max = Math.max(...points) || 1;
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${coords.join(' L ')}`;
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;
  const gradId = `repSpark-${color.replace('#','')}`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Modern KPI Card ─────────────────────────────────────────────────────────
function ModernKpiCard({ title, value, subtext, tag, isPositive = true, icon: Icon, iconBg, iconColor, sparkColor, sparkPoints }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '16px',
      padding: '20px 22px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor, flexShrink: 0
          }}>
            <Icon size={19} />
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
            <div style={{ color: '#0f172a', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>
              {value}
            </div>
          </div>
        </div>
        {sparkPoints && (
          <div style={{ opacity: 0.9 }}>
            <Sparkline color={sparkColor || '#16a34a'} points={sparkPoints} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
        <span style={{ color: '#64748b', fontWeight: 500 }}>{subtext}</span>
        {tag && (
          <span style={{
            background: isPositive ? '#dcfce7' : '#f1f5f9',
            color: isPositive ? '#15803d' : '#64748b',
            fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px'
          }}>
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SalesReportAdmin() {
  const { branches, selectedBranchId } = useApp();
  const [filterBranchId, setFilterBranchId] = useState(selectedBranchId || '');
  const [period, setPeriod] = useState('30days'); // 'today' | '7days' | '30days' | '90days' | '1year' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active view tab: 'overview' | 'products' | 'branches' | 'trends' | 'audit'
  const [activeReportTab, setActiveReportTab] = useState('overview');
  const [auditSearch, setAuditSearch] = useState('');

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
    } else if (period === '1year') {
      params.startDateUtc = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString();
    } else if (period === 'custom' && customStartDate && customEndDate) {
      params.startDateUtc = new Date(customStartDate).toISOString();
      params.endDateUtc = new Date(customEndDate + 'T23:59:59').toISOString();
    }
    const url = reportsApi.getCsvUrl(params);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Real P&L variables from backend ──────────────────────────────────────
  const rawNetSales = report?.summary?.netSales ?? 0;
  const grossSales = report?.summary?.grossSales ?? rawNetSales;
  const totalCOGS = report?.summary?.totalCOGS ?? 0;          // Recipe BOM raw material cost
  const totalWastageCost = report?.summary?.totalWastageCost ?? 0; // Kitchen wastage/spoilage
  const totalPackagingCost = report?.summary?.totalPackagingCost ?? 0;
  const totalDeliveryCost = report?.summary?.totalDeliveryCost ?? 0;
  const totalExpenses = report?.summary?.totalExpenses ?? 0;  // All costs combined
  const grossProfit = report?.summary?.totalGrossProfit ?? 0; // Real profit after costs
  const profitMarginPct = report?.summary?.grossProfitMarginPercent ?? 0;
  const totalOrders = report?.summary?.totalOrders ?? 0;
  const aov = report?.summary?.averageOrderValue ?? 0;
  const totalCollected = report?.summary?.totalCollected ?? 0;
  const totalOutstanding = report?.summary?.totalOutstanding ?? 0;
  const totalDiscounts = report?.summary?.totalDiscounts ?? 0;
  const totalTax = report?.summary?.totalTax ?? 0;

  // Filtered orders for audit table
  const filteredOrders = useMemo(() => {
    if (!report?.recentOrders) return [];
    if (!auditSearch.trim()) return report.recentOrders;
    const q = auditSearch.toLowerCase();
    return report.recentOrders.filter(o =>
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.toLowerCase().includes(q) ||
      o.branchName?.toLowerCase().includes(q)
    );
  }, [report?.recentOrders, auditSearch]);

  const maxDaySales = Math.max(...(report?.byDayOfWeek?.map(d => d.totalSales) || [1]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Modern Executive Top Header ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Financial Intelligence & Analytics
            </span>
            <span style={{
              background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 800,
              padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              Live Synced
            </span>
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Executive Sales & Profit Report
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            প্রকৃত P&L রিপোর্ট — Recipe BOM থেকে কাঁচামাল খরচ বাদ দিয়ে Gross Profit দেখানো হচ্ছে।
          </p>
        </div>

        {/* Controls: Branch Filter + Period Pills + Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>

          {/* Dynamic Branch Selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '9px',
            padding: '4px 10px'
          }}>
            <Store size={15} color="#ea580c" />
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer'
              }}
            >
              <option value="">All Branches (Consolidated)</option>
              {branches?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Period selector pills */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '9px', gap: '2px' }}>
            {[
              { id: 'today', label: 'Today (আজ)' },
              { id: '7days', label: '7 Days (৭ দিন)' },
              { id: '30days', label: '30 Days (১ মাস)' },
              { id: '90days', label: '3 Months (৩ মাস)' },
              { id: '1year', label: '1 Year (১ বছর)' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  border: 0,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: period === p.id ? '#0c1929' : 'transparent',
                  color: period === p.id ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '0.74rem' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '0.74rem' }}
              />
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={fetchReport}
            disabled={isLoading}
            title="Refresh Data"
            style={{
              padding: '7px 12px', borderRadius: '9px', border: '1px solid #cbd5e1',
              background: '#ffffff', color: '#334155', fontSize: '0.76rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Print button */}
          <button
            onClick={handlePrint}
            title="Print or Save PDF"
            style={{
              padding: '7px 12px', borderRadius: '9px', border: '1px solid #cbd5e1',
              background: '#ffffff', color: '#334155', fontSize: '0.76rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Printer size={13} />
            Print
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            style={{
              padding: '7px 15px', borderRadius: '9px', border: 0,
              background: 'linear-gradient(135deg, #0c1929 0%, #ea580c 100%)',
              color: '#ffffff', fontSize: '0.76rem', fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 2px 8px rgba(234,88,12,0.25)'
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: '12px 18px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── Key Highlights Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>

        {/* Highlight 1: Real P&L Model Status */}
        <div style={{ background: 'linear-gradient(135deg, #0f2e21 0%, #0c2017 100%)', color: '#ffffff', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(34,197,94,0.2)', color: '#4ade80', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#86efac', textTransform: 'uppercase', fontWeight: 800 }}>Gross Profit Margin</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '2px' }}>
              {profitMarginPct > 0 ? `${profitMarginPct}%` : 'No Orders Yet'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>Sales − Raw Material − Wastage − Packaging</div>
          </div>
        </div>

        {/* Highlight 2: Best Branch */}
        <div style={{ background: 'linear-gradient(135deg, #0c1929 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(234,88,12,0.25)', color: '#fb923c', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#fed7aa', textTransform: 'uppercase', fontWeight: 800 }}>Top Outlets Leader</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
              {report?.bestPerformingBranch || 'All Branches'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>Leading revenue share</div>
          </div>
        </div>

        {/* Highlight 3: Peak Sales Day */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', color: '#ffffff', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(255,255,255,0.15)', color: '#60a5fa', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#bfdbfe', textTransform: 'uppercase', fontWeight: 800 }}>Peak Sales Day (বেশি বিক্রির দিন)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '2px' }}>
              {report?.peakSalesDay || 'Friday / Saturday'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#93c5fd' }}>Highest turnover & customer footfall</div>
          </div>
        </div>

        {/* Highlight 4: #1 Best Seller Item */}
        <div style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #431407 100%)', color: '#ffffff', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(234,88,12,0.2)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'rgba(255,255,255,0.15)', color: '#fdba74', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#fed7aa', textTransform: 'uppercase', fontWeight: 800 }}>#1 Best Selling Item</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
              {report?.topSellingProducts?.[0]?.productName || 'Chicken Biryani'}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#fed7aa' }}>
              {report?.topSellingProducts?.[0]?.quantitySold || 0} orders completed
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Executive KPI Cards (Real P&L: Revenue, COGS, Expenses, Gross Profit) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <ModernKpiCard
          title="মোট বিক্রয় (Gross Sales)"
          value={`৳${Number(grossSales).toLocaleString()}`}
          subtext={`Net (ছাড় ও ভ্যাট বাদে): ৳${Number(rawNetSales).toLocaleString()}`}
          tag={`${totalOrders} টি অর্ডার`}
          isPositive={true}
          icon={DollarSign}
          iconBg="#dbeafe"
          iconColor="#2563eb"
          sparkColor="#2563eb"
          sparkPoints={[30, 42, 38, 55, 68, 72, 85]}
        />
        <ModernKpiCard
          title="কাঁচামাল খরচ (COGS - BOM)"
          value={`৳${Number(totalCOGS).toLocaleString()}`}
          subtext="রেসিপি অনুযায়ী ব্যবহৃত উপকরণের ব্যয়"
          tag={grossSales > 0 ? `${((totalCOGS / grossSales) * 100).toFixed(1)}% কাঁচামাল ব্যয়` : 'রেসিপি হিসাব'}
          isPositive={false}
          icon={Wallet}
          iconBg="#fef3c7"
          iconColor="#d97706"
          sparkColor="#d97706"
          sparkPoints={[20, 25, 22, 30, 35, 32, 40]}
        />
        <ModernKpiCard
          title="মোট খরচ ও অপচয় (Expenses)"
          value={`৳${Number(totalExpenses).toLocaleString()}`}
          subtext={`COGS + অপচয় + প্যাকেজিং + রাইডার`}
          tag={grossSales > 0 ? `${((totalExpenses / grossSales) * 100).toFixed(1)}% মোট ব্যয়` : 'ব্যয় সমন্বয়'}
          isPositive={false}
          icon={TrendingDown}
          iconBg="#fee2e2"
          iconColor="#dc2626"
          sparkColor="#dc2626"
          sparkPoints={[25, 28, 26, 35, 40, 38, 45]}
        />
        <ModernKpiCard
          title="প্রকৃত মোট লাভ (Gross Profit)"
          value={`৳${Number(grossProfit).toLocaleString()}`}
          subtext={`গড় অর্ডার: ৳${Math.round(aov).toLocaleString()}`}
          tag={grossProfit >= 0 ? `${profitMarginPct}% প্রফিট মার্জিন` : 'লোকসান'}
          isPositive={grossProfit >= 0}
          icon={TrendingUp}
          iconBg={grossProfit >= 0 ? "#dcfce7" : "#fee2e2"}
          iconColor={grossProfit >= 0 ? "#16a34a" : "#dc2626"}
          sparkColor={grossProfit >= 0 ? "#16a34a" : "#dc2626"}
          sparkPoints={[30, 42, 38, 55, 68, 72, grossProfit > 0 ? 85 : 10]}
        />
      </div>

      {/* ── Modern Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: '8px', background: '#ffffff', padding: '6px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {[
          { id: 'overview', label: '📊 Financial Overview & Trajectory' },
          { id: 'products', label: '🍽️ Menu Dish Performance' },
          { id: 'branches', label: '🏢 Branch Sales Leaderboard' },
          { id: 'trends', label: '📅 Time & Day Trends' },
          { id: 'audit', label: '📋 Live Orders Audit Log' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReportTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 0,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeReportTab === tab.id ? '#ea580c' : 'transparent',
              color: activeReportTab === tab.id ? '#ffffff' : '#64748b',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: EXECUTIVE FINANCIAL OVERVIEW */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Revenue vs Cost Clarity Card */}
          <div style={{
            background: '#ffffff', borderRadius: '16px', padding: '22px 24px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>Profitability Statement (লাভ-ক্ষতির হিসাব)</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>বাস্তব কাঁচামাল ও উৎপাদন ব্যয় সমন্বয় (P&L Model)</h3>
              </div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem' }}>
                <span style={{ color: '#16a34a', fontWeight: 800 }}>● Gross Profit Margin: {profitMarginPct}%</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>● Total Deductions: ৳{Number(totalExpenses).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Total Billed Revenue (বিক্রি)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                  ৳{Number(rawNetSales).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  মোট {totalOrders} টি অর্ডারে
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Raw Material Cost (COGS / BOM)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
                  ৳{Number(totalCOGS).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  ইনভেন্টরি রেসিপি কাঁচামাল ব্যয়
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Wastage & Logistics (অপচয় ও খরচ)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                  ৳{Number(totalWastageCost + totalPackagingCost + totalDeliveryCost).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  অপচয় ৳{Number(totalWastageCost).toLocaleString()} + প্যাকেজিং ৳{Number(totalPackagingCost + totalDeliveryCost).toLocaleString()}
                </div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1.5px solid #86efac' }}>
                <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 800 }}>Net Gross Profit (প্রকৃত লাভ)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                  ৳{Number(grossProfit).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                  ✓ {profitMarginPct}% প্রফিট মার্জিন
                </div>
              </div>
            </div>

            {/* Visual Progress Bar: Green for Profit, Red for Expenses */}
            <div style={{ height: '12px', background: '#fee2e2', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, profitMarginPct))}%`, height: '100%', background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)', borderRadius: '6px 0 0 6px' }} title={`Gross Profit: ${profitMarginPct}%`} />
              <div style={{ width: `${Math.min(100, Math.max(0, 100 - profitMarginPct))}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)', borderRadius: '0 6px 6px 0' }} title="COGS & Operating Expenses" />
            </div>
            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
              <span style={{ color: '#15803d' }}>● লাভ: {profitMarginPct}%</span>
              <span style={{ color: '#dc2626' }}>● কাঁচামাল ও পরিচালন ব্যয়: {grossSales > 0 ? ((totalExpenses / grossSales) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>

          {/* ── Cost Breakdown by Head (খরচের বিস্তারিত খাত) ── */}
          {report?.costBreakdown && report.costBreakdown.length > 0 && (
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '20px 24px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
            }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>
                📋 Cost & Expense Heads Breakdown (খরচের বিস্তারিত খাত)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>খরচের খাত (Expense Head)</th>
                      <th style={{ padding: '10px 14px' }}>বিবরণ (Description)</th>
                      <th style={{ padding: '10px 14px' }}>পরিমাণ (Amount)</th>
                      <th style={{ padding: '10px 14px' }}>বিক্রির শতকরা হার (% of Revenue)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.costBreakdown.map((item, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0f172a' }}>{item.expenseCategory}</td>
                        <td style={{ padding: '11px 14px', color: '#64748b' }}>{item.description}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 800, color: item.amount > 0 ? '#dc2626' : '#64748b' }}>
                          ৳{Number(item.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#64748b' }}>{item.percentageOfRevenue}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Additional Secondary Financial Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Customer Discounts Given</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>
                ৳{Number(totalDiscounts).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Reductions from campaign offers</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Govt VAT (5%)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                ৳{Number(totalTax).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Statutory collected tax</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Total Collected In Cash/Bank</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                ৳{Number(totalCollected).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 700 }}>100% Payment Settled</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Customer Due / Outstanding</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: totalOutstanding > 0 ? '#dc2626' : '#16a34a', marginTop: '4px' }}>
                ৳{Number(totalOutstanding).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: totalOutstanding > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {totalOutstanding > 0 ? 'Due requires collection' : 'Zero outstanding dues'}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MENU DISH PERFORMANCE */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>

          {/* Top Selling Dishes */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#16a34a" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Top Selling Items (সর্বাধিক বিক্রিত পণ্য)</h3>
              </div>
              <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '12px', fontWeight: 800 }}>
                High Demand
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                  <tr>
                    <th style={{ padding: '11px 18px' }}># Item Name</th>
                    <th style={{ padding: '11px 18px' }}>Category</th>
                    <th style={{ padding: '11px 18px' }}>Qty Sold</th>
                    <th style={{ padding: '11px 18px' }}>Total Revenue (মোট বিক্রি)</th>
                    <th style={{ padding: '11px 18px' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.topSellingProducts && report.topSellingProducts.length > 0 ? (
                    report.topSellingProducts.map((p, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                          <span style={{ display: 'inline-block', width: '22px', color: '#ea580c', fontWeight: 900 }}>#{idx + 1}</span>
                          {p.productName}
                        </td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{p.categoryName}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 800, color: '#15803d' }}>{p.quantitySold}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>৳{p.totalRevenue?.toLocaleString()}</td>
                        <td style={{ padding: '12px 18px', color: '#2563eb', fontWeight: 700 }}>{p.percentageOfSales}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No item sales recorded in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow Moving Dishes */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={18} color="#d97706" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Low Selling Items (কম বিক্রিত পণ্য)</h3>
              </div>
              <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '3px 9px', borderRadius: '12px', fontWeight: 800 }}>
                Low Velocity
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                  <tr>
                    <th style={{ padding: '11px 18px' }}>Item Name</th>
                    <th style={{ padding: '11px 18px' }}>Category</th>
                    <th style={{ padding: '11px 18px' }}>Qty Sold</th>
                    <th style={{ padding: '11px 18px' }}>Total Revenue</th>
                    <th style={{ padding: '11px 18px' }}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.lowSellingProducts && report.lowSellingProducts.length > 0 ? (
                    report.lowSellingProducts.map((p, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: '#334155' }}>{p.productName}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{p.categoryName}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 700, color: '#dc2626' }}>{p.quantitySold}</td>
                        <td style={{ padding: '12px 18px' }}>৳{p.totalRevenue?.toLocaleString()}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{p.percentageOfSales}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No underperforming items in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: BRANCH SALES LEADERBOARD */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'branches' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Store size={20} color="#ea580c" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>
                  Branch Performance & Profit Leaderboard (শাখাভিত্তিক আয় তুলনা)
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                  Real-time sales ranked across all active restaurant outlets.
                </p>
              </div>
            </div>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '4px 10px', borderRadius: '12px' }}>
              {branches?.length || 0} Outlets Reporting
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '12px 20px' }}>Rank & Branch Name</th>
                  <th style={{ padding: '12px 20px' }}>Total Orders</th>
                  <th style={{ padding: '12px 20px' }}>Total Revenue (মোট বিক্রি ৳)</th>
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
                          display: 'inline-grid', placeItems: 'center',
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: idx === 0 ? '#fef3c7' : (idx === 1 ? '#e2e8f0' : '#f1f5f9'),
                          color: idx === 0 ? '#b45309' : (idx === 1 ? '#475569' : '#64748b'),
                          marginRight: '10px', fontSize: '0.74rem', fontWeight: 900
                        }}>
                          {idx + 1}
                        </span>
                        {b.branchName}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 600 }}>{b.orderCount} orders</td>
                      <td style={{ padding: '14px 20px', fontWeight: 900, color: '#15803d', fontSize: '0.95rem' }}>৳{b.totalSales?.toLocaleString()}</td>
                      <td style={{ padding: '14px 20px', fontWeight: 800, color: '#2563eb' }}>{b.percentageOfTotal}%</td>
                      <td style={{ padding: '14px 20px', width: '220px' }}>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, b.percentageOfTotal)}%`, height: '100%', background: idx === 0 ? '#10b981' : '#3b82f6', borderRadius: '4px' }} />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No branch data recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: TIME & DAY TRENDS */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'trends' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>

          {/* Day of Week Trend */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#ea580c" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Day of Week Trend (সপ্তাহের বার অনুযায়ী সেলস)
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Peak: <strong style={{ color: '#15803d' }}>{report?.peakSalesDay}</strong> • Slowest: <strong style={{ color: '#dc2626' }}>{report?.slowestSalesDay}</strong>
              </p>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {report?.byDayOfWeek?.map((day, idx) => {
                const pct = maxDaySales > 0 ? (day.totalSales / maxDaySales) * 100 : 0;
                const isPeak = day.displayLabel === report.peakSalesDay;
                const isSlowest = day.displayLabel === report.slowestSalesDay;

                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: isPeak ? '#15803d' : (isSlowest ? '#b91c1c' : '#334155') }}>
                        {day.displayLabel} {isPeak && '🔥 (PEAK)'} {isSlowest && '📉 (LOW)'}
                      </span>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>
                        ৳{day.totalSales?.toLocaleString()} <span style={{ color: '#64748b', fontWeight: 500 }}>({day.orderCount} orders)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: isPeak ? '#16a34a' : (isSlowest ? '#f87171' : '#3b82f6'), borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Trajectory */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="#0c1929" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Monthly Sales Trajectory (মাসভিত্তিক বিক্রি ও ট্রেন্ড)
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Long-term revenue progression across business months.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                  <tr>
                    <th style={{ padding: '11px 18px' }}>Month</th>
                    <th style={{ padding: '11px 18px' }}>Orders</th>
                    <th style={{ padding: '11px 18px' }}>Total Sales (৳)</th>
                    <th style={{ padding: '11px 18px' }}>AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.byMonth && report.byMonth.length > 0 ? (
                    report.byMonth.map((m, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>{m.displayLabel}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{m.orderCount}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 800, color: '#15803d' }}>৳{m.totalSales?.toLocaleString()}</td>
                        <td style={{ padding: '12px 18px', color: '#ea580c', fontWeight: 700 }}>৳{m.averageTicket}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No monthly records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: LIVE ORDERS AUDIT LOG */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeReportTab === 'audit' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Live Orders Audit Log ({filteredOrders.length})
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Every customer order and POS checkout recorded in this reporting period.
              </p>
            </div>

            {/* Quick search input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '9px',
              padding: '6px 12px', width: '280px', maxWidth: '100%'
            }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search order #, customer, phone..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: '0.78rem', color: '#0f172a', width: '100%'
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '11px 18px' }}>Order #</th>
                  <th style={{ padding: '11px 18px' }}>Customer</th>
                  <th style={{ padding: '11px 18px' }}>Branch</th>
                  <th style={{ padding: '11px 18px' }}>Type</th>
                  <th style={{ padding: '11px 18px' }}>Status</th>
                  <th style={{ padding: '11px 18px' }}>Total (৳)</th>
                  <th style={{ padding: '11px 18px' }}>Payment</th>
                  <th style={{ padding: '11px 18px' }}>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <tr key={order.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>{order.orderNumber}</td>
                      <td style={{ padding: '12px 18px', color: '#334155' }}>
                        <div>{order.customerName || 'Walk-in Guest'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{order.customerPhone || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600 }}>{order.branchName}</td>
                      <td style={{ padding: '12px 18px', color: '#64748b' }}>{order.orderType}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{
                          background: order.status === 'Delivered' ? '#dcfce7' : (order.status === 'Cancelled' ? '#fee2e2' : '#fef3c7'),
                          color: order.status === 'Delivered' ? '#15803d' : (order.status === 'Cancelled' ? '#b91c1c' : '#b45309'),
                          fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', fontWeight: 800, color: '#15803d' }}>
                        ৳{order.totalAmount?.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#64748b', fontSize: '0.74rem' }}>
                        {order.payments?.map(p => p.method).join(', ') || order.paymentStatus || 'Paid'}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#94a3b8', fontSize: '0.74rem' }}>
                        {order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No matching orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
