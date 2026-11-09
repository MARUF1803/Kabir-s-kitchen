import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, Filter, Phone, RefreshCw, Table, User, Users, XCircle } from 'lucide-react';
import { reservationsApi } from '../services/api';

export default function ReservationAdmin({ activeBranchId }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals for actions
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null, tableNumber: 'T-1', staffNotes: '' });
  const [rejectModal, setRejectModal] = useState({ isOpen: false, item: null, reason: 'Fully booked at requested time' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (activeBranchId) params.branchId = activeBranchId;
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;

      const res = await reservationsApi.list(params);
      setReservations(res.items || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch reservations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [activeBranchId, statusFilter, dateFilter]);

  const handleConfirmSubmit = async () => {
    if (!confirmModal.item) return;
    try {
      setActionLoading(true);
      await reservationsApi.confirm(confirmModal.item.id, {
        assignedTableNumber: confirmModal.tableNumber,
        staffNotes: confirmModal.staffNotes
      });
      setConfirmModal({ isOpen: false, item: null, tableNumber: 'T-1', staffNotes: '' });
      await fetchReservations();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to confirm reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal.item) return;
    try {
      setActionLoading(true);
      await reservationsApi.reject(rejectModal.item.id, {
        reason: rejectModal.reason
      });
      setRejectModal({ isOpen: false, item: null, reason: '' });
      await fetchReservations();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to reject reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeat = async (id) => {
    try {
      setActionLoading(true);
      await reservationsApi.seat(id);
      await fetchReservations();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to seat reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      setActionLoading(true);
      await reservationsApi.complete(id);
      await fetchReservations();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to complete reservation.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (statusLabel) => {
    switch (statusLabel?.toLowerCase()) {
      case 'pending':
        return <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>Pending</span>;
      case 'confirmed':
        return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>Confirmed</span>;
      case 'seated':
        return <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>Seated</span>;
      case 'completed':
        return <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>Completed</span>;
      case 'rejected':
      case 'cancelled':
        return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>{statusLabel}</span>;
      default:
        return <span>{statusLabel}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#fff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Table Reservations</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Manage dine-in bookings, table assignments, and guest seating.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          >
            <option value="">All Statuses</option>
            <option value="1">Pending</option>
            <option value="2">Confirmed</option>
            <option value="3">Seated</option>
            <option value="4">Completed</option>
            <option value="6">Rejected</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />

          <button
            type="button"
            onClick={fetchReservations}
            className="button button--light"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {/* Reservations Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Ref / Date</th>
              <th style={{ padding: '12px 16px' }}>Guest Details</th>
              <th style={{ padding: '12px 16px' }}>Guests</th>
              <th style={{ padding: '12px 16px' }}>Assigned Table</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                  No reservations found for the selected branch or filters.
                </td>
              </tr>
            ) : (
              reservations.map(res => {
                const resDate = new Date(res.reservationDateUtc);
                return (
                  <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{res.referenceCode}</strong>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {resDate.toLocaleDateString()} at {resDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{res.customerName}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{res.customerPhone}</div>
                      {res.specialRequests && (
                        <div style={{ fontSize: '0.78rem', color: '#d97706', marginTop: 4, fontStyle: 'italic' }}>
                          Note: "{res.specialRequests}"
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#334155' }}>
                        <Users size={14} /> {res.guestCount}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {res.assignedTableNumber ? (
                        <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontWeight: 700, color: '#0f172a' }}>
                          {res.assignedTableNumber}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getStatusBadge(res.statusLabel)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {res.statusLabel === 'Pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmModal({ isOpen: true, item: res, tableNumber: 'T-1', staffNotes: '' })}
                              className="button button--primary"
                              style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectModal({ isOpen: true, item: res, reason: 'Fully booked' })}
                              className="button button--light"
                              style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#991b1b' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {res.statusLabel === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleSeat(res.id)}
                            className="button button--primary"
                            style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#7c3aed', borderColor: '#7c3aed' }}
                          >
                            Seat Guest
                          </button>
                        )}
                        {res.statusLabel === 'Seated' && (
                          <button
                            type="button"
                            onClick={() => handleComplete(res.id)}
                            className="button button--primary"
                            style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#16a34a', borderColor: '#16a34a' }}
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>Confirm Table Reservation</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Assign a table for {confirmModal.item?.customerName} ({confirmModal.item?.guestCount} Guests).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Assigned Table Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Table 4 / Window 2"
                  value={confirmModal.tableNumber}
                  onChange={e => setConfirmModal({ ...confirmModal, tableNumber: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Internal Staff Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Prepared cutlery, VIP guest, etc."
                  value={confirmModal.staffNotes}
                  onChange={e => setConfirmModal({ ...confirmModal, staffNotes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="button button--light"
                  onClick={() => setConfirmModal({ isOpen: false, item: null, tableNumber: '', staffNotes: '' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  className="button button--primary"
                  onClick={handleConfirmSubmit}
                >
                  {actionLoading ? 'Saving...' : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#991b1b' }}>Reject Reservation</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#64748b' }}>
              Please provide a reason for rejecting {rejectModal.item?.customerName}'s request.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                rows="3"
                value={rejectModal.reason}
                onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                placeholder="Reason for rejection (e.g. All tables occupied)"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="button button--light"
                  onClick={() => setRejectModal({ isOpen: false, item: null, reason: '' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  className="button button--primary"
                  style={{ background: '#991b1b', borderColor: '#991b1b' }}
                  onClick={handleRejectSubmit}
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Reservation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

