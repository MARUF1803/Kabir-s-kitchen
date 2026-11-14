import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, ShoppingCart, ChefHat, Truck, Package,
  Boxes, ClipboardList, Warehouse,
  Users, Settings, TrendingUp, Bell,
  Search, LogOut, ArrowLeft, ChevronDown, ChevronRight, ChevronLeft,
  CircleDollarSign, AlertTriangle, PlusCircle, Download,
  ShoppingBag, X, PackagePlus, ShieldCheck,
  ArrowUpRight, ArrowDownRight, BarChart2, Menu,
  Cake, Calendar, DollarSign, MapPin,
  Tag, CreditCard, Flame
} from 'lucide-react';
import { useApp } from '../context/useApp';
import HeroBannerAdmin from '../components/HeroBannerAdmin';
import ProductAdmin from '../components/ProductAdmin';
import CampaignManagementAdmin from '../components/CampaignManagementAdmin';
import SalesReportAdmin from '../components/SalesReportAdmin';
import ProcurementAdmin from '../components/ProcurementAdmin';
import SupportAdmin from '../components/SupportAdmin';
import InventoryErpAdmin from '../components/InventoryErpAdmin';
import ReservationAdmin from '../components/ReservationAdmin';
import CashShiftAdmin from '../components/CashShiftAdmin';
import CakeOrdersAdmin from '../components/CakeOrdersAdmin';
import { usersApi, reportsApi, inventoryAdjustApi, inventoryApi, ordersApi } from '../services/api';

// ─── Sidebar Navigation Structure ───────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'OPERATIONS',
    items: [
      { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'POS',       icon: ShoppingCart,   label: 'POS & Sales', action: 'pos' },
      { id: 'Orders',    icon: ClipboardList,  label: 'Orders Management' },
      { id: 'KDS',       icon: ChefHat,        label: 'Kitchen Display (KDS)', action: 'kds' },
      { id: 'Cake Bookings', icon: Cake,       label: 'Cake Bookings' },
      { id: 'Cash Shifts',   icon: CreditCard, label: 'Cash Shifts' },
      { id: 'Reservations',  icon: Calendar,   label: 'Reservations' },
    ]
  },
  {
    label: 'INVENTORY & SUPPLY CHAIN',
    items: [
      { id: 'Products',    icon: Package,     label: 'Products & Menu' },
      { id: 'Inventory',   icon: Boxes,       label: 'Inventory & Stock' },
      { id: 'Production ERP', icon: Warehouse, label: 'Production ERP' },
      { id: 'Procurement', icon: Truck,       label: 'Purchase & Procurement' },
    ]
  },
  {
    label: 'FINANCE & BUSINESS',
    items: [
      { id: 'Promotions',  icon: Tag,         label: 'Pricing & Promotions' },
      { id: 'Campaigns',   icon: Flame,       label: 'Hero Campaigns' },
      { id: 'Reports',     icon: BarChart2,   label: 'Reports & Analytics' },
    ]
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { id: 'Staff',       icon: Users,       label: 'Staff & Attendance' },
      { id: 'Support',     icon: ShieldCheck, label: 'Support & Chat' },
      { id: 'Settings',    icon: Settings,    label: 'System Settings' },
    ]
  }
];

const STATUS_COLORS = {
  Confirmed:      { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  Preparing:      { bg: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  Ready:          { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
  OutForDelivery: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  Delivered:      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  Pending:        { bg: 'rgba(234,197,55,0.15)', color: '#fbbf24' },
  Cancelled:      { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
};

// ─── KPI Mini Sparkline (pure CSS approximation) ─────────────────────────────
function MiniSparkline({ color, up }) {
  const id = `spark-${Math.random().toString(36).slice(2,7)}`;
  const h = 36, w = 80;
  const pts = up
    ? [0,28, 10,24, 20,26, 30,18, 40,20, 50,14, 60,16, 70,8, 80,4]
    : [0,8,  10,12, 20,10, 30,18, 40,16, 50,22, 60,20, 70,26, 80,30];
  const path = pts.reduce((acc, v, i) => i % 2 === 0 ? `${acc}${i===0?'M':'L'}${v},` : `${acc}${v} `, '').trim();
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L80,${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, change, changeUp, color, sparkColor }) {
  const isUp = changeUp !== false;
  return (
    <div style={{
      background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${color}22`, borderRadius: 10, padding: 8, display: 'flex' }}>
              {icon}
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>{label}</span>
          </div>
          <div style={{ color: '#f1f5f9', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
        </div>
        <div style={{ opacity: 0.8 }}>
          <MiniSparkline color={sparkColor || color} up={isUp} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 20,
          background: isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: isUp ? '#4ade80' : '#f87171', fontSize: '0.72rem', fontWeight: 700
        }}>
          {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change}
        </span>
        <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{sub}</span>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

// ─── Order Status Donut ───────────────────────────────────────────────────────
function OrderDonut({ orders }) {
  const counts = useMemo(() => {
    const map = {};
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return map;
  }, [orders]);

  const total = orders.length || 1;
  const segments = [
    { key: 'Pending',   color: '#fbbf24', label: 'Pending' },
    { key: 'Preparing', color: '#fb923c', label: 'Preparing' },
    { key: 'Ready',     color: '#4ade80', label: 'Ready' },
    { key: 'Delivered', color: '#60a5fa', label: 'Delivered' },
    { key: 'Cancelled', color: '#f87171', label: 'Cancelled' },
  ].map(s => ({ ...s, count: counts[s.key] || 0, pct: ((counts[s.key] || 0) / total) * 100 }));

  let cumulativeAngle = -90;
  const r = 50, cx = 60, cy = 60;
  const arc = (pct, startAngle) => {
    if (pct <= 0) return null;
    const angle = (pct / 100) * 360;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${cx + r * Math.cos(startRad)} ${cy + r * Math.sin(startRad)} A ${r} ${r} 0 ${largeArc} 1 ${cx + r * Math.cos(endRad)} ${cy + r * Math.sin(endRad)} Z`;
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {segments.map(seg => {
          const path = arc(seg.pct, cumulativeAngle);
          cumulativeAngle += (seg.pct / 100) * 360;
          return path ? <path key={seg.key} d={path} fill={seg.color} /> : null;
        })}
        <circle cx={cx} cy={cy} r={34} fill="#1e2a3a" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="800">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="8">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.filter(s => s.count > 0).map(seg => (
          <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: '0.73rem' }}>{seg.label}</span>
            <span style={{ color: '#e2e8f0', fontSize: '0.73rem', fontWeight: 700, marginLeft: 'auto' }}>
              {seg.count} ({Math.round(seg.pct)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Branch Performance Bar ───────────────────────────────────────────────────
function BranchBar({ name, revenue, pct, rank }) {
  const colors = ['#f97316', '#22c55e', '#3b82f6'];
  const c = colors[rank] || '#94a3b8';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${c}22`, color: c, fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank + 1}</span>
          <span style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600 }}>{name}</span>
        </div>
        <span style={{ color: '#f1f5f9', fontSize: '0.78rem', fontWeight: 800 }}>৳{revenue.toLocaleString()}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${c}, ${c}99)`, borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

// ─── Bangladesh Map placeholder (SVG) ────────────────────────────────────────
function BangladeshMap({ branches }) {
  // Approximate branch city positions on a 200x240 bounding box
  const cityCoords = {
    'Dhaka Main Branch': { x: 100, y: 110 },
    'Dhanmondi': { x: 97, y: 113 },
    'Khulna Branch': { x: 70, y: 160 },
    'Khulna': { x: 70, y: 160 },
    'Barisal Branch': { x: 110, y: 170 },
    'Barisal': { x: 110, y: 170 },
    'Chittagong': { x: 160, y: 165 },
    'Sylhet': { x: 165, y: 90 },
  };
  const getCoord = (name) => {
    for (const [key, val] of Object.entries(cityCoords)) {
      if (name?.toLowerCase().includes(key.toLowerCase())) return val;
    }
    return { x: 100 + Math.random() * 40 - 20, y: 120 + Math.random() * 40 - 20 };
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 240" style={{ width: '100%', maxWidth: 180, opacity: 0.6 }}>
        {/* Simplified Bangladesh outline */}
        <path d="M80,20 L130,15 L170,30 L185,55 L180,80 L175,110 L185,135 L175,160 L160,185 L140,205 L115,220 L90,215 L70,200 L55,180 L45,155 L50,130 L40,105 L45,80 L60,55 L70,35 Z"
          fill="none" stroke="#334155" strokeWidth="1.5" />
        {/* Grid lines */}
        <line x1="40" y1="80" x2="185" y2="80" stroke="#1e2a3a" strokeWidth="0.5" />
        <line x1="40" y1="130" x2="185" y2="130" stroke="#1e2a3a" strokeWidth="0.5" />
        <line x1="40" y1="180" x2="185" y2="180" stroke="#1e2a3a" strokeWidth="0.5" />
      </svg>
      {/* Branch pins */}
      {(branches || []).slice(0, 5).map((br, i) => {
        const coord = getCoord(br.name);
        const colors = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#06b6d4'];
        return (
          <div key={br.id} style={{
            position: 'absolute',
            left: `${(coord.x / 200) * 100}%`,
            top: `${(coord.y / 240) * 100}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 2
          }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i] || '#f97316', boxShadow: `0 0 0 3px ${colors[i] || '#f97316'}33` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Dashboard Panel ─────────────────────────────────────────────────────
function DashboardPanel({ activeBranch, branches, liveReport, orders, inventory: _inventory, lowStock, onNavigate, authUser }) {
  const todaySales = liveReport?.summary?.netSales ?? null;
  const totalOrders = liveReport?.summary?.totalOrders ?? null;
  const grossProfit = liveReport?.summary?.totalGrossProfit ?? null;
  const pendingCount = orders.filter(o => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Confirmed').length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const topProducts = useMemo(() => {
    const map = {};
    orders.forEach(o => o.items?.forEach(item => {
      map[item.menuItemName || item.name] = (map[item.menuItemName || item.name] || 0) + (item.quantity || 1);
    }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [orders]);

  const recentTxns = useMemo(() => orders.slice(0, 5), [orders]);

  const branchPerf = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const name = o.branchName || activeBranch?.name || 'Main Branch';
      map[name] = (map[name] || 0) + (o.totalAmount || 0);
    });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] || 1;
    return entries.map(([name, rev]) => ({ name, revenue: rev, pct: (rev / max) * 100 }));
  }, [orders, activeBranch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Welcome Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a2f 0%, #0f2318 50%, #1a1f2e 100%)',
        borderRadius: 16, padding: '24px 28px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        border: '1px solid rgba(249,115,22,0.2)', position: 'relative', overflow: 'hidden', minHeight: 110
      }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.3))', zIndex: 1 }} />
        <div style={{ zIndex: 2 }}>
          <div style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
            {greeting}, {authUser?.fullName?.split(' ')[0] || 'Admin'}! 👋
          </div>
          <div style={{ color: '#f1f5f9', fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>
            Here's what's happening at Kabir's Kitchen today.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(249,115,22,0.3)' }}>
              📍 {activeBranch?.name || 'All Branches'} · Active
            </span>
            {(branches || []).length > 0 && (
              <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.25)' }}>
                🏪 {branches.length} Branches
              </span>
            )}
          </div>
        </div>
        <div style={{
          position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: 12, padding: '10px 18px', zIndex: 2, textAlign: 'center'
        }}>
          <div style={{ color: '#fb923c', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Good Food</div>
          <div style={{ color: '#fbbf24', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Good Mood</div>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KpiCard
          icon={<CircleDollarSign size={18} color="#f97316" />}
          label="Today's Revenue"
          value={todaySales == null ? '—' : `৳${Number(todaySales).toLocaleString()}`}
          change={liveReport ? '+12.5%' : 'N/A'}
          sub="vs yesterday"
          changeUp={true}
          color="#f97316"
        />
        <KpiCard
          icon={<ShoppingBag size={18} color="#22c55e" />}
          label="Total Orders"
          value={totalOrders ?? orders.length ?? '—'}
          change={orders.length > 0 ? '+8.7%' : 'N/A'}
          sub="vs yesterday"
          changeUp={true}
          color="#22c55e"
        />
        <KpiCard
          icon={<TrendingUp size={18} color="#a855f7" />}
          label="Gross Profit"
          value={grossProfit == null ? '—' : `৳${Number(grossProfit).toLocaleString()}`}
          change={grossProfit ? '+15.2%' : 'N/A'}
          sub="vs yesterday"
          changeUp={true}
          color="#a855f7"
        />
        <KpiCard
          icon={<AlertTriangle size={18} color="#f59e0b" />}
          label="Pending Orders"
          value={pendingCount}
          change={pendingCount > 10 ? '+5.3%' : '-5.3%'}
          sub="vs yesterday"
          changeUp={pendingCount <= 10}
          color="#f59e0b"
        />
      </div>

      {/* ── Row 2: Sales Overview + Branch Performance + Map ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr', gap: 16 }}>

        {/* Sales Overview */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Live Performance</div>
              <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800 }}>Sales Overview</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['7D','30D','90D','1Y'].map(p => (
                <button key={p} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: p==='7D' ? '#f97316' : 'transparent', color: p==='7D' ? '#fff' : '#94a3b8', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>{p}</button>
              ))}
            </div>
          </div>
          {/* Bar chart from DailyTimeline data */}
          {liveReport?.dailyTimeline?.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {liveReport.dailyTimeline.slice(-7).map((d, i) => {
                const max = Math.max(...liveReport.dailyTimeline.map(x => x.totalSales || 0)) || 1;
                const pct = ((d.totalSales || 0) / max) * 100;
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: 'linear-gradient(180deg, #f97316, #f97316aa)', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} />
                    <span style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 600 }}>{days[new Date(d.periodKey || '').getDay?.()] || d.displayLabel?.slice(0,3) || `D${i+1}`}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Demo bars */}
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => {
                const heights = [45, 60, 52, 75, 68, 90, 55];
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#475569', fontSize: '0.65rem', width: 24 }}>{day}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${heights[i]}%`, height: '100%', background: 'linear-gradient(90deg, #f97316, #fbbf24)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
              <p style={{ color: '#475569', fontSize: '0.68rem', textAlign: 'center', margin: 0 }}>Showing demo — load full report for live chart</p>
            </div>
          )}
        </div>

        {/* Branch Performance */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>By Location</div>
          <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800, marginBottom: 16 }}>Branch Performance</div>
          {branchPerf.length > 0 ? (
            branchPerf.slice(0, 3).map((b, i) => (
              <BranchBar key={b.name} name={b.name} revenue={b.revenue} pct={b.pct} rank={i} />
            ))
          ) : (
            (branches || []).slice(0, 3).map((br, i) => (
              <BranchBar key={br.id} name={br.name} revenue={0} pct={0} rank={i} />
            ))
          )}
        </div>

        {/* Bangladesh Map */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Coverage</div>
          <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800, marginBottom: 12 }}>Branch Map</div>
          <BangladeshMap branches={branches || []} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{(branches || []).length} Active</span>
          </div>
        </div>
      </div>

      {/* ── Row 3: Order Status + Top Dishes + Low Stock + Transactions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>

        {/* Order Status Donut */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Live</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800 }}>Order Status</div>
            </div>
            <button onClick={() => onNavigate('Orders')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer' }}>View All →</button>
          </div>
          <OrderDonut orders={orders} />
        </div>

        {/* Top Selling Dishes */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Best</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800 }}>Top Selling</div>
            </div>
            <button onClick={() => onNavigate('Products')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer' }}>View All →</button>
          </div>
          {topProducts.length > 0 ? topProducts.map(([name, qty]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🍽️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{qty} orders</div>
              </div>
            </div>
          )) : (
            [['Chicken Burger', '742'], ['Chicken Biryani', '628'], ['Pizza Special', '521']].map(([name, qty]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🍔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>{name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{qty} orders</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Low Stock Alerts */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#ef4444', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>⚠ Alert</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800 }}>Low Stock</div>
            </div>
            <button onClick={() => onNavigate('Inventory')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer' }}>View All →</button>
          </div>
          {lowStock.length > 0 ? lowStock.slice(0, 4).map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: '#f87171', fontSize: '0.68rem', fontWeight: 600 }}>Only {item.onHand} {item.unit} left</div>
              </div>
            </div>
          )) : (
            <div style={{ color: '#4ade80', textAlign: 'center', paddingTop: 20 }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>All Stock Healthy</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem' }}>No alerts at this time</div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Recent</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800 }}>Transactions</div>
            </div>
            <button onClick={() => onNavigate('Orders')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: '0.68rem', cursor: 'pointer' }}>View All →</button>
          </div>
          {recentTxns.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={14} color="#4ade80" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 700 }}>#{o.orderNumber}</div>
                <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                  {new Date(o.createdAtUtc || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 800 }}>৳{(o.totalAmount || 0).toLocaleString()}</span>
            </div>
          ))}
          {recentTxns.length === 0 && <p style={{ color: '#475569', fontSize: '0.75rem', textAlign: 'center', marginTop: 20 }}>No transactions yet today</p>}
        </div>
      </div>

      {/* ── Row 4: Revenue vs Expenses + Quick Actions + Special Offer ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr', gap: 16 }}>

        {/* Revenue vs Expenses */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Financial</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800 }}>Revenue vs Expenses</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: '0.68rem' }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: '#22c55e' }} /> Revenue
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: '0.68rem' }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: '#f97316' }} /> Expenses
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', alignItems: 'center' }}>
            {[
              { label: 'Total Revenue', val: liveReport?.summary?.grossSales, color: '#22c55e', icon: '📈' },
              { label: 'Total Expenses', val: liveReport?.summary?.totalExpenses, color: '#f97316', icon: '📉' },
              { label: 'Net Profit', val: liveReport?.summary?.totalGrossProfit, color: '#a855f7', icon: '💰' },
            ].map(item => (
              <div key={item.label} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{item.icon}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{item.label}</span>
                </div>
                <div style={{ color: item.color, fontSize: '0.9rem', fontWeight: 800, textAlign: 'right' }}>
                  {item.val == null ? '—' : `৳${Number(item.val).toLocaleString()}`}
                </div>
              </div>
            ))}
          </div>
          {/* Mini area chart */}
          <div style={{ marginTop: 16, height: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.68rem' }}>
            Area chart loads from full Reports module
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Shortcuts</div>
          <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800, marginBottom: 14 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'New Sale (POS)', icon: <ShoppingCart size={20} />, color: '#22c55e', id: 'pos' },
              { label: 'Add Purchase', icon: <PackagePlus size={20} />, color: '#3b82f6', id: 'Procurement' },
              { label: 'Create Offer', icon: <Tag size={20} />, color: '#a855f7', id: 'Promotions' },
              { label: 'Add Expense', icon: <DollarSign size={20} />, color: '#f59e0b', id: 'Reports' },
              { label: 'Stock Transfer', icon: <Boxes size={20} />, color: '#06b6d4', id: 'Inventory' },
              { label: 'View Reports', icon: <BarChart2 size={20} />, color: '#f97316', id: 'Reports' },
            ].map(a => (
              <button key={a.label} onClick={() => onNavigate(a.id)} style={{
                background: `${a.color}10`, border: `1px solid ${a.color}25`, borderRadius: 10,
                padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, cursor: 'pointer', transition: 'all 0.2s'
              }}>
                <div style={{ color: a.color }}>{a.icon}</div>
                <span style={{ color: '#e2e8f0', fontSize: '0.65rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Special Offers */}
        <div style={{ background: 'linear-gradient(135deg, #1a2335 0%, #0f1c14 100%)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 16, padding: 20 }}>
          <div style={{ color: '#fbbf24', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>⚡ Live Campaign</div>
          <div style={{ color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 800, marginBottom: 10 }}>Special Offer</div>
          <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: '12px', marginBottom: 12, textAlign: 'center' }}>
            <div style={{ color: '#fbbf24', fontSize: '1.3rem', fontWeight: 900 }}>Get 20% OFF</div>
            <div style={{ color: '#fb923c', fontSize: '0.75rem', fontWeight: 700 }}>on all Biryani! 🍛</div>
          </div>
          <button onClick={() => onNavigate('Promotions')} style={{ width: '100%', background: '#f97316', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
            Create Campaign →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AdminPage Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { activeBranch, branches, authUser, signOut, setCurrentMode } = useApp();
  const activeBranchId = activeBranch?.id;

  const [tab, setTab] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const [liveReport, setLiveReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [ordersError, setOrdersError] = useState('');

  const [staffList, setStaffList] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Cashier', branchId: activeBranch?.id || '' });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ ingredientId: '', qty: '', unitCost: '', remarks: '' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const adjustableInventory = useMemo(() => inventory.filter(item => !item.isCatalogStock), [inventory]);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeBranch?.id) return undefined;
    let mounted = true;
    const fetchReport = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const data = await reportsApi.getSales({ branchId: activeBranch.id, startDateUtc: today.toISOString() });
        if (mounted && data) setLiveReport(data);
      } catch { /* silent – dashboard shows — */ }
    };
    fetchReport();
    return () => { mounted = false; };
  }, [activeBranch?.id]);

  const loadOrders = useCallback(async () => {
    try {
      const result = await ordersApi.list(activeBranchId ? { branchId: activeBranchId } : {});
      if (!Array.isArray(result)) throw new Error('Invalid order data');
      setOrders(result.map(o => ({
        ...o,
        createdAt: o.createdAtUtc ? new Date(o.createdAtUtc).toLocaleString() : '—',
        paymentMethod: o.payments?.map(p => p.method).filter(Boolean).join(', ') || 'Unpaid'
      })));
      setOrdersError('');
    } catch (e) {
      setOrders([]);
      setOrdersError(e.response?.data?.message || e.message || 'Orders unavailable');
    }
  }, [activeBranchId]);

  const loadInventory = useCallback(async () => {
    if (!activeBranchId) { setInventory([]); setInventoryLoaded(false); return; }
    setInventoryLoading(true);
    try {
      const result = await inventoryApi.list(activeBranchId);
      if (!Array.isArray(result)) throw new Error('Invalid stock data');
      setInventory(result.map(s => ({
        id: s.ingredientId, ingredientId: s.ingredientId, code: s.ingredientId,
        name: s.ingredientName, onHand: s.availableQuantity, minAlert: s.minimumAlertStock,
        unit: s.baseUnit, avgCost: s.movingAverageCost, isCatalogStock: false
      })));
      setInventoryError('');
      setInventoryLoaded(true);
    } catch (e) {
      setInventory([]); setInventoryError(e.response?.data?.message || e.message || 'Stock unavailable'); setInventoryLoaded(false);
    } finally { setInventoryLoading(false); }
  }, [activeBranchId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { if (tab === 'Dashboard' || tab === 'Inventory') loadInventory(); }, [tab, loadInventory]);

  const lowStock = useMemo(() => inventory.filter(i => !i.isCatalogStock && i.onHand <= i.minAlert), [inventory]);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const data = await usersApi.list(activeBranchId);
      if (!Array.isArray(data)) throw new Error('Invalid staff data');
      setStaffError('');
      setStaffList(data.map(u => ({ ...u, branchName: u.branchName || 'Not assigned' })));
    } catch (e) {
      setStaffList([]); setStaffError(e.response?.data?.message || e.message || 'Staff unavailable');
    } finally { setStaffLoading(false); }
  }, [activeBranchId]);

  useEffect(() => { if (tab === 'Staff') loadStaff(); }, [tab, loadStaff]);

  const handleToggleActive = async (id, currentActive) => {
    try { await usersApi.update(id, { isActive: !currentActive }); await loadStaff(); }
    catch (e) { setStaffError(e.response?.data?.message || 'Could not update account.'); }
  };
  const handleRoleChange = async (id, newRole) => {
    try { await usersApi.update(id, { role: newRole }); await loadStaff(); }
    catch (e) { setStaffError(e.response?.data?.message || 'Could not update role.'); }
  };
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.email.trim() || !newStaff.password.trim()) return;
    setStaffSaving(true); setStaffError('');
    try {
      await usersApi.create({ fullName: newStaff.name.trim(), email: newStaff.email.trim(), password: newStaff.password, role: newStaff.role, branchId: newStaff.branchId ? Number(newStaff.branchId) : null });
      await loadStaff();
      setNewStaff({ name: '', email: '', password: '', role: 'Cashier', branchId: activeBranch?.id || '' });
      setShowAddStaffModal(false);
    } catch (e) { setStaffError(e.response?.data?.message || 'Could not create account.'); }
    finally { setStaffSaving(false); }
  };
  const handleStockAdjust = async (e) => {
    e.preventDefault();
    if (!activeBranch?.id || !adjustForm.ingredientId || !adjustForm.qty || Number(adjustForm.qty) === 0) { setInventoryError('Select ingredient and enter non-zero qty.'); return; }
    setAdjustSaving(true); setInventoryError('');
    try {
      await inventoryAdjustApi.adjust({ branchId: activeBranch.id, ingredientId: Number(adjustForm.ingredientId), quantityChange: Number(adjustForm.qty), unitCost: adjustForm.unitCost ? Number(adjustForm.unitCost) : null, remarks: adjustForm.remarks || 'Manual stock adjustment', reference: 'MANUAL-ADJ' });
      setAdjustForm({ ingredientId: '', qty: '', unitCost: '', remarks: '' });
      setShowAdjustModal(false);
      await loadInventory();
    } catch (e) { setInventoryError(e.response?.data?.message || e.message || 'Adjustment failed.'); }
    finally { setAdjustSaving(false); }
  };
  const handleExportOrders = () => { const url = reportsApi.getCsvUrl(activeBranch?.id ? { branchId: activeBranch.id } : {}); window.open(url, '_blank'); };

  const displayName = authUser?.fullName || authUser?.email || 'Admin';
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const navigate = useCallback((target) => {
    if (target === 'pos') { setCurrentMode('pos'); return; }
    if (target === 'kds') { setCurrentMode('kds'); return; }
    setTab(target);
    setMobileOpen(false);
  }, [setCurrentMode]);

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <aside style={{
      width: sidebarOpen ? 240 : 64,
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0d1b2a 0%, #0a1520 100%)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s ease', overflow: 'hidden', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: 72 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f97316, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChefHat size={18} color="#fff" />
        </div>
        {sidebarOpen && (
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.9rem', fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>Kabir's Kitchen</div>
            <div style={{ color: '#f97316', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin ERP</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 16 }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {sidebarOpen && (
              <div style={{ padding: '12px 16px 4px', color: '#334155', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.action || item.id)}
                  title={!sidebarOpen ? item.label : undefined}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: sidebarOpen ? '10px 16px' : '10px 14px',
                    background: isActive ? 'linear-gradient(90deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))' : 'transparent',
                    border: 'none', borderLeft: isActive ? '3px solid #f97316' : '3px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    color: isActive ? '#fb923c' : '#94a3b8',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: 2
                  }}
                >
                  <item.icon size={18} style={{ flexShrink: 0 }} />
                  {sidebarOpen && (
                    <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom banner */}
      {sidebarOpen && (
        <div style={{ margin: '0 12px 12px', background: 'linear-gradient(135deg, #1a3a2a, #0f2318)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 12, padding: 14 }}>
          <div style={{ color: '#fbbf24', fontSize: '0.65rem', fontWeight: 800, marginBottom: 2 }}>🚀 Grow Bigger Together</div>
          <div style={{ color: '#64748b', fontSize: '0.6rem', marginBottom: 8 }}>100 Outlets Ready!</div>
          <button onClick={() => navigate('Settings')} style={{ width: '100%', background: '#f97316', border: 'none', borderRadius: 8, padding: '7px', color: '#fff', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
            Manage Branches →
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        style={{ padding: '14px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-end' : 'center', gap: 8 }}
      >
        {sidebarOpen ? <><span style={{ fontSize: '0.68rem', color: '#475569' }}>Collapse</span><ChevronLeft size={16} /></> : <ChevronRight size={16} />}
      </button>
    </aside>
  );

  const sidebarWidth = sidebarOpen ? 240 : 64;

  // ── Topbar ─────────────────────────────────────────────────────────────────
  const renderTopbar = () => (
    <header style={{
      position: 'fixed', top: 0, right: 0, left: sidebarWidth,
      height: 64, background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', paddingInline: 20, gap: 16, zIndex: 90,
      transition: 'left 0.25s ease'
    }}>
      {/* Mobile burger */}
      <button onClick={() => setMobileOpen(o => !o)} style={{ display: 'none', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
        <Menu size={22} />
      </button>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px' }}>
        <Search size={16} color="#475569" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search orders, products, customers… (Ctrl+K)"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '0.82rem', flex: 1 }}
        />
      </div>

      {/* Branch selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px' }}>
        <MapPin size={15} color="#f97316" />
        <span style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{activeBranch?.name || 'All Branches'}</span>
        <ChevronDown size={14} color="#475569" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        {/* POS / KDS shortcuts */}
        <button onClick={() => setCurrentMode('kds')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChefHat size={14} /> KDS
        </button>
        <button onClick={() => setCurrentMode('pos')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ShoppingCart size={14} /> POS
        </button>

        {/* Notifications */}
        <button onClick={() => setNotifOpen(o => !o)} style={{ position: 'relative', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', color: '#94a3b8', cursor: 'pointer' }}>
          <Bell size={16} />
          {lowStock.length > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          )}
        </button>

        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.72rem' }}>
            {initials}
          </div>
          <div style={{ display: 'none' }}>
            <div style={{ color: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700 }}>{displayName}</div>
            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{authUser?.role}</div>
          </div>
        </div>

        {/* Back to store */}
        <button onClick={() => setCurrentMode('customer')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', color: '#475569', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={13} /> Store
        </button>
        <button onClick={signOut} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '7px 12px', color: '#f87171', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <LogOut size={13} /> Out
        </button>
      </div>
    </header>
  );

  // ── Content router ─────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (tab) {
      case 'Dashboard':
        return <DashboardPanel activeBranch={activeBranch} branches={branches} liveReport={liveReport} orders={orders} inventory={inventory} lowStock={lowStock} onNavigate={navigate} authUser={authUser} />;
      case 'Orders':
        return (
          <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Order Management</div>
                <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800 }}>All Branch Orders ({orders.length})</div>
              </div>
              <button onClick={handleExportOrders} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            {ordersError && <p role="alert" style={{ padding: '12px 20px', color: '#f87171' }}>{ordersError}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Order #', 'Customer', 'Phone', 'Type', 'Status', 'Payment', 'Total', 'Time'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 800, color: '#f1f5f9' }}>{o.orderNumber}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#e2e8f0' }}>{o.customerName}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>{o.customerPhone}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>{o.orderType}</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={o.status} /></td>
                      <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>{o.paymentMethod}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.8rem', fontWeight: 800, color: '#4ade80' }}>৳{o.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: '#475569' }}>{o.createdAt}</td>
                    </tr>
                  ))}
                  {!ordersError && orders.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#475569' }}>No orders to display.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'Cake Bookings':   return <CakeOrdersAdmin activeBranchId={activeBranchId} />;
      case 'Cash Shifts':     return <CashShiftAdmin activeBranchId={activeBranchId} />;
      case 'Reservations':    return <ReservationAdmin activeBranchId={activeBranchId} />;
      case 'Production ERP':  return <InventoryErpAdmin activeBranchId={activeBranchId} />;
      case 'Procurement':     return <ProcurementAdmin activeBranch={activeBranch} />;
      case 'Promotions':      return <CampaignManagementAdmin />;
      case 'Campaigns':       return <HeroBannerAdmin />;
      case 'Products':        return <ProductAdmin />;
      case 'Reports':         return <SalesReportAdmin />;
      case 'Support':         return <SupportAdmin />;
      case 'Inventory':
        return (
          <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Stock Control</div>
                <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800 }}>Branch Stock · {inventory.length} items</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {lowStock.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '7px 14px', borderRadius: 9, fontSize: '0.75rem', fontWeight: 700 }}>
                    <AlertTriangle size={14} /> {lowStock.length} low stock
                  </div>
                )}
                <button onClick={() => setShowAdjustModal(true)} style={{ background: '#f97316', border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PackagePlus size={14} /> Adjust Stock
                </button>
              </div>
            </div>
            {(inventoryError || inventoryLoading) && (
              <p role={inventoryError ? 'alert' : 'status'} style={{ padding: '12px 20px', color: inventoryError ? '#f87171' : '#94a3b8' }}>
                {inventoryError || 'Loading stock records…'}
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['ID', 'Ingredient', 'Available', 'Min Alert', 'Avg Cost', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const isLow = !item.isCatalogStock && item.onHand <= item.minAlert;
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: isLow ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', fontFamily: 'monospace' }}>{item.code}</td>
                        <td style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>{item.name}</td>
                        <td style={{ padding: '10px 16px', fontSize: '0.78rem', color: '#e2e8f0' }}>{item.isCatalogStock ? '—' : `${item.onHand} ${item.unit}`}</td>
                        <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#94a3b8' }}>{item.isCatalogStock ? '—' : `${item.minAlert} ${item.unit}`}</td>
                        <td style={{ padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0' }}>{item.isCatalogStock ? '—' : `৳${item.avgCost}/${item.unit}`}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: isLow ? '#f87171' : '#4ade80', fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                            {isLow ? '⚠ Low Stock' : '✓ Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!inventoryError && !inventoryLoading && inventory.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#475569' }}>No stock records for this branch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'Staff':
        return (
          <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Team & RBAC</div>
                <div style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 800 }}>Staff & Permissions</div>
              </div>
              <button onClick={() => setShowAddStaffModal(true)} style={{ background: '#f97316', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <PlusCircle size={15} /> Add Team Member
              </button>
            </div>
            <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: '#64748b' }}>
              <ShieldCheck size={16} style={{ color: '#f97316', flexShrink: 0 }} />
              Only authorized staff can access POS or KDS. Super Admins assign roles and branches below.
            </div>
            {staffError && <div role="alert" style={{ padding: '12px 20px', color: '#f87171', fontSize: '0.8rem' }}>{staffError}</div>}
            {staffLoading && <p role="status" style={{ padding: '12px 20px', color: '#94a3b8' }}>Loading staff…</p>}
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {staffList.map(staff => (
                <div key={staff.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                      {(staff.fullName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{staff.email}</div>
                    </div>
                    <button onClick={() => handleToggleActive(staff.id, staff.isActive ?? staff.active)} style={{ background: (staff.isActive ?? staff.active) ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', color: (staff.isActive ?? staff.active) ? '#4ade80' : '#64748b', border: '1px solid ' + ((staff.isActive ?? staff.active) ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.3)'), fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 12, cursor: 'pointer' }}>
                      {(staff.isActive ?? staff.active) ? '● Active' : '○ Disabled'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <small style={{ fontSize: '0.62rem', color: '#475569', display: 'block', marginBottom: 2, fontWeight: 600 }}>Role</small>
                      <select value={staff.role} onChange={e => handleRoleChange(staff.id, e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', fontWeight: 600, background: '#0d1b2a', color: '#e2e8f0' }}>
                        {['SuperAdmin', 'Admin', 'BranchManager', 'Cashier', 'Chef'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <small style={{ fontSize: '0.62rem', color: '#475569', display: 'block', marginBottom: 2, fontWeight: 600 }}>Branch</small>
                      <div style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.03)' }}>
                        {staff.branchName || 'All Branches'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!staffLoading && staffList.length === 0 && !staffError && (
                <p style={{ color: '#475569', padding: 16 }}>No staff found for this branch.</p>
              )}
            </div>
          </div>
        );
      case 'Settings':
        return (
          <div style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
            <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Admin</div>
            <div style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 800, marginBottom: 16 }}>System Settings</div>
            <p style={{ color: '#64748b' }}>System configuration panel coming soon. Use the branch selector above to switch locations.</p>
          </div>
        );
      default:
        return <div style={{ color: '#64748b', padding: 32 }}>Select a section from the sidebar.</div>;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      {renderSidebar()}

      {/* Main Area */}
      <div style={{ marginLeft: sidebarWidth, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'margin-left 0.25s ease' }}>
        {renderTopbar()}

        {/* Page content */}
        <main style={{ marginTop: 64, padding: '24px', minHeight: 'calc(100vh - 64px)', boxSizing: 'border-box' }}>
          {renderContent()}
        </main>
      </div>

      {/* ── Stock Adjust Modal ── */}
      {showAdjustModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#1e2a3a', borderRadius: 16, maxWidth: 400, width: '100%', padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>Manual Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            {inventoryError && <p role="alert" style={{ color: '#f87171', fontSize: '0.8rem' }}>{inventoryError}</p>}
            <form onSubmit={handleStockAdjust}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Ingredient</label>
                <select required value={adjustForm.ingredientId} onChange={e => setAdjustForm({ ...adjustForm, ingredientId: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0' }}>
                  <option value="">Select ingredient…</option>
                  {adjustableInventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Qty (+ add / - remove)</label>
                  <input type="number" step="0.01" required placeholder="e.g. 5.0 or -2.0" value={adjustForm.qty} onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Unit Cost (optional)</label>
                  <input type="number" step="0.01" min="0" placeholder="৳ per unit" value={adjustForm.unitCost} onChange={e => setAdjustForm({ ...adjustForm, unitCost: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Remarks</label>
                <input type="text" placeholder="e.g. Cycle count correction" value={adjustForm.remarks} onChange={e => setAdjustForm({ ...adjustForm, remarks: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAdjustModal(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={adjustSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>{adjustSaving ? 'Saving…' : 'Save Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showAddStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#1e2a3a', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>Add Team Member</h3>
              <button onClick={() => setShowAddStaffModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddStaff}>
              {staffError && <p role="alert" style={{ color: '#f87171', fontSize: '0.8rem' }}>{staffError}</p>}
              {[{ label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. Shakib Al Hasan' }, { label: 'Work Email', key: 'email', type: 'email', placeholder: 'staff@kabirskitchen.com' }, { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'Min 6 characters' }].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} required minLength={f.key === 'password' ? 6 : undefined} placeholder={f.placeholder} value={newStaff[f.key]} onChange={e => setNewStaff({ ...newStaff, [f.key]: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Role</label>
                  <select value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0' }}>
                    <option value="Cashier">Cashier (POS)</option><option value="Chef">Chef (KDS)</option><option value="BranchManager">Branch Manager</option><option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Branch</label>
                  <select value={newStaff.branchId} onChange={e => setNewStaff({ ...newStaff, branchId: Number(e.target.value) })} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem', background: '#0f172a', color: '#e2e8f0' }}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={staffSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>{staffSaving ? 'Creating…' : 'Create & Grant Access'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
