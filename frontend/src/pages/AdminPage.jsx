import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Boxes, ChefHat, CircleDollarSign, TrendingUp, Users,
  ShoppingBag, AlertTriangle,
  Download, PlusCircle, Eye, MapPin, LogOut, ShieldCheck, X,
  PackagePlus
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
import { usersApi, reportsApi, inventoryAdjustApi, inventoryApi, ordersApi } from '../services/api';

const TABS = ['Overview', 'Orders', 'Cash Shifts', 'Reservations', 'Production ERP', 'Promotions', 'Campaigns', 'Products', 'Inventory', 'Procurement', 'Staff', 'Reports', 'Support'];

const STATUS_COLORS = {
  Confirmed:      { bg: '#dbeafe', color: '#1d4ed8' },
  Preparing:      { bg: '#fff7ed', color: '#c2410c' },
  Ready:          { bg: '#dcfce7', color: '#15803d' },
  OutForDelivery: { bg: '#f5f3ff', color: '#6d28d9' },
  Delivered:      { bg: '#f1f5f9', color: '#475569' },
  Pending:        { bg: '#fef9c3', color: '#854d0e' },
};

function MetricCard({ icon, iconClass, label, value, trend, trendUp }) {
  return (
    <div className="admin-metric-card">
      <div className={`admin-metric-icon admin-metric-icon--${iconClass}`}>{icon}</div>
      <div>
        <div className="admin-metric-lbl">{label}</div>
        <div className="admin-metric-val">{value}</div>
        {trend && (
          <div className={`admin-metric-trend${trendUp === false ? ' admin-metric-trend--down' : ''}`}>
            <TrendingUp size={12} /> {trend}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700,
      padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap'
    }}>{status}</span>
  );
}

export default function AdminPage() {
  const { activeBranch, branches, authUser, signOut, setCurrentMode } = useApp();
  const activeBranchId = activeBranch?.id;
  const [tab, setTab] = useState('Overview');
  const [liveReport, setLiveReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [inventory, setInventory] = useState([]);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setReportError('');
    setLiveReport(null);
    const fetchTodayReport = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const data = await reportsApi.getSales({
          branchId: activeBranch?.id,
          startDateUtc: today.toISOString()
        });
        if (isMounted && data) {
          setLiveReport(data);
        }
      } catch (error) {
        if (isMounted) setReportError(error.response?.data?.message || 'Live sales metrics are unavailable.');
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
      setInventoryLoaded(false);
      return;
    }
    setInventoryLoading(true);
    setInventoryLoaded(false);
    try {
      const result = await inventoryApi.list(activeBranchId);
      if (!Array.isArray(result)) throw new Error('The server returned invalid stock data.');
      setInventory(result.map(stock => ({
        id: stock.ingredientId,
        ingredientId: stock.ingredientId,
        code: stock.ingredientId,
        name: stock.ingredientName,
        categoryName: '',
        onHand: stock.availableQuantity,
        minAlert: stock.minimumAlertStock,
        unit: stock.baseUnit,
        avgCost: stock.movingAverageCost,
        isCatalogStock: false
      })));
      setInventoryError('');
      setInventoryLoaded(true);
    } catch (error) {
      setInventory([]);
      setInventoryError(error.response?.data?.message || error.message || 'Stock could not be loaded from the server.');
      setInventoryLoaded(false);
    } finally {
      setInventoryLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (tab === 'Overview' || tab === 'Inventory') loadInventory();
  }, [tab, loadInventory]);

  const todaySales = useMemo(() => {
    if (liveReport?.summary?.netSales != null) {
      return liveReport.summary.netSales;
    }
    return null;
  }, [liveReport]);

  const totalOrdersCount = useMemo(() => {
    if (liveReport?.summary?.totalOrders != null) {
      return liveReport.summary.totalOrders;
    }
    return null;
  }, [liveReport]);

  const lowStock = useMemo(() => inventory.filter(i => !i.isCatalogStock && i.onHand <= i.minAlert), [inventory]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status !== 'Delivered'), [orders]);

  const displayName = authUser?.fullName || authUser?.email || 'Admin';
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const [staffList, setStaffList] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Cashier', branchId: activeBranch?.id || '' });

  // Stock Adjustment State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ ingredientId: '', qty: '', unitCost: '', remarks: '' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const adjustableInventory = useMemo(() => inventory.filter(item => !item.isCatalogStock), [inventory]);

  // Load staff from backend on Staff tab open
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const data = await usersApi.list(activeBranchId);
      if (!Array.isArray(data)) throw new Error('The server returned invalid staff data.');
      setStaffError('');
      setStaffList(data.map(user => ({ ...user, branchName: user.branchName || 'Branch not assigned' })));
    } catch (requestError) {
      setStaffList([]);
      setStaffError(requestError.response?.data?.message || requestError.message || 'Unable to load staff from the server.');
    } finally {
      setStaffLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This starts an asynchronous API request.
    if (tab === 'Staff') loadStaff();
  }, [tab, loadStaff]);

  const handleToggleActive = async (id, currentActive) => {
    try {
      await usersApi.update(id, { isActive: !currentActive });
      await loadStaff();
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Could not update the staff account.');
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await usersApi.update(id, { role: newRole });
      await loadStaff();
    } catch (error) {
      setStaffError(error.response?.data?.message || 'Could not update the staff role.');
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
      setStaffError(error.response?.data?.message || 'Staff account could not be created on the server.');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleExportOrders = () => {
    const url = reportsApi.getCsvUrl(activeBranch?.id ? { branchId: activeBranch.id } : {});
    window.open(url, '_blank');
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

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }} id="admin-page">
      {/* ── Sidebar / Top header ── */}
      <header style={{
        background: 'linear-gradient(135deg, #071c14 0%, #0c2e1e 100%)',
        borderBottom: '1px solid rgba(212,175,55,0.2)',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: '64px', height: 'auto', gap: '16px', flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 50, boxSizing: 'border-box'
      }}>
        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#071c14,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', color:'#d4af37' }}>
            <ChefHat size={19} />
          </div>
          <div>
            <strong style={{ color:'#fff', fontFamily:"'Playfair Display',serif", fontSize:'1rem' }}>Kabir's Kitchen</strong>
            <div style={{ color:'#d4af37', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Admin ERP</div>
          </div>
        </div>

        {/* Branch indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', padding:'6px 14px', borderRadius:10 }}>
          <MapPin size={14} style={{ color:'#ea580c' }} />
          <span style={{ color:'#c9d8ce', fontSize:'0.78rem', fontWeight:600 }}>{activeBranch?.name || 'Branch unavailable'}</span>
        </div>

        {/* User + actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'8px', flexWrap:'wrap', flex:'1 1 280px', minWidth:0 }}>
          <button
            onClick={() => setCurrentMode('kds')}
            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)', padding:'6px 14px', borderRadius:9, fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}
          >
            <ChefHat size={14} /> KDS
          </button>
          <button
            onClick={() => setCurrentMode('pos')}
            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)', padding:'6px 14px', borderRadius:9, fontSize:'0.75rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}
          >
            <ShoppingBag size={14} /> POS
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#071c14,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', color:'#d4af37', fontSize:'0.72rem', fontWeight:800 }}>
              {initials}
            </div>
            <div>
              <div style={{ color:'#fff', fontSize:'0.76rem', fontWeight:700 }}>{displayName}</div>
              <div style={{ color:'#d4af37', fontSize:'0.62rem' }}>{authUser?.role}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', padding:'6px 12px', borderRadius:9, fontSize:'0.72rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
            <LogOut size={13} /> Out
          </button>
          <button onClick={() => setCurrentMode('customer')} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.5)', padding:'6px 12px', borderRadius:9, fontSize:'0.72rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
            <ArrowLeft size={13} /> Store
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 12px', display:'flex', gap:'4px', overflowX:'auto', width:'100%', maxWidth:'100%', boxSizing:'border-box' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '14px 18px', border: 'none', background:'transparent',
              fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
              color: tab === t ? '#0c251c' : '#64748b',
              borderBottom: tab === t ? '2.5px solid #ea580c' : '2.5px solid transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap', fontFamily:'inherit'
            }}
          >{t}</button>
        ))}
      </div>

      {/* ── Content ── */}
      <main style={{ padding:'28px', maxWidth:'1400px', margin:'0 auto' }}>

        {/* ── Overview Tab ── */}
        {tab === 'Overview' && (
          <>
            {/* Metric cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px', marginBottom:'24px' }}>
              <MetricCard icon={<CircleDollarSign size={22} />} iconClass="orange" label="Today's Revenue" value={todaySales == null ? 'Unavailable' : `৳${todaySales.toLocaleString()}`} trend={reportError || (liveReport?.summary ? `Net: ৳${(liveReport.summary.totalCollected || 0).toLocaleString()}` : '')} trendUp={true} />
              <MetricCard icon={<ShoppingBag size={22} />} iconClass="green" label="Total Orders" value={totalOrdersCount ?? 'Unavailable'} trend={ordersError || `${pendingOrders.length} active`} trendUp={true} />
              <MetricCard icon={<Boxes size={22} />} iconClass="blue" label="Low Stock Items" value={inventoryLoaded ? lowStock.length : 'Unavailable'} trend={inventoryError || (inventoryLoaded ? (lowStock.length > 0 ? 'Needs attention' : 'Live branch stock') : 'Loading branch stock…')} trendUp={lowStock.length === 0} />
              <MetricCard icon={<Users size={22} />} iconClass="purple" label="Active Staff" value="View Staff tab" trend="Loaded from server on request" trendUp={true} />
            </div>

            {/* Charts + Quick info */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px', marginBottom:'24px' }}>
              {/* Sales chart */}
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
                  <div>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Live Performance</div>
                    <h2 style={{ fontSize:'1.1rem', fontWeight:800, color:'#0f172a', margin:0 }}>Weekly Sales</h2>
                  </div>
                </div>
                <p style={{ color: reportError ? '#b91c1c' : '#64748b', margin: 0 }}>
                  {reportError || 'Weekly chart data is not available from the sales report API yet.'}
                </p>
              </div>

              {/* Branch stats */}
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'20px' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Current Branch</div>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, color:'#0f172a', margin:'0 0 16px' }}>{activeBranch?.name || 'Branch unavailable'}</h2>
                {[
                  { label:'Pending Orders', val: pendingOrders.length, icon:<ShoppingBag size={16}/> },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#64748b', fontSize:'0.8rem' }}>
                      <span style={{ color:'#ea580c' }}>{row.icon}</span> {row.label}
                    </div>
                    <strong style={{ color:'#0f172a', fontSize:'0.88rem' }}>{row.val}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent orders table */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Recent Activity</div>
                  <h2 style={{ fontSize:'1rem', fontWeight:800, color:'#0f172a', margin:0 }}>Latest Orders</h2>
                </div>
                <button onClick={() => setTab('Orders')} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:9, padding:'7px 14px', fontSize:'0.75rem', fontWeight:700, color:'#0f172a', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontFamily:'inherit' }}>
                  <Eye size={14} /> View All
                </button>
              </div>
              <p role="status" style={{ padding: '0 20px', color: ordersError ? '#b91c1c' : '#64748b' }}>
                {ordersError || (orders.length === 0 ? 'No orders are recorded for this branch yet.' : '')}
              </p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Order #', 'Customer', 'Type', 'Status', 'Amount', 'Time'].map(h => (
                        <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.72rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 8).map(order => (
                      <tr key={order.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'11px 16px', fontSize:'0.8rem', fontWeight:800, color:'#0f172a' }}>{order.orderNumber}</td>
                        <td style={{ padding:'11px 16px', fontSize:'0.8rem', color:'#334155' }}>{order.customerName}</td>
                        <td style={{ padding:'11px 16px', fontSize:'0.78rem', color:'#64748b' }}>{order.orderType}</td>
                        <td style={{ padding:'11px 16px' }}><StatusBadge status={order.status} /></td>
                        <td style={{ padding:'11px 16px', fontSize:'0.82rem', fontWeight:800, color:'#0f172a' }}>৳{order.totalAmount?.toLocaleString()}</td>
                        <td style={{ padding:'11px 16px', fontSize:'0.75rem', color:'#94a3b8' }}>{order.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Orders Tab ── */}
        {tab === 'Orders' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Order Management</div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, color:'#0f172a', margin:0 }}>All Branch Orders ({orders.length})</h2>
              </div>
              <button onClick={handleExportOrders} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:9, padding:'7px 14px', fontSize:'0.75rem', fontWeight:700, color:'#0f172a', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontFamily:'inherit' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Order #', 'Customer', 'Phone', 'Type', 'Status', 'Payment', 'Total', 'Time'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.72rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 16px', fontSize:'0.78rem', fontWeight:800, color:'#0f172a' }}>{order.orderNumber}</td>
                      <td style={{ padding:'10px 16px', fontSize:'0.78rem', color:'#334155' }}>{order.customerName}</td>
                      <td style={{ padding:'10px 16px', fontSize:'0.75rem', color:'#64748b' }}>{order.customerPhone}</td>
                      <td style={{ padding:'10px 16px', fontSize:'0.75rem', color:'#64748b' }}>{order.orderType}</td>
                      <td style={{ padding:'10px 16px' }}><StatusBadge status={order.status} /></td>
                      <td style={{ padding:'10px 16px', fontSize:'0.75rem', color:'#64748b' }}>{order.paymentMethod}</td>
                      <td style={{ padding:'10px 16px', fontSize:'0.8rem', fontWeight:800, color:'#0f172a' }}>৳{order.totalAmount?.toLocaleString()}</td>
                      <td style={{ padding:'10px 16px', fontSize:'0.72rem', color:'#94a3b8' }}>{order.createdAt}</td>
                    </tr>
                  ))}
                  {!ordersError && orders.length === 0 && (
                    <tr><td colSpan={8} style={{ padding:'18px 16px', textAlign:'center', color:'#64748b' }}>No orders to display.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Production ERP Tab ── */}
        {tab === 'Production ERP' && (
          <InventoryErpAdmin activeBranchId={activeBranchId} />
        )}

        {/* ── Cash Shifts / Z-Report Tab ── */}
        {tab === 'Cash Shifts' && (
          <CashShiftAdmin activeBranchId={activeBranchId} />
        )}

        {/* ── Table Reservations Tab ── */}
        {tab === 'Reservations' && (
          <ReservationAdmin activeBranchId={activeBranchId} />
        )}

        {/* ── Inventory Tab ── */}
        {tab === 'Inventory' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Stock Control</div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, color:'#0f172a', margin:0 }}>Branch Stock · {inventory.length} items</h2>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                {lowStock.length > 0 && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', padding:'7px 14px', borderRadius:9, fontSize:'0.75rem', fontWeight:700 }}>
                    <AlertTriangle size={14} /> {lowStock.length} low stock
                  </div>
                )}
                <button
                  onClick={() => setShowAdjustModal(true)}
                  style={{ background:'#0c251c', border:'none', borderRadius:9, padding:'7px 14px', fontSize:'0.75rem', fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontFamily:'inherit' }}
                >
                  <PackagePlus size={14} /> Adjust Stock
                </button>
                <button onClick={handleExportOrders} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:9, padding:'7px 14px', fontSize:'0.75rem', fontWeight:700, color:'#0f172a', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontFamily:'inherit' }}>
                  <Download size={14} /> Export Orders
                </button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Ingredient ID', 'Ingredient', 'Available', 'Min Alert', 'Avg Cost', 'Status'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'0.72rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const isCatalogOnly = item.isCatalogStock === true;
                    const isLow = !isCatalogOnly && item.onHand <= item.minAlert;
                    return (
                      <tr key={item.id} style={{ borderTop:'1px solid #f1f5f9', background: isLow ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding:'10px 16px', fontSize:'0.75rem', fontWeight:700, color:'#94a3b8', fontFamily:'monospace' }}>{item.code}</td>
                        <td style={{ padding:'10px 16px', fontSize:'0.82rem', fontWeight:700, color:'#0f172a' }}>{item.name}</td>
                        <td style={{ padding:'10px 16px', fontSize:'0.8rem', color:'#334155' }}>{isCatalogOnly ? 'Not stocked' : `${item.onHand} ${item.unit}`}</td>
                        <td style={{ padding:'10px 16px', fontSize:'0.78rem', color:'#64748b' }}>{isCatalogOnly ? '—' : `${item.minAlert} ${item.unit}`}</td>
                        <td style={{ padding:'10px 16px', fontSize:'0.78rem', fontWeight:700, color:'#0f172a' }}>{isCatalogOnly ? '—' : `৳${item.avgCost}/${item.unit}`}</td>
                        <td style={{ padding:'10px 16px' }}>
                          <span style={{ background: isCatalogOnly ? '#e0e7ff' : isLow ? '#fecaca' : '#dcfce7', color: isCatalogOnly ? '#4338ca' : isLow ? '#dc2626' : '#15803d', fontSize:'0.7rem', fontWeight:800, padding:'3px 10px', borderRadius:'20px' }}>
                            {isCatalogOnly ? 'Catalog only' : isLow ? '⚠ Low Stock' : '✓ Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!inventoryError && !inventoryLoading && inventory.length === 0 && (
                    <tr><td colSpan={6} style={{ padding:'18px 16px', textAlign:'center', color:'#64748b' }}>No stock records are available for this branch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {(inventoryError || inventoryLoading) && (
              <p role={inventoryError ? 'alert' : 'status'} style={{ padding:'0 20px 14px', color:inventoryError ? '#b91c1c' : '#64748b' }}>
                {inventoryError || 'Loading stock records…'}
              </p>
            )}
          </div>
        )}

        {/* ── Stock Adjustment Modal ── */}
        {showAdjustModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
            <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'400px', width:'100%', padding:'24px', boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <h3 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:'#0f172a' }}>Manual Stock Adjustment</h3>
                <button onClick={() => setShowAdjustModal(false)} style={{ border:0, background:'transparent', cursor:'pointer', color:'#64748b' }}><X size={18} /></button>
              </div>
              {inventoryError && <p role="alert" style={{ color:'#b91c1c', fontSize:'0.8rem' }}>{inventoryError}</p>}
              <form onSubmit={handleStockAdjust}>
                <div style={{ marginBottom:'12px' }}>
                  <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Ingredient</label>
                  <select
                    required
                    value={adjustForm.ingredientId}
                    onChange={e => setAdjustForm({ ...adjustForm, ingredientId: e.target.value })}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                  >
                    <option value="">Select ingredient…</option>
                    {adjustableInventory.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Quantity (+ add / - remove)</label>
                    <input
                      type="number" step="0.01" required
                      placeholder="e.g. 5.0 or -2.0"
                      value={adjustForm.qty}
                      onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Unit Cost (optional)</label>
                    <input
                      type="number" step="0.01" min="0"
                      placeholder="৳ per unit"
                      value={adjustForm.unitCost}
                      onChange={e => setAdjustForm({ ...adjustForm, unitCost: e.target.value })}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom:'18px' }}>
                  <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Cycle count correction"
                    value={adjustForm.remarks}
                    onChange={e => setAdjustForm({ ...adjustForm, remarks: e.target.value })}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                  />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                  <button type="button" onClick={() => setShowAdjustModal(false)}
                    style={{ padding:'9px 16px', borderRadius:'8px', border:'1px solid #cbd5e1', background:'#fff', color:'#475569', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}
                  >Cancel</button>
                  <button type="submit" disabled={adjustSaving}
                    style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:'#ea580c', color:'#fff', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}
                  >{adjustSaving ? 'Saving…' : 'Save Adjustment'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Procurement & GRN Tab ── */}
        {tab === 'Procurement' && <ProcurementAdmin activeBranch={activeBranch} />}

        {/* ── Staff Tab ── */}
        {tab === 'Staff' && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f1f5f9', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ea580c', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Team & RBAC Security</div>
                <h2 style={{ fontSize:'1rem', fontWeight:800, color:'#0f172a', margin:0 }}>Staff Roles & Branch Permissions</h2>
              </div>
              <button
                onClick={() => setShowAddStaffModal(true)}
                style={{ background:'#0c251c', border:'none', borderRadius:9, padding:'8px 16px', fontSize:'0.78rem', fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:'7px', fontFamily:'inherit' }}
              >
                <PlusCircle size={15} /> Add Team Member
              </button>
            </div>

            {/* Role Access Explainer Notice */}
            <div style={{ padding:'12px 20px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:'10px', fontSize:'0.75rem', color:'#475569' }}>
              <ShieldCheck size={16} style={{ color:'#ea580c', flexShrink:0 }} />
              <span>
                <strong>Access Policy:</strong> Only authorized staff accounts can access the POS or KDS. Super Admins assign roles (Branch Manager, Cashier, Chef) and branch locations below. Inactive staff are automatically locked out.
              </span>
            </div>

            {staffError && <div role="alert" style={{ padding:'12px', color:'#b91c1c' }}>{staffError}</div>}
            {staffLoading && <p role="status" style={{ padding:'12px 20px', color:'#64748b' }}>Loading staff from the server…</p>}
            {!staffLoading && !staffError && staffList.length === 0 && <p style={{ padding:'12px 20px', color:'#64748b' }}>No staff accounts are assigned to this branch.</p>}
            <div style={{ padding:'20px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'14px' }}>
              {staffList.map((staff) => (
                <div key={staff.id} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #071c14, #ea580c)', display:'flex', alignItems:'center', justifyContent:'center', color:'#d4af37', fontWeight:800, fontSize:'1rem', flexShrink:0 }}>
                      {(staff.fullName || staff.name || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, color:'#0f172a', fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{staff.fullName || staff.name}</div>
                      <div style={{ fontSize:'0.72rem', color:'#64748b' }}>{staff.email}</div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(staff.id, staff.isActive ?? staff.active)}
                      style={{
                        background: (staff.isActive ?? staff.active) ? '#dcfce7' : '#f1f5f9',
                        color: (staff.isActive ?? staff.active) ? '#15803d' : '#64748b',
                        border: '1px solid ' + ((staff.isActive ?? staff.active) ? '#bbf7d0' : '#cbd5e1'),
                        fontSize:'0.68rem',
                        fontWeight:800,
                        padding:'3px 8px',
                        borderRadius:'12px',
                        cursor:'pointer'
                      }}
                      title="Click to toggle access"
                    >
                      {(staff.isActive ?? staff.active) ? '● Active' : '○ Disabled'}
                    </button>
                  </div>

                  {/* Role & Branch Display */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', paddingTop:'8px', borderTop:'1px solid #e2e8f0' }}>
                    <div>
                      <small style={{ fontSize:'0.65rem', color:'#64748b', display:'block', marginBottom:'2px', fontWeight:600 }}>Assigned Role</small>
                      <select
                        value={staff.role}
                        onChange={e => handleRoleChange(staff.id, e.target.value)}
                        style={{ width:'100%', padding:'5px 8px', borderRadius:'6px', border:'1px solid #cbd5e1', fontSize:'0.75rem', fontWeight:600, background:'#fff', color:'#0f172a' }}
                      >
                        <option value="SuperAdmin">Super Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="BranchManager">Branch Manager</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Chef">Chef</option>
                      </select>
                    </div>
                    <div>
                      <small style={{ fontSize:'0.65rem', color:'#64748b', display:'block', marginBottom:'2px', fontWeight:600 }}>Branch</small>
                      <div style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'0.75rem', fontWeight:600, color:'#0f172a', background:'#f8fafc' }}>
                        {staff.branchName || staff.branch || 'All Branches'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal: Add Team Member */}
            {showAddStaffModal && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
                <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'440px', width:'100%', padding:'24px', boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                    <h3 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:'#0f172a' }}>Add Team Member</h3>
                    <button onClick={() => setShowAddStaffModal(false)} style={{ border:0, background:'transparent', cursor:'pointer', color:'#64748b' }}>
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleAddStaff}>
                    {staffError && <p role="alert" style={{ color:'#b91c1c', fontSize:'0.8rem' }}>{staffError}</p>}
                    <div style={{ marginBottom:'12px' }}>
                      <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Full Name</label>
                      <input
                        type="text" required
                        placeholder="e.g. Shakib Al Hasan"
                        value={newStaff.name}
                        onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                      />
                    </div>
                    <div style={{ marginBottom:'12px' }}>
                      <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Work Email</label>
                      <input
                        type="email" required
                        placeholder="staff@kabirskitchen.com"
                        value={newStaff.email}
                        onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                      />
                    </div>
                    <div style={{ marginBottom:'12px' }}>
                      <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Temporary Password</label>
                      <input
                        type="password" required minLength={6}
                        placeholder="Min 6 characters"
                        value={newStaff.password}
                        onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                        style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem' }}
                      />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'18px' }}>
                      <div>
                        <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Role</label>
                        <select
                          value={newStaff.role}
                          onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                          style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem', background:'#fff' }}
                        >
                          <option value="Cashier">Cashier (POS)</option>
                          <option value="Chef">Chef (KDS)</option>
                          <option value="BranchManager">Branch Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#475569', marginBottom:'4px' }}>Branch</label>
                        <select
                          value={newStaff.branchId}
                          onChange={e => setNewStaff({ ...newStaff, branchId: Number(e.target.value) })}
                          style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'0.82rem', background:'#fff' }}
                        >
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                      <button type="button" onClick={() => setShowAddStaffModal(false)}
                        style={{ padding:'9px 16px', borderRadius:'8px', border:'1px solid #cbd5e1', background:'#fff', color:'#475569', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}
                      >Cancel</button>
                      <button type="submit" disabled={staffSaving}
                        style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:'#ea580c', color:'#fff', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}
                      >{staffSaving ? 'Creating…' : 'Create & Grant Access'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Support / Live Chat Tab ── */}
        {tab === 'Support' && <SupportAdmin />}

        {/* ── Reports Tab ── */}
        {tab === 'Reports' && <SalesReportAdmin />}

        {/* ── Promotions / Offers Tab ── */}
        {tab === 'Promotions' && <CampaignManagementAdmin />}

        {/* ── Campaigns Tab ── */}
        {tab === 'Campaigns' && <HeroBannerAdmin />}

        {/* ── Products Tab ── */}
        {tab === 'Products' && <ProductAdmin />}

      </main>
    </div>
  );
}
