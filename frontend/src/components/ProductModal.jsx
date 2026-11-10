import React, { useState, useEffect } from 'react';
import { X, Star, Check } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function ProductModal({ product, onClose }) {
  const { selectedBranchId, addToCart } = useApp();

  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0] || null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [spiceLevel, setSpiceLevel] = useState('Medium');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Lock background body scroll and support Escape key while modal is open
  useEffect(() => {
    if (!product) return;
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
  }, [product, onClose]);

  if (!product) return null;

  const basePrice = product.branchPrices?.[selectedBranchId] || product.basePrice;
  const variantPriceDiff = selectedVariant?.priceDiff || 0;
  const addonsPriceTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = basePrice + variantPriceDiff + addonsPriceTotal;
  const totalPrice = unitPrice * quantity;

  const toggleAddon = (addon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  const handleAdd = () => {
    addToCart(product, selectedVariant, selectedAddons, specialInstructions, quantity);
    onClose();
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
        zIndex: 200,
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
        aria-labelledby="product-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          maxWidth: 540,
          width: '100%',
          maxHeight: 'min(92vh, 690px)',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Header Hero Image - Clear full presentation */}
        <div style={{ height: 'clamp(210px, 32vh, 280px)', minHeight: 200, position: 'relative', flexShrink: 0, background: '#0f172a' }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
          />
          {/* Subtle gradient scrim at bottom of image */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 40%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none' }} />
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 34,
              height: 34,
              borderRadius: 17,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.94)',
              color: '#0b0f17',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '16px 20px',
          flex: '1 1 auto',
          overflowY: 'auto',
          minHeight: 0,
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ff7828', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {product.categoryName}
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 4px', lineHeight: 1.25 }}>
                {product.name}
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.28rem', fontWeight: 900, color: '#ea580c' }}>৳{basePrice}</span>
              {product.reviews > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#f59e0b', fontSize: '0.76rem', fontWeight: 700 }}>
                  <Star size={12} fill="#f59e0b" /> {product.rating} ({product.reviews})
                </div>
              )}
            </div>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: 14 }}>
            {product.description}
          </p>

          {/* Section 1: Portion / Variant Selection */}
          {product.variants && product.variants.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 8, color: '#0f172a' }}>
                Select Portion Size <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {product.variants.map(v => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    style={{
                      border: selectedVariant?.id === v.id ? '2px solid #ff7828' : '1px solid #e2e8f0',
                      background: selectedVariant?.id === v.id ? '#fff7ed' : '#ffffff',
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{v.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {v.priceDiff > 0 ? `+৳${v.priceDiff}` : 'Standard'}
                      </div>
                    </div>
                    {selectedVariant?.id === v.id && <Check size={15} color="#ff7828" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Spice Level Preferences */}
          {product.isSpicy && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 6, color: '#0f172a' }}>
                Choose Spice Level 🌶️
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Mild', 'Medium', 'Extra Hot 🔥'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSpiceLevel(lvl)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: spiceLevel === lvl ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      background: spiceLevel === lvl ? '#fef2f2' : '#ffffff',
                      color: spiceLevel === lvl ? '#b91c1c' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Add-ons & Extra Ingredients */}
          {product.addons && product.addons.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 8, color: '#0f172a' }}>
                Optional Add-ons & Extra Dips
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {product.addons.map(addon => {
                  const isChecked = selectedAddons.some(a => a.id === addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: isChecked ? '1px solid #ff7828' : '1px solid #e2e8f0',
                        background: isChecked ? '#fff7ed' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{addon.name}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ff7828' }}>+৳{addon.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Special Instructions */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4, color: '#0f172a' }}>
              Special Cooking Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Less oil, extra cutlery, separate sauce in dip cup..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Modal Sticky Bottom Actions */}
        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexShrink: 0,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.03)'
        }}>
          {/* Quantity Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '3px 8px' }}>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem' }}
            >
              -
            </button>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: 20, textAlign: 'center' }}>{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem' }}
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAdd}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#ff7828',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 14px rgba(255, 120, 40, 0.35)'
            }}
          >
            <span>Add to Cart</span>
            <span>৳{totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
