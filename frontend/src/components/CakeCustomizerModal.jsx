import React, { useState, useEffect } from 'react';
import { X, Cake, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/useApp';
import { CAKE_DESIGNS } from '../data/cakeDesigns';
import { bakeryApi } from '../services/api';

const DESIGN_CATEGORIES = ['All designs', ...new Set(CAKE_DESIGNS.map(design => design.category))];

function CakeDesignPreview({ design }) {
  return (
    <img
      src={design.image}
      alt={`${design.name} cake`}
      loading="lazy"
      style={{ display: 'block', width: '100%', height: 150, objectFit: 'cover', background: design.background }}
    />
  );
}

export default function CakeCustomizerModal({ isOpen, onClose, product }) {
  const { createCustomCakeRequest, activeBranch, userProfile } = useApp();
  const initialDesign = CAKE_DESIGNS.find(design => design.id === product?.cakeDesignId) ?? CAKE_DESIGNS[0];

  const [weightKg, setWeightKg] = useState(1.5);
  const [flavor, setFlavor] = useState(initialDesign.flavor);
  const [creamType, setCreamType] = useState(initialDesign.frosting);
  const [messageOnCake, setMessageOnCake] = useState('Happy Birthday Kabir!');
  const [deliveryDate, setDeliveryDate] = useState('Tomorrow');
  const [deliverySlot, setDeliverySlot] = useState('04:00 PM - 06:00 PM');
  const [selectedDesignId, setSelectedDesignId] = useState(initialDesign.id);
  const [activeDesignCategory, setActiveDesignCategory] = useState('All designs');
  const [priceQuote, setPriceQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen || !product?.id) {
      setPriceQuote(null);
      setQuoteError('');
      return undefined;
    }

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');
    setPriceQuote(null);
    bakeryApi.quoteCustomCake({
      branchId: Number(activeBranch.id),
      menuItemId: Number(product.id),
      weightKg: Number(weightKg),
      couponCode: null
    }).then(quote => {
      if (active) setPriceQuote(quote);
    }).catch(error => {
      if (active) {
        setQuoteError(error.response?.data?.message || 'Could not verify this cake price with the server.');
      }
    }).finally(() => {
      if (active) setQuoteLoading(false);
    });

    return () => { active = false; };
  }, [isOpen, product?.id, activeBranch.id, weightKg]);
  const selectedDesign = CAKE_DESIGNS.find(design => design.id === selectedDesignId) ?? CAKE_DESIGNS[0];
  const visibleDesigns = activeDesignCategory === 'All designs'
    ? CAKE_DESIGNS
    : CAKE_DESIGNS.filter(design => design.category === activeDesignCategory);

  if (!isOpen) return null;

  const estimatedPrice = priceQuote?.estimatedPrice;
  const advanceRequired = priceQuote?.advanceRequiredAmount;

  const getDeliveryDate = (selection) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    if (selection === 'Tomorrow') date.setDate(date.getDate() + 1);
    else if (selection === 'Day After Tomorrow') date.setDate(date.getDate() + 2);
    else {
      const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday);
    }
    return date.toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!priceQuote || quoteLoading || quoteError) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await createCustomCakeRequest({
        menuItemId: product.id,
        weightKg,
        flavor,
        creamType,
        designName: selectedDesign.name,
        colorTheme: selectedDesign.name,
        messageOnCake,
        deliveryDate: getDeliveryDate(deliveryDate),
        deliverySlot,
        customerName: userProfile.name,
        customerPhone: userProfile.phone
      });
      onClose();
      alert(`Custom cake request saved. Offer-adjusted price: ৳${order.estimatedPrice}. Pay 50% advance (৳${order.advanceRequired}) to confirm production.`);
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Could not save the cake request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 15, 23, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overscrollBehavior: 'contain'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          maxWidth: 880,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#faf5ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Cake size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase' }}>
                Artisan Celebration Cake Studio
              </span>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0b0f17', margin: 0 }}>
                Custom Celebration Cake
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={22} color="#64748b" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section aria-labelledby="cake-design-heading">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <h4 id="cake-design-heading" style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 900 }}>
                  Choose a cake design
                </h4>
                <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                  {CAKE_DESIGNS.length} made-to-order styles · selected: {selectedDesign.name}
                </p>
              </div>
              <span style={{ flexShrink: 0, borderRadius: 999, background: '#f3e8ff', color: '#7e22ce', padding: '5px 10px', fontSize: '0.72rem', fontWeight: 800 }}>
                {selectedDesign.category}
              </span>
            </div>
            <div role="group" aria-label="Filter cake designs" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8 }}>
              {DESIGN_CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveDesignCategory(category)}
                  aria-pressed={activeDesignCategory === category}
                  style={{
                    border: activeDesignCategory === category ? '1px solid #8b5cf6' : '1px solid #e2e8f0',
                    borderRadius: 999,
                    padding: '7px 11px',
                    background: activeDesignCategory === category ? '#f5f0ff' : '#fff',
                    color: activeDesignCategory === category ? '#6d28d9' : '#475569',
                    whiteSpace: 'nowrap',
                    fontSize: '0.74rem',
                    fontWeight: 750,
                    cursor: 'pointer'
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 12 }}>
              {visibleDesigns.map(design => {
                const isSelected = design.id === selectedDesignId;
                return (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => {
                      setSelectedDesignId(design.id);
                      setFlavor(design.flavor);
                      setCreamType(design.frosting);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${design.name}, ${design.category}${isSelected ? ', selected' : ''}`}
                    style={{
                      overflow: 'hidden',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      border: isSelected ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                      borderRadius: 12,
                      background: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 3px #8b5cf622' : '0 2px 8px rgba(15, 23, 42, .04)'
                    }}
                  >
                    <CakeDesignPreview design={design} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 11px 12px', textAlign: 'left' }}>
                      <strong style={{ color: '#1e293b', fontSize: '0.86rem', lineHeight: 1.2 }}>{design.name}</strong>
                      <span style={{ color: '#7e22ce', fontSize: '0.68rem', fontWeight: 800 }}>{design.category} design</span>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.35 }}>{design.description}</span>
                      <span style={{ color: '#475569', fontSize: '0.68rem', lineHeight: 1.35 }}>
                        {design.flavor} · {design.frosting}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Weight / Size Buttons */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 8 }}>
              Select Cake Weight / Size
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[1.0, 1.5, 2.0, 3.0].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeightKg(w)}
                  style={{
                    padding: '12px 6px',
                    borderRadius: 10,
                    border: weightKg === w ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                    background: weightKg === w ? '#faf5ff' : '#ffffff',
                    color: weightKg === w ? '#7e22ce' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {w} kg
                </button>
              ))}
            </div>
          </div>

          {/* Flavor Selection */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
              Flavor Profile
            </label>
            <select
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }}
            >
              <option value="Dutch Truffle Chocolate Fudge">Dutch Truffle Chocolate Fudge (Rich 64% Cocoa)</option>
              <option value="Velvet Royale Strawberry Cream">Velvet Royale Strawberry Cream (Cream Cheese)</option>
              <option value="Vanilla Bean White Chocolate">Vanilla Bean White Chocolate Ganache</option>
              <option value="Black Forest Cherry Royale">Black Forest with Spiced Cherry Compote</option>
            </select>
          </div>

          {/* Cream / Frosting Selection */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
              Frosting & Decoration Style
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['Belgian Dark Ganache', 'Swiss Buttercream', 'Royal Fondant'].map(cream => (
                <button
                  key={cream}
                  type="button"
                  onClick={() => setCreamType(cream)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 8,
                    border: creamType === cream ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                    background: creamType === cream ? '#faf5ff' : '#ffffff',
                    color: creamType === cream ? '#7e22ce' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {cream}
                </button>
              ))}
            </div>
          </div>

          {/* Personalized Message on Cake */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
              Message to Write on Cake
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Happy 25th Birthday Kabir!"
              value={messageOnCake}
              onChange={(e) => setMessageOnCake(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
            />
          </div>

          {/* Scheduled Delivery Slot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Delivery Date
              </label>
              <select
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              >
                <option value="Tomorrow">Tomorrow</option>
                <option value="Day After Tomorrow">Day After Tomorrow</option>
                <option value="This Friday Evening">This Friday Evening</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Time Slot
              </label>
              <select
                value={deliverySlot}
                onChange={(e) => setDeliverySlot(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              >
                <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                <option value="07:00 PM - 09:00 PM">07:00 PM - 09:00 PM</option>
              </select>
            </div>
          </div>

          {/* Strict 50% Advance Payment Rule Notice */}
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>
              <AlertTriangle size={16} /> Backend Business Rule Notice
            </div>
            <p style={{ fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.45, margin: 0 }}>
              Bakery production requires an advance equal to <strong>50% of the final price after eligible offers (৳{advanceRequired ?? '—'})</strong>. The server recalculates both the offer and advance when you submit.
            </p>
          </div>

          {/* Summary Box */}
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            {quoteError && <p role="alert" style={{ color: '#be123c', margin: '0 0 10px' }}>{quoteError}</p>}
            {submitError && <p role="alert" style={{ color: '#be123c', margin: '0 0 10px' }}>{submitError}</p>}
            <p role="status" style={{ color: '#64748b', margin: '0 0 10px', fontSize: 12 }}>
              {quoteLoading ? 'Checking current cake price and offers…' :
                priceQuote?.campaignName ? `Offer applied: ${priceQuote.campaignName}` :
                  quoteError ? '' : 'Price and eligible offers checked by the server.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Price before offer:</span>
              <strong>৳{priceQuote?.subTotal ?? '—'}</strong>
            </div>
            {Number(priceQuote?.discountAmount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', marginBottom: 4 }}>
              <span>Offer discount:</span><strong>-৳{priceQuote.discountAmount}</strong>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Final price ({weightKg} kg):</span>
              <strong>৳{estimatedPrice ?? '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7e22ce', fontWeight: 800 }}>
              <span>50% Advance Payable:</span>
              <span>৳{advanceRequired ?? '—'}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || quoteLoading || !!quoteError || !priceQuote}
            style={{
              padding: '14px',
              borderRadius: 10,
              border: 'none',
              background: '#8b5cf6',
              color: 'white',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: submitting || quoteLoading || !!quoteError || !priceQuote ? 'not-allowed' : 'pointer',
              opacity: submitting || quoteLoading || !!quoteError || !priceQuote ? 0.65 : 1,
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
            }}
          >
            {submitting ? 'Saving cake request…' : 'Submit Custom Cake Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}
