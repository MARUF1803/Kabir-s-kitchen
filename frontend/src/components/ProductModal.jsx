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
          maxWidth: 620,
          width: '100%',
          maxHeight: 'min(92vh, 660px)',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain'
        }}
      >
        {/* Header Hero Image */}
        <div style={{ height: 'clamp(140px, 24vh, 210px)', minHeight: 140, position: 'relative', flexShrink: 0 }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.92)',
              color: '#0b0f17',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '20px 24px',
          flex: '1 1 auto',
          overflowY: 'auto',
          minHeight: 0,
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff7828', textTransform: 'uppercase' }}>
                {product.categoryName}
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0b0f17', margin: '4px 0' }}>
                {product.name}
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0b0f17' }}>৳{basePrice}</span>
              {product.reviews > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Star size={13} fill="#f59e0b" /> {product.rating} ({product.reviews})
                </div>
              )}
            </div>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 20 }}>
            {product.description}
          </p>

          {/* Section 1: Portion / Variant Selection */}
          {product.variants && product.variants.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: 10, color: '#0f172a' }}>
                Select Portion Size <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {product.variants.map(v => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    style={{
                      border: selectedVariant?.id === v.id ? '2px solid #ff7828' : '1px solid #e2e8f0',
                      background: selectedVariant?.id === v.id ? '#fff7ed' : '#ffffff',
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{v.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {v.priceDiff > 0 ? `+৳${v.priceDiff}` : 'Standard'}
                      </div>
                    </div>
                    {selectedVariant?.id === v.id && <Check size={16} color="#ff7828" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Spice Level Preferences */}
          {product.isSpicy && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: 10, color: '#0f172a' }}>
                Choose Spice Level 🌶️
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Mild', 'Medium', 'Extra Hot 🔥'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSpiceLevel(lvl)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 8,
                      border: spiceLevel === lvl ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      background: spiceLevel === lvl ? '#fef2f2' : '#ffffff',
                      color: spiceLevel === lvl ? '#b91c1c' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.82rem',
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
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: 10, color: '#0f172a' }}>
                Optional Add-ons & Extra Dips
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: isChecked ? '1px solid #ff7828' : '1px solid #e2e8f0',
                        background: isChecked ? '#fff7ed' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{addon.name}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ff7828' }}>+৳{addon.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Special Instructions */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 800, display: 'block', marginBottom: 6, color: '#0f172a' }}>
              Special Cooking Instructions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Less oil, extra cutlery, separate sauce in dip cup..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Modal Sticky Bottom Actions */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.03)'
        }}>
          {/* Quantity Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 8px' }}>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 900 }}
            >
              -
            </button>
            <span style={{ fontWeight: 800, fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 900 }}
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAdd}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 10,
              border: 'none',
              background: '#ff7828',
              color: 'white',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 14px rgba(255, 120, 40, 0.4)'
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
