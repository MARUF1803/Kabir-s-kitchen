import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Plus, Minus, Trash2, Printer,
  ArrowLeft, ShieldCheck, Flame, ShoppingBag, X,
  LogOut, AlertCircle, Utensils,
  Download, FileText
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { invoicesApi, authApi, mapLoginResponse } from '../services/api';
import './PosPage.css';

const PRODUCT_PAGE_SIZE = 100;

const flattenSubCategories = (subCategories, depth = 0) => (subCategories || []).flatMap(category => [
  { id: String(category.categoryId ?? category.id), name: category.name, depth },
  ...flattenSubCategories(category.children, depth + 1)
]);

export default function PosPage() {
  const {
    products,
    categories,
    productsLoading,
    productLoadError,
    productPage,
    productTotalCount,
    hasMoreProducts,
    loadProductPage,
    activeBranch,
    selectedBranchId,
    authUser,
    saveAuthSession,
    signOut,
    setCurrentMode,
    placeOrder,
    quoteOrder,
    getProductUnitPrice,
    getProductPromotion
  } = useApp();

  // ─── 1. Authentication & Role Gate ───
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isAuthorizedStaff = authUser && (
    authUser.role === 'Admin' ||
    authUser.role === 'Cashier' ||
    authUser.role === 'BranchManager' ||
    authUser.role === 'SuperAdmin'
  );

  const handleStaffLogin = async (e) => {
    e?.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter email and password.');
      return;
    }
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const data = await authApi.login(authEmail.trim(), authPassword);
      saveAuthSession(mapLoginResponse(data));
      setIsAuthenticating(false);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        setAuthError('Invalid credentials. Check your email or password.');
        setIsAuthenticating(false);
      } else if (status === 403) {
        setAuthError('Account is disabled. Contact your administrator.');
        setIsAuthenticating(false);
      } else {
        setAuthError('Server unreachable. POS access requires a successful server login.');
        setIsAuthenticating(false);
      }
    }
  };

  // ─── 2. POS Operational State ───
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [cartItems, setCartItems] = useState([]);
  const [orderType, setOrderType] = useState('DineIn'); // 'DineIn' | 'Takeaway' | 'Delivery'
  const [priceQuote, setPriceQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [tableNumber, setTableNumber] = useState('Table 1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'Card' | 'bKash' | 'Nagad' | 'Due'

  const [cashTendered, setCashTendered] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptWidth, setReceiptWidth] = useState(80); // 80 or 58 mm
  const [printCount, setPrintCount] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeOperationalTab, setActiveOperationalTab] = useState('pos'); // 'pos' | 'orders' | 'inventory' | 'drawer'

  const searchInputRef = useRef(null);
  const selectedRootCategory = categories.find(category => String(category.id) === selectedCategory);
  const subCategoryOptions = flattenSubCategories(selectedRootCategory?.subCategories);

  // Keyboard shortcut F2 to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const search = searchQuery.trim() || undefined;
    const categoryId = search
      ? undefined
      : selectedSubCategory
        ? Number(selectedSubCategory)
        : selectedCategory === 'all'
          ? undefined
          : Number(selectedCategory);
    const timer = setTimeout(() => {
      loadProductPage({ page: 1, pageSize: PRODUCT_PAGE_SIZE, categoryId, search });
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [loadProductPage, searchQuery, selectedCategory, selectedSubCategory]);

  // Filtered Products for Center Panel (Search query searches across all categories)
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchQuery = !query || [p.name, p.categoryName, p.code || '', String(p.id), p.description || ''].some(v => String(v).toLowerCase().includes(query));
      const matchTag = activeTag === 'all' || (activeTag === 'popular' && p.isPopular) || (activeTag === 'veg' && p.isVeg) || (activeTag === 'spicy' && p.isSpicy);
      return matchQuery && matchTag;
    });
  }, [products, searchQuery, activeTag]);

  const loadNextProductPage = () => {
    const search = searchQuery.trim() || undefined;
    const categoryId = search
      ? undefined
      : selectedSubCategory
        ? Number(selectedSubCategory)
        : selectedCategory === 'all'
          ? undefined
          : Number(selectedCategory);
    loadProductPage({
      page: productPage + 1,
      pageSize: PRODUCT_PAGE_SIZE,
      categoryId,
      search,
      append: true
    });
  };

  // Cart Management
  const addToPosCart = (product, selectedVariant = null, selectedAddons = []) => {
    const unitPrice = getProductUnitPrice(product, selectedVariant, selectedAddons);

    const itemKey = `${product.id}-${selectedVariant?.id || 'std'}-${selectedAddons.map(a => a.id).sort().join('-')}`;

    setCartItems(prev => {
      const existing = prev.find(item => item.key === itemKey);
      if (existing) {
        return prev.map(item => item.key === itemKey ? { ...item, qty: item.qty + 1 } : item);
      }
      return [
        ...prev,
        {
          key: itemKey,
          productId: product.id,
          menuItemVariantId: selectedVariant?.id || null,
          selectedAddOnIds: selectedAddons.map(addon => addon.id),
          name: product.name,
          categoryName: product.categoryName,
          variantName: selectedVariant?.name || 'Standard',
          addons: selectedAddons.map(a => a.name),
          unitPrice,
          bomCost: product.bomCost || 0,
          qty: 1
        }
      ];
    });
    setSelectedProductForModal(null);
  };

  const updateItemQty = (key, delta) => {
    setCartItems(prev => prev.map(item => {
      if (item.key === key) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (key) => {
    setCartItems(prev => prev.filter(item => item.key !== key));
  };

  const clearPosCart = () => {
    setCartItems([]);
    setCashTendered('');
    setNotice('');
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  }, [cartItems]);

  const localDiscountAmount = 0;

  const vatTax = useMemo(() => {
    // 5% standard restaurant VAT in Bangladesh
    return Math.round(subtotal * 0.05 * 100) / 100;
  }, [subtotal]);

  const [deliveryFee, grandTotal] = [
    priceQuote?.deliveryFee ?? (orderType === 'Delivery' ? 60 : 0),
    priceQuote?.totalAmount ?? Math.max(0, subtotal + vatTax + (orderType === 'Delivery' ? 60 : 0))
  ];
  const displaySubtotal = priceQuote?.subTotal ?? subtotal;
  const displayDiscountAmount = priceQuote?.discountAmount ?? localDiscountAmount;
  const displayTaxAmount = priceQuote?.taxAmount ?? vatTax;

  useEffect(() => {
    if (cartItems.length === 0) {
      setPriceQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setPriceQuote(null);
      setQuoteError('');
      try {
        const quote = await quoteOrder({ items: cartItems, orderType });
        if (active) setPriceQuote(quote);
      } catch (error) {
        if (active) setQuoteError(error.response?.data?.message || 'Could not verify the current price with the server.');
      } finally {
        if (active) setQuoteLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cartItems, orderType, quoteOrder]);

  const changeDue = useMemo(() => {
    const num = Number(cashTendered);
    return num >= grandTotal ? num - grandTotal : 0;
  }, [cashTendered, grandTotal]);

  // Order Submission
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const handleCompleteOrder = async () => {
    if (!cartItems.length) {
      setNotice('Please select at least one item from the menu.');
      return;
    }
    if (!priceQuote || quoteLoading || quoteError) {
      setNotice('The latest server price is not verified. Please wait or retry before completing this order.');
      return;
    }

    if (paymentMethod === 'Cash' && cashTendered && Number(cashTendered) < grandTotal) {
      setNotice(`Tendered cash (৳${cashTendered}) is less than total (৳${grandTotal})!`);
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const newOrder = await placeOrder({
        orderType,
        customerName: customerName.trim() || 'Walk-in Guest',
        customerPhone: customerPhone.trim() || '+8801700000000',
        deliveryAddress: orderType === 'Delivery' ? 'Dhaka Local Delivery' : '',
        tableNumber: orderType === 'DineIn' ? tableNumber : '',
        paymentMethod,
        items: cartItems,
        notes: `POS Cashier: ${authUser?.fullName || 'Staff'}`
      });

      if (newOrder) {
        const paidTotal = Number(cashTendered) || newOrder.totalAmount;
        setCompletedOrder({
          ...newOrder,
          completedAt: new Date().toISOString(),
          cashTendered: paidTotal,
          changeDue: Math.max(0, paidTotal - newOrder.totalAmount),
          discountAmount: newOrder.discount,
          vatTax: newOrder.tax
        });
        setPrintCount(1);
        setShowReceiptModal(true);
        clearPosCart();
      }
    } catch (requestError) {
      setNotice(requestError.response?.data?.message || 'Order was not saved. Check the API connection and try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!completedOrder) return;
    setIsPrinting(true);
    try {
      if (completedOrder.id) {
        await invoicesApi.recordPrint(completedOrder.id, {
          staffName: authUser?.fullName || 'Cashier',
          printFormat: receiptWidth === 58 ? 'Thermal58' : 'Thermal80'
        }).catch(() => {});
      }
      setPrintCount(prev => prev + 1);
    } catch {
      // ignore
    } finally {
      setIsPrinting(false);
      window.print();
    }
  };

  // ─── If Not Authorized Staff: Show Staff Security Lockscreen ───
  if (!isAuthorizedStaff) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #071711 0%, #0c251c 50%, #153c2e 100%)', display: 'grid', placeItems: 'center', padding: '20px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: '24px', maxWidth: '440px', width: '100%', padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, #0c251c 0%, #ea580c 100%)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 16px', boxShadow: '0 10px 25px rgba(12,37,28,0.25)' }}>
            <ShieldCheck size={32} />
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Staff Authorization Gate</span>
          <h2 style={{ margin: '6px 0 6px', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.75rem', color: '#0f172a' }}>Billing POS Portal</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 24px' }}>Restricted staff-only operational system. Please log in with your cashier or manager credentials.</p>

          {authError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '18px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {authError}
            </div>
          )}

          <form onSubmit={handleStaffLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>Staff Email / Employee ID</label>
              <input
                type="email"
                placeholder="e.g. cashier@kabirskitchen.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                required
              />
            </div>

            <button
              type="submit"
              className="button button--primary"
              disabled={isAuthenticating}
              style={{ width: '100%', padding: '13px', marginTop: '6px', background: '#0c251c', fontWeight: 700 }}
            >
              {isAuthenticating ? 'Authorizing...' : 'Unlock POS Register'}
            </button>
          </form>

          <div style={{ marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => setCurrentMode('customer')}
              style={{ background: 'transparent', border: 0, color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={14} /> Back to Customer Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. Professional Desktop-First 3-Panel POS Screen ───
  return (
    <div className="pos-workspace" style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr) 400px', height: '100vh', overflow: 'hidden', background: '#f1f5f9', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ══════════════════════════════════════════════════════════════════
          PANEL 1 (LEFT): Operational Navigation & Cashier Controls (240px)
          ══════════════════════════════════════════════════════════════════ */}
      <aside className="pos-sidebar" style={{ background: '#0a1a14', color: '#fff', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Brand & Branch */}
        <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ea580c', display: 'grid', placeItems: 'center' }}>
              <Utensils size={18} />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', letterSpacing: '0.04em', display: 'block', lineHeight: 1.1 }}>KABIR’S KITCHEN</strong>
              <small style={{ color: '#d4af37', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>Enterprise POS 2.0</small>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: '6px' }} />{activeBranch.name}</span>
          </div>
        </div>

        {/* Staff Profile Card */}
        <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#153c2e', color: '#d4af37', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
              {authUser.fullName?.charAt(0) || 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{authUser.fullName}</strong>
              <small style={{ color: '#94a3b8', fontSize: '0.66rem' }}>Role: <span style={{ color: '#38bdf8' }}>{authUser.role}</span></small>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
            <span>Drawer Balance:</span>
            <strong style={{ color: '#34d399' }}>৳12,500.00</strong>
          </div>
        </div>

        {/* Operational Menu Items */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <button
            onClick={() => setActiveOperationalTab('pos')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: 0,
              background: activeOperationalTab === 'pos' ? '#ea580c' : 'transparent',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <ShoppingBag size={16} /> Billing POS Register
          </button>

          <button
            onClick={() => setCurrentMode('kds')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: 0,
              background: 'transparent',
              color: '#c9d8ce',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Flame size={16} style={{ color: '#f97316' }} /> Kitchen Display (KDS)
          </button>

          <button
            onClick={() => setCurrentMode('admin')}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: 0,
              background: 'transparent',
              color: '#c9d8ce',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <ShieldCheck size={16} style={{ color: '#38bdf8' }} /> Management ERP
          </button>

          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '6px 12px', fontSize: '0.66rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={13} style={{ color: '#10b981' }} /> Thermal Printer Online
            </div>
          </div>
        </nav>

        {/* Exit & Signout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setCurrentMode('customer')}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#c9d8ce', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={14} /> Back to Customer Site
          </button>
          <button
            onClick={signOut}
            style={{ padding: '8px 12px', borderRadius: '8px', border: 0, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={14} /> Lock & Sign Out
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════
          PANEL 2 (CENTER): Product Selection & Fast Order Search
          ══════════════════════════════════════════════════════════════════ */}
      <section className="pos-products" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: '16px 20px', background: '#f8fafc' }}>
        {/* Top Control Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name, code... (Press F2)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', background: '#fff', outline: 'none' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'popular', 'veg', 'spicy'].map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: activeTag === tag ? '1.5px solid #0c251c' : '1px solid #cbd5e1',
                  background: activeTag === tag ? '#0c251c' : '#fff',
                  color: activeTag === tag ? '#fff' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {tag === 'all' && 'All'}
                {tag === 'popular' && '🔥 Popular'}
                {tag === 'veg' && '🌿 Veg'}
                {tag === 'spicy' && '🌶️ Spicy'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Chips Bar */}
        <div className="pos-category-chips">
          {[
            { id: 'all', label: 'All Dishes', icon: '✨' },
            ...categories.map(category => ({
              id: String(category.id),
              label: category.name,
              icon: category.icon || '🍽️'
            }))
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedSubCategory('');
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: selectedCategory === cat.id ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                background: selectedCategory === cat.id ? '#ea580c' : '#fff',
                color: selectedCategory === cat.id ? '#fff' : '#334155',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>

        {subCategoryOptions.length > 0 && (
          <div className="pos-subcategory-chips" aria-label={`${selectedRootCategory.name} subcategories`}>
            <button
              type="button"
              className={!selectedSubCategory ? 'active' : ''}
              onClick={() => setSelectedSubCategory('')}
            >
              All {selectedRootCategory.name}
            </button>
            {subCategoryOptions.map(category => (
              <button
                type="button"
                key={category.id}
                className={selectedSubCategory === category.id ? 'active' : ''}
                onClick={() => setSelectedSubCategory(category.id)}
                style={{ paddingInlineStart: `${12 + category.depth * 12}px` }}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        {/* Product Selection Grid */}
        <div style={{ padding: '0 2px 8px', color: '#64748b', fontSize: '0.72rem' }}>
          Showing {filteredProducts.length} of {productTotalCount} menu items
        </div>
        <div className="pos-product-grid" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', paddingRight: '4px' }}>
          {productsLoading ? (
            <div role="status" style={{ gridColumn: '1 / -1', padding: '32px', color: '#64748b', textAlign: 'center' }}>Loading menu items…</div>
          ) : productLoadError ? (
            <div role="alert" style={{ gridColumn: '1 / -1', padding: '24px', color: '#b91c1c', textAlign: 'center' }}>{productLoadError}</div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '32px', color: '#64748b', textAlign: 'center' }}>
              {products.length === 0 ? 'No active menu items are available.' : 'No menu items match the selected filters.'}
            </div>
          ) : filteredProducts.map(product => {
            const price = getProductUnitPrice(product);
            const regularPrice = product.branchPrices?.[selectedBranchId] || product.basePrice;
            const activeOffer = getProductPromotion(product);
            const hasVariants = product.variants && product.variants.length > 1;

            return (
              <div
                className="pos-product-card"
                key={product.id}
                onClick={() => {
                  if (hasVariants) {
                    setSelectedProductForModal(product);
                  } else {
                    addToPosCart(product);
                  }
                }}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ height: '110px', position: 'relative', overflow: 'hidden' }}>
                  <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {product.isVeg && <span style={{ position: 'absolute', top: '6px', left: '6px', background: '#059669', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>🌿 Veg</span>}
                  {product.isSpicy && <span style={{ position: 'absolute', top: '6px', right: '6px', background: '#dc2626', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>🌶️</span>}
                </div>

                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
                      {product.name}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '0.68rem', display: 'block', marginTop: '3px' }}>{product.categoryName}</small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ color: '#ea580c', fontSize: '0.92rem' }}>৳{price}</strong>
                      {activeOffer?.discountType === 'Percentage' && price < regularPrice && (
                        <small style={{ color: '#c2410c', fontWeight: 700 }}>{activeOffer.discountValue}% offer</small>
                      )}
                    </span>
                    <span style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                      {hasVariants ? 'Options' : '+ Add'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {hasMoreProducts && !productsLoading && (
            <button
              onClick={loadNextProductPage}
              style={{ gridColumn: '1 / -1', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#334155', background: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Load next 100 products
            </button>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PANEL 3 (RIGHT): Current Order & Fast Billing Summary (400px)
          ══════════════════════════════════════════════════════════════════ */}
      <aside className="pos-cart" style={{ background: '#fff', borderLeft: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Order Header & Type */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>Active Ticket</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Order #KK-POS</h3>
            </div>
            <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>
              {cartItems.reduce((sum, i) => sum + i.qty, 0)} items
            </span>
          </div>

          {/* Dine-In / Takeaway / Delivery Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            {[
              { id: 'DineIn', label: '🍽️ Dine-In' },
              { id: 'Takeaway', label: '🛍️ Takeaway' },
              { id: 'Delivery', label: '🛵 Delivery' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                style={{
                  padding: '7px 4px',
                  border: 0,
                  borderRadius: '7px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: orderType === type.id ? '#fff' : 'transparent',
                  color: orderType === type.id ? '#0f172a' : '#64748b',
                  boxShadow: orderType === type.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Context Input (Table or Customer info) */}
          <div style={{ display: 'grid', gridTemplateColumns: orderType === 'DineIn' ? '1fr 1fr' : '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            {orderType === 'DineIn' ? (
              <select
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', background: '#fff' }}
              >
                {[...Array(18)].map((_, i) => (
                  <option key={i} value={`Table ${i + 1}`}>Table {i + 1}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
              />
            )}
            <input
              type="tel"
              placeholder="Phone (017...)"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {cartItems.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center' }}>
              <ShoppingBag size={42} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <strong style={{ fontSize: '0.9rem', color: '#475569' }}>No Items Selected</strong>
              <small style={{ fontSize: '0.74rem' }}>Tap dishes from the menu to build order.</small>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cartItems.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                    <strong style={{ display: 'block', fontSize: '0.8rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '0.68rem' }}>
                      {item.variantName} · ৳{item.unitPrice}
                    </small>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 4px' }}>
                      <button onClick={() => updateItemQty(item.key, -1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '16px', textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateItemQty(item.key, 1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <Plus size={12} />
                      </button>
                    </div>

                    <strong style={{ fontSize: '0.82rem', color: '#0f172a', minWidth: '48px', textAlign: 'right' }}>
                      ৳{item.unitPrice * item.qty}
                    </strong>

                    <button onClick={() => removeItem(item.key)} style={{ border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bill Calculation & Summary Panel */}
        <div style={{ padding: '14px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 9px', color: '#64748b', fontSize: '0.72rem' }}>
            {quoteError || (quoteLoading ? 'Checking current server price…' : priceQuote?.campaignName
              ? `Server offer applied: ${priceQuote.campaignName}`
              : 'Order total is checked by the server before payment.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: '#475569' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{priceQuote ? `৳${displaySubtotal}` : '—'}</span>
            </div>
            {priceQuote && displayDiscountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                <span>Discount:</span>
                <span>-৳{displayDiscountAmount}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VAT / Service (5%):</span>
              <span>{priceQuote ? `৳${displayTaxAmount}` : '—'}</span>
            </div>
            {orderType === 'Delivery' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Delivery Charge:</span>
                <span>{priceQuote ? `৳${deliveryFee}` : '—'}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '6px', marginTop: '4px', borderTop: '1.5px dashed #cbd5e1' }}>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Payable Total:</strong>
              <strong style={{ fontSize: '1.35rem', color: '#ea580c' }}>{priceQuote ? `৳${grandTotal}` : '—'}</strong>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginTop: '10px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Payment Method:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
              {['Cash', 'bKash', 'Nagad', 'Card', 'Due'].map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    padding: '6px 2px',
                    borderRadius: '6px',
                    border: paymentMethod === method ? '1.5px solid #0c251c' : '1px solid #cbd5e1',
                    background: paymentMethod === method ? '#0c251c' : '#fff',
                    color: paymentMethod === method ? '#fff' : '#334155',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Cash Tendered Input & Change Calculator */}
          {paymentMethod === 'Cash' && (
            <div style={{ marginTop: '10px', background: '#fff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Cash Tendered:</span>
                <input
                  type="number"
                  placeholder="৳ Amount"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  style={{ width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem' }}>
                <span style={{ color: '#64748b' }}>Change to Return:</span>
                <strong style={{ color: changeDue > 0 ? '#16a34a' : '#0f172a' }}>৳{changeDue}</strong>
              </div>
            </div>
          )}

          {notice && (
            <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.72rem' }}>
              {notice}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={clearPosCart}
              disabled={!cartItems.length || isSubmittingOrder}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, cursor: cartItems.length ? 'pointer' : 'not-allowed' }}
              title="Clear Ticket"
            >
              Clear
            </button>

            <button
              onClick={handleCompleteOrder}
              disabled={!cartItems.length || isSubmittingOrder || quoteLoading || !!quoteError || !priceQuote}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: '10px',
                border: 0,
                background: cartItems.length && priceQuote && !quoteError ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : '#cbd5e1',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: cartItems.length && priceQuote && !quoteError ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: cartItems.length && priceQuote && !quoteError ? '0 6px 18px rgba(234,88,12,0.3)' : 'none'
              }}
            >
              <Printer size={16} /> {isSubmittingOrder ? 'Saving order…' : `Pay & Print ${priceQuote ? `৳${grandTotal}` : '—'}`}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── IN-POS VARIANT & ADD-ON SELECTION MODAL ─── */}
      {selectedProductForModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '18px', maxWidth: '420px', width: '100%', padding: '22px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{selectedProductForModal.name}</strong>
                <small style={{ color: '#64748b', display: 'block' }}>Select Portions & Options</small>
              </div>
              <button onClick={() => setSelectedProductForModal(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedProductForModal.variants?.map(v => (
                <button
                  key={v.id}
                  onClick={() => addToPosCart(selectedProductForModal, v)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 700
                  }}
                >
                  <span>{v.name}</span>
                  <strong style={{ color: '#ea580c' }}>
                    ৳{getProductUnitPrice(selectedProductForModal, v)}
                  </strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── THERMAL RECEIPT PRINT MODAL ─── */}
      {showReceiptModal && completedOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'grid', placeItems: 'center', padding: '16px', overflowY: 'auto' }}>
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-thermal-receipt, #printable-thermal-receipt * {
                visibility: visible;
              }
              #printable-thermal-receipt {
                position: absolute;
                left: 0;
                top: 0;
                width: ${receiptWidth === 58 ? '58mm' : '80mm'} !important;
                padding: 4mm !important;
                margin: 0 !important;
                background: #fff !important;
                color: #000 !important;
                box-shadow: none !important;
              }
              @page {
                size: ${receiptWidth === 58 ? '58mm auto' : '80mm auto'};
                margin: 0;
              }
            }
          `}</style>
          
          <div style={{ background: '#fff', borderRadius: '18px', maxWidth: receiptWidth === 58 ? '340px' : '410px', width: '100%', padding: '22px', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            
            {/* Header Toolbar: Receipt Width & Reprint Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReceiptWidth(80)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 0,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: receiptWidth === 80 ? '#0c251c' : 'transparent',
                    color: receiptWidth === 80 ? '#fff' : '#64748b'
                  }}
                >
                  80mm Standard
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptWidth(58)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 0,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: receiptWidth === 58 ? '#0c251c' : 'transparent',
                    color: receiptWidth === 58 ? '#fff' : '#64748b'
                  }}
                >
                  58mm Compact
                </button>
              </div>

              {printCount > 1 ? (
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: '6px' }}>
                  REPRINT #{printCount}
                </span>
              ) : (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                  ORIGINAL
                </span>
              )}
            </div>

            {/* Printable Thermal Receipt Card */}
            <div id="printable-thermal-receipt" style={{ background: '#fafafa', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '16px', fontFamily: "'Courier New', Courier, monospace", fontSize: '0.75rem', color: '#111', textAlign: 'center' }}>
              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.04em' }}>KABIR'S KITCHEN</div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700 }}>{activeBranch?.name || 'Main Branch'}</div>
                <div style={{ fontSize: '0.68rem', color: '#444' }}>{activeBranch?.address}</div>
                <div style={{ fontSize: '0.68rem', color: '#444' }}>BIN: 002941829-0101 | Tel: {activeBranch?.phone}</div>
              </div>

              {printCount > 1 && (
                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#000', border: '1px solid #000', padding: '2px 0', margin: '6px 0', letterSpacing: '0.1em' }}>
                  *** DUPLICATE BILL / REPRINT ***
                </div>
              )}

              <div style={{ textAlign: 'left', fontSize: '0.72rem', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px', lineHeight: 1.4 }}>
                <div>Inv #: <strong>{completedOrder.invoiceNumber || completedOrder.orderNumber}</strong></div>
                <div>Order #: <strong>{completedOrder.orderNumber}</strong></div>
                <div>Type: <strong>{completedOrder.orderType?.toUpperCase()} {completedOrder.tableNumber ? `(${completedOrder.tableNumber})` : ''}</strong></div>
                <div>Date: {new Date(completedOrder.completedAt).toLocaleDateString()} {new Date(completedOrder.completedAt).toLocaleTimeString()}</div>
                <div>Cashier: {authUser?.fullName || 'Cashier Staff'}</div>
                <div>Customer: {completedOrder.customerName || 'Walk-in'}</div>
              </div>

              <div style={{ textAlign: 'left', fontSize: '0.72rem', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 54px', fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px dotted #888', paddingBottom: '2px' }}>
                  <span>Qty</span>
                  <span>Item</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {completedOrder.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 54px', margin: '3px 0' }}>
                    <span>{item.qty}x</span>
                    <span>{item.name} {item.variantName && item.variantName !== 'Standard' ? `(${item.variantName})` : ''}</span>
                    <span style={{ textAlign: 'right' }}>৳{item.unitPrice * item.qty}</span>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.74rem', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px', lineHeight: 1.5 }}>
                <div>Subtotal: ৳{completedOrder.subTotal}</div>
                {completedOrder.discount > 0 && <div>Discount: -৳{completedOrder.discount}</div>}
                <div>VAT (5%): ৳{completedOrder.tax || completedOrder.vatTax || Math.round(Math.max(0, completedOrder.subTotal - (completedOrder.discount || 0)) * 0.05)}</div>
                {completedOrder.deliveryFee > 0 && <div>Delivery Fee: ৳{completedOrder.deliveryFee}</div>}
                <div style={{ fontSize: '1rem', fontWeight: 900, marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  TOTAL: ৳{completedOrder.totalAmount}
                </div>
                <div>Method: {completedOrder.paymentMethod}</div>
                {completedOrder.paymentMethod === 'Cash' && (
                  <>
                    <div>Cash Tendered: ৳{completedOrder.cashTendered || completedOrder.totalAmount}</div>
                    <div>Change Due: ৳{completedOrder.changeDue || 0}</div>
                  </>
                )}
              </div>

              <div style={{ fontSize: '0.68rem', color: '#444', lineHeight: 1.3 }}>
                Thank you for choosing Kabir's Kitchen!<br />
                Govt VAT 5% included. Order dispatched to KDS.<br />
                www.kabirskitchen.com
              </div>
            </div>

            {/* Action Buttons: Print, A4 PDF, Thermal PDF, Next Order */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={handlePrintReceipt}
                disabled={isPrinting}
                style={{
                  gridColumn: 'span 2',
                  padding: '11px',
                  borderRadius: '10px',
                  border: 0,
                  background: '#0c251c',
                  color: '#fff',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Printer size={16} />
                {isPrinting ? 'Recording Print...' : `Print Thermal Receipt (${receiptWidth}mm)`}
              </button>

              <a
                href={invoicesApi.getPdfUrl(completedOrder.id)}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                  color: '#1e293b',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={14} color="#ea580c" />
                A4 Tax PDF
              </a>

              <a
                href={invoicesApi.getReceiptPdfUrl(completedOrder.id, receiptWidth)}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#fff',
                  color: '#1e293b',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} color="#0c251c" />
                Thermal PDF
              </a>

              <button
                type="button"
                onClick={() => { setShowReceiptModal(false); setCompletedOrder(null); }}
                style={{
                  gridColumn: 'span 2',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                Done / Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
