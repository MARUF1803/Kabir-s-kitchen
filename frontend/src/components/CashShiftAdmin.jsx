import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownCircle, CheckCircle, Clock, DollarSign, Lock, RefreshCw, ShieldCheck, Unlock, User, Wallet } from 'lucide-react';
import { cashShiftsApi } from '../services/api';

export default function CashShiftAdmin({ activeBranchId }) {
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Open Shift Form State
  const [openingFloat, setOpeningFloat] = useState('2000');
  const [cashierName, setCashierName] = useState('');
  const [openLoading, setOpenLoading] = useState(false);

  // Cash Drop Modal
  const [dropModal, setDropModal] = useState({ isOpen: false, amount: '', notes: '' });
  const [dropLoading, setDropLoading] = useState(false);

  // Close Shift / Z-Report Modal
  const [closeModal, setCloseModal] = useState({ isOpen: false, actualCash: '', notes: '' });
  const [closeLoading, setCloseLoading] = useState(false);

  const fetchShiftData = async () => {
    if (!activeBranchId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch active shift
      try {
        const activeRes = await cashShiftsApi.getCurrent(activeBranchId);
        setCurrentShift(activeRes);
      } catch (err) {
        if (err?.response?.status === 404) {
          setCurrentShift(null);
        } else {
          console.warn('Error fetching active shift', err);
        }
      }

      // Fetch shift history
      const historyRes = await cashShiftsApi.list({ branchId: activeBranchId, pageSize: 20 });
      setShiftsHistory(historyRes.items || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch cash shift details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, [activeBranchId]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!activeBranchId) return;
    try {
      setOpenLoading(true);
      setError(null);
      const res = await cashShiftsApi.open({
        branchId: activeBranchId,
        openingFloat: parseFloat(openingFloat) || 0,
        cashierStaffName: cashierName.trim()
      });
      await fetchShiftData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to open shift.');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleCashDrop = async (e) => {
    e.preventDefault();
    if (!currentShift) return;
    const amount = parseFloat(dropModal.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid drop amount.');
      return;
    }
    try {
      setDropLoading(true);
      await cashShiftsApi.cashDrop(currentShift.id, {
        shiftId: currentShift.id,
        dropAmount: amount,
        notes: dropModal.notes
      });
      setDropModal({ isOpen: false, amount: '', notes: '' });
      await fetchShiftData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Cash drop failed.');
    } finally {
      setDropLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;
    const actualCash = parseFloat(closeModal.actualCash);
    if (isNaN(actualCash)) {
      alert('Please enter the physical cash counted.');
      return;
    }
    try {
      setCloseLoading(true);
      await cashShiftsApi.close(currentShift.id, {
        actualCashCounted: actualCash,
        zReportNotes: closeModal.notes
      });
      setCloseModal({ isOpen: false, actualCash: '', notes: '' });
      await fetchShiftData();
    } catch (err) {
      alert(err?.response?.data?.error || 'Shift closing failed.');
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#fff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Cash Shift & Z-Report Reconciliation
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Open cashier drawer, track real-time drawer sales, record safe drops, and execute end-of-day Z-Report reconciliation.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchShiftData}
          className="button button--light"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Drawer
        </button>
      </div>

      {error && (
        <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {/* Active Shift Section */}
      {!currentShift ? (
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
              <Unlock size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>No Open Shift for this Branch</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Open a cashier drawer session to start POS billing and tracking cash balance.</p>
            </div>
          </div>

          <form onSubmit={handleOpenShift} style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Cashier Staff Name
              </label>
              <input
                type="text"
                placeholder="e.g. Tanvir (Counter 1)"
                value={cashierName}
                onChange={e => setCashierName(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Opening Cash Float (৳ In Drawer) *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                required
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={openLoading}
              className="button button--primary"
              style={{ width: '100%', padding: '12px', fontWeight: 700 }}
            >
              {openLoading ? 'Opening Session...' : 'Open Cash Shift Now'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={14} /> ACTIVE SHIFT
                </span>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.15rem' }}>{currentShift.shiftReferenceNumber}</span>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#64748b', marginTop: 4 }}>
                Cashier: <strong>{currentShift.cashierStaffName}</strong> • Opened: {new Date(currentShift.openedAtUtc).toLocaleTimeString()} ({new Date(currentShift.openedAtUtc).toLocaleDateString()})
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDropModal({ isOpen: true, amount: '', notes: '' })}
                className="button button--light"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309' }}
              >
                <ArrowDownCircle size={15} /> Cash Drop to Safe
              </button>
              <button
                type="button"
                onClick={() => setCloseModal({ isOpen: true, actualCash: currentShift.expectedCashInDrawer.toFixed(2), notes: '' })}
                className="button button--primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', borderColor: '#0f172a' }}
              >
                <Lock size={15} /> Close Shift (Z-Report)
              </button>
            </div>
          </div>

          {/* Running Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opening Float</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>৳{currentShift.openingFloat.toLocaleString()}</div>
            </div>

            <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 10, border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>Cash Sales</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', marginTop: 4 }}>৳{currentShift.totalCashSales.toLocaleString()}</div>
            </div>

            <div style={{ background: '#eff6ff', padding: 16, borderRadius: 10, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Card & MFS Sales</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>
                ৳{(currentShift.totalCardSales + currentShift.totalMfsSales).toLocaleString()}
              </div>
            </div>

            <div style={{ background: '#fefce8', padding: 16, borderRadius: 10, border: '1px solid #fef08a' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>Cash Drops</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ca8a04', marginTop: 4 }}>৳{currentShift.cashDropAmount.toLocaleString()}</div>
            </div>

            <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 10, border: '2px solid #22c55e' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Expected Cash in Drawer</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#166534', marginTop: 4 }}>৳{currentShift.expectedCashInDrawer.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, color: '#334155' }}>
          Z-Report Shift History & Reconciliation
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.76rem', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Shift Ref</th>
              <th style={{ padding: '12px 16px' }}>Cashier</th>
              <th style={{ padding: '12px 16px' }}>Duration</th>
              <th style={{ padding: '12px 16px' }}>Opening Float</th>
              <th style={{ padding: '12px 16px' }}>Cash Sales</th>
              <th style={{ padding: '12px 16px' }}>Expected Cash</th>
              <th style={{ padding: '12px 16px' }}>Actual Counted</th>
              <th style={{ padding: '12px 16px' }}>Variance (Over/Short)</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shiftsHistory.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8' }}>
                  No past shifts recorded yet.
                </td>
              </tr>
            ) : (
              shiftsHistory.map(shift => {
                const isOverShort = shift.varianceOverShort !== null && shift.varianceOverShort !== undefined;
                const isShort = isOverShort && shift.varianceOverShort < 0;
                const isOver = isOverShort && shift.varianceOverShort > 0;

                return (
                  <tr key={shift.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{shift.shiftReferenceNumber}</td>
                    <td style={{ padding: '12px 16px' }}>{shift.cashierStaffName}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem' }}>
                      {new Date(shift.openedAtUtc).toLocaleDateString()}
                      <div>{new Date(shift.openedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {shift.closedAtUtc ? new Date(shift.closedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>৳{shift.openingFloat.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#059669' }}>৳{shift.totalCashSales.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>৳{shift.expectedCashInDrawer.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {shift.actualCashCounted !== null ? `৳${shift.actualCashCounted?.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isOverShort ? (
                        <span style={{ fontWeight: 800, color: isShort ? '#dc2626' : (isOver ? '#16a34a' : '#475569') }}>
                          {isShort ? `-৳${Math.abs(shift.varianceOverShort).toLocaleString()} (Short)` : (isOver ? `+৳${shift.varianceOverShort.toLocaleString()} (Over)` : '৳0 (Balanced)')}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: shift.statusLabel === 'Open' ? '#dbeafe' : '#f1f5f9',
                        color: shift.statusLabel === 'Open' ? '#1e40af' : '#475569'
                      }}>
                        {shift.statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cash Drop Modal */}
      {dropModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#b45309' }}>Cash Drop / Transfer to Safe</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Remove excess cash from the cashier drawer and transfer it to the branch safe.
            </p>

            <form onSubmit={handleCashDrop} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Drop Amount (৳) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={dropModal.amount}
                  onChange={e => setDropModal({ ...dropModal, amount: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Notes / Bag Number
                </label>
                <input
                  type="text"
                  placeholder="Midday drop to safe bag #12"
                  value={dropModal.notes}
                  onChange={e => setDropModal({ ...dropModal, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="button button--light"
                  onClick={() => setDropModal({ isOpen: false, amount: '', notes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dropLoading}
                  className="button button--primary"
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  {dropLoading ? 'Processing...' : 'Confirm Drop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift / Z-Report Modal */}
      {closeModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: '#0f172a' }}>Close Cash Shift (Z-Report)</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Count all physical cash in the drawer to calculate overage or shortage.
            </p>

            <form onSubmit={handleCloseShift} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Opening Float:</span> <strong>৳{currentShift.openingFloat.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Cash Sales:</span> <strong>৳{currentShift.totalCashSales.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Cash Drops:</span> <strong>-৳{currentShift.cashDropAmount.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 6, fontWeight: 800, color: '#047857' }}>
                  <span>Expected In Drawer:</span> <span>৳{currentShift.expectedCashInDrawer.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  Physical Cash Counted (৳) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={closeModal.actualCash}
                  onChange={e => setCloseModal({ ...closeModal, actualCash: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #0f172a', fontSize: '1.1rem', fontWeight: 800 }}
                />
                {closeModal.actualCash && (
                  <div style={{ marginTop: 6, fontSize: '0.85rem', fontWeight: 700 }}>
                    {(() => {
                      const variance = parseFloat(closeModal.actualCash) - currentShift.expectedCashInDrawer;
                      if (variance === 0) return <span style={{ color: '#16a34a' }}>✓ Perfectly Balanced (৳0 variance)</span>;
                      if (variance < 0) return <span style={{ color: '#dc2626' }}>⚠ Cash Shortage: -৳{Math.abs(variance).toLocaleString()}</span>;
                      return <span style={{ color: '#2563eb' }}>ℹ Cash Overage: +৳{variance.toLocaleString()}</span>;
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Z-Report Closing Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Drawer counted by cashier and signed by branch supervisor."
                  value={closeModal.notes}
                  onChange={e => setCloseModal({ ...closeModal, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="button button--light"
                  onClick={() => setCloseModal({ isOpen: false, actualCash: '', notes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeLoading}
                  className="button button--primary"
                  style={{ background: '#0f172a', borderColor: '#0f172a' }}
                >
                  {closeLoading ? 'Closing Shift...' : 'Finalize & Close Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

