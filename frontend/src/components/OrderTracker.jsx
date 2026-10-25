import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ChefHat, Bike, PackageCheck, Phone, ArrowLeft, FileText, Download } from 'lucide-react';
import { useApp } from '../context/useApp';
import { invoicesApi, ordersApi } from '../services/api';

const readTrackingReference = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem('kabirKitchenTrackedOrder') || 'null');
    const id = Number(value?.id);
    return Number.isSafeInteger(id) && id > 0 ? { id, phone: value.phone || '' } : null;
  } catch {
    return null;
  }
};

const mapOrderResponse = order => ({
  ...order,
  discount: order.discountAmount,
  subTotal: order.subTotal,
  tax: order.taxAmount,
  createdAt: order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleString() : '',
  items: (order.items || []).map(item => ({
    qty: item.quantity,
    name: item.itemName,
    variantName: item.variantName || '',
    addons: item.addOns || [],
    unitPrice: item.unitPrice
  }))
});

export default function OrderTracker({ onBackToMenu }) {
  const { orders, branches, activeTrackedOrderId, setActiveTrackedOrderId } = useApp();
  const [savedReference, setSavedReference] = useState(readTrackingReference);
  const trackedId = activeTrackedOrderId ?? savedReference?.id;
  const localOrder = orders.find(order => Number(order.id) === Number(trackedId));
  const trackingPhone = localOrder?.customerPhone || savedReference?.phone || '';
  const [remoteOrderState, setRemoteOrderState] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!trackedId) return undefined;
    let active = true;

    const refreshOrder = async () => {
      setIsRefreshing(true);
      try {
        const response = await ordersApi.getForTracking(trackedId, trackingPhone || undefined);
        if (!active) return;
        setRemoteOrderState({ id: Number(trackedId), order: mapOrderResponse(response) });
        setTrackingError('');
      } catch (error) {
        if (!active) return;
        setTrackingError(error.response?.data?.message || 'Order status could not be refreshed. Check your connection and try again.');
      } finally {
        if (active) setIsRefreshing(false);
      }
    };

    refreshOrder();
    const interval = window.setInterval(refreshOrder, 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [trackedId, trackingPhone]);

  const order = remoteOrderState?.id === Number(trackedId) ? remoteOrderState.order : localOrder;
  const branchPhone = useMemo(
    () => branches.find(branch => Number(branch.id) === Number(order?.branchId))?.phone || '',
    [branches, order?.branchId]
  );

  const selectOrder = orderId => {
    const selectedOrder = orders.find(item => Number(item.id) === Number(orderId));
    setActiveTrackedOrderId(Number(orderId));
    if (!selectedOrder) return;
    const reference = { id: Number(orderId), phone: selectedOrder.customerPhone || '' };
    setSavedReference(reference);
    try {
      sessionStorage.setItem('kabirKitchenTrackedOrder', JSON.stringify(reference));
    } catch (error) {
      console.warn('[OrderTracker] Could not save order tracking for this browser session:', error);
    }
  };

  if (!trackedId || (!order && trackingError)) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h3>{trackedId ? 'Order status unavailable' : 'No active order found'}</h3>
        <p role={trackingError ? 'alert' : undefined} style={{ color: trackingError ? '#b91c1c' : '#64748b' }}>
          {trackingError || 'Place an order in this browser session to track it here.'}
        </p>
        <button
          onClick={onBackToMenu}
          style={{ marginTop: 12, padding: '10px 20px', borderRadius: 8, background: '#ff7828', color: 'white', border: 'none', fontWeight: 700 }}
        >
          Return to Menu
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div role="status" style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
        Loading order status…
      </div>
    );
  }

  const stages = [
    { key: 'Pending', label: 'Order Received', icon: Clock, desc: 'The order has been received.' },
    { key: 'Confirmed', label: 'Confirmed', icon: CheckCircle2, desc: 'The order has been confirmed.' },
    { key: 'Preparing', label: 'Preparing', icon: ChefHat, desc: 'The order is being prepared.' },
    { key: 'Ready', label: 'Ready', icon: PackageCheck, desc: 'The order is marked ready.' },
    { key: 'OutForDelivery', label: 'Out for Delivery', icon: Bike, desc: 'The order is marked as out for delivery.' },
    { key: 'Delivered', label: 'Delivered', icon: CheckCircle2, desc: 'The order is marked delivered.' }
  ];
  const currentIdx = stages.findIndex(stage => stage.key === order.status);
  const isCancelled = order.isVoid || ['Cancelled', 'Canceled', 'Void'].includes(order.status);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBackToMenu}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} /> Back to Storefront
        </button>
        {orders.length > 1 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
            Switch order:
            <select
              value={order.id}
              onChange={event => selectOrder(event.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}
            >
              {orders.map(item => <option key={item.id} value={item.id}>{item.orderNumber} ({item.status})</option>)}
            </select>
          </label>
        )}
      </div>

      {trackingError && (
        <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fff7ed', color: '#9a3412' }}>
          {trackingError}{isRefreshing ? ' Retrying…' : ''}
        </div>
      )}

      <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 20, marginBottom: 28 }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff7828', textTransform: 'uppercase' }}>Order status</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0b0f17', margin: '4px 0' }}>{order.orderNumber}</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Branch: <strong>{order.branchName}</strong>{order.createdAt && <> • Placed at {order.createdAt}</>}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
            <span>{isRefreshing ? 'Refreshing status…' : 'Status from restaurant'}</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isCancelled ? '#b91c1c' : '#0b0f17' }}>
              {isCancelled ? 'Cancelled' : order.status}
            </div>
          </div>
        </div>

        {isCancelled ? (
          <p role="status" style={{ padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 10 }}>This order was cancelled.</p>
        ) : currentIdx < 0 ? (
          <p role="status" style={{ padding: 16, background: '#f8fafc', color: '#475569', borderRadius: 10 }}>
            The restaurant has not provided a recognized tracking stage for this order yet.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', margin: '30px 10px 40px' }}>
              <div style={{ position: 'absolute', top: 20, left: '5%', right: '5%', height: 4, background: '#e2e8f0', zIndex: 1 }}>
                <div style={{ height: '100%', background: '#ff7828', width: `${(currentIdx / (stages.length - 1)) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: 90, textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: isCurrent ? '#ff7828' : isCompleted ? '#0b0f17' : '#fff', border: isCompleted ? 'none' : '2px solid #cbd5e1', color: isCompleted ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} />
                    </div>
                    <span style={{ marginTop: 10, fontSize: '0.78rem', fontWeight: isCurrent ? 800 : isCompleted ? 700 : 500, color: isCurrent ? '#ff7828' : isCompleted ? '#0b0f17' : '#94a3b8' }}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#ff7828', fontWeight: 800 }}>CURRENT STATUS</div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0b0f17', margin: '2px 0' }}>{stages[currentIdx].label}</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{stages[currentIdx].desc}</p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <a href={invoicesApi.getPdfUrl(order.id, trackingPhone)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#ea580c', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                  <FileText size={14} /> Tax Invoice (PDF)
                </a>
                <a href={invoicesApi.getReceiptPdfUrl(order.id, 80, trackingPhone)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0c251c', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                  <Download size={14} /> Receipt
                </a>
                {branchPhone && (
                  <a href={`tel:${branchPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#0c251c', color: '#fff', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                    <Phone size={14} /> Call branch
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 14 }}>Items in This Order</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {(order.items || []).map((item, idx) => (
            <div key={`${item.name}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #f8fafc' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{item.qty}× {item.name}</span>
                {(item.variantName || item.addons?.length > 0) && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {item.variantName} {item.addons?.length > 0 ? `(${item.addons.join(', ')})` : ''}
                  </div>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>৳{Number(item.unitPrice || 0) * Number(item.qty || 0)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, fontSize: '0.85rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>৳{order.subTotal}</span></div>
          {order.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 700 }}><span>Discount</span><span>-৳{order.discount}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery Fee</span><span>৳{order.deliveryFee}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>VAT & Tax</span><span>৳{order.tax}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, color: '#0b0f17', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
            <span>Order total</span><span style={{ color: '#ff7828' }}>৳{order.totalAmount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
