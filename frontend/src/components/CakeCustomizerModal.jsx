import React, { useState, useEffect } from 'react';
import { X, Cake, Info, CheckCircle2, MessageSquare, AlertCircle, Tag } from 'lucide-react';
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

  const [weightUnit, setWeightUnit] = useState('pound'); // 'pound' or 'kg'
  const [selectedPound, setSelectedPound] = useState(1);
  const [selectedKg, setSelectedKg] = useState(1.5);
  const [customWeight, setCustomWeight] = useState(''); // for custom / large orders
  const [flavor, setFlavor] = useState(initialDesign.flavor);
  const [creamType, setCreamType] = useState(initialDesign.frosting);
  const [messageOnCake, setMessageOnCake] = useState('Happy Birthday Kabir!');
  const [deliveryDate, setDeliveryDate] = useState('Tomorrow');
  const [deliverySlot, setDeliverySlot] = useState('04:00 PM - 06:00 PM');
  const [selectedDesignId, setSelectedDesignId] = useState(initialDesign.id);
  const [activeDesignCategory, setActiveDesignCategory] = useState('All designs');
  const [customerName, setCustomerName] = useState(userProfile?.name || '');
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [priceQuote, setPriceQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (!customerName && userProfile?.name) setCustomerName(userProfile.name);
      if (!customerPhone && userProfile?.phone) setCustomerPhone(userProfile.phone);
      setBookingSuccess(null);
      setSubmitError('');
    }
  }, [isOpen, userProfile]);

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
  // Rates determination: standard cakes = 800/pound (1750/kg), gourmet = 850/pound (1880/kg), wedding = 1050/pound (2300/kg)
  const baseRate = Number(product?.basePrice) || 1750;
  const pricePerPound = baseRate >= 2100 ? 1050 : baseRate >= 1800 ? 850 : 800;
  const pricePerKg = baseRate;

  // Active quantity selected by user (either typed in custom box or selected from presets)
  const parsedCustom = parseFloat(customWeight);
  const isCustomActive = customWeight !== '' && !isNaN(parsedCustom) && parsedCustom > 0;
  const activeQuantity = isCustomActive ? parsedCustom : (weightUnit === 'pound' ? selectedPound : selectedKg);

  // Effective weightKg to send to backend so that backend calculation matches exact taka
  const effectiveWeightKg = (() => {
    if (weightUnit === 'pound') {
      const targetSubTotal = activeQuantity * pricePerPound;
      return parseFloat((targetSubTotal / baseRate).toFixed(6));
    }
    return activeQuantity;
  })();

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
      weightKg: Number(effectiveWeightKg),
      couponCode: appliedCoupon ? appliedCoupon.trim() : null
    }).then(quote => {
      if (active) {
        setPriceQuote(quote);
        if (appliedCoupon && Number(quote.discountAmount) <= 0) {
          setCouponError('Coupon applied, but gives 0 discount or does not match this cake.');
        } else {
          setCouponError('');
        }
      }
    }).catch(error => {
      if (active) {
        const msg = error.response?.data?.message || 'Could not verify this cake price with the server.';
        if (appliedCoupon) {
          setCouponError(msg);
          setAppliedCoupon('');
        } else {
          setQuoteError(msg);
        }
      }
    }).finally(() => {
      if (active) setQuoteLoading(false);
    });

    return () => { active = false; };
  }, [isOpen, product?.id, activeBranch.id, effectiveWeightKg, appliedCoupon]);
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
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    if (!trimmedName || !trimmedPhone) {
      setSubmitError('Please enter your Name and Phone/WhatsApp number so we can confirm your custom order.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await createCustomCakeRequest({
        menuItemId: product.id,
        weightKg: effectiveWeightKg,
        flavor,
        creamType,
        tierCount: '1 Tier',
        designName: selectedDesign.name,
        colorTheme: selectedDesign.name,
        messageOnCake,
        deliveryDate: getDeliveryDate(deliveryDate),
        deliverySlot,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        deliveryAddress: deliveryAddress.trim() || null,
        couponCode: appliedCoupon ? appliedCoupon.trim() : null
      });
      setBookingSuccess(order);
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

        {/* Content */}
        {bookingSuccess ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#059669' }}>
              <CheckCircle2 size={40} />
            </div>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              Custom Cake Booking Confirmed!
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 20px' }}>
              Your custom cake request has been registered in Kabir&apos;s Kitchen system.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, textAlign: 'left', maxWidth: 520, margin: '0 auto 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #e2e8f0', marginBottom: 10, fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>Booking Reference:</span>
                <strong style={{ color: '#7e22ce', fontFamily: 'monospace', fontSize: '1rem' }}>{bookingSuccess.customOrderNumber || bookingSuccess.customNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #e2e8f0', marginBottom: 10, fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <strong style={{ color: '#0f172a' }}>{bookingSuccess.customerName} ({bookingSuccess.customerPhone})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #e2e8f0', marginBottom: 10, fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Design & Weight:</span>
                <strong style={{ color: '#0f172a' }}>
                  {product?.name || 'Custom Cake'} • {activeQuantity} {weightUnit === 'pound' ? 'Pound' : 'KG'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #e2e8f0', marginBottom: 10, fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Total Estimated Price:</span>
                <strong style={{ color: '#0f172a' }}>৳{bookingSuccess.estimatedPrice}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', color: '#b45309', fontWeight: 900 }}>
                <span>50% Advance Payable:</span>
                <span>৳{bookingSuccess.advanceRequired || bookingSuccess.advanceRequiredAmount}</span>
              </div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 14, textAlign: 'left', maxWidth: 520, margin: '0 auto 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: '0.88rem', marginBottom: 4 }}>
                <Info size={16} /> Complete 50% Advance to Begin Baking
              </div>
              <p style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                Please pay <strong>৳{bookingSuccess.advanceRequired || bookingSuccess.advanceRequiredAmount}</strong> via bKash / Nagad or at the counter with booking ref <strong>{bookingSuccess.customOrderNumber || bookingSuccess.customNumber}</strong>. You can also send the receipt directly to our WhatsApp helpline.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, maxWidth: 520, margin: '0 auto' }}>
              <a
                href={`https://wa.me/8801791665634?text=${encodeURIComponent(`Hi Kabir's Kitchen! I booked custom cake #${bookingSuccess.customOrderNumber || bookingSuccess.customNumber} (${bookingSuccess.customerName}). Size: ${activeQuantity} ${weightUnit === 'pound' ? 'Pound' : 'KG'}. I want to complete my 50% advance payment of ৳${bookingSuccess.advanceRequired || bookingSuccess.advanceRequiredAmount}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                <MessageSquare size={16} /> Confirm via WhatsApp
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
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

          {/* Weight / Size Selection */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Cake Weight / Size
              </label>
              {/* Unit Toggle: Pound vs KG */}
              <div style={{ display: 'inline-flex', background: '#e2e8f0', borderRadius: 8, padding: 2 }}>
                <button
                  type="button"
                  onClick={() => {
                    setWeightUnit('pound');
                    setCustomWeight('');
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: weightUnit === 'pound' ? '#8b5cf6' : 'transparent',
                    color: weightUnit === 'pound' ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Pound
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeightUnit('kg');
                    setCustomWeight('');
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: weightUnit === 'kg' ? '#8b5cf6' : 'transparent',
                    color: weightUnit === 'kg' ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  KG
                </button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: weightUnit === 'pound' ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
              {(weightUnit === 'pound'
                ? [1, 2, 3, 5, 10, 20]
                : [1.0, 1.5, 2.0, 3.0, 5.0]
              ).map(val => {
                const isSelected = !customWeight && (weightUnit === 'pound' ? selectedPound === val : selectedKg === val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setCustomWeight('');
                      if (weightUnit === 'pound') setSelectedPound(val);
                      else setSelectedKg(val);
                    }}
                    style={{
                      padding: '10px 4px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                      background: isSelected ? '#faf5ff' : '#ffffff',
                      color: isSelected ? '#7e22ce' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {val} {weightUnit === 'pound' ? 'Pound' : 'KG'}
                  </button>
                );
              })}
            </div>

            {/* Custom Weight Input for Large / Mega Orders */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Custom {weightUnit === 'pound' ? 'Pound' : 'KG'}:
                </span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="number"
                    min="0.5"
                    max={weightUnit === 'pound' ? '220' : '100'}
                    step="0.5"
                    placeholder={weightUnit === 'pound' ? 'e.g. 1, 2, 5, 10, 20, 50, 100 Pound' : 'e.g. 1, 1.5, 2, 5, 10, 25 KG'}
                    value={customWeight}
                    onChange={(e) => setCustomWeight(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 55px 8px 12px',
                      borderRadius: 8,
                      border: customWeight ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#8b5cf6',
                    pointerEvents: 'none'
                  }}>
                    {weightUnit === 'pound' ? 'Pound' : 'KG'}
                  </span>
                </div>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>
                  Selected: {activeQuantity} {weightUnit === 'pound' ? 'Pound' : 'KG'}
                </span>
                <span style={{ color: '#7e22ce', fontWeight: 700 }}>
                  Rate: ৳{weightUnit === 'pound' ? pricePerPound : pricePerKg} / {weightUnit === 'pound' ? 'Pound' : 'KG'}
                </span>
              </p>
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

          {/* Customer Contact & Booking Information */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
              Customer Contact Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kabir Hossain"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Phone / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 01791665634"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Delivery Address or Special Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Pickup at Dhanmondi Branch, or House 12, Road 4..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Kabir's Kitchen 50% Advance Payment Policy Notice */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>
              <Info size={16} /> Kabir&apos;s Kitchen Custom Cake Policy
            </div>
            <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5, margin: 0 }}>
              Handcrafted custom cakes require a <strong>50% advance payment (৳{advanceRequired ?? '—'})</strong> to confirm the order and begin bakery preparation. The remaining 50% balance is payable upon delivery or pickup.
            </p>
          </div>

          {/* Promo / VIP Discount Coupon Box */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={15} color="#8b5cf6" /> Have a Promo / VIP Discount Code?
              </span>
              {appliedCoupon && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: 12 }}>
                  ✓ Code &quot;{appliedCoupon}&quot; Applied
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="e.g. VIP200, KABIRSPECIAL..."
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase());
                  setCouponError('');
                }}
                disabled={!!appliedCoupon}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  background: appliedCoupon ? '#f1f5f9' : '#ffffff'
                }}
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon('');
                    setCouponInput('');
                    setCouponError('');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #fca5a5',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = couponInput.trim();
                    if (!trimmed) {
                      setCouponError('Please enter a coupon code.');
                      return;
                    }
                    setAppliedCoupon(trimmed);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              )}
            </div>
            {couponError && (
              <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#dc2626', fontWeight: 600 }}>
                {couponError}
              </p>
            )}
          </div>

          {/* Summary Box */}
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            {quoteError && <p role="alert" style={{ color: '#be123c', margin: '0 0 10px' }}>{quoteError}</p>}
            {submitError && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: 8, color: '#be123c', fontSize: '0.85rem', fontWeight: 700, margin: '0 0 10px' }}>
                <AlertCircle size={16} /> {submitError}
              </div>
            )}
            <p role="status" style={{ color: '#64748b', margin: '0 0 10px', fontSize: 12 }}>
              {quoteLoading ? 'Checking current cake price and offers…' :
                priceQuote?.campaignName ? `Offer applied: ${priceQuote.campaignName}` :
                  quoteError ? '' : 'Prices calculated with active offers and advance policy.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Price before offer:</span>
              <strong>৳{priceQuote?.subTotal ?? '—'}</strong>
            </div>
            {Number(priceQuote?.discountAmount) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', marginBottom: 4 }}>
              <span>Offer discount:</span><strong>-৳{priceQuote.discountAmount}</strong>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>
                Final price ({activeQuantity} {weightUnit === 'pound' ? 'Pound' : 'KG'}):
              </span>
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
        )}
      </div>
    </div>
  );
}
