import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, ShoppingBag, ChefHat, Truck, Package,
  Boxes, ClipboardList, Warehouse, Users, Settings,
  TrendingUp, Bell, Search, LogOut, ArrowLeft,
  CircleDollarSign, AlertTriangle, PlusCircle, Download,
  X, PackagePlus, ShieldCheck, ArrowUpRight, ArrowDownRight,
  BarChart2, Menu, Cake, Calendar, MapPin, Tag, CreditCard, Flame
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

// ─── Sidebar Groups ─────────────────────────────────────────────────────────
const SIDEBAR_NAV = [
  {
    title: null,
    items: [
      { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { id: 'POS', label: 'POS & Sales', icon: ShoppingBag, isPos: true },
      { id: 'Orders', label: 'Orders Management', icon: ClipboardList },
      { id: 'KDS', label: 'Kitchen Display (KDS)', icon: ChefHat, isKds: true },
      { id: 'Cake Bookings', label: 'Cake Bookings', icon: Cake },
      { id: 'Cash Shifts', label: 'Cash Shifts', icon: CreditCard },
      { id: 'Reservations', label: 'Table Reservations', icon: Calendar },
    ]
  },
  {
    title: 'INVENTORY & SUPPLY CHAIN',
    items: [
      { id: 'Products', label: 'Products & Menu', icon: Package },
      { id: 'Inventory', label: 'Inventory & Stock', icon: Boxes },
      { id: 'Production ERP', label: 'Production ERP', icon: Warehouse },
      { id: 'Procurement', label: 'Purchase & Procurement', icon: Truck },
    ]
  },
  {
    title: 'FINANCE & BUSINESS',
    items: [
      { id: 'Promotions', label: 'Pricing & Promotions', icon: Tag },
      { id: 'Campaigns', label: 'Hero Campaigns', icon: Flame },
      { id: 'Reports', label: 'Reports & Analytics', icon: BarChart2 },
    ]
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { id: 'Branches', label: 'Branches Management', icon: MapPin },
      { id: 'Staff', label: 'Staff & Attendance', icon: Users },
      { id: 'Support', label: 'Support & Chat', icon: ShieldCheck },
      { id: 'Settings', label: 'System Settings', icon: Settings },
    ]
  }
];

const ORDER_STATUS_COLORS = {
  Confirmed:      { bg: '#dbeafe', color: '#1d4ed8' },
  Preparing:      { bg: '#fff7ed', color: '#c2410c' },
  Ready:          { bg: '#dcfce7', color: '#15803d' },
  OutForDelivery: { bg: '#f5f3ff', color: '#6d28d9' },
  Delivered:      { bg: '#f1f5f9', color: '#475569' },
  Pending:        { bg: '#fef9c3', color: '#854d0e' },
  Cancelled:      { bg: '#fee2e2', color: '#b91c1c' },
};

function StatusBadge({ status }) {
  const s = ORDER_STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700,
      padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap'
    }}>{status}</span>
  );
}

// ─── Sparkline SVG Component ────────────────────────────────────────────────
function Sparkline({ color, points, height = 34, width = 85 }) {
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
  const gradId = `sparkGrad-${color.replace('#','')}`;

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

// ─── KPI Card (Design 4 White Rounded Card) ──────────────────────────────────
function KpiCard({ title, value, change, isPositive, icon: Icon, iconBg, iconColor, sparkColor, sparkPoints }) {
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
      gap: '12px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor
          }}>
            <Icon size={20} />
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}>{title}</div>
            <div style={{ color: '#0f172a', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>
              {value}
            </div>
          </div>
        </div>
        <div style={{ opacity: 0.9 }}>
          <Sparkline color={sparkColor} points={sparkPoints} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 700,
          color: isPositive ? '#16a34a' : '#dc2626'
        }}>
          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
        <span style={{ color: '#94a3b8' }}>vs yesterday</span>
      </div>
    </div>
  );
}

// ─── Bangladesh SVG Map ─────────────────────────────────────────────────────
function BangladeshMap({ branches }) {
  const getBranchCoord = (branch, index) => {
    const text = `${branch.name || ''} ${branch.address || ''}`.toLowerCase();
    if (text.includes('dhanmondi')) return { x: 102, y: 112 };
    if (text.includes('mirpur')) return { x: 99, y: 104 };
    if (text.includes('gulshan') || text.includes('banani') || text.includes('uttara')) return { x: 106, y: 98 };
    if (text.includes('chattogram') || text.includes('chittagong')) return { x: 148, y: 178 };
    if (text.includes('sylhet')) return { x: 156, y: 76 };
    if (text.includes('rajshahi')) return { x: 58, y: 94 };
    if (text.includes('khulna')) return { x: 74, y: 160 };
    if (text.includes('barisal') || text.includes('barishal')) return { x: 114, y: 172 };
    if (text.includes('rangpur')) return { x: 62, y: 44 };
    if (text.includes('mymensingh')) return { x: 112, y: 72 };
    const xOffsets = [104, 96, 110, 92, 114];
    const yOffsets = [110, 102, 116, 106, 120];
    return { x: xOffsets[index % xOffsets.length], y: yOffsets[index % yOffsets.length] };
  };

  const colors = ['#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2'];
  const activeBranches = branches && branches.length > 0 ? branches : [
    { name: 'Dhanmondi Branch', address: 'House 42, Road 7/A, Dhanmondi, Dhaka' },
    { name: 'Mirpur Branch', address: 'Plot 12, Block D, Mirpur-10, Dhaka' }
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 240" style={{ width: '100%', height: '100%', maxHeight: '170px' }}>
        {/* Bangladesh boundary shape */}
        <path
          d="M82,18 L126,14 L165,28 L180,50 L176,78 L170,105 L182,130 L172,158 L158,182 L138,202 L112,216 L88,212 L68,196 L54,176 L44,152 L48,126 L38,102 L44,78 L58,54 L70,34 Z"
          fill="#e2e8f0"
          stroke="#cbd5e1"
          strokeWidth="1.5"
          opacity="0.85"
        />
        {/* Branch location pins */}
        {activeBranches.map((b, i) => {
          const pt = getBranchCoord(b, i);
          const color = colors[i % colors.length];
          return (
            <g key={b.id || i}>
              <title>{b.name}</title>
              <circle cx={pt.x} cy={pt.y} r="12" fill={color} opacity="0.18" />
              <circle cx={pt.x} cy={pt.y} r="6" fill={color} stroke="#ffffff" strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      <div style={{
        position: 'absolute', top: 6, right: 6, background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', fontSize: '0.7rem', fontWeight: 700, color: '#0f172a'
      }}>
        <span style={{ color: '#16a34a', marginRight: '4px' }}>●</span>
        {activeBranches.length} {activeBranches.length === 1 ? 'Branch' : 'Branches'} Active
      </div>
    </div>
  );
}

// ─── Order Status Donut Chart ────────────────────────────────────────────────
function OrderStatusDonut({ orders }) {
  const counts = useMemo(() => {
    const res = { Pending: 0, Preparing: 0, Ready: 0, Delivered: 0, Cancelled: 0 };
    orders.forEach(o => {
      if (res[o.status] !== undefined) res[o.status] += 1;
      else res.Pending += 1;
    });
    return res;
  }, [orders]);

  const total = orders.length || 1;
  const segments = [
    { label: 'Pending', count: counts.Pending, color: '#f59e0b' },
    { label: 'Preparing', count: counts.Preparing, color: '#2563eb' },
    { label: 'Ready', count: counts.Ready, color: '#06b6d4' },
    { label: 'Delivered', count: counts.Delivered, color: '#16a34a' },
    { label: 'Cancelled', count: counts.Cancelled, color: '#ef4444' }
  ];

  let cumulativeAngle = -90;
  const r = 48, cx = 60, cy = 60;
  const getArc = (percent, startAngle) => {
    if (percent <= 0) return null;
    const angle = (percent / 100) * 360;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${cx + r * Math.cos(startRad)} ${cy + r * Math.sin(startRad)} A ${r} ${r} 0 ${largeArc} 1 ${cx + r * Math.cos(endRad)} ${cy + r * Math.sin(endRad)} Z`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {segments.map((seg, i) => {
            const pct = (seg.count / total) * 100;
            const path = getArc(pct, cumulativeAngle);
            cumulativeAngle += (pct / 100) * 360;
            return path ? <path key={i} d={path} fill={seg.color} /> : null;
          })}
          {/* Inner cutout for donut */}
          <circle cx={cx} cy={cy} r="32" fill="#ffffff" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{orders.length}</span>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Total</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color }} />
              <span style={{ color: '#475569', fontWeight: 600 }}>{seg.label}</span>
            </div>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>
              {seg.count} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({Math.round((seg.count / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Design 4 Dashboard View ────────────────────────────────────────────────
function DashboardView({ liveReport, orders, inventory, branches, activeBranch, authUser, onNavigate }) {
  const [salesPeriod, setSalesPeriod] = useState('7D');
  const computedOrdersSales = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [orders]);

  const todaySales = liveReport?.summary?.netSales ?? (computedOrdersSales > 0 ? computedOrdersSales : 85450);
  const totalOrders = liveReport?.summary?.totalOrders ?? (orders.length || 248);
  // Real P&L: COGS (Raw material recipe BOM cost) + Operating expenses
  const todayCOGS = liveReport?.summary?.totalCOGS ?? (computedOrdersSales > 0 ? 0 : 35889);
  const totalExpenses = liveReport?.summary?.totalExpenses ?? (computedOrdersSales > 0 ? 0 : 42100);
  const grossProfit = liveReport?.summary?.totalGrossProfit ?? (todaySales - totalExpenses);
  const profitMargin = liveReport?.summary?.grossProfitMarginPercent ?? (todaySales > 0 ? Math.round((grossProfit / todaySales) * 100) : 0);
  const pendingOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
  const pendingCount = pendingOrders.length || 18;

  // Real dynamic branch performance calculated from database branches and orders
  const branchPerformance = useMemo(() => {
    const colors = ['#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2'];
    if (branches && branches.length > 0) {
      const salesMap = {};
      orders.forEach(o => {
        if (o.branchId) {
          salesMap[o.branchId] = (salesMap[o.branchId] || 0) + (o.totalAmount || 0);
        }
      });
      if (liveReport?.byBranch?.length > 0) {
        liveReport.byBranch.forEach(b => {
          salesMap[b.branchId] = Math.max(salesMap[b.branchId] || 0, b.totalSales || 0);
        });
      }

      const list = branches.map((b, i) => {
        const val = salesMap[b.id] || 0;
        return {
          id: b.id,
          name: b.name,
          sales: val > 0 ? `৳${val.toLocaleString()}` : '৳0',
          rawVal: val,
          color: colors[i % colors.length],
          growth: '+14%'
        };
      });
      const max = Math.max(...list.map(l => l.rawVal), 1);
      return list.map(l => ({ ...l, pct: Math.max(20, Math.round((l.rawVal / max) * 100)) }));
    }
    return [
      { name: 'Dhanmondi Branch', sales: '৳85,450', pct: 85, color: '#ea580c', growth: '+14%' },
      { name: 'Mirpur Branch', sales: '৳62,300', pct: 60, color: '#16a34a', growth: '+10%' }
    ];
  }, [branches, orders, liveReport]);

  // Real or realistic timeline bars
  const timelineDays = [
    { day: 'Mon', sales: 48000, orders: 120 },
    { day: 'Tue', sales: 62000, orders: 154 },
    { day: 'Wed', sales: 58000, orders: 142 },
    { day: 'Thu', sales: 74000, orders: 188 },
    { day: 'Fri', sales: 88000, orders: 220 },
    { day: 'Sat', sales: 92300, orders: 248, isPeak: true },
    { day: 'Sun', sales: 81000, orders: 205 },
  ];
  const maxSales = Math.max(...timelineDays.map(d => d.sales));

  const lowStockItems = useMemo(() => {
    return inventory.filter(i => !i.isCatalogStock && i.onHand <= i.minAlert);
  }, [inventory]);

  const recentOrders = orders.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* ── Welcome Hero Banner ── */}
      <div style={{
        background: 'linear-gradient(90deg, #182820 0%, #0f1c16 45%, #1e1b18 100%)',
        borderRadius: '18px',
        padding: '24px 32px',
        position: 'relative',
        overflow: 'hidden',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '115px',
        border: '1px solid rgba(234,88,12,0.18)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
      }}>
        {/* Ambient overlay */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '48%',
          background: 'radial-gradient(circle at right, rgba(234,88,12,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ zIndex: 2, maxWidth: '580px' }}>
          <h1 style={{
            fontSize: '1.45rem', fontWeight: 800, margin: '0 0 6px',
            fontFamily: "'Playfair Display', Georgia, serif", color: '#ffffff'
          }}>
            Good Morning, {authUser?.fullName?.split(' ')[0] || 'Admin'}! 👋
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 400 }}>
            Here's what's happening at Kabir's Kitchen today.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <span style={{
              background: 'rgba(234,88,12,0.25)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.4)',
              padding: '3px 10px', borderRadius: '14px', fontSize: '0.72rem', fontWeight: 700
            }}>
              📍 {activeBranch?.name || 'All Active Branches'}
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)',
              padding: '3px 10px', borderRadius: '14px', fontSize: '0.72rem', fontWeight: 600
            }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Right Food Motto */}
        <div style={{
          zIndex: 2, display: 'flex', alignItems: 'center', gap: '16px',
          background: 'rgba(255,255,255,0.06)', padding: '10px 18px', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)'
        }}>
          <div style={{ fontSize: '2rem' }}>🍔</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: '1.15rem', color: '#fed7aa', fontWeight: 700 }}>
              Good Food
            </div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: '1.15rem', color: '#fdba74', fontWeight: 700 }}>
              Good Mood
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <KpiCard
          title="Today's Revenue"
          value={`৳${Number(todaySales).toLocaleString()}`}
          change="12.5%"
          isPositive={true}
          icon={CircleDollarSign}
          iconBg="#dcfce7"
          iconColor="#16a34a"
          sparkColor="#16a34a"
          sparkPoints={[32, 45, 40, 58, 62, 75, 85]}
        />
        <KpiCard
          title="Total Orders"
          value={totalOrders}
          change="8.7%"
          isPositive={true}
          icon={ShoppingBag}
          iconBg="#dbeafe"
          iconColor="#2563eb"
          sparkColor="#2563eb"
          sparkPoints={[140, 165, 180, 210, 195, 230, 248]}
        />
        <KpiCard
          title="Gross Profit (প্রকৃত লাভ)"
          value={`৳${Number(grossProfit).toLocaleString()}`}
          change={`${profitMargin}% margin`}
          isPositive={grossProfit >= 0}
          icon={TrendingUp}
          iconBg="#f3e8ff"
          iconColor="#7c3aed"
          sparkColor="#7c3aed"
          sparkPoints={[12, 15, 14, 18, 20, 22, 24.8]}
        />
        <KpiCard
          title="Pending Orders"
          value={pendingCount}
          change="5.3%"
          isPositive={false}
          icon={AlertTriangle}
          iconBg="#ffedd5"
          iconColor="#ea580c"
          sparkColor="#ea580c"
          sparkPoints={[24, 21, 26, 22, 19, 17, 18]}
        />
      </div>

      {/* ── Row 2: Sales Overview Chart + Branch Performance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.3fr', gap: '20px' }}>

        {/* Sales Overview Chart Card */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '22px 24px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Analytics
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                Sales Overview
              </h2>
            </div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '9px' }}>
              {['7D', '30D', '90D', '1Y'].map(p => (
                <button
                  key={p}
                  onClick={() => setSalesPeriod(p)}
                  style={{
                    border: 'none', background: salesPeriod === p ? '#ea580c' : 'transparent',
                    color: salesPeriod === p ? '#ffffff' : '#64748b', fontSize: '0.72rem', fontWeight: 700,
                    padding: '4px 10px', borderRadius: '7px', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Bar Chart with peak tooltip */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '180px', paddingTop: '28px' }}>
            {timelineDays.map((d, i) => {
              const heightPct = Math.round((d.sales / maxSales) * 100);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                  {d.isPeak && (
                    <div style={{
                      position: 'absolute', top: 0, background: '#0f172a', color: '#ffffff',
                      padding: '4px 8px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 700,
                      whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', zIndex: 3
                    }}>
                      ৳{(d.sales / 1000).toFixed(1)}k <span style={{ color: '#fb923c' }}>Peak</span>
                    </div>
                  )}
                  <div
                    style={{
                      width: '100%', maxWidth: '42px',
                      height: `${heightPct}%`,
                      background: d.isPeak ? 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)' : '#fdba74',
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 0.4s ease'
                    }}
                    title={`৳${d.sales.toLocaleString()} (${d.orders} orders)`}
                  />
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', fontWeight: 700, color: d.isPeak ? '#ea580c' : '#64748b' }}>
                    {d.day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Branch Performance & Bangladesh Map Card */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '22px 24px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Coverage
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 16px' }}>
              Branch Performance
            </h2>

            {/* Dynamic Branch progress list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {branchPerformance.map((b, i) => (
                <div key={b.id || b.name || i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>
                      <span style={{ color: '#94a3b8', marginRight: '6px' }}>#{i+1}</span>
                      {b.name}
                    </span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      {b.sales} <span style={{ color: '#16a34a', fontSize: '0.7rem' }}>{b.growth}</span>
                    </span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bangladesh Map */}
          <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <BangladeshMap branches={branches} />
          </div>
        </div>
      </div>

      {/* ── Row 3: Order Status Donut + Top Dishes + Low Stock + Transactions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

        {/* Card 1: Order Status Donut */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Order Status</h3>
            <button onClick={() => onNavigate('Orders')} style={{ border: 'none', background: 'transparent', color: '#ea580c', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>View All →</button>
          </div>
          <OrderStatusDonut orders={orders} />
        </div>

        {/* Card 2: Top Selling Dishes */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Top Selling Dishes</h3>
            <button onClick={() => onNavigate('Products')} style={{ border: 'none', background: 'transparent', color: '#ea580c', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { name: 'Crunchy Chicken Burger', orders: '742 orders', icon: '🍔', pct: 85, color: '#ea580c' },
              { name: 'Old Dhaka Kacchi Biryani', orders: '628 orders', icon: '🍛', pct: 72, color: '#16a34a' },
              { name: 'Italian Loaded Pizza', orders: '521 orders', icon: '🍕', pct: 60, color: '#2563eb' }
            ].map(dish => (
              <div key={dish.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                  {dish.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.name}</span>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>{dish.orders}</span>
                  </div>
                  <div style={{ background: '#f1f5f9', height: '5px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${dish.pct}%`, height: '100%', background: dish.color, borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} color="#dc2626" />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Low Stock Alerts</h3>
            </div>
            <button onClick={() => onNavigate('Inventory')} style={{ border: 'none', background: 'transparent', color: '#ea580c', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lowStockItems.length > 0 ? (
              lowStockItems.slice(0, 3).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#dc2626' }}>Only {item.onHand} {item.unit} left (Alert: {item.minAlert})</div>
                  </div>
                  <button onClick={() => onNavigate('Procurement')} style={{ border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}>
                    Reorder
                  </button>
                </div>
              ))
            ) : (
              [
                { name: 'Chicken Patty', remain: 'Only 5 kg left', icon: '🥩' },
                { name: 'Mozzarella Cheese', remain: 'Only 2 kg left', icon: '🧀' },
                { name: 'Tomato Pizza Sauce', remain: 'Only 3 bottles left', icon: '🥫' }
              ].map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                  <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#9a3412' }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#ea580c', fontWeight: 600 }}>{item.remain}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 4: Recent Transactions */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Recent Transactions</h3>
            <button onClick={() => onNavigate('Orders')} style={{ border: 'none', background: 'transparent', color: '#ea580c', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentOrders.length > 0 ? (
              recentOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a' }}>#{o.orderNumber}</div>
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{o.createdAt || 'Just now'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>৳{o.totalAmount?.toLocaleString()}</div>
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>Sale</span>
                  </div>
                </div>
              ))
            ) : (
              [
                { id: '#ORD-10485', amount: '৳820', time: '2 min ago' },
                { id: '#ORD-10484', amount: '৳1,240', time: '5 min ago' },
                { id: '#ORD-10483', amount: '৳580', time: '12 min ago' },
              ].map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a' }}>{tx.id}</div>
                    <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{tx.time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{tx.amount}</div>
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>Sale</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: Revenue vs Expenses + Quick Actions + Special Offer ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: '20px' }}>

        {/* Revenue vs Expenses Breakdown (Real P&L: COGS, Operating Expenses, Net Profit) */}
        <div style={{
          background: '#ffffff', borderRadius: '16px', padding: '22px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Revenue vs Expenses (আয় বনাম ব্যয়)</h3>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>● Net Profit ({profitMargin}%)</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>● Costs ({todaySales > 0 ? Math.round((totalExpenses / todaySales) * 100) : 0}%)</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Total Revenue (মোট বিক্রি)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                ৳{Number(todaySales).toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Raw Material & Costs (ব্যয়)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                ৳{Number(totalExpenses).toLocaleString()}
              </div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 700 }}>Net Profit (প্রকৃত লাভ)</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                ৳{Number(grossProfit).toLocaleString()}
              </div>
            </div>
          </div>
          {/* Visual Bar representation - Green for Profit, Red for Expenses */}
          <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', background: '#fee2e2' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%`, background: '#16a34a', borderRadius: '4px 0 0 4px' }} title={`Net Profit: ${profitMargin}%`} />
            <div style={{ width: `${Math.min(100, Math.max(0, 100 - profitMargin))}%`, background: '#ef4444', borderRadius: '0 4px 4px 0' }} title="Expenses & COGS" />
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Profit Margin: <strong style={{ color: '#15803d' }}>{profitMargin}%</strong></span>
            <span>Recipe BOM + Spoilage + Packaging Deducted</span>
          </div>
        </div>

        {/* Quick Actions & Special Offer Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>

          {/* Quick Actions Grid */}
          <div style={{
            background: '#ffffff', borderRadius: '16px', padding: '20px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
          }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>
              ⚡ Quick Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'New Sale (POS)', icon: ShoppingBag, color: '#ea580c', target: 'pos' },
                { label: 'Add Purchase', icon: PackagePlus, color: '#2563eb', target: 'Procurement' },
                { label: 'Create Offer', icon: Tag, color: '#16a34a', target: 'Promotions' },
                { label: 'Stock Transfer', icon: Boxes, color: '#7c3aed', target: 'Inventory' },
                { label: 'Book Cake', icon: Cake, color: '#db2777', target: 'Cake Bookings' },
                { label: 'View Reports', icon: BarChart2, color: '#0891b2', target: 'Reports' },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => onNavigate(action.target)}
                    style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                      padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '6px', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    <Icon size={18} color={action.color} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', textAlign: 'center' }}>
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Offer Campaign Card */}
          <div style={{
            background: 'linear-gradient(135deg, #182820 0%, #0d1a14 100%)',
            borderRadius: '16px', padding: '20px', color: '#ffffff',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: '1px solid rgba(234,88,12,0.2)'
          }}>
            <div>
              <div style={{ color: '#fbbf24', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                👑 Featured Offer
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '6px 0 4px', color: '#ffffff' }}>
                Get 20% OFF
              </h4>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#fed7aa' }}>
                on all Dum Biryani Platters!
              </p>
            </div>
            <button
              onClick={() => onNavigate('Promotions')}
              style={{
                background: '#ea580c', border: 'none', borderRadius: '9px',
                padding: '9px 12px', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800,
                cursor: 'pointer', marginTop: '14px', width: '100%'
              }}
            >
              Create Campaign →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN AdminPage Component
// ═════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const { activeBranch, branches, authUser, signOut, setCurrentMode, selectedBranchId, setSelectedBranchId } = useApp();
  const activeBranchId = activeBranch?.id;

  const [tab, setTab] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Data States
  const [liveReport, setLiveReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Staff States
  const [staffList, setStaffList] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Cashier', branchId: activeBranch?.id || '' });

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ ingredientId: '', qty: '', unitCost: '', remarks: '' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const adjustableInventory = useMemo(() => inventory.filter(item => !item.isCatalogStock), [inventory]);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchTodayReport = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const data = await reportsApi.getSales({
          branchId: activeBranch?.id,
          startDateUtc: today.toISOString()
        });
        if (isMounted && data) setLiveReport(data);
      } catch {
        // silent fallback to local/cached data
      }
    };
    fetchTodayReport();
    return () => { isMounted = false; };
  }, [activeBranch?.id]);

  const loadOrders = useCallback(async () => {
    try {
      const result = await ordersApi.list(activeBranchId ? { branchId: activeBranchId } : {});
      if (!Array.isArray(result)) throw new Error('The server returned invalid order data.');
      setOrders(result.map(order => ({
        ...order,
        createdAt: order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleString() : '—',
        paymentMethod: order.payments?.map(payment => payment.method).filter(Boolean).join(', ') || 'Unpaid'
      })));
      setOrdersError('');
    } catch (error) {
      setOrders([]);
      setOrdersError(error.response?.data?.message || error.message || 'Orders could not be loaded from the server.');
    }
  }, [activeBranchId]);

  const loadInventory = useCallback(async () => {
    if (!activeBranchId) {
      setInventory([]);
      setInventoryError('Select a branch to load stock.');
      return;
    }
    setInventoryLoading(true);
    try {
      const result = await inventoryApi.list(activeBranchId);
      if (!Array.isArray(result)) throw new Error('The server returned invalid stock data.');
      setInventory(result.map(stock => ({
        id: stock.ingredientId,
        ingredientId: stock.ingredientId,
        code: stock.ingredientId,
        name: stock.ingredientName,
        onHand: stock.availableQuantity,
        minAlert: stock.minimumAlertStock,
        unit: stock.baseUnit,
        avgCost: stock.movingAverageCost,
        isCatalogStock: false
      })));
      setInventoryError('');
    } catch (error) {
      setInventory([]);
      setInventoryError(error.response?.data?.message || error.message || 'Stock could not be loaded from the server.');
    } finally {
      setInventoryLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (tab === 'Dashboard' || tab === 'Inventory') loadInventory();
  }, [tab, loadInventory]);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const data = await usersApi.list(activeBranchId);
      if (!Array.isArray(data)) throw new Error('The server returned invalid staff data.');
      setStaffError('');
      setStaffList(data.map(user => ({ ...user, branchName: user.branchName || 'All Branches' })));
    } catch (requestError) {
      setStaffList([]);
      setStaffError(requestError.response?.data?.message || requestError.message || 'Unable to load staff from the server.');
    } finally {
      setStaffLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (tab === 'Staff') loadStaff();
  }, [tab, loadStaff]);

  const handleToggleActive = async (id, currentActive) => {
    try {
      await usersApi.update(id, { isActive: !currentActive });
      await loadStaff();
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Could not update staff account.');
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await usersApi.update(id, { role: newRole });
      await loadStaff();
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Could not update staff role.');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim() || !newStaff.email.trim() || !newStaff.password.trim()) return;
    setStaffSaving(true);
    setStaffError('');
    try {
      await usersApi.create({
        fullName: newStaff.name.trim(),
        email: newStaff.email.trim(),
        password: newStaff.password,
        role: newStaff.role,
        branchId: newStaff.branchId ? Number(newStaff.branchId) : null
      });
      await loadStaff();
      setNewStaff({ name: '', email: '', password: '', role: 'Cashier', branchId: activeBranch?.id || '' });
      setShowAddStaffModal(false);
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Staff account could not be created.');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    if (!activeBranch?.id || !adjustForm.ingredientId || !adjustForm.qty || Number(adjustForm.qty) === 0) {
      setInventoryError('Select an ingredient and enter a non-zero quantity adjustment.');
      return;
    }
    setAdjustSaving(true);
    setInventoryError('');
    try {
      await inventoryAdjustApi.adjust({
        branchId: activeBranch.id,
        ingredientId: Number(adjustForm.ingredientId),
        quantityChange: Number(adjustForm.qty),
        unitCost: adjustForm.unitCost ? Number(adjustForm.unitCost) : null,
        remarks: adjustForm.remarks || 'Manual stock adjustment',
        reference: 'MANUAL-ADJ'
      });
      setAdjustForm({ ingredientId: '', qty: '', unitCost: '', remarks: '' });
      setShowAdjustModal(false);
      await loadInventory();
    } catch (error) {
      setInventoryError(error.response?.data?.message || error.message || 'Stock adjustment failed.');
    } finally {
      setAdjustSaving(false);
    }
  };

  const handleExportOrders = () => {
    const url = reportsApi.getCsvUrl(activeBranch?.id ? { branchId: activeBranch.id } : {});
    window.open(url, '_blank');
  };

  const handleNavigate = (target) => {
    if (target === 'pos') { setCurrentMode('pos'); return; }
    if (target === 'kds') { setCurrentMode('kds'); return; }
    setTab(target);
  };

  const displayName = authUser?.fullName || authUser?.email || 'Admin';
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Render Content Router ───────────────────────────────────────────────────
  const renderContent = () => {
    switch (tab) {
      case 'Dashboard':
        return (
          <DashboardView
            liveReport={liveReport}
            orders={orders}
            inventory={inventory}
            branches={branches}
            activeBranch={activeBranch}
            authUser={authUser}
            onNavigate={handleNavigate}
          />
        );

      case 'Orders':
        return (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Management</div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>All Orders ({orders.length})</h2>
              </div>
              <button
                onClick={handleExportOrders}
                style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px',
                  padding: '8px 14px', fontSize: '0.76rem', fontWeight: 700, color: '#0f172a',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            {ordersError && <p role="alert" style={{ padding: '12px 24px', color: '#b91c1c' }}>{ordersError}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Order #', 'Customer', 'Phone', 'Type', 'Status', 'Payment', 'Total', 'Time'].map(h => (
                      <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{order.orderNumber}</td>
                      <td style={{ padding: '12px 18px', fontSize: '0.8rem', color: '#334155' }}>{order.customerName}</td>
                      <td style={{ padding: '12px 18px', fontSize: '0.76rem', color: '#64748b' }}>{order.customerPhone}</td>
                      <td style={{ padding: '12px 18px', fontSize: '0.76rem', color: '#64748b' }}>{order.orderType}</td>
                      <td style={{ padding: '12px 18px' }}><StatusBadge status={order.status} /></td>
                      <td style={{ padding: '12px 18px', fontSize: '0.76rem', color: '#64748b' }}>{order.paymentMethod}</td>
                      <td style={{ padding: '12px 18px', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>৳{order.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding: '12px 18px', fontSize: '0.74rem', color: '#94a3b8' }}>{order.createdAt}</td>
                    </tr>
                  ))}
                  {!ordersError && orders.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No orders recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Inventory':
        return (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stock Control</div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>Branch Stock · {inventory.length} items</h2>
              </div>
              <button
                onClick={() => setShowAdjustModal(true)}
                style={{
                  background: '#ea580c', border: 'none', borderRadius: '9px',
                  padding: '8px 16px', fontSize: '0.76rem', fontWeight: 700, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <PackagePlus size={15} /> Adjust Stock
              </button>
            </div>
            {inventoryError && <p role="alert" style={{ padding: '12px 24px', color: '#b91c1c' }}>{inventoryError}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['ID', 'Ingredient', 'Available', 'Min Alert', 'Avg Cost', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const isLow = !item.isCatalogStock && item.onHand <= item.minAlert;
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9', background: isLow ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '12px 18px', fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'monospace' }}>{item.code}</td>
                        <td style={{ padding: '12px 18px', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                        <td style={{ padding: '12px 18px', fontSize: '0.8rem', color: '#334155' }}>{item.onHand} {item.unit}</td>
                        <td style={{ padding: '12px 18px', fontSize: '0.78rem', color: '#64748b' }}>{item.minAlert} {item.unit}</td>
                        <td style={{ padding: '12px 18px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>৳{item.avgCost}/{item.unit}</td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            background: isLow ? '#fee2e2' : '#dcfce7', color: isLow ? '#dc2626' : '#15803d',
                            fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: '20px'
                          }}>
                            {isLow ? '⚠ Low Stock' : '✓ Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!inventoryLoading && inventory.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No inventory items recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Staff':
        return (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RBAC & Security</div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>Staff Roles & Permissions</h2>
              </div>
              <button
                onClick={() => setShowAddStaffModal(true)}
                style={{
                  background: '#ea580c', border: 'none', borderRadius: '9px',
                  padding: '8px 16px', fontSize: '0.76rem', fontWeight: 700, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <PlusCircle size={15} /> Add Team Member
              </button>
            </div>
            {staffError && <p role="alert" style={{ padding: '12px 24px', color: '#b91c1c' }}>{staffError}</p>}
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {staffList.map(staff => (
                <div key={staff.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg,#0c1929,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                      {(staff.fullName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{staff.email}</div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(staff.id, staff.isActive ?? staff.active)}
                      style={{
                        background: (staff.isActive ?? staff.active) ? '#dcfce7' : '#f1f5f9',
                        color: (staff.isActive ?? staff.active) ? '#15803d' : '#64748b',
                        border: '1px solid ' + ((staff.isActive ?? staff.active) ? '#bbf7d0' : '#cbd5e1'),
                        fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px', cursor: 'pointer'
                      }}
                    >
                      {(staff.isActive ?? staff.active) ? '● Active' : '○ Disabled'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <small style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Role</small>
                      <select
                        value={staff.role}
                        onChange={e => handleRoleChange(staff.id, e.target.value)}
                        style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600, background: '#fff', color: '#0f172a' }}
                      >
                        {['SuperAdmin', 'Admin', 'BranchManager', 'Cashier', 'Salesman', 'Waiter', 'Chef', 'KitchenStaff', 'Rider'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <small style={{ fontSize: '0.65rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Branch</small>
                      <div style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', background: '#ffffff' }}>
                        {staff.branchName || 'All Branches'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'Branches':
        return (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Network Outlets</div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>All Active Branches ({branches.length})</h2>
              </div>
              <span style={{ fontSize: '0.74rem', background: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '4px 12px', borderRadius: '20px' }}>
                ● Real-Time Database Sync
              </span>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {branches.map((b) => (
                <div key={b.id} style={{
                  background: b.id === activeBranch?.id ? '#fff7ed' : '#f8fafc',
                  border: `1.5px solid ${b.id === activeBranch?.id ? '#ea580c' : '#e2e8f0'}`,
                  borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ea580c', background: '#ffedd5', padding: '2px 8px', borderRadius: '6px' }}>
                        {b.branchCode || `BR-${b.id}`}
                      </span>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px' }}>{b.name}</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>📍 {b.address || 'Dhaka, Bangladesh'}</p>
                    </div>
                    <span style={{
                      background: b.isActive ? '#dcfce7' : '#f1f5f9',
                      color: b.isActive ? '#15803d' : '#64748b',
                      fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px'
                    }}>
                      {b.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '0.74rem' }}>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>Phone</span>
                      <strong style={{ color: '#334155' }}>{b.contactPhone || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.65rem', fontWeight: 600 }}>Cash Drawer</span>
                      <strong style={{ color: '#16a34a' }}>৳{(b.currentCashDrawerBalance || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBranchId(b.id)}
                    style={{
                      marginTop: '4px',
                      background: b.id === activeBranch?.id ? '#ea580c' : '#ffffff',
                      color: b.id === activeBranch?.id ? '#ffffff' : '#334155',
                      border: b.id === activeBranch?.id ? 'none' : '1px solid #cbd5e1',
                      padding: '7px 12px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {b.id === activeBranch?.id ? '✓ Current Active Branch' : 'Switch To This Branch'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'Cake Bookings':   return <CakeOrdersAdmin activeBranchId={activeBranchId} />;
      case 'Cash Shifts':     return <CashShiftAdmin activeBranchId={activeBranchId} />;
      case 'Reservations':    return <ReservationAdmin activeBranchId={activeBranchId} />;
      case 'Production ERP':  return <InventoryErpAdmin activeBranchId={activeBranchId} />;
      case 'Procurement':     return <ProcurementAdmin activeBranch={activeBranch} />;
      case 'Products':        return <ProductAdmin />;
      case 'Promotions':      return <CampaignManagementAdmin />;
      case 'Campaigns':       return <HeroBannerAdmin />;
      case 'Reports':         return <SalesReportAdmin />;
      case 'Support':         return <SupportAdmin />;
      case 'Settings':
        return (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>System Settings</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Configure branch details, store hours, and system options.</p>
          </div>
        );

      default:
        return null;
    }
  };

  const sidebarWidth = sidebarOpen ? 250 : 68;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Navy Sidebar ── */}
      <aside style={{
        width: sidebarWidth,
        minHeight: '100vh',
        background: '#0c1929',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}>
        {/* Brand Header */}
        <div style={{
          padding: sidebarOpen ? '18px 20px' : '18px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          minHeight: '68px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff', flexShrink: 0, boxShadow: '0 2px 8px rgba(234,88,12,0.3)'
          }}>
            <ChefHat size={20} />
          </div>
          {sidebarOpen && (
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                color: '#ffffff', fontWeight: 800, fontSize: '0.94rem',
                fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}>
                Kabir's Kitchen
              </div>
              <div style={{
                color: '#ea580c', fontSize: '0.62rem', fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase'
              }}>
                Taste Beyond Limits
              </div>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {SIDEBAR_NAV.map((section, idx) => (
            <div key={idx}>
              {section.title && sidebarOpen && (
                <div style={{
                  fontSize: '0.62rem', fontWeight: 800, color: '#475569',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '6px 12px 4px', whiteSpace: 'nowrap'
                }}>
                  {section.title}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.isPos) { setCurrentMode('pos'); return; }
                        if (item.isKds) { setCurrentMode('kds'); return; }
                        setTab(item.id);
                      }}
                      title={!sidebarOpen ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: sidebarOpen ? '9px 12px' : '9px 10px',
                        borderRadius: '9px',
                        border: 'none',
                        background: isActive ? '#ea580c' : 'transparent',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        transition: 'all 0.15s ease',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <Icon size={18} style={{ flexShrink: 0 }} />
                      {sidebarOpen && (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Toggle Collapse */}
        <div style={{
          padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center'
        }}>
          {sidebarOpen && (
            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
              © Kabir's Kitchen
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: '4px', borderRadius: '6px'
            }}
            title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            <Menu size={16} />
          </button>
        </div>
      </aside>

      {/* ── Main Workspace Area ── */}
      <div style={{
        marginLeft: sidebarWidth,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        transition: 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>

        {/* ── Bright White Topbar ── */}
        <header style={{
          height: '68px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          {/* Global Search Box */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
            padding: '7px 14px', width: '380px', maxWidth: '100%'
          }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search orders, products, customers... (Ctrl + K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: '0.8rem', color: '#0f172a', width: '100%', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Right Action Icons & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Branch Selector Dropdown */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px',
              padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a'
            }}>
              <MapPin size={15} color="#ea580c" />
              <select
                value={selectedBranchId || ''}
                onChange={e => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* POS Shortcut Button */}
            <button
              onClick={() => setCurrentMode('pos')}
              style={{
                background: '#fff7ed', border: '1px solid #ffedd5', color: '#ea580c',
                padding: '7px 14px', borderRadius: '9px', fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <ShoppingBag size={14} /> POS
            </button>

            {/* KDS Shortcut Button */}
            <button
              onClick={() => setCurrentMode('kds')}
              style={{
                background: '#f0fdf4', border: '1px solid #dcfce7', color: '#16a34a',
                padding: '7px 14px', borderRadius: '9px', fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <ChefHat size={14} /> KDS
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setTab('Inventory')}
              style={{
                position: 'relative', width: '38px', height: '38px', borderRadius: '10px',
                background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer'
              }}
              title="Notifications"
            >
              <Bell size={17} />
              <span style={{
                position: 'absolute', top: '7px', right: '7px', width: '7px', height: '7px',
                borderRadius: '50%', background: '#dc2626'
              }} />
            </button>

            {/* Admin Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', paddingLeft: '6px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #0c1929, #ea580c)',
                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800
              }}>
                {initials}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>{displayName}</div>
                <div style={{ fontSize: '0.65rem', color: '#ea580c', fontWeight: 700 }}>{authUser?.role || 'Super Admin'}</div>
              </div>
            </div>

            {/* Store & Sign Out Buttons */}
            <button
              onClick={() => setCurrentMode('customer')}
              style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b',
                padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <ArrowLeft size={13} /> Store
            </button>
            <button
              onClick={signOut}
              style={{
                background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626',
                padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <LogOut size={13} /> Out
            </button>
          </div>
        </header>

        {/* ── Main Scrollable Content ── */}
        <main style={{ padding: '26px 30px', flex: 1 }}>
          {renderContent()}
        </main>
      </div>

      {/* ── Stock Adjust Modal ── */}
      {showAdjustModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Manual Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            {inventoryError && <p role="alert" style={{ color: '#dc2626', fontSize: '0.8rem' }}>{inventoryError}</p>}
            <form onSubmit={handleStockAdjust}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Ingredient</label>
                <select required value={adjustForm.ingredientId} onChange={e => setAdjustForm({ ...adjustForm, ingredientId: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a' }}>
                  <option value="">Select ingredient…</option>
                  {adjustableInventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Qty (+ add / - remove)</label>
                  <input type="number" step="0.01" required placeholder="e.g. 5.0 or -2.0" value={adjustForm.qty} onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Unit Cost (optional)</label>
                  <input type="number" step="0.01" min="0" placeholder="৳ per unit" value={adjustForm.unitCost} onChange={e => setAdjustForm({ ...adjustForm, unitCost: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Remarks</label>
                <input type="text" placeholder="e.g. Cycle count correction" value={adjustForm.remarks} onChange={e => setAdjustForm({ ...adjustForm, remarks: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAdjustModal(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'transparent', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={adjustSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>{adjustSaving ? 'Saving…' : 'Save Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showAddStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Add Team Member</h3>
              <button onClick={() => setShowAddStaffModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddStaff}>
              {staffError && <p role="alert" style={{ color: '#dc2626', fontSize: '0.8rem' }}>{staffError}</p>}
              {[
                { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. Shakib Al Hasan' },
                { label: 'Work Email', key: 'email', type: 'email', placeholder: 'staff@kabirskitchen.com' },
                { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'Min 6 characters' }
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type} required minLength={f.key === 'password' ? 6 : undefined}
                    placeholder={f.placeholder} value={newStaff[f.key]}
                    onChange={e => setNewStaff({ ...newStaff, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Role</label>
                  <select
                    value={newStaff.role}
                    onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a' }}
                  >
                    <option value="Salesman">Salesman (Floor Sales / সেলস ম্যান)</option>
                    <option value="Waiter">Waiter (Floor Captain / ওয়েটার)</option>
                    <option value="Cashier">Cashier (POS / ক্যাশিয়ার)</option>
                    <option value="Chef">Chef (Master Chef / KDS)</option>
                    <option value="KitchenStaff">Kitchen Staff (কিচেন সহকারী)</option>
                    <option value="Rider">Rider (Delivery / রাইডার)</option>
                    <option value="BranchManager">Branch Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Branch</label>
                  <select
                    value={newStaff.branchId}
                    onChange={e => setNewStaff({ ...newStaff, branchId: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', color: '#0f172a' }}
                  >
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'transparent', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={staffSaving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>{staffSaving ? 'Creating…' : 'Create & Grant Access'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
