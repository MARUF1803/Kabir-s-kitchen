import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';

export default function ProductCarousel({
  title,
  subtitle,
  eyebrow,
  icon,
  badge,
  products = [],
  onSelectProduct,
  onOpenCakeCustomizer,
  id
}) {
  const scrollRef = useRef(null);

  // Guarantee Deduplication of products by ID within the same shelf
  const deduplicatedProducts = useMemo(() => {
    const seen = new Set();
    return products.filter(p => {
      if (!p || !p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [products]);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (!deduplicatedProducts.length) return null;

  return (
    <section className="product-carousel-section" id={id} style={{ margin: '48px 0', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          {eyebrow && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {icon} {eyebrow}
            </span>
          )}
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.9rem', color: '#0f172a', margin: '4px 0 0' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {badge && (
            <span style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', padding: '6px 14px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
              {badge}
            </span>
          )}
          <span
            aria-label={`${deduplicatedProducts.length} products in this carousel`}
            style={{ fontSize: '0.78rem', color: '#334155', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {deduplicatedProducts.length} products
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#fff',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease'
              }}
            >
              <ChevronLeft size={18} color="#0f172a" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#fff',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease'
              }}
            >
              <ChevronRight size={18} color="#0f172a" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '20px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '16px',
          paddingLeft: '4px',
          paddingRight: '4px'
        }}
        tabIndex="0"
        aria-label={`${title} product carousel`}
      >
        {deduplicatedProducts.map(product => (
          <div
            key={product.id}
            style={{
              flex: '0 0 280px',
              maxWidth: '300px',
              scrollSnapAlign: 'start'
            }}
          >
            <ProductCard
              product={product}
              onSelectProduct={onSelectProduct}
              onOpenCakeCustomizer={onOpenCakeCustomizer}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
