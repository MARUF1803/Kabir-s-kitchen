import React, { useEffect, useState } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function CartDrawer({ onProceedToCheckout }) {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQty,
    removeFromCart,
    cartSubtotal,
    appliedCoupon,
    setAppliedCoupon,
    validateCoupon,
    quoteOrder
  } = useApp();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [serverQuote, setServerQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (!isCartOpen || cart.length === 0) {
      setServerQuote(null);
      setQuoteError('');
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const quote = await quoteOrder({
          items: cart,
          orderType: 'Delivery',
          couponCode: appliedCoupon?.code || null
        });
        if (active) setServerQuote(quote);
      } catch (error) {
        if (active) {
          setServerQuote(null);
          setQuoteError(error.response?.data?.message || 'Could not verify the latest price with the server.');
        }
      } finally {
        if (active) setQuoteLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isCartOpen, cart, appliedCoupon?.code, quoteOrder]);

  if (!isCartOpen) return null;

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    const res = validateCoupon ? validateCoupon(couponInput, cartSubtotal) : null;
    if (res && res.success) {
      setAppliedCoupon(res.coupon);
      setCouponError('');
      setCouponInput('');
    } else {
      setCouponError(res?.message || 'Enter a valid coupon code.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(11, 15, 23, 0.65)',
      backdropFilter: 'blur(6px)',
      zIndex: 250,
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: 440,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.25s ease'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingBag size={22} color="#ff7828" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0b0f17' }}>
              Your Food Cart ({cart.reduce((s, i) => s + i.qty, 0)})
            </h3>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
          >
            <X size={22} color="#64748b" />
          </button>
        </div>

        {/* Cart Items Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 80 }}>
              <ShoppingBag size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#475569' }}>Your cart is empty</h4>
              <p style={{ fontSize: '0.85rem' }}>Add sizzling wok dishes, burgers or designer cakes to begin ordering.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.map(item => (
                <div
                  key={item.cartKey}
                  style={{
                    padding: 14,
                    background: '#f8fafc',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{item.name}</h4>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                        {item.variantName} {item.addons.length > 0 ? `• ${item.addons.join(', ')}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.cartKey)}
                      style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#ff7828' }}>
                      ৳{item.effectivePrice * item.qty}
                    </span>

                    {/* Quantity Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 6px' }}>
                      <button
                        onClick={() => updateCartQty(item.cartKey, -1)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(item.cartKey, 1)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800 }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Checkout Summary */}
        {cart.length > 0 && (
          <div style={{ padding: '20px 24px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
            {/* Promo Code Input */}
            <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Tag size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 30px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0b0f17',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Apply
              </button>
            </form>
            {appliedCoupon && (
              <div style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                marginBottom: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: quoteLoading ? '#f1f5f9' : serverQuote?.discountAmount > 0 ? '#f0fdf4' : '#fffbeb',
                border: quoteLoading ? '1px solid #cbd5e1' : serverQuote?.discountAmount > 0 ? '1px solid #86efac' : '1px solid #fde68a',
                color: quoteLoading ? '#475569' : serverQuote?.discountAmount > 0 ? '#15803d' : '#b45309',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8
              }}>
                <span>
                  {quoteLoading
                    ? `Verifying coupon '${appliedCoupon.code}'…`
                    : serverQuote?.discountAmount > 0
                      ? `✓ Coupon '${appliedCoupon.code}' applied: ৳${serverQuote.discountAmount} discount!`
                      : `⚠️ Coupon '${appliedCoupon.code}' entered, but did not qualify for current items/spend.`}
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textDecoration: 'underline',
                    flexShrink: 0
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {couponError && (
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, marginBottom: 10 }}>
                {couponError}
              </div>
            )}

            {/* Price Calculations */}
            <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {quoteError && <small role="alert" style={{ color: '#be123c' }}>{quoteError}</small>}
              {!quoteError && <small>{quoteLoading ? 'Checking current server prices…' : serverQuote?.campaignName ? `Offer applied: ${serverQuote.campaignName}` : 'Price checked by the server.'}</small>}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>{serverQuote ? `৳${serverQuote.subTotal}` : '—'}</span>
              </div>
              {serverQuote?.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 700 }}>
                  <span>Campaign discount</span>
                  <span>-৳{serverQuote.discountAmount}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Delivery Charge</span>
                <span>{serverQuote ? `৳${serverQuote.deliveryFee}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VAT & Tax (5%)</span>
                <span>{serverQuote ? `৳${serverQuote.taxAmount}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 900, color: '#0b0f17', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <span>Total Payable</span>
                <span style={{ color: '#ff7828' }}>{serverQuote ? `৳${serverQuote.totalAmount}` : '—'}</span>
              </div>
            </div>

            {/* Proceed to Checkout CTA */}
            <button
              onClick={() => {
                if (!serverQuote || quoteLoading || quoteError) return;
                setIsCartOpen(false);
                onProceedToCheckout();
              }}
              disabled={!serverQuote || quoteLoading || !!quoteError}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                background: '#ff7828',
                color: 'white',
                fontWeight: 900,
                fontSize: '1rem',
                cursor: !serverQuote || quoteLoading || !!quoteError ? 'not-allowed' : 'pointer',
                opacity: !serverQuote || quoteLoading || !!quoteError ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(255, 120, 40, 0.4)'
              }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
