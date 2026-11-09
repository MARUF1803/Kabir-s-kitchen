import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, MapPin, MessageCircle, Phone, Sparkles, User, Users, Utensils, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import { reservationsApi } from '../services/api';

export default function TableReservationModal({ isOpen, onClose }) {
  const { branches, selectedBranchId } = useApp();
  const [branchId, setBranchId] = useState(null);
  const [activeTab, setActiveTab] = useState('online'); // 'online' | 'contact'

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('19:00');
  const [guestCount, setGuestCount] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setBookingSuccess(null);
      setError(null);
      return undefined;
    }

    // Set default reservation date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setReservationDate(tomorrow.toISOString().split('T')[0]);

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, selectedBranchId]);

  if (!isOpen) return null;

  const currentBranchId = Number(branchId ?? selectedBranchId ?? (branches[0]?.id || 1));
  const selectedBranch = branches.find(b => b.id === currentBranchId) || branches[0];
  const phoneDigits = String(selectedBranch?.phone || '').replace(/\D/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please provide your name and phone number.');
      return;
    }

    try {
      setLoading(true);
      // Combine date and time to ISO UTC
      const combinedDateTime = new Date(`${reservationDate}T${reservationTime}:00`);
      if (isNaN(combinedDateTime.getTime()) || combinedDateTime <= new Date()) {
        setError('Please select a valid future date and time.');
        setLoading(false);
        return;
      }

      const res = await reservationsApi.create({
        branchId: currentBranchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        reservationDateUtc: combinedDateTime.toISOString(),
        guestCount: Number(guestCount),
        specialRequests: specialRequests.trim() || null
      });

      setBookingSuccess(res);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to submit reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(7, 23, 17, 0.75)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-dialog-title"
        onClick={event => event.stopPropagation()}
        style={{ background: '#fff', borderRadius: 24, maxWidth: 560, width: '100%', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0c251c 0%, #153c2e 100%)', color: '#fff', padding: '24px 28px', position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation modal"
            style={{ position: 'absolute', right: 18, top: 18, background: 'rgba(255,255,255,0.15)', border: 0, color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <X size={18} />
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <Sparkles size={14} /> Kabir's Kitchen Dining
          </span>
          <h2 id="reservation-dialog-title" style={{ margin: '6px 0 2px', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.65rem' }}>
            Table Reservation
          </h2>
          <p style={{ margin: 0, color: '#c7d9d0', fontSize: '0.85rem' }}>
            Book your dining experience or contact the branch directly.
          </p>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('online')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 600,
                background: activeTab === 'online' ? '#d4af37' : 'rgba(255,255,255,0.15)',
                color: activeTab === 'online' ? '#0c251c' : '#fff'
              }}
            >
              Online Booking Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 600,
                background: activeTab === 'contact' ? '#d4af37' : 'rgba(255,255,255,0.15)',
                color: activeTab === 'contact' ? '#0c251c' : '#fff'
              }}
            >
              Direct Branch Call
            </button>
          </div>
        </div>

        {/* Body content with scrolling */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {bookingSuccess ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '1.4rem' }}>Reservation Request Received!</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>
                Your request is pending confirmation. Our manager will review and confirm your table.
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Booking Reference</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c251c', marginTop: 2 }}>{bookingSuccess.referenceCode}</div>
                <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#334155' }}>
                  <strong>Branch:</strong> {selectedBranch?.name}<br />
                  <strong>Status:</strong> <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Review</span>
                </div>
              </div>
              <button
                type="button"
                className="button button--primary"
                onClick={onClose}
                style={{ width: '100%', padding: '12px' }}
              >
                Done
              </button>
            </div>
          ) : activeTab === 'online' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              {/* Branch */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} /> Branch
                </label>
                <select
                  value={currentBranchId}
                  onChange={e => setBranchId(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.address})</option>
                  ))}
                </select>
              </div>

              {/* Name & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    <User size={13} style={{ display: 'inline', marginRight: 4 }} /> Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Kabir Ahmed"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    <Phone size={13} style={{ display: 'inline', marginRight: 4 }} /> Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="017xxxxxxxx"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Date, Time & Guests */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    <Calendar size={13} style={{ display: 'inline', marginRight: 4 }} /> Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={reservationDate}
                    onChange={e => setReservationDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    <Clock size={13} style={{ display: 'inline', marginRight: 4 }} /> Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={reservationTime}
                    onChange={e => setReservationTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    <Users size={13} style={{ display: 'inline', marginRight: 4 }} /> Guests *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    required
                    value={guestCount}
                    onChange={e => setGuestCount(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  <Utensils size={13} style={{ display: 'inline', marginRight: 4 }} /> Special Requests (Optional)
                </label>
                <textarea
                  rows="2"
                  placeholder="Window seat, quiet corner, high chair, birthday decoration, etc."
                  value={specialRequests}
                  onChange={e => setSpecialRequests(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="button button--primary"
                style={{ width: '100%', padding: '12px', marginTop: 6, fontSize: '0.95rem', fontWeight: 700 }}
              >
                {loading ? 'Submitting Reservation...' : 'Confirm Reservation Request'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} /> Branch
                <select
                  value={currentBranchId}
                  onChange={event => setBranchId(Number(event.target.value))}
                  style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', background: '#fff' }}
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </label>

              {selectedBranch && (
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', color: '#475569', fontSize: '0.88rem' }}>
                  <strong>{selectedBranch.name}</strong>
                  <div>{selectedBranch.address}</div>
                  {selectedBranch.phone && <div style={{ marginTop: 4 }}>{selectedBranch.phone}</div>}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {selectedBranch?.phone && (
                  <>
                    <a href={`tel:${selectedBranch.phone}`} className="button button--primary">
                      <Phone size={15} /> Call Branch
                    </a>
                    <a
                      href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello, I would like to inquire about a table reservation at ${selectedBranch.name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button--light"
                    >
                      <MessageCircle size={15} /> WhatsApp Branch
                    </a>
                  </>
                )}
                <button type="button" className="button button--light" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
