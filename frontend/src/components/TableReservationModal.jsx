import React, { useEffect, useState } from 'react';
import { MapPin, MessageCircle, Phone, Sparkles, X } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function TableReservationModal({ isOpen, onClose }) {
  const { branches, selectedBranchId } = useApp();
  const [branchId, setBranchId] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
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

  const selectedBranch = branches.find(branch => branch.id === Number(branchId ?? selectedBranchId));
  const phoneDigits = String(selectedBranch?.phone || '').replace(/\D/g, '');

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
        style={{ background: '#fff', borderRadius: 24, maxWidth: 520, width: '100%', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ background: 'linear-gradient(135deg, #0c251c 0%, #153c2e 100%)', color: '#fff', padding: '24px 28px', position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation information"
            style={{ position: 'absolute', right: 18, top: 18, background: 'rgba(255,255,255,0.15)', border: 0, color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <X size={18} />
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <Sparkles size={14} /> Table reservations
          </span>
          <h2 id="reservation-dialog-title" style={{ margin: '6px 0 2px', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.65rem' }}>
            Contact a branch
          </h2>
          <p style={{ margin: 0, color: '#c7d9d0', fontSize: '0.85rem' }}>
            Online reservations are not available. Contact the branch directly to ask about availability.
          </p>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} /> Select Branch
            <select
              value={branchId ?? selectedBranchId ?? ''}
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
                  <Phone size={15} /> Call to check availability
                </a>
                <a
                  href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello, I would like to ask about a table reservation at ${selectedBranch.name}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--light"
                >
                  <MessageCircle size={15} /> Message branch
                </a>
              </>
            )}
            {!selectedBranch?.phone && <p role="status">No branch phone number is available. Please try again later.</p>}
            <button type="button" className="button button--light" onClick={onClose}>Close</button>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
            Contacting the branch does not create or confirm a reservation.
          </p>
        </div>
      </div>
    </div>
  );
}
