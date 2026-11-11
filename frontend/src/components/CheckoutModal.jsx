import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function CheckoutModal({ isOpen, onClose, onOrderPlaced }) {
  const { cart, activeBranch, placeOrder, quoteOrder, userProfile, appliedCoupon } = useApp();

  const [orderType, setOrderType] = useState('Delivery'); // 'Delivery' | 'Pickup' | 'DineIn'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [priceQuote, setPriceQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);

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
    if (!isOpen || cart.length === 0) {
      setPriceQuote(null);
      setQuoteError('');
      return undefined;
    }

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');
    setPriceQuote(null);
    quoteOrder({
      items: cart,
      orderType,
      couponCode: appliedCoupon?.code || null
    })
      .then(quote => {
        if (active) setPriceQuote(quote);
      })
      .catch(error => {
        if (!active) return;
        setPriceQuote(null);
        setQuoteError(error.response?.data?.message || 'Could not verify the latest price with the server.');
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => { active = false; };
  }, [isOpen, cart, orderType, appliedCoupon?.code, quoteOrder]);

  if (!isOpen) return null;

  const displayedCustomerName = nameEdited ? customerName : userProfile.name;
  const displayedCustomerPhone = phoneEdited ? customerPhone : userProfile.phone;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!priceQuote || quoteLoading || quoteError) {
      setSubmitError('The latest server price must be verified before placing this order.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const createdOrder = await placeOrder({
        orderType,
        customerName: displayedCustomerName,
        customerPhone: displayedCustomerPhone,
        deliveryAddress,
        tableNumber,
        paymentMethod,
        notes: deliveryNotes
      });

      if (createdOrder) {
        onOrderPlaced(createdOrder);
        onClose();
      }
    } catch (requestError) {
      setSubmitError(requestError.response?.data?.message || 'Your order was not saved. Please check your connection and try again.');
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
        zIndex: 300,
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
          maxWidth: 580,
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
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ff7828', textTransform: 'uppercase' }}>
              Express Checkout
            </span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0b0f17', margin: 0 }}>
              Complete Your Order
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={22} color="#64748b" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {submitError && <div role="alert" style={{ padding: '10px 12px', borderRadius: 8, background: '#fff1f2', color: '#be123c', fontWeight: 700 }}>{submitError}</div>}
          {/* Channel Selector: Delivery | Pickup | Dine-in */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 8 }}>
              Dining / Delivery Option
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { id: 'Delivery', label: 'Home Delivery 🚴' },
                { id: 'Pickup', label: 'Store Pickup 🛍️' },
                { id: 'DineIn', label: 'Dine-In Table 🍽️' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOrderType(opt.id)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 10,
                    border: orderType === opt.id ? '2px solid #ff7828' : '1px solid #e2e8f0',
                    background: orderType === opt.id ? '#fff7ed' : '#ffffff',
                    color: orderType === opt.id ? '#ea580c' : '#475569',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayedCustomerName}
                onChange={(e) => { setCustomerName(e.target.value); setNameEdited(true); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Phone Number
              </label>
              <input
                type="text"
                required
                value={displayedCustomerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); setPhoneEdited(true); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* Conditional Address or Table Number */}
          {orderType === 'Delivery' ? (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Delivery Address
              </label>
              <textarea
                required
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit' }}
              />
            </div>
          ) : orderType === 'DineIn' ? (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Dining Table Number
              </label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. Table 4"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#64748b' }}>
              Pickup Location: <strong>{activeBranch.name}</strong> ({activeBranch.address})
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: 8 }}>
              Select Payment Method
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {[
                { id: 'Cash', label: orderType === 'Delivery' ? 'Cash on delivery' : 'Pay in person', color: '#0f172a', disabled: false },
                { id: 'bKash', label: 'bKash · coming soon', color: '#e11d48', disabled: true },
                { id: 'Nagad', label: 'Nagad · coming soon', color: '#ea580c', disabled: true },
                { id: 'Rocket', label: 'Rocket · coming soon', color: '#7c3aed', disabled: true },
                { id: 'Card', label: 'SSLCommerz / Card · coming soon', color: '#2563eb', disabled: true },
                { id: 'Other', label: 'Other gateway · coming soon', color: '#475569', disabled: true }
              ].map(pay => (
                <button
                  key={pay.id}
                  type="button"
                  onClick={() => setPaymentMethod(pay.id)}
                  disabled={pay.disabled}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 8,
                    border: paymentMethod === pay.id ? `2px solid ${pay.color}` : '1px solid #e2e8f0',
                    background: paymentMethod === pay.id ? '#f8fafc' : '#ffffff',
                    color: pay.color,
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: pay.disabled ? 'not-allowed' : 'pointer',
                    opacity: pay.disabled ? 0.55 : 1
                  }}
                >
                  {pay.label}
                </button>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.76rem' }}>
              Online payment is not active yet. Your order will remain unpaid until the branch or delivery staff records the payment.
            </p>
          </div>

          {/* Delivery Note */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
              Rider Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Ring bell twice, deliver to 3rd floor..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </div>

          {/* Order Summary & Price Breakdown */}
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            {quoteError && <div role="alert" style={{ color: '#be123c', fontSize: 13, marginBottom: 8, fontWeight: 700 }}>{quoteError}</div>}
            {!quoteError && (
              <div style={{ color: priceQuote?.discountAmount > 0 ? '#15803d' : '#64748b', fontSize: 12, marginBottom: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                {quoteLoading
                  ? 'Checking server price…'
                  : priceQuote?.campaignName
                    ? `🎉 Offer applied: ${priceQuote.campaignName} (-৳${priceQuote.discountAmount})`
                    : 'Price verified by server.'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                <span>{priceQuote ? `৳${priceQuote.subTotal}` : '—'}</span>
              </div>

              {priceQuote?.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 700 }}>
                  <span>Offer Discount</span>
                  <span>-৳{priceQuote.discountAmount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{orderType === 'Delivery' ? 'Delivery Fee' : orderType === 'DineIn' ? 'Table Service' : 'Store Pickup'}</span>
                <span>{priceQuote ? (priceQuote.deliveryFee > 0 ? `৳${priceQuote.deliveryFee}` : 'FREE') : '—'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VAT & Tax (5%)</span>
                <span>{priceQuote ? `৳${priceQuote.taxAmount}` : '—'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900, color: '#0b0f17', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                <span>Total Payable</span>
                <span style={{ color: '#ff7828' }}>{priceQuote ? `৳${priceQuote.totalAmount}` : '—'}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || quoteLoading || !!quoteError || !priceQuote}
            style={{
              padding: '15px',
              borderRadius: 10,
              border: 'none',
              background: '#ff7828',
              color: 'white',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: submitting ? 'wait' : quoteLoading || quoteError || !priceQuote ? 'not-allowed' : 'pointer',
              opacity: submitting || quoteLoading || quoteError || !priceQuote ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(255, 120, 40, 0.4)'
            }}
          >
            {submitting ? 'Saving your order…' : `Confirm & Place Order (${priceQuote ? `৳${priceQuote.totalAmount}` : 'Price unavailable'})`}
          </button>
        </form>
      </div>
    </div>
  );
}
