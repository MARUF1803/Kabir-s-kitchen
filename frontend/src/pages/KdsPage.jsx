import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, ChefHat, Clock3, Flame, RefreshCw, Truck, ShieldCheck, Bell } from 'lucide-react';
import { useApp } from '../context/useApp';
import { ordersApi } from '../services/api';

const STAGES = [
  { key: 'Confirmed',      label: 'New Orders',     icon: '🔵', cls: 'confirmed' },
  { key: 'Preparing',      label: 'In Kitchen',      icon: '🔥', cls: 'preparing' },
  { key: 'Ready',          label: 'Ready',           icon: '✅', cls: 'ready' },
  { key: 'OutForDelivery', label: 'Dispatched',      icon: '🚴', cls: 'outfordelivery' },
];

function KdsTicket({ order, onAdvance, onComplete, onDispatch }) {
  const isUrgent = order.estimatedMinutes <= 5 && order.status === 'Preparing';
  return (
    <article className={`kds-ticket kds-ticket--${order.status.toLowerCase()}`}>
      <div className="kds-ticket__top">
        <span className="kds-ticket__num">#{order.orderNumber?.slice(-6) ?? order.id}</span>
        <span className={`kds-ticket__timer${isUrgent ? ' kds-ticket__timer--urgent' : ''}`}>
          <Clock3 size={11} style={{ display:'inline', marginRight:3 }} />
          {order.estimatedMinutes} min
        </span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
        <span className="kds-ticket__type">{order.orderType}</span>
        {order.tableNumber && (
          <span style={{ fontSize:'0.68rem', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', padding:'1px 8px', borderRadius:'12px' }}>
            {order.tableNumber}
          </span>
        )}
      </div>

      <div className="kds-ticket__customer">
        {order.customerName} · {order.customerPhone}
      </div>

      <ul className="kds-ticket__items">
        {order.items.slice(0, 4).map((item, i) => (
          <li key={`${item.name}-${i}`}>
            <strong style={{ color:'#d4af37', minWidth:'18px', textAlign:'right' }}>{item.qty}×</strong>
            {item.name}
            {item.variantName && item.variantName !== 'Standard' && (
              <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem' }}> ({item.variantName})</span>
            )}
          </li>
        ))}
        {order.items.length > 4 && (
          <li className="kds-ticket__more">+{order.items.length - 4} more items…</li>
        )}
      </ul>

      <div className="kds-ticket__actions">
        {order.status === 'Confirmed' && (
          <button className="kds-btn kds-btn--advance" onClick={() => onAdvance(order.id, 'Preparing')}>
            <Flame size={13} /> Start Cooking
          </button>
        )}
        {order.status === 'Preparing' && (
          <button className="kds-btn kds-btn--complete" onClick={() => onAdvance(order.id, 'Ready')}>
            <CheckCircle2 size={13} /> Mark Ready
          </button>
        )}
        {order.status === 'Ready' && order.orderType === 'Delivery' && (
          <button className="kds-btn kds-btn--dispatch" onClick={() => onDispatch(order.id)}>
            <Truck size={13} /> Dispatch
          </button>
        )}
        {order.status === 'Ready' && order.orderType !== 'Delivery' && (
          <button className="kds-btn kds-btn--complete" onClick={() => onComplete(order.id)}>
            <ShieldCheck size={13} /> Handed Over
          </button>
        )}
        {order.status === 'OutForDelivery' && (
          <button className="kds-btn kds-btn--complete" onClick={() => onComplete(order.id)}>
            <CheckCircle2 size={13} /> Delivered
          </button>
        )}
      </div>
    </article>
  );
}

export default function KdsPage() {
  const { orders, activeBranch, setCurrentMode, updateOrderStatus, authUser } = useApp();
  const [filter, setFilter] = useState('All');
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [apiOrders, setApiOrders] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchKitchenOrders = async () => {
      try {
        const data = await ordersApi.list({ branchId: activeBranch.id });
        if (isMounted && Array.isArray(data)) {
          setLoadError('');
          const mapped = data.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            branchId: o.branchId,
            branchName: o.branchName,
            orderType: typeof o.orderType === 'string' ? o.orderType : ['DineIn', 'Takeaway', 'Delivery'][o.orderType] || 'DineIn',
            status: typeof o.status === 'string' ? o.status : ['Pending', 'Confirmed', 'Preparing', 'Ready', 'OutForDelivery', 'Delivered', 'Cancelled', 'Refunded'][o.status] || 'Confirmed',
            tableNumber: o.tableNumber || '',
            customerName: o.customerName || 'Guest',
            customerPhone: o.customerPhone || '',
            items: (o.items || []).map(i => ({
              name: i.itemName,
              qty: i.quantity,
              variantName: i.variantName || 'Standard',
              addons: i.addOns || []
            })),
            estimatedMinutes: 15,
            createdAt: o.createdAtUtc ? new Date(o.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
          }));
          setApiOrders(mapped);
        }
      } catch (requestError) {
        if (isMounted) {
          setLoadError(requestError?.response?.data?.message || 'Unable to refresh kitchen orders; displaying locally available orders.');
        }
      } finally {
        if (isMounted) setLastRefresh(new Date());
      }
    };

    fetchKitchenOrders();
    const interval = setInterval(fetchKitchenOrders, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeBranch.id, refreshVersion]);

  const kitchenOrders = useMemo(() => {
    const combined = [...orders.filter(o => o.branchId === activeBranch.id)];
    for (const ao of apiOrders) {
      const existingIdx = combined.findIndex(o => o.id === ao.id || (o.orderNumber && o.orderNumber === ao.orderNumber));
      if (existingIdx >= 0) {
        combined[existingIdx] = { ...combined[existingIdx], ...ao };
      } else {
        combined.push(ao);
      }
    }
    return combined.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
  }, [orders, apiOrders, activeBranch.id]);

  const grouped = useMemo(() =>
    STAGES.map(stage => ({
      ...stage,
      orders: kitchenOrders.filter(o =>
        (filter === 'All' || o.orderType === filter || o.status === filter) &&
        o.status === stage.key
      )
    })),
    [kitchenOrders, filter]
  );

  const totalActive = kitchenOrders.length;
  const inKitchen = kitchenOrders.filter(o => o.status === 'Preparing').length;
  const ready = kitchenOrders.filter(o => o.status === 'Ready').length;
  const urgent = kitchenOrders.filter(o => o.status === 'Preparing' && o.estimatedMinutes <= 5).length;

  const handleAdvance = (id, status) => {
    updateOrderStatus(id, status);
    setApiOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const handleComplete = (id) => {
    updateOrderStatus(id, 'Delivered');
    setApiOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleDispatch = (id) => {
    updateOrderStatus(id, 'OutForDelivery');
    setApiOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'OutForDelivery' } : o));
  };

  const handleRefresh = () => setRefreshVersion(version => version + 1);

  return (
    <div className="kds-page" id="kds-page">
      {/* ── Header ── */}
      <header className="kds-header">
        <div className="kds-header__brand">
          <div className="kds-header__brand-mark"><ChefHat size={20} /></div>
          <div>
            <strong>Kitchen Display</strong>
            <small>{activeBranch.name}</small>
          </div>
        </div>

        <div className="kds-header__stats">
          <div className="kds-stat">
            <span className="kds-stat__val">{totalActive}</span>
            <span className="kds-stat__lbl">Active</span>
          </div>
          <div className="kds-stat">
            <span className="kds-stat__val" style={{ color:'#fb923c' }}>{inKitchen}</span>
            <span className="kds-stat__lbl">Cooking</span>
          </div>
          <div className="kds-stat">
            <span className="kds-stat__val" style={{ color:'#34d399' }}>{ready}</span>
            <span className="kds-stat__lbl">Ready</span>
          </div>
          {urgent > 0 && (
            <div className="kds-stat" style={{ background:'rgba(239,68,68,0.1)', borderColor:'rgba(239,68,68,0.25)' }}>
              <span className="kds-stat__val" style={{ color:'#f87171' }}>{urgent}</span>
              <span className="kds-stat__lbl" style={{ color:'#f87171' }}>Urgent!</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.7rem', color:'rgba(255,255,255,0.4)' }}>
            <div className="kds-live-dot" />
            Live
          </div>
        </div>
      </header>

      {/* ── Controls ── */}
      <div className="kds-controls">
        <button className="kds-back-btn" onClick={() => setCurrentMode(authUser?.role === 'Chef' ? 'login' : 'pos')}>
          <ArrowLeft size={15} /> Back
        </button>
        {['All', 'DineIn', 'Delivery', 'Takeaway'].map(f => (
          <button
            key={f}
            className={`kds-filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'All' ? 'All Orders' : f}
          </button>
        ))}
        {urgent > 0 && (
          <button
            className={`kds-filter-btn kds-filter-btn--danger${filter === 'Urgent' ? ' active' : ''}`}
            onClick={() => setFilter(filter === 'Urgent' ? 'All' : 'Urgent')}
          >
            <Bell size={13} /> {urgent} Urgent
          </button>
        )}
        <button className="kds-refresh-btn" onClick={handleRefresh}>
          <RefreshCw size={14} /> Refresh · {lastRefresh.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
        </button>
      </div>

      {loadError && <div role="alert" style={{ padding: '8px 16px', color: '#fecaca', background: 'rgba(127, 29, 29, 0.35)' }}>{loadError}</div>}

      {/* ── Kanban Board ── */}
      <div className="kds-board">
        {grouped.map(col => (
          <div key={col.key} className={`kds-col kds-col--${col.cls}`}>
            <div className="kds-col__head">
              <div className="kds-col__head-left">
                <span style={{ fontSize:'1rem' }}>{col.icon}</span>
                <span className="kds-col__title">{col.label}</span>
              </div>
              <span className="kds-col__count">{col.orders.length}</span>
            </div>
            <div className="kds-col__items">
              {col.orders.length === 0 ? (
                <div className="kds-empty">No tickets here</div>
              ) : (
                col.orders.map(order => (
                  <KdsTicket
                    key={order.id}
                    order={order}
                    onAdvance={handleAdvance}
                    onComplete={handleComplete}
                    onDispatch={handleDispatch}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
