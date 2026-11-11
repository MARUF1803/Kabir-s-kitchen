import React from 'react';
import { Clock, Star, Flame, Plus, Sparkles, Cake } from 'lucide-react';
import { useApp } from '../context/useApp';

export default function ProductCard({ product, onSelectProduct, onOpenCakeCustomizer }) {
  const { selectedBranchId, addToCart, getProductUnitPrice, getProductPromotion } = useApp();
  const promotion = getProductPromotion?.(product);
  const basePrice = product.branchPrices?.[selectedBranchId] || product.basePrice;
  const effectivePrice = getProductUnitPrice(product);
  const isBranchDiscounted = effectivePrice < product.basePrice;

  const handleAction = e => {
    e.stopPropagation();
    if (product.isCustomCake) onOpenCakeCustomizer(product);
    else if (product.variants?.length > 1 || product.addons?.length > 0) onSelectProduct(product);
    else addToCart(product, product.variants?.[0] || null, [], '', 1);
  };

  const handleImageError = event => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = 'true';
    image.src = '/food-placeholder.svg';
  };

  return (
    <article className="product-card" onClick={() => onSelectProduct(product)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onSelectProduct(product)}>
      <div className="product-card__image">
        <img src={product.image || '/food-placeholder.svg'} alt={product.name} loading="lazy" onError={handleImageError} />
        <div className="product-card__badges">
          <span className={product.isVeg ? 'badge badge--veg' : 'badge badge--nonveg'}>{product.isVeg ? '🌿 Veg' : '🍖 Non-veg'}</span>
          {product.isSpicy && <span className="badge badge--spicy"><Flame size={11} /> Spicy</span>}
          {product.isPopular && <span className="badge badge--popular"><Sparkles size={11} /> Best seller</span>}
          {promotion && (
            <span className="badge badge--offer" style={{ background: '#ea580c', color: '#fff', fontWeight: 800 }}>
              <Sparkles size={11} /> {promotion.discountType === 'Percentage' ? `${promotion.discountValue}% OFF` : `৳${promotion.discountValue} OFF`}
            </span>
          )}
        </div>
        <span className="product-card__time"><Clock size={13} /> {product.prepTime} min</span>
      </div>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.categoryName}</span>
          {product.reviews > 0 && <span className="rating"><Star size={13} fill="currentColor" /> {product.rating} <small>({product.reviews})</small></span>}
        </div>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-card__footer">
          <div className="price">
            <strong>৳{effectivePrice}</strong>
            {isBranchDiscounted && <s>৳{basePrice}</s>}
            {isBranchDiscounted && <small>Branch price</small>}
          </div>
          <button className={product.isCustomCake ? 'product-action product-action--cake' : 'product-action'} onClick={handleAction}>
            {product.isCustomCake ? <><Cake size={16} /> Customize</> : <><Plus size={16} /> Add</>}
          </button>
        </div>
      </div>
    </article>
  );
}
