import React, { useState, useEffect, useMemo } from 'react';
import { X, Cake, Info, CheckCircle2, MessageSquare, AlertCircle, Tag, CreditCard, ChevronDown, ChevronUp, Sparkles, Search } from 'lucide-react';
import { useApp } from '../context/useApp';
import { CAKE_DESIGNS } from '../data/cakeDesigns';
import { bakeryApi, productsApi } from '../services/api';

const detectInitialFlavor = (name) => {
  if (!name) return 'Dutch Truffle Chocolate Fudge';
  if (/red velvet/i.test(name)) return 'Velvet Royale Strawberry Cream';
  if (/vanilla|white chocolate/i.test(name)) return 'Vanilla Bean White Chocolate';
  if (/black forest|cherry/i.test(name)) return 'Black Forest Cherry Royale';
  if (/cheesecake/i.test(name)) return 'Velvet Royale Strawberry Cream';
  if (/caramel|biscoff/i.test(name)) return 'Lotus Biscoff Caramel Crunch';
  if (/mango|passion/i.test(name)) return 'Mango Passionfruit Cream';
  if (/coffee|mocha/i.test(name)) return 'Coffee Mocha Hazelnut';
  return 'Dutch Truffle Chocolate Fudge';
};

const detectInitialFrosting = (name) => {
  if (!name) return 'Swiss Buttercream';
  if (/fondant|tier|wedding|pearl|gold leaf/i.test(name)) return 'Royal Fondant';
  if (/ganache|truffle|fudge|dark chocolate/i.test(name)) return 'Belgian Dark Ganache';
  if (/cream cheese/i.test(name)) return 'Cream Cheese Frosting';
  if (/whipped|fresh cream/i.test(name)) return 'Light Whipped Cream';
  return 'Swiss Buttercream';
};

export default function CakeCustomizerModal({ isOpen, onClose, product }) {
  const { createCustomCakeRequest, activeBranch, userProfile } = useApp();

  const [apiCakes, setApiCakes] = useState([]);
  const [selectedCake, setSelectedCake] = useState(product || null);
  const [isBrowseOpen, setIsBrowseOpen] = useState(!product);
  const [activeDesignCategory, setActiveDesignCategory] = useState('All Cakes');
  const [searchDesign, setSearchDesign] = useState('');

  const [weightUnit, setWeightUnit] = useState('pound'); // 'pound' or 'kg'
  const [selectedPound, setSelectedPound] = useState(1);
  const [selectedKg, setSelectedKg] = useState(1.5);
  const [customWeight, setCustomWeight] = useState(''); // for custom / large orders
  const [flavor, setFlavor] = useState(() => detectInitialFlavor(product?.name));
  const [creamType, setCreamType] = useState(() => detectInitialFrosting(product?.name));
  const [messageOnCake, setMessageOnCake] = useState('Happy Birthday Kabir!');
  const [deliveryDate, setDeliveryDate] = useState('Tomorrow');
  const [deliverySlot, setDeliverySlot] = useState('04:00 PM - 06:00 PM');
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

  // Payment proof submission state
  const [proofMethod, setProofMethod] = useState('bKash');
  const [proofTrx, setProofTrx] = useState('');
  const [proofSender, setProofSender] = useState('');
  const [proofAmount, setProofAmount] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [proofError, setProofError] = useState('');

  // Fetch all real store cakes from database
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    productsApi.listPage({ categoryId: 9, pageSize: 100 })
      .then(res => {
        if (!active || !Array.isArray(res?.items)) return;
        const validCakes = res.items
          .filter(item => item.isCustomCake || (item.subCategoryName !== 'Bread & Cookies' && item.subCategoryName !== 'Pastry & Brownies' && !item.name.includes('Slice')))
          .map(item => ({
            id: item.id,
            name: item.name,
            category: item.subCategoryName || item.categoryName || 'Celebration Cake',
            image: item.imageUrl || '/food-placeholder.svg',
            basePrice: Number(item.basePrice) || 1750,
            description: item.description || 'Artisanal handcrafted celebration cake by Kabir\'s Kitchen.'
          }));
        setApiCakes(validCakes);
        if (!product && validCakes.length > 0) {
          setSelectedCake(prev => prev || validCakes[0]);
        }
      })
      .catch(err => {
        console.warn('Could not load cake catalog:', err);
      });
    return () => { active = false; };
  }, [isOpen, product]);

  const allCakes = useMemo(() => {
    if (apiCakes.length > 0) return apiCakes;
    return CAKE_DESIGNS.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category || 'Celebration Cake',
      image: d.image,
      basePrice: 1750,
      description: d.description || ''
    }));
  }, [apiCakes]);

  const currentCake = useMemo(() => {
    if (selectedCake) return selectedCake;
    if (product) {
      return {
        id: product.id,
        name: product.name,
        category: product.subCategoryName || product.categoryName || 'Celebration Cake',
        image: product.image || product.imageUrl || '/food-placeholder.svg',
        basePrice: Number(product.basePrice) || 1750,
        description: product.description || ''
      };
    }
    return allCakes[0] || null;
  }, [selectedCake, product, allCakes]);

  const designCategories = useMemo(() => {
    return ['All Cakes', ...new Set(allCakes.map(c => c.category))];
  }, [allCakes]);

  const visibleCakes = useMemo(() => {
    return allCakes.filter(c => {
      const matchCat = activeDesignCategory === 'All Cakes' || c.category === activeDesignCategory;
      const matchSearch = !searchDesign.trim() || c.name.toLowerCase().includes(searchDesign.trim().toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allCakes, activeDesignCategory, searchDesign]);

  useEffect(() => {
    if (isOpen) {
      if (!customerName && userProfile?.name) setCustomerName(userProfile.name);
      if (!customerPhone && userProfile?.phone) setCustomerPhone(userProfile.phone);
      setBookingSuccess(null);
      setSubmitError('');
      setProofTrx('');
      setProofNote('');
      setProofSubmitted(false);
      setProofError('');
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

  // Rates determination based on realistic BD bakery market rates:
  const baseRate = Number(currentCake?.basePrice) || 1750;
  const isTiered = baseRate >= 2100 || (currentCake?.name && /tier|wedding|pearl|gold leaf/i.test(currentCake.name));
  const isGourmet = !isTiered && (baseRate >= 1800 || (currentCake?.name && /truffle|fudge|velvet|rosette|berry|ganache|confetti/i.test(currentCake.name)));

  const pricePerPound = isTiered ? 1050 : (isGourmet ? 850 : 800);
  const pricePerKg = isTiered ? 2300 : (isGourmet ? 1880 : 1750);
  const backendBaseRate = baseRate > 0 ? baseRate : pricePerKg;

  // Active quantity selected by user (either typed in custom box or selected from presets)
  const parsedCustom = parseFloat(customWeight);
  const isCustomActive = customWeight !== '' && !isNaN(parsedCustom) && parsedCustom > 0;
  const activeQuantity = isCustomActive ? parsedCustom : (weightUnit === 'pound' ? selectedPound : selectedKg);

  const targetSubTotal = weightUnit === 'pound'
    ? activeQuantity * pricePerPound
    : activeQuantity * pricePerKg;

  const effectiveWeightKg = parseFloat((targetSubTotal / backendBaseRate).toFixed(6));

  useEffect(() => {
    if (!isOpen || !currentCake?.id) {
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
      menuItemId: Number(currentCake.id),
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
  }, [isOpen, currentCake?.id, activeBranch.id, effectiveWeightKg, appliedCoupon]);

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
        menuItemId: Number(currentCake.id),
        weightKg: effectiveWeightKg,
        flavor,
        creamType,
        tierCount: isTiered ? '2 Tier' : '1 Tier',
        designName: currentCake.name,
        colorTheme: currentCake.name,
        messageOnCake,
        deliveryDate: getDeliveryDate(deliveryDate),
        deliverySlot,
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        deliveryAddress: deliveryAddress.trim() || null,
        couponCode: appliedCoupon ? appliedCoupon.trim() : null
      });
      setBookingSuccess(order);
      setProofAmount(String(order.advanceRequired || order.advanceRequiredAmount || ''));
      setProofSender(trimmedPhone);
      setProofSubmitted(false);
      setProofError('');
    } catch (error) {
      setSubmitError(error.response?.data?.message || 'Could not save the cake request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofSubmit = async (e) => {
    e.preventDefault();
    if (!bookingSuccess?.id) return;
    const cleanTrx = proofTrx.trim();
    if (!cleanTrx) {
      setProofError('Please enter the Transaction ID (TrxID) or sender last 4 digits.');
      return;
    }
    const cleanAmount = parseFloat(proofAmount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setProofError('Please enter a valid payment amount.');
      return;
    }

    setProofSubmitting(true);
    setProofError('');
    try {
      await bakeryApi.submitPaymentProof({
        cakeCustomOrderId: bookingSuccess.id,
        paymentMethod: proofMethod,
        senderPhoneOrAccount: proofSender.trim() || customerPhone.trim(),
        transactionId: cleanTrx,
        paidAmount: cleanAmount,
        customerNote: proofNote.trim() || null
      });
      setProofSubmitted(true);
    } catch (err) {
      setProofError(err.response?.data?.message || 'Failed to submit payment proof. You can also send receipt to WhatsApp.');
    } finally {
      setProofSubmitting(false);
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
                  {currentCake?.name || product?.name || 'Custom Cake'} • {activeQuantity} {weightUnit === 'pound' ? 'Pound' : 'KG'}
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

            {/* Kabir's Kitchen Official Advance Accounts */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 14, textAlign: 'left', maxWidth: 520, margin: '0 auto 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: '0.88rem', marginBottom: 4 }}>
                <Info size={16} /> Complete 50% Advance to Begin Baking
              </div>
              <p style={{ fontSize: '0.82rem', color: '#92400e', lineHeight: 1.5, margin: '0 0 8px' }}>
                Please send <strong>৳{bookingSuccess.advanceRequired || bookingSuccess.advanceRequiredAmount}</strong> (min 50%) using any method below with booking ref: <strong>{bookingSuccess.customOrderNumber || bookingSuccess.customNumber}</strong>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: '0.75rem' }}>
                <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#d946ef' }}>bKash (বিকাশ):</strong>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>01791665634</div>
                </div>
                <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#f97316' }}>Nagad (নগদ):</strong>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>01791665634</div>
                </div>
                <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#8b5cf6' }}>Rocket (রকেট):</strong>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>01791665634</div>
                </div>
                <div style={{ background: '#ffffff', padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <strong style={{ color: '#10b981' }}>Kitchen Counter:</strong>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>Cash / POS Card</div>
                </div>
              </div>
            </div>

            {/* Interactive Payment Proof Form */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 14, padding: 18, textAlign: 'left', maxWidth: 520, margin: '0 auto 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a', fontWeight: 900, fontSize: '0.92rem', marginBottom: 4 }}>
                <CreditCard size={18} color="#7e22ce" /> Submit Advance Payment Proof
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 12px', lineHeight: 1.4 }}>
                After sending money, enter your transaction reference below. Admin will verify it to unlock baking.
              </p>

              {proofSubmitted ? (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#059669', fontWeight: 800, fontSize: '0.92rem', marginBottom: 4 }}>
                    <CheckCircle2 size={18} /> Payment Proof Submitted!
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#047857', margin: '0 0 8px' }}>
                    Status: <strong>Awaiting Admin Verification</strong>
                  </p>
                  <div style={{ fontSize: '0.75rem', color: '#065f46', fontFamily: 'monospace', background: '#d1fae5', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>
                    [{proofMethod}] Trx: {proofTrx} • Claimed: ৳{proofAmount}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#047857', margin: '8px 0 0' }}>
                    Staff will verify your transaction shortly to approve baking.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleProofSubmit}>
                  {/* Method selection pills */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                      Payment Channel:
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { id: 'bKash', label: 'bKash (বিকাশ)', color: '#d946ef' },
                        { id: 'Nagad', label: 'Nagad (নগদ)', color: '#f97316' },
                        { id: 'Rocket', label: 'Rocket (রকেট)', color: '#8b5cf6' },
                        { id: 'Cash Counter', label: 'Cash at Counter', color: '#10b981' },
                        { id: 'Card POS', label: 'Card / POS', color: '#3b82f6' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setProofMethod(m.id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: proofMethod === m.id ? 800 : 600,
                            border: proofMethod === m.id ? `2px solid ${m.color}` : '1px solid #e2e8f0',
                            background: proofMethod === m.id ? '#faf5ff' : '#ffffff',
                            color: proofMethod === m.id ? m.color : '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Sender Number / Slip #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 017... or Last 4"
                        value={proofSender}
                        onChange={(e) => setProofSender(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Amount Paid (৳) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={proofAmount}
                        onChange={(e) => setProofAmount(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 800, color: '#7e22ce', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Transaction ID (TrxID) / Receipt Details *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9X738B4291 or Counter Cash"
                      value={proofTrx}
                      onChange={(e) => setProofTrx(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  {proofError && (
                    <p style={{ color: '#dc2626', fontSize: '0.78rem', margin: '0 0 10px', fontWeight: 700 }}>
                      {proofError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={proofSubmitting}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #7e22ce 0%, #6b21a8 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px',
                      borderRadius: 8,
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: proofSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {proofSubmitting ? 'Submitting proof…' : 'Submit Advance Payment Proof'}
                  </button>
                </form>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, maxWidth: 520, margin: '0 auto' }}>
              <a
                href={`https://wa.me/8801791665634?text=${encodeURIComponent(`Hi Kabir's Kitchen! I booked custom cake #${bookingSuccess.customOrderNumber || bookingSuccess.customNumber} (${bookingSuccess.customerName}). Size: ${activeQuantity} ${weightUnit === 'pound' ? 'Pound' : 'KG'}. Payment: Paid ৳${proofAmount || bookingSuccess.advanceRequired || bookingSuccess.advanceRequiredAmount} via ${proofMethod}${proofTrx ? ` (TrxID: ${proofTrx})` : ''}. Please verify and confirm my order.`)}`}
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
          {/* ─── 1. SELECTED CAKE SHOWCASE CARD ─── */}
          <div style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '2px solid #d8b4fe',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.08)'
          }}>
            <img
              src={currentCake?.image || '/food-placeholder.svg'}
              alt={currentCake?.name}
              style={{
                width: 90,
                height: 90,
                borderRadius: 12,
                objectFit: 'cover',
                flexShrink: 0,
                border: '2px solid #ffffff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  background: '#7e22ce',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {currentCake?.category || 'Celebration Cake'}
                </span>
                <span style={{ fontSize: '0.76rem', color: '#6b21a8', fontWeight: 700 }}>
                  Base: ৳{pricePerPound}/lb (৳{pricePerKg}/kg)
                </span>
              </div>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 900, lineHeight: 1.3 }}>
                {currentCake?.name || 'Custom Celebration Cake'}
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.76rem', lineHeight: 1.35 }}>
                {currentCake?.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBrowseOpen(!isBrowseOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 10,
                border: '1.5px solid #8b5cf6',
                background: isBrowseOpen ? '#8b5cf6' : '#ffffff',
                color: isBrowseOpen ? '#ffffff' : '#7e22ce',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(139, 92, 246, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              <Sparkles size={14} />
              {isBrowseOpen ? 'Hide Cake Catalog' : `Browse All Cakes (${allCakes.length})`}
              {isBrowseOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* ─── 2. BROWSE ALL CAKES GALLERY (69+ REAL STORE CAKES) ─── */}
          {isBrowseOpen && (
            <section aria-labelledby="cake-design-heading" style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <h4 id="cake-design-heading" style={{ margin: 0, color: '#0f172a', fontSize: '0.98rem', fontWeight: 900 }}>
                    Choose From All Cakes & Bakery Catalog
                  </h4>
                  <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.76rem' }}>
                    {allCakes.length} handcrafted cake designs available in Kabir&apos;s Kitchen
                  </p>
                </div>
                <div style={{ position: 'relative', width: 220 }}>
                  <input
                    type="text"
                    placeholder="Search cakes..."
                    value={searchDesign}
                    onChange={(e) => setSearchDesign(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div role="group" aria-label="Filter cake designs" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 10 }}>
                {designCategories.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveDesignCategory(category)}
                    aria-pressed={activeDesignCategory === category}
                    style={{
                      border: activeDesignCategory === category ? '1.5px solid #8b5cf6' : '1px solid #e2e8f0',
                      borderRadius: 999,
                      padding: '7px 13px',
                      background: activeDesignCategory === category ? '#7e22ce' : '#ffffff',
                      color: activeDesignCategory === category ? '#ffffff' : '#475569',
                      whiteSpace: 'nowrap',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Cakes Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                gap: 12,
                maxHeight: 380,
                overflowY: 'auto',
                paddingRight: 4
              }}>
                {visibleCakes.map(cake => {
                  const isSelected = cake.id === currentCake?.id;
                  return (
                    <button
                      key={cake.id}
                      type="button"
                      onClick={() => {
                        setSelectedCake(cake);
                        setFlavor(detectInitialFlavor(cake.name));
                        setCreamType(detectInitialFrosting(cake.name));
                        setIsBrowseOpen(false); // auto-collapse to focus on customization!
                      }}
                      aria-pressed={isSelected}
                      style={{
                        overflow: 'hidden',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        border: isSelected ? '2.5px solid #8b5cf6' : '1px solid #e2e8f0',
                        borderRadius: 12,
                        background: isSelected ? '#faf5ff' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 3px #8b5cf633' : '0 2px 6px rgba(15, 23, 42, .04)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img
                        src={cake.image}
                        alt={cake.name}
                        loading="lazy"
                        style={{ display: 'block', width: '100%', height: 125, objectFit: 'cover' }}
                      />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 10px 11px' }}>
                        <span style={{ color: '#7e22ce', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' }}>
                          {cake.category}
                        </span>
                        <strong style={{ color: '#0f172a', fontSize: '0.82rem', lineHeight: 1.25, height: 32, overflow: 'hidden' }}>
                          {cake.name}
                        </strong>
                        <span style={{ color: '#059669', fontSize: '0.74rem', fontWeight: 800 }}>
                          ৳{cake.basePrice} / kg
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

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
              <option value="Lotus Biscoff Caramel Crunch">Lotus Biscoff Caramel Crunch</option>
              <option value="Mango Passionfruit Cream">Mango Passionfruit Cream</option>
              <option value="Coffee Mocha Hazelnut">Coffee Mocha Hazelnut</option>
            </select>
          </div>

          {/* Cream / Frosting Selection */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 6 }}>
              Frosting & Decoration Style
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {[
                'Belgian Dark Ganache',
                'Swiss Buttercream',
                'Royal Fondant',
                'Cream Cheese Frosting',
                'Light Whipped Cream'
              ].map(cream => (
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
                    fontSize: '0.78rem',
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
