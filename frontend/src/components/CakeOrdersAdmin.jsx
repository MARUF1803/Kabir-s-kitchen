import { useState, useEffect } from 'react';
import { Cake, Search, RefreshCw, CheckCircle2, AlertCircle, Percent, MessageSquare, ShieldAlert, Sparkles, X } from 'lucide-react';
import { bakeryApi } from '../services/api';
import { useApp } from '../context/useApp';

export default function CakeOrdersAdmin({ activeBranchId }) {
  const { authUser } = useApp();
  const isAdmin = authUser?.role === 'Admin' || authUser?.role === 'SuperAdmin';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Discount Modal State
  const [discountModalOrder, setDiscountModalOrder] = useState(null);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('Special Customer Courtesy');
  const [discountSubmitting, setDiscountSubmitting] = useState(false);
  const [discountError, setDiscountError] = useState('');

  // Verify Advance Modal State
  const [advanceModalOrder, setAdvanceModalOrder] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceTrxRef, setAdvanceTrxRef] = useState('');
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bakeryApi.getCakeOrders(activeBranchId, searchQuery);
      setOrders(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cake orders from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleApplyDiscountSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setDiscountError('Permission Denied: Only Admin can grant courtesy discounts.');
      return;
    }
    const amount = parseFloat(discountAmount);
    if (isNaN(amount) || amount <= 0) {
      setDiscountError('Please enter a valid positive discount amount in Taka.');
      return;
    }
    if (amount > discountModalOrder.estimatedPrice) {
      setDiscountError('Discount cannot exceed the total price.');
      return;
    }

    setDiscountSubmitting(true);
    setDiscountError('');
    try {
      const updatedOrder = await bakeryApi.applySpecialDiscount({
        cakeCustomOrderId: discountModalOrder.id,
        discountAmount: amount,
        reason: discountReason.trim() || 'Special Customer Courtesy'
      });
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setDiscountModalOrder(null);
      setDiscountAmount('');
    } catch (err) {
      setDiscountError(err.response?.data?.message || 'Failed to apply discount. Ensure you are logged in as Admin.');
    } finally {
      setDiscountSubmitting(false);
    }
  };

  const handleVerifyAdvanceSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(advanceAmount);
    if (isNaN(amount) || amount <= 0) {
      setAdvanceError('Please enter the advance amount received.');
      return;
    }
    if (!advanceTrxRef.trim()) {
      setAdvanceError('Please enter a Transaction Reference / Receipt # (e.g. bKash TrxID).');
      return;
    }

    setAdvanceSubmitting(true);
    setAdvanceError('');
    try {
      await bakeryApi.verifyAdvance({
        cakeCustomOrderId: advanceModalOrder.id,
        advanceAmountPaid: amount,
        paymentTransactionRef: advanceTrxRef.trim(),
        verifiedByStaffName: authUser?.name || authUser?.email || 'Admin Staff'
      });
      await fetchOrders();
      setAdvanceModalOrder(null);
      setAdvanceAmount('');
      setAdvanceTrxRef('');
    } catch (err) {
      setAdvanceError(err.response?.data?.message || 'Failed to verify advance payment.');
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  const handleStartBaking = async (orderId) => {
    try {
      await bakeryApi.startBaking(orderId);
      await fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not move order to baking.');
    }
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, background: '#faf5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e22ce' }}>
              <Cake size={20} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Custom Cake Orders & Advance Tracking
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Manage custom cake pre-orders, verify 50% advance payments, and apply admin-only courtesy discounts.
          </p>
        </div>

        {/* Search & Refresh */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search name, phone, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 36px 8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                width: 240
              }}
            />
            <button
              type="submit"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <Search size={16} />
            </button>
          </form>

          <button
            type="button"
            onClick={fetchOrders}
            title="Refresh list"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#334155'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 10, color: '#dc2626', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          Loading custom cake orders...
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
          <Cake size={36} color="#94a3b8" style={{ margin: '0 auto 12px', display: 'block' }} />
          <h4 style={{ margin: '0 0 6px', color: '#1e293b', fontWeight: 800 }}>No Custom Cake Orders Found</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            When customers book handcrafted custom cakes from the storefront, they appear here for 50% advance confirmation.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                <th style={{ padding: '12px 14px' }}>Order Ref #</th>
                <th style={{ padding: '12px 14px' }}>Customer</th>
                <th style={{ padding: '12px 14px' }}>Cake Details</th>
                <th style={{ padding: '12px 14px' }}>Delivery Slot</th>
                <th style={{ padding: '12px 14px' }}>Pricing & 50% Policy</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const approxPound = (order.weightKg / 0.453592).toFixed(1);
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {/* Order Ref */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#7e22ce', background: '#faf5ff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                        {order.customOrderNumber}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                        {new Date(order.deliveryDate).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Customer Info */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{order.customerName}</div>
                      <div style={{ color: '#475569', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span>{order.customerPhone}</span>
                        <a
                          href={`https://wa.me/88${order.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${order.customerName}, regarding your custom cake booking #${order.customOrderNumber} at Kabir's Kitchen:`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chat on WhatsApp"
                          style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <MessageSquare size={14} />
                        </a>
                      </div>
                    </td>

                    {/* Cake Specs */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {approxPound} Pound ({order.weightKg} kg) • {order.flavor}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                        {order.creamType}
                      </div>
                      {order.messageOnCake && (
                        <div style={{ fontSize: '0.75rem', color: '#7e22ce', fontStyle: 'italic', marginTop: 4 }}>
                          &ldquo;{order.messageOnCake}&rdquo;
                        </div>
                      )}
                    </td>

                    {/* Delivery Slot */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {new Date(order.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {order.deliveryTimeSlot}
                      </div>
                    </td>

                    {/* Pricing */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <div>
                        <strong>Total: ৳{order.estimatedPrice}</strong>
                        {Number(order.discountAmount) > 0 && (
                          <span style={{ color: '#059669', fontSize: '0.75rem', marginLeft: 6, fontWeight: 700 }}>
                            (-৳{order.discountAmount} off)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                        {order.advancePaidAmount >= order.estimatedPrice ? (
                          <span style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} color="#059669" /> Fully Paid: ৳{order.advancePaidAmount} (Due: ৳0)
                          </span>
                        ) : order.isAdvanceVerified ? (
                          <span style={{ color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} color="#059669" /> Advance Paid: ৳{order.advancePaidAmount} (Due on delivery: ৳{Math.max(0, order.estimatedPrice - order.advancePaidAmount)})
                          </span>
                        ) : (
                          <span style={{ color: '#b45309' }}>
                            Due: <strong>৳{order.estimatedPrice}</strong> (Min 50%: ৳{order.advanceRequiredAmount})
                          </span>
                        )}
                      </div>
                      {order.advancePaymentTransactionRef && (
                        <div style={{
                          marginTop: 6,
                          padding: '4px 8px',
                          background: order.isAdvanceVerified ? '#f0fdf4' : '#fffbeb',
                          border: `1px solid ${order.isAdvanceVerified ? '#bbf7d0' : '#fde68a'}`,
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          color: order.isAdvanceVerified ? '#166534' : '#92400e',
                          wordBreak: 'break-word',
                          maxWidth: 240
                        }}>
                          <strong>{order.isAdvanceVerified ? '✓ Verified Ref:' : '⚠️ Claimed Proof:'}</strong> {order.advancePaymentTransactionRef}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px', verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        background: order.status === 2 ? '#dcfce7' : order.status === 3 ? '#e0e7ff' : '#fef3c7',
                        color: order.status === 2 ? '#166534' : order.status === 3 ? '#3730a3' : '#92400e'
                      }}>
                        {order.status === 1 ? 'Pending Advance' : order.status === 2 ? 'Advance Verified' : order.status === 3 ? 'In Baking' : 'Completed'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        {/* Admin-only Special Discount Button */}
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountModalOrder(order);
                              setDiscountAmount('');
                              setDiscountReason('Special Customer Courtesy');
                              setDiscountError('');
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid #e9d5ff',
                              background: '#faf5ff',
                              color: '#7e22ce',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Percent size={13} /> Special Discount
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            (Admin discount only)
                          </span>
                        )}

                        {/* Verify Advance Button (if not verified) */}
                        {!order.isAdvanceVerified && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdvanceModalOrder(order);
                              setAdvanceAmount(order.advanceRequiredAmount);
                              setAdvanceTrxRef(order.advancePaymentTransactionRef || '');
                              setAdvanceError('');
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: order.advancePaymentTransactionRef ? '#ea580c' : '#25D366',
                              color: '#ffffff',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckCircle2 size={13} /> {order.advancePaymentTransactionRef ? 'Check & Verify' : 'Verify 50%'}
                          </button>
                        )}

                        {/* Start Baking Button */}
                        {order.isAdvanceVerified && order.status === 2 && (
                          <button
                            type="button"
                            onClick={() => handleStartBaking(order.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#8b5cf6',
                              color: '#ffffff',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Start Baking
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADMIN ONLY SPECIAL DISCOUNT MODAL ── */}
      {discountModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7e22ce' }}>
                  <Sparkles size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                  Apply Special Discount
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModalOrder(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#b45309' }}>
              <ShieldAlert size={16} />
              <span><strong>Admin Only Action:</strong> Only system administrators can approve courtesy discounts.</span>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Order:</span>
                <strong style={{ fontFamily: 'monospace' }}>{discountModalOrder.customOrderNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <strong>{discountModalOrder.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Current Total Price:</span>
                <strong style={{ color: '#0f172a' }}>৳{discountModalOrder.estimatedPrice}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Current 50% Advance Required:</span>
                <strong style={{ color: '#b45309' }}>৳{discountModalOrder.advanceRequiredAmount}</strong>
              </div>
            </div>

            <form onSubmit={handleApplyDiscountSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Discount Amount (৳ Taka)
                </label>
                <input
                  type="number"
                  min="1"
                  max={discountModalOrder.estimatedPrice}
                  step="1"
                  placeholder="e.g. 200, 300, 500"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 800, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Reason / Courtesy Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer, Relative, Festival Courtesy"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Live Preview of New Total & 50% Advance */}
              {parseFloat(discountAmount) > 0 && parseFloat(discountAmount) <= discountModalOrder.estimatedPrice && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 10, marginBottom: 16, fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', fontWeight: 800, marginBottom: 4 }}>
                    <span>New Total Price:</span>
                    <span>৳{Math.max(0, discountModalOrder.estimatedPrice - parseFloat(discountAmount))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', fontWeight: 800 }}>
                    <span>New 50% Advance Required:</span>
                    <span>৳{Math.round(Math.max(0, discountModalOrder.estimatedPrice - parseFloat(discountAmount)) * 0.5)}</span>
                  </div>
                </div>
              )}

              {discountError && (
                <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0 0 12px', fontWeight: 700 }}>
                  {discountError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setDiscountModalOrder(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={discountSubmitting}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#7e22ce', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {discountSubmitting ? 'Applying...' : 'Approve Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VERIFY ADVANCE PAYMENT MODAL ── */}
      {advanceModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                Verify 50% Advance Payment
              </h3>
              <button
                type="button"
                onClick={() => setAdvanceModalOrder(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px' }}>
              Confirm payment received for <strong>{advanceModalOrder.customOrderNumber}</strong> ({advanceModalOrder.customerName}).
            </p>

            {/* Customer Claimed Payment Box */}
            {advanceModalOrder.advancePaymentTransactionRef && !advanceModalOrder.isAdvanceVerified && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: '0.8rem', color: '#92400e' }}>
                <div style={{ fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={14} color="#b45309" /> Customer Claimed Payment:
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: '#fef3c7', padding: '6px 8px', borderRadius: 6, wordBreak: 'break-all' }}>
                  {advanceModalOrder.advancePaymentTransactionRef}
                </div>
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#b45309' }}>
                  * Check your mobile MFS app or cash drawer before confirming.
                </div>
              </div>
            )}

            {/* Quick Amount Pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setAdvanceAmount(advanceModalOrder.estimatedPrice)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: advanceAmount === advanceModalOrder.estimatedPrice ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: advanceAmount === advanceModalOrder.estimatedPrice ? '#ecfdf5' : '#ffffff',
                  color: advanceAmount === advanceModalOrder.estimatedPrice ? '#059669' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Full Payment: ৳{advanceModalOrder.estimatedPrice}
              </button>
              <button
                type="button"
                onClick={() => setAdvanceAmount(advanceModalOrder.advanceRequiredAmount)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: advanceAmount === advanceModalOrder.advanceRequiredAmount ? '2px solid #b45309' : '1px solid #cbd5e1',
                  background: advanceAmount === advanceModalOrder.advanceRequiredAmount ? '#fffbeb' : '#ffffff',
                  color: advanceAmount === advanceModalOrder.advanceRequiredAmount ? '#b45309' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                50% Advance: ৳{advanceModalOrder.advanceRequiredAmount}
              </button>
            </div>

            <form onSubmit={handleVerifyAdvanceSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Advance Amount Received (৳)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 800, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Transaction Reference / TrxID (bKash/Nagad/Counter)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BKASH-9A74B2, CASH-RECEIPT-402"
                  value={advanceTrxRef}
                  onChange={(e) => setAdvanceTrxRef(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {advanceError && (
                <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0 0 12px', fontWeight: 700 }}>
                  {advanceError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdvanceModalOrder(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advanceSubmitting}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#25D366', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {advanceSubmitting ? 'Verifying...' : 'Confirm Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

