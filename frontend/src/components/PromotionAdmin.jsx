import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, Tag, Percent, CheckCircle2,
  Plus, Trash2, ToggleRight, Store, ShoppingBag,
  Flame, Search, RotateCcw
} from 'lucide-react';
import { useApp } from '../context/useApp';
import apiClient, { mapMenuItemToProduct } from '../services/api';

export default function PromotionAdmin() {
  const {
    promotionsConfig,
    updateStorewidePromotion,
    addCoupon,
    deleteCoupon,
    toggleCoupon,
    products: contextProducts = [],
    setProductOfferPrice,
    removeProductOfferPrice
  } = useApp();

  const storewide = promotionsConfig?.storewide || {
    isActive: false,
    title: 'Flash Sale - Today Only!',
    discountPct: 20,
    appliesToWeb: true,
    appliesToPos: true,
    expiresAt: null
  };

  const coupons = promotionsConfig?.coupons || [];
  const itemOffers = promotionsConfig?.itemOffers || {};

  // Local form states for Storewide Sale
  const [swTitle, setSwTitle] = useState(storewide.title);
  const [swDiscount, setSwDiscount] = useState(storewide.discountPct);
  const [swWeb, setSwWeb] = useState(storewide.appliesToWeb);
  const [swPos, setSwPos] = useState(storewide.appliesToPos);
  const [swPreset, setSwPreset] = useState('midnight'); // 'midnight' | 'weekend' | 'forever'
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // New Coupon Form
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState(20);
  const [newCouponMinSpend, setNewCouponMinSpend] = useState(0);
  const [couponFormError, setCouponFormError] = useState('');

  // Product List & Filters
  const [allProducts, setAllProducts] = useState(contextProducts);
  const [categories, setCategories] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [offerFilterTab, setOfferFilterTab] = useState('all'); // 'all' | 'on_offer' | 'regular'
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Per-row custom input state
  const [rowInputs, setRowInputs] = useState({});

  // Fetch full product list and categories from backend
  const loadFullCatalog = useCallback(async (pageToLoad = currentPage) => {
    const page = typeof pageToLoad === 'number' ? pageToLoad : currentPage;
    setLoadingProducts(true);
    try {
      const params = {
        page,
        pageSize: pageSize,
        search: productSearch.trim() || undefined,
        categoryId: selectedCategoryFilter !== 'all' ? Number(selectedCategoryFilter) : undefined
      };
      const [catRes, prodRes] = await Promise.all([
        categories.length === 0 ? apiClient.get('/menu/categories') : Promise.resolve({ data: categories }),
        apiClient.get('/menu/items', { params })
      ]);
      if (Array.isArray(catRes.data) && categories.length === 0) {
        setCategories(catRes.data);
      }
      if (prodRes.data?.items && Array.isArray(prodRes.data.items)) {
        const mapped = prodRes.data.items.map(mapMenuItemToProduct);
        setAllProducts(mapped);
        setTotalCount(prodRes.data.totalCount ?? mapped.length);
        setTotalPages(prodRes.data.totalPages ?? 1);
        setCurrentPage(prodRes.data.page ?? page);
      }
    } catch {
      // Fallback to context products
      if (contextProducts.length > 0) {
        setAllProducts(contextProducts);
        setTotalCount(contextProducts.length);
      }
    } finally {
      setLoadingProducts(false);
    }
  }, [currentPage, pageSize, productSearch, selectedCategoryFilter, categories, contextProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFullCatalog(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch, selectedCategoryFilter, pageSize]);

  const handleSaveStorewide = (e) => {
    e?.preventDefault();
    let expiry = null;
    const now = new Date();
    if (swPreset === 'midnight') {
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      expiry = midnight.toISOString();
    } else if (swPreset === 'weekend') {
      const weekend = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      expiry = weekend.toISOString();
    } else {
      expiry = null;
    }

    updateStorewidePromotion({
      isActive: true,
      title: swTitle,
      discountPct: Number(swDiscount) || 10,
      appliesToWeb: swWeb,
      appliesToPos: swPos,
      expiresAt: expiry
    });

    setSaveSuccessMsg('Promotion activated successfully! Website and POS updated.');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleStopStorewide = () => {
    updateStorewidePromotion({
      ...storewide,
      isActive: false
    });
    setSaveSuccessMsg('Storewide promotion has been turned OFF.');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!newCouponCode.trim()) {
      setCouponFormError('Please enter a coupon code.');
      return;
    }
    const cleanCode = newCouponCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (coupons.some(c => c.code === cleanCode)) {
      setCouponFormError(`Coupon '${cleanCode}' already exists!`);
      return;
    }

    addCoupon({
      id: 'cp_' + Date.now(),
      code: cleanCode,
      discountPct: Number(newCouponPct) || 10,
      minSpend: Number(newCouponMinSpend) || 0,
      isActive: true,
      usageCount: 0
    });

    setNewCouponCode('');
    setNewCouponPct(20);
    setNewCouponMinSpend(0);
    setShowCouponModal(false);
    setCouponFormError('');
  };

  // Quick discount calculation & set
  const handleQuickPercentDiscount = (product, percent) => {
    const discountedPrice = Math.round(product.basePrice * (1 - percent / 100));
    setProductOfferPrice(product.id, discountedPrice);
    setSaveSuccessMsg(`${percent}% discount applied on '${product.name}' (৳${discountedPrice})!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleSetCustomPrice = (product) => {
    const customVal = Number(rowInputs[product.id]);
    if (isNaN(customVal) || customVal <= 0) {
      alert('Please enter a valid promotional price.');
      return;
    }
    if (customVal >= product.basePrice) {
      alert(`Promotional price must be less than regular price (৳${product.basePrice}).`);
      return;
    }
    setProductOfferPrice(product.id, customVal);
    setRowInputs(prev => ({ ...prev, [product.id]: '' }));
    setSaveSuccessMsg(`Promotional price of ৳${customVal} set for '${product.name}'!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleRemoveOffer = (product) => {
    removeProductOfferPrice(product.id);
    setSaveSuccessMsg(`Promotional offer removed for '${product.name}' (regular price ৳${product.basePrice}).`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      // Search filter
      const matchesSearch = !productSearch.trim() ||
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (product.categoryName && product.categoryName.toLowerCase().includes(productSearch.toLowerCase()));

      // Category filter
      const matchesCategory = selectedCategoryFilter === 'all' ||
        String(product.productCategoryId) === String(selectedCategoryFilter) ||
        String(product.dbCategoryId) === String(selectedCategoryFilter) ||
        product.categoryId === selectedCategoryFilter;

      // Offer status filter
      const hasOffer = Boolean(itemOffers[product.id]);
      const matchesOfferTab =
        offerFilterTab === 'all' ||
        (offerFilterTab === 'on_offer' && hasOffer) ||
        (offerFilterTab === 'regular' && !hasOffer);

      return matchesSearch && matchesCategory && matchesOfferTab;
    });
  }, [allProducts, productSearch, selectedCategoryFilter, offerFilterTab, itemOffers]);

  const activeOfferCount = Object.keys(itemOffers).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Header Notification */}
      {saveSuccessMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #10b981',
          color: '#065f46',
          padding: '12px 18px',
          borderRadius: '10px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          {saveSuccessMsg}
        </div>
      )}

      {/* ── CARD 1: STOREWIDE SPECIAL DISCOUNT ── */}
      <div style={{
        background: '#ffffff',
        border: storewide.isActive ? '2px solid #ea580c' : '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: storewide.isActive ? '0 10px 25px -5px rgba(234, 88, 12, 0.12)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={22} color={storewide.isActive ? '#ea580c' : '#64748b'} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Store-wide Discount & Flash Sale
              </h3>
              <span style={{
                background: storewide.isActive ? '#dcfce7' : '#f1f5f9',
                color: storewide.isActive ? '#15803d' : '#64748b',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '20px',
                textTransform: 'uppercase'
              }}>
                {storewide.isActive ? '🟢 Active & Live Now' : '⚪ Turned Off'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
              Instantly toggle flat percentage discounts across Website Storefront and Counter POS.
            </p>
          </div>

          <div>
            {storewide.isActive ? (
              <button
                type="button"
                onClick={handleStopStorewide}
                style={{
                  background: '#fee2e2',
                  border: '1px solid #ef4444',
                  color: '#b91c1c',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ToggleRight size={20} />
                Stop Offer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveStorewide}
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={18} />
                Turn ON Offer
              </button>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveStorewide} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', background: '#f8fafc', padding: '18px', borderRadius: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              Promotion Title / Banner Text
            </label>
            <input
              type="text"
              value={swTitle}
              onChange={e => setSwTitle(e.target.value)}
              placeholder="e.g. Flash Friday 20% Off All Items!"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#fff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              Discount Percentage (%)
            </label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[10, 15, 20, 25, 30].map(pct => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => setSwDiscount(pct)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '8px',
                    border: Number(swDiscount) === pct ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: Number(swDiscount) === pct ? '#fff7ed' : '#ffffff',
                    color: Number(swDiscount) === pct ? '#ea580c' : '#334155',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {pct}%
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="90"
                value={swDiscount}
                onChange={e => setSwDiscount(e.target.value)}
                style={{
                  width: '64px',
                  padding: '7px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              />
              <span style={{ fontWeight: 800, color: '#64748b' }}>%</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              Duration & Schedule
            </label>
            <select
              value={swPreset}
              onChange={e => setSwPreset(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                background: '#fff'
              }}
            >
              <option value="midnight">🌙 Until Midnight Tonight (Today Only)</option>
              <option value="weekend">🗓️ Next 48 Hours (Weekend Sale)</option>
              <option value="forever">♾️ Always Active (Until Stopped)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
              Target Channels
            </label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '36px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={swWeb}
                  onChange={e => setSwWeb(e.target.checked)}
                />
                <ShoppingBag size={15} color="#ea580c" />
                Website Storefront
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={swPos}
                  onChange={e => setSwPos(e.target.checked)}
                />
                <Store size={15} color="#0284c7" />
                Counter POS
              </label>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="submit"
              style={{
                background: '#0f172a',
                color: '#fff',
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Update Settings & Apply
            </button>
          </div>
        </form>
      </div>

      {/* ── CARD 2: PROMO / COUPON CODES MANAGER ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                Promo Coupon Codes Management
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Customers can apply these promo codes during online checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCouponModal(true)}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            Add New Coupon
          </button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '10px 14px' }}>Coupon Code</th>
                <th style={{ padding: '10px 14px' }}>Discount</th>
                <th style={{ padding: '10px 14px' }}>Min Order Spend</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No promo coupons created. Click "Add New Coupon" above.
                  </td>
                </tr>
              ) : (
                coupons.map(coupon => (
                  <tr key={coupon.id || coupon.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        letterSpacing: '0.05em',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px dashed #38bdf8'
                      }}>
                        {coupon.code}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#16a34a' }}>
                      {coupon.discountPct ? `${coupon.discountPct}% OFF` : `৳${coupon.flatAmount} OFF`}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {coupon.minSpend > 0 ? `৳${coupon.minSpend}` : 'No minimum'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: coupon.isActive ? '#dcfce7' : '#fee2e2',
                        color: coupon.isActive ? '#15803d' : '#b91c1c',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        {coupon.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => toggleCoupon(coupon.id || coupon.code)}
                          style={{
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: coupon.isActive ? '#64748b' : '#16a34a',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {coupon.isActive ? 'Turn Off' : 'Turn On'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCoupon(coupon.id || coupon.code)}
                          style={{
                            border: 'none',
                            background: '#fee2e2',
                            color: '#ef4444',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CARD 3: COMPLETE PRODUCT LIST & SPECIAL OFFERS ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Section Header with Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Percent size={22} color="#8b5cf6" />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Product Offers & Menu Price Control
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Set fast 10%, 20%, 30% discounts or custom promotional pricing on any menu item below.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{
              background: '#f5f3ff',
              color: '#7c3aed',
              fontWeight: 800,
              fontSize: '0.78rem',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid #ddd6fe'
            }}>
              Total Items: {totalCount || allProducts.length}
            </span>
            <span style={{
              background: activeOfferCount > 0 ? '#ffedd5' : '#f1f5f9',
              color: activeOfferCount > 0 ? '#c2410c' : '#64748b',
              fontWeight: 800,
              fontSize: '0.78rem',
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeOfferCount > 0 ? '1px solid #fed7aa' : '1px solid #e2e8f0'
            }}>
              On Offer: {activeOfferCount}
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#f8fafc',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search items by name or category (e.g. Burger, Chicken, Chow Mein)..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#fff'
              }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="all">🍽️ All Categories ({totalCount || allProducts.length})</option>
              {categories.map(cat => (
                <option key={cat.id || cat.slug} value={cat.id}>
                  {cat.icon || '📁'} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Offer Tabs */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff' }}>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'on_offer', label: `On Offer (${activeOfferCount})` },
              { id: 'regular', label: 'Regular Price' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOfferFilterTab(tab.id)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  background: offerFilterTab === tab.id ? '#8b5cf6' : '#ffffff',
                  color: offerFilterTab === tab.id ? '#ffffff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadFullCatalog(currentPage)}
            title="Refresh Catalog"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem'
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* ── ALL PRODUCTS TABLE ── */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '12px 14px', width: '35%' }}>Item</th>
                <th style={{ padding: '12px 14px' }}>Regular Price</th>
                <th style={{ padding: '12px 14px' }}>Current Status</th>
                <th style={{ padding: '12px 14px', width: '38%', textAlign: 'right' }}>Set Discount / Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Loading menu catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No menu items found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const offer = itemOffers[product.id];
                  const hasSpecificOffer = Boolean(offer);
                  const effectivePrice = hasSpecificOffer
                    ? offer.offerPrice
                    : (storewide.isActive && storewide.appliesToWeb
                      ? Math.round(product.basePrice * (1 - (storewide.discountPct || 0) / 100))
                      : product.basePrice);

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: hasSpecificOffer ? '#faf5ff' : '#ffffff'
                      }}
                    >
                      {/* Product Name & Category */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={product.imageUrl || product.image || '/food-placeholder.svg'}
                            alt={product.name}
                            onError={(e) => { e.currentTarget.src = '/food-placeholder.svg'; }}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '1px solid #e2e8f0',
                              background: '#f8fafc'
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem' }}>
                              {product.name}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {product.categoryName || 'General'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Regular Price */}
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#334155' }}>
                        ৳{product.basePrice}
                      </td>

                      {/* Current Status */}
                      <td style={{ padding: '10px 14px' }}>
                        {hasSpecificOffer ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.75rem' }}>
                                ৳{product.basePrice}
                              </span>
                              <strong style={{ color: '#ea580c', fontSize: '0.9rem' }}>
                                ৳{offer.offerPrice}
                              </strong>
                            </div>
                            <span style={{
                              background: '#fef2f2',
                              color: '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              width: 'fit-content'
                            }}>
                              🔥 {Math.round(((product.basePrice - offer.offerPrice) / product.basePrice) * 100)}% OFF
                            </span>
                          </div>
                        ) : storewide.isActive && storewide.appliesToWeb ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.75rem' }}>
                                ৳{product.basePrice}
                              </span>
                              <strong style={{ color: '#0284c7', fontSize: '0.88rem' }}>
                                ৳{effectivePrice}
                              </strong>
                            </div>
                            <span style={{
                              background: '#f0f9ff',
                              color: '#0284c7',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              width: 'fit-content'
                            }}>
                              ⚡ Storewide {storewide.discountPct}% OFF
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            Regular Price
                          </span>
                        )}
                      </td>

                      {/* Action Column */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                          {/* Quick Percentage Buttons */}
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {[10, 20, 30].map(pct => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleQuickPercentDiscount(product, pct)}
                                title={`Apply ${pct}% discount`}
                                style={{
                                  padding: '4px 7px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#475569',
                                  cursor: 'pointer'
                                }}
                              >
                                -{pct}%
                              </button>
                            ))}
                          </div>

                          {/* Custom Price Input */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              placeholder="৳ Price"
                              value={rowInputs[product.id] ?? ''}
                              onChange={e => setRowInputs({ ...rowInputs, [product.id]: e.target.value })}
                              style={{
                                width: '68px',
                                padding: '4px 6px',
                                borderRadius: '5px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.75rem',
                                textAlign: 'center'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSetCustomPrice(product)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: 'none',
                                background: '#8b5cf6',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Set
                            </button>
                          </div>

                          {/* Remove Offer Button */}
                          {hasSpecificOffer && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOffer(product)}
                              title="Remove offer and restore regular price"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: '1px solid #fecaca',
                                background: '#fee2e2',
                                color: '#ef4444',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Trash2 size={12} />
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          {totalCount > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalCount)}</strong> of <strong>{totalCount}</strong> items
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  disabled={currentPage <= 1 || loadingProducts}
                  onClick={() => loadFullCatalog(currentPage - 1)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage <= 1 ? '#94a3b8' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>

                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages || loadingProducts}
                  onClick={() => loadFullCatalog(currentPage + 1)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE COUPON MODAL ── */}
      {showCouponModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'grid',
          placeItems: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Create New Promo Coupon
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#64748b' }}>
              Customers can apply this coupon code at checkout to claim discounts.
            </p>

            {couponFormError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '12px', fontWeight: 700 }}>
                {couponFormError}
              </div>
            )}

            <form onSubmit={handleCreateCoupon}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Coupon Code (Uppercase)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TODAY20, FRIDAY50"
                  value={newCouponCode}
                  onChange={e => setNewCouponCode(e.target.value.toUpperCase())}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.05em' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Discount Percentage (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  placeholder="20"
                  value={newCouponPct}
                  onChange={e => setNewCouponPct(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Minimum Order Spend (0 for no minimum)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newCouponMinSpend}
                  onChange={e => setNewCouponMinSpend(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
