import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppContext } from './AppContext.js';
import { bakeryApi, branchesApi, categoriesApi, mapMenuItemToProduct, productsApi, promotionsApi, setAuthToken, ordersApi } from '../services/api';
import { offlineStorage } from '../services/offlineSync';

const BRANCH_UNAVAILABLE = { id: 0, code: 'N/A', name: 'Branch unavailable', address: '', phone: '' };
const formatCurrentTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function AppProvider({ children }) {
  // Navigation Modes: 'customer' | 'chat' | 'admin' | 'pos' | 'kds' | 'tracking' | 'support'
  const [currentMode, setCurrentMode] = useState('customer');
  const [selectedBranchId, setSelectedBranchId] = useState(0);
  const [authUser, setAuthUser] = useState(() => {
    try {
      const storedToken = localStorage.getItem('kabirKitchenAccessToken');
      const storedUser = localStorage.getItem('kabirKitchenAuthUser');
      if (storedToken && storedUser) {
        setAuthToken(storedToken);
        return JSON.parse(storedUser);
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(() => offlineStorage.getQueue().length);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when back online
      offlineStorage.syncAll(ordersApi).then(res => {
        if (res.success > 0) {
          setOfflineQueueCount(offlineStorage.getQueue().length);
        }
      });
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdated = (e) => setOfflineQueueCount(e.detail?.count ?? offlineStorage.getQueue().length);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('kabir:offline-queue-updated', handleQueueUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('kabir:offline-queue-updated', handleQueueUpdated);
    };
  }, []);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchLoadError, setBranchLoadError] = useState('');
  const [activePromotions, setActivePromotions] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productLoadError, setProductLoadError] = useState('');
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const productRequestId = useRef(0);

  const loadProductPage = useCallback(async ({
    page = 1,
    pageSize = 100,
    categoryId,
    search,
    append = false
  } = {}) => {
    if (!selectedBranchId) return null;
    const requestId = ++productRequestId.current;
    setProductsLoading(true);
    setProductLoadError('');

    try {
      const result = await productsApi.listPage({ page, pageSize, categoryId, search, branchId: selectedBranchId });
      if (!Array.isArray(result.items)) {
        throw new Error('The menu API returned an invalid product page.');
      }

      if (requestId === productRequestId.current) {
        const loadedProducts = result.items.map(mapMenuItemToProduct);
        setProducts(current => append
          ? [...current, ...loadedProducts.filter(product => !current.some(existing => existing.id === product.id))]
          : loadedProducts);
        setProductPage(result.page);
        setProductTotalCount(result.totalCount);
        setHasMoreProducts(result.hasNextPage);
        offlineStorage.saveCatalog(loadedProducts, categories, activeBranch);
      }

      return result;
    } catch (error) {
      if (requestId === productRequestId.current) {
        const cached = offlineStorage.getCachedCatalog();
        if (cached && cached.products && cached.products.length > 0) {
          setProducts(cached.products);
          setProductTotalCount(cached.products.length);
          setProductLoadError('');
        } else {
          setProductLoadError(error.response?.data?.message || error.message || 'Menu data could not be loaded from the server.');
        }
      }
      return null;
    } finally {
      if (requestId === productRequestId.current) setProductsLoading(false);
    }
  }, [selectedBranchId]);

  // oxlint-disable-next-line react/set-state-in-effect -- Initial catalog data is loaded from the API.
  useEffect(() => {
    let active = true;

    // oxlint-disable-next-line react/set-state-in-effect -- The fetch synchronizes initial catalog loading state.
    loadProductPage();

    categoriesApi.list()
      .then(items => {
        if (!Array.isArray(items)) throw new Error('The menu API returned an invalid category list.');
        if (active) setCategories(items);
      })
      .catch(error => {
        const cached = offlineStorage.getCachedCatalog();
        if (cached && cached.categories && cached.categories.length > 0 && active) {
          setCategories(cached.categories);
        } else if (active) {
          setCategoryLoadError(error.response?.data?.message || 'Menu categories could not be loaded from the server.');
        }
      });

    return () => { active = false; };
  }, [loadProductPage]);

  useEffect(() => {
    let active = true;
    branchesApi.list()
      .then(items => {
        if (!Array.isArray(items)) throw new Error('The branches API returned an invalid list.');
        const mapped = items.map(branch => ({
          id: Number(branch.id),
          code: branch.branchCode,
          name: branch.name,
          address: branch.address,
          phone: branch.contactPhone
        }));
        if (active && mapped.length > 0) {
          setBranchLoadError('');
          setBranches(mapped);
          setSelectedBranchId(currentId =>
            mapped.some(branch => branch.id === currentId) ? currentId : mapped[0].id);
        } else if (active) {
          setBranchLoadError('No branches are configured in the database.');
        }
      })
      .catch(error => {
        if (active) {
          setBranchLoadError(error.response?.data?.message || 'Branches could not be loaded. Check that the API is running.');
          console.error('[AppContext] Branch list could not be loaded:', error);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return undefined;
    let active = true;
    const refreshPromotions = async () => {
      try {
        const promotions = await promotionsApi.listActive(selectedBranchId);
        if (active && Array.isArray(promotions)) setActivePromotions(promotions);
      } catch (error) {
        console.warn('[AppContext] Active promotions could not be loaded:', error.response?.data?.message || error.message);
        if (active) setActivePromotions([]);
      }
    };

    refreshPromotions();
    const timer = window.setInterval(refreshPromotions, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedBranchId]);

  // Use authenticated customer details when available; leave guest details blank.
  const userProfile = useMemo(() => ({
    name: authUser?.fullName || '',
    phone: authUser?.phoneNumber || '',
    email: authUser?.email || '',
    role: authUser?.role || 'Guest',
  }), [authUser]);

  const addProduct = (newProduct) => {
    setProducts(prev => {
      const exists = prev.some(p => p.id === newProduct.id);
      if (exists) return prev;
      return [newProduct, ...prev];
    });
  };

  const getProductPromotion = useCallback((product) => {
    if (!product) return null;
    return activePromotions.find(promotion => {
      if (product.isCustomCake && !promotion.includeCustomCakes) return false;
      if (promotion.couponCode) return false; // Coupon-code discounts apply via code entry
      if (promotion.targetType === 'AllItems') return true;
      if (promotion.targetType === 'Product') return Number(promotion.menuItemId) === Number(product.id);
      if (promotion.targetType === 'Category') {
        const catId = Number(product.productCategoryId || product.categoryId);
        return catId > 0 && Number(promotion.categoryId) === catId;
      }
      return false;
    }) || null;
  }, [activePromotions]);

  const getProductUnitPrice = useCallback((product, variant = null, selectedAddons = []) => {
    const basePrice = product.branchPrices?.[selectedBranchId] || product.basePrice;
    return basePrice + (variant?.priceDiff || 0) +
      selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  }, [selectedBranchId]);

  // Current Active Branch
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId) || branches[0] || BRANCH_UNAVAILABLE;
  }, [branches, selectedBranchId]);

  // Cart State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code: 'KABIR10', discountPct: 10 }

  // Live Orders
  const [orders, setOrders] = useState([]);

  // Tracked Order for Domino's-Style Pipeline
  const [activeTrackedOrderId, setActiveTrackedOrderId] = useState(null);

  // Custom Cakes Studio State
  const [customCakes, setCustomCakes] = useState([]);

  // Raw Inventory & Audited Ledger

  // Promotional & Discount Configuration (Managed by non-technical Admin/Owner)
  const DEFAULT_PROMOTIONS = {
    storewide: {
      isActive: false,
      title: "Today's Special Discount",
      discountPct: 20,
      appliesToWeb: true,
      appliesToPos: true,
      expiresAt: null
    },
    coupons: [],
    itemOffers: {}
  };

  const [promotionsConfig, setPromotionsConfig] = useState(DEFAULT_PROMOTIONS);

  const savePromotions = (newConfig) => {
    setPromotionsConfig(newConfig);
    try {
      localStorage.setItem('kabirKitchenPromotions', JSON.stringify(newConfig));
    } catch {
      // Ignore localStorage errors
    }
  };

  const updateStorewidePromotion = (storewide) => {
    savePromotions({
      ...promotionsConfig,
      storewide
    });
  };

  const addCoupon = (coupon) => {
    savePromotions({
      ...promotionsConfig,
      coupons: [coupon, ...(promotionsConfig.coupons || [])]
    });
  };

  const deleteCoupon = (idOrCode) => {
    savePromotions({
      ...promotionsConfig,
      coupons: (promotionsConfig.coupons || []).filter(c => c.id !== idOrCode && c.code !== idOrCode)
    });
  };

  const toggleCoupon = (idOrCode) => {
    savePromotions({
      ...promotionsConfig,
      coupons: (promotionsConfig.coupons || []).map(c => {
        if (c.id === idOrCode || c.code === idOrCode) {
          return { ...c, isActive: !c.isActive };
        }
        return c;
      })
    });
  };

  const setProductOfferPrice = (productId, offerPrice) => {
    savePromotions({
      ...promotionsConfig,
      itemOffers: {
        ...(promotionsConfig.itemOffers || {}),
        [productId]: { offerPrice }
      }
    });
  };

  const removeProductOfferPrice = (productId) => {
    const updated = { ...(promotionsConfig.itemOffers || {}) };
    delete updated[productId];
    savePromotions({
      ...promotionsConfig,
      itemOffers: updated
    });
  };

  const validateCoupon = (code, subtotal) => {
    if (!code) return { success: false, message: 'Please enter a coupon code.' };
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(clean)) {
      return { success: false, message: 'Enter a coupon code containing 3–40 letters, numbers, or hyphens.' };
    }
    return {
      success: true,
      coupon: { code: clean },
      message: 'Coupon eligibility and discount are confirmed by the server when you place your order.'
    };
  };

  const isStorewideActiveForWeb = useMemo(() => {
    const sw = promotionsConfig?.storewide;
    if (!sw || !sw.isActive || !sw.appliesToWeb) return false;
    if (sw.expiresAt) {
      const expiry = new Date(sw.expiresAt);
      if (new Date() > expiry) return false;
    }
    return true;
  }, [promotionsConfig?.storewide]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.effectivePrice * item.qty), 0);
  }, [cart]);

  const discountAmount = 0;

  const deliveryFee = cart.length > 0 ? 60 : 0;
  const vatTax = Math.round(cartSubtotal * 0.05 * 100) / 100; // Estimate only; backend is authoritative.
  const cartTotal = Math.max(0, cartSubtotal - discountAmount + deliveryFee + vatTax);

  // Cart Actions
  const addToCart = (product, variant = null, selectedAddons = [], notes = '', qty = 1) => {
    const effectivePrice = getProductUnitPrice(product, variant, selectedAddons);

    const cartKey = `${product.id}-${variant?.id || 'def'}-${selectedAddons.map(a => a.id).sort().join('-')}`;

    setCart(prev => {
      const existing = prev.find(item => item.cartKey === cartKey);
      if (existing) {
        return prev.map(item => item.cartKey === cartKey ? { ...item, qty: item.qty + qty } : item);
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product.id,
          menuItemVariantId: variant?.id || null,
          selectedAddOnIds: selectedAddons.map(addon => addon.id),
          name: product.name,
          categoryName: product.categoryName,
          image: product.image,
          variantName: variant?.name || 'Standard',
          addons: selectedAddons.map(a => a.name),
          notes,
          effectivePrice,
          bomCost: product.bomCost,
          qty
        }
      ];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (cartKey, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartKey === cartKey) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (cartKey) => {
    setCart(prev => prev.filter(item => item.cartKey !== cartKey));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const quoteOrder = useCallback(async ({
    items,
    orderType = 'Delivery',
    couponCode = null
  }) => {
    // If browser is offline, instantly return local fallback calculation
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const subtotal = (items || []).reduce((sum, item) => sum + ((item.unitPrice || item.effectivePrice || 0) * (item.qty || 1)), 0);
      const vatTax = Math.round(subtotal * 0.05 * 100) / 100;
      const deliveryFee = orderType === 'Delivery' ? 60 : 0;
      return {
        subTotal: subtotal,
        discountAmount: 0,
        taxAmount: vatTax,
        deliveryFee: deliveryFee,
        totalAmount: subtotal + vatTax + deliveryFee,
        totalIngredientBOMCost: 0,
        isOfflineQuote: true
      };
    }

    try {
      return await promotionsApi.quote({
        branchId: selectedBranchId,
        orderType: orderType === 'Pickup' ? 'Takeaway' : orderType,
        couponCode,
        items: (items || []).map(item => ({
          menuItemId: Number(item.productId || item.id),
          menuItemVariantId: item.menuItemVariantId || null,
          quantity: item.qty,
          selectedAddOnIds: item.selectedAddOnIds || []
        }))
      });
    } catch {
      // If server unreachable, return local fallback quote
      const subtotal = (items || []).reduce((sum, item) => sum + ((item.unitPrice || item.effectivePrice || 0) * (item.qty || 1)), 0);
      const vatTax = Math.round(subtotal * 0.05 * 100) / 100;
      const deliveryFee = orderType === 'Delivery' ? 60 : 0;
      return {
        subTotal: subtotal,
        discountAmount: 0,
        taxAmount: vatTax,
        deliveryFee: deliveryFee,
        totalAmount: subtotal + vatTax + deliveryFee,
        totalIngredientBOMCost: 0,
        isOfflineQuote: true
      };
    }
  }, [selectedBranchId]);

  // Place Order through Central Engine
  const placeOrder = async ({
    orderType = 'DineIn',
    customerName,
    customerPhone,
    deliveryAddress,
    tableNumber,
    paymentMethod = 'Cash',
    notes: _notes,
    items: customItems = null,
    couponCode = appliedCoupon?.code || null
  } = {}) => {
    const sourceItems = customItems || cart;
    if (!sourceItems || sourceItems.length === 0) return null;

    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let apiOrder = null;
    let isOfflineExecution = typeof navigator !== 'undefined' && !navigator.onLine;

    if (!isOfflineExecution) {
      try {
        apiOrder = await ordersApi.create({
          branchId: selectedBranchId,
          orderType: orderType === 'Pickup' ? 'Takeaway' : orderType,
          customerName: customerName || userProfile.name,
          customerPhone: customerPhone || userProfile.phone,
          deliveryAddress: orderType === 'Delivery' ? deliveryAddress : null,
          customerNotes: _notes || null,
          couponCode,
          idempotencyKey,
          items: sourceItems.map(item => ({
            menuItemId: Number(item.productId || item.id),
            menuItemVariantId: item.menuItemVariantId || null,
            quantity: item.qty,
            specialInstructions: item.notes || null,
            selectedAddOnIds: item.selectedAddOnIds || []
          }))
        });
      } catch (err) {
        console.warn('Network failure placing order; falling back to offline queue', err);
        isOfflineExecution = true;
      }
    }

    let calcSubtotal, calcDiscount, calcTax, calcDeliveryFee, calcTotal, totalBOMCost, newId, orderNumber, invoiceNumber, paidAmount, outstandingAmount, status, paymentStatus;

    if (apiOrder) {
      calcSubtotal = apiOrder.subTotal;
      calcDiscount = apiOrder.discountAmount;
      calcTax = apiOrder.taxAmount;
      calcDeliveryFee = apiOrder.deliveryFee;
      calcTotal = apiOrder.totalAmount;
      totalBOMCost = apiOrder.totalIngredientBOMCost;
      newId = apiOrder.id;
      orderNumber = apiOrder.orderNumber;
      invoiceNumber = apiOrder.invoiceNumber;
      paidAmount = apiOrder.paidAmount;
      outstandingAmount = apiOrder.outstandingAmount;
      status = apiOrder.status;
      paymentStatus = apiOrder.paymentStatus;
    } else {
      // Local offline order calculation
      calcSubtotal = sourceItems.reduce((sum, c) => sum + ((c.unitPrice || c.effectivePrice || 0) * c.qty), 0);
      calcDiscount = 0;
      calcTax = Math.round(calcSubtotal * 0.05 * 100) / 100;
      calcDeliveryFee = orderType === 'Delivery' ? 60 : 0;
      calcTotal = calcSubtotal + calcTax + calcDeliveryFee;
      totalBOMCost = 0;

      const branchCode = (activeBranch?.name || 'BRN').replace(/\s+/g, '').substring(0, 3).toUpperCase();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      orderNumber = `OFF-${branchCode}-${dateStr}-${randomSeq}`;
      invoiceNumber = orderNumber;
      newId = Date.now();
      paidAmount = calcTotal;
      outstandingAmount = 0;
      status = 'Confirmed (Offline)';
      paymentStatus = 'Paid';

      // Enqueue in offline storage for automatic sync when online
      offlineStorage.enqueueOrder({
        branchId: selectedBranchId,
        orderType: orderType === 'Pickup' ? 'Takeaway' : orderType,
        customerName: customerName || userProfile.name,
        customerPhone: customerPhone || userProfile.phone,
        deliveryAddress: orderType === 'Delivery' ? deliveryAddress : null,
        notes: _notes,
        couponCode,
        idempotencyKey,
        items: sourceItems,
        subTotal: calcSubtotal,
        taxAmount: calcTax,
        totalAmount: calcTotal,
        paymentMethod
      });
    }

    const formattedItems = sourceItems.map(c => ({
      id: c.productId || c.id,
      name: c.name,
      variantName: c.variantName || 'Standard',
      qty: c.qty,
      unitPrice: c.unitPrice || c.effectivePrice,
      bomCost: c.bomCost || 0,
      addons: c.addons || []
    }));

    const newOrder = {
      id: newId,
      orderNumber,
      invoiceNumber,
      branchId: selectedBranchId,
      branchName: apiOrder.branchName || activeBranch.name,
      orderType: apiOrder.orderType || orderType,
      customerName: apiOrder.customerName,
      customerPhone: apiOrder.customerPhone,
      deliveryAddress: orderType === 'Delivery' ? deliveryAddress : null,
      tableNumber: orderType === 'DineIn' ? tableNumber : null,
      status: apiOrder.status,
      items: formattedItems,
      subTotal: calcSubtotal,
      discount: calcDiscount,
      deliveryFee: calcDeliveryFee,
      tax: calcTax,
      totalAmount: calcTotal,
      paidAmount: apiOrder.paidAmount,
      outstandingAmount: apiOrder.outstandingAmount,
      totalBOMCost,
      packagingCost: orderType === 'Delivery' ? 40 : 0,
      deliveryCost: orderType === 'Delivery' ? 60 : 0,
      paymentMethod,
      paymentStatus: apiOrder.paymentStatus,
      estimatedMinutes: orderType === 'Delivery' ? 30 : 15,
      createdAt: formatCurrentTime()
    };

    setOrders(prev => [newOrder, ...prev]);
    setActiveTrackedOrderId(newOrder.id);
    try {
      sessionStorage.setItem('kabirKitchenTrackedOrder', JSON.stringify({
        id: newOrder.id,
        phone: newOrder.customerPhone || customerPhone || userProfile.phone
      }));
    } catch (error) {
      console.warn('[AppContext] Order tracking could not be saved for this browser session:', error);
    }
    if (!customItems) {
      clearCart();
      setIsCartOpen(false);
    }

    return newOrder;
  };

  // KDS & Order Status Updates
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    ordersApi.updateStatus(orderId, newStatus).catch(err => {
      console.warn('[AppContext] Order status update failed in backend:', err?.response?.status ?? err.message);
    });
  };

  // Cake Operations
  const verifyCakeAdvance = (cakeId) => {
    setCustomCakes(prev => prev.map(c => {
      if (c.id === cakeId) {
        return {
          ...c,
          advancePaid: c.advanceRequired,
          isAdvanceVerified: true,
          status: 'AdvancePaid'
        };
      }
      return c;
    }));
  };

  const startCakeBaking = (cakeId) => {
    const target = customCakes.find(c => c.id === cakeId);
    if (!target?.isAdvanceVerified) {
      alert("❌ Kabir's Kitchen Policy: Cannot start baking! 50% advance payment is not verified.");
      return false;
    }
    setCustomCakes(prev => prev.map(c => c.id === cakeId ? { ...c, status: 'InBaking' } : c));
    return true;
  };

  const createCustomCakeRequest = async (cakeData) => {
    const response = await bakeryApi.createCustomCake({
      branchId: selectedBranchId,
      menuItemId: Number(cakeData.menuItemId),
      customerName: cakeData.customerName || userProfile.name,
      customerPhone: cakeData.customerPhone || userProfile.phone,
      deliveryAddress: cakeData.deliveryAddress || null,
      weightKg: Number(cakeData.weightKg),
      flavor: cakeData.flavor,
      creamType: cakeData.creamType,
      tierCount: cakeData.tierCount || '1 Tier',
      colorTheme: cakeData.colorTheme || null,
      messageOnCake: cakeData.messageOnCake || null,
      referenceImageUrl: cakeData.referenceImageUrl || null,
      deliveryDate: cakeData.deliveryDate,
      deliveryTimeSlot: cakeData.deliverySlot,
      couponCode: cakeData.couponCode || null
    });
    const newCake = {
      ...response,
      customNumber: response.customOrderNumber,
      designName: cakeData.designName,
      advanceRequired: response.advanceRequiredAmount,
      advancePaid: response.advancePaidAmount,
      status: response.status
    };
    setCustomCakes(prev => [newCake, ...prev]);
    return newCake;
  };

  /**
   * Save authentication session.
   * Supports two calling conventions:
   *   saveAuthSession({ token, user })   — from login pages
   *   saveAuthSession(token, user)       — legacy form used by PosPage demo login
   */
  const saveAuthSession = (sessionOrToken, maybeUser) => {
    let token, user;
    if (typeof sessionOrToken === 'string') {
      token = sessionOrToken;
      user = maybeUser;
    } else {
      token = sessionOrToken?.token;
      user = sessionOrToken?.user;
    }
    setAuthToken(token);
    localStorage.setItem('kabirKitchenAuthUser', JSON.stringify(user));
    setAuthUser(user);
  };

  const signOut = () => {
    setAuthToken(null);
    localStorage.removeItem('kabirKitchenAccessToken');
    localStorage.removeItem('kabirKitchenAuthUser');
    setAuthUser(null);
    setCurrentMode('customer');
  };

  return (
    <AppContext.Provider
      value={{
        currentMode,
        setCurrentMode,
        selectedBranchId,
        setSelectedBranchId,
        activeBranch,
        isOnline,
        offlineQueueCount,
        syncOfflineOrders: () => offlineStorage.syncAll(ordersApi),
        branches,
        branchLoadError,
        products,
        categories,
        activePromotions,
        getProductPromotion,
        getProductUnitPrice,
        productsLoading,
        productLoadError,
        categoryLoadError,
        productPage,
        productTotalCount,
        hasMoreProducts,
        loadProductPage,
        setProducts,
        addProduct,
        userProfile,
        authUser,
        saveAuthSession,
        signOut,
        cart,
        isCartOpen,
        setIsCartOpen,
        appliedCoupon,
        setAppliedCoupon,
        cartSubtotal,
        discountAmount,
        deliveryFee,
        vatTax,
        cartTotal,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        orders,
        activeTrackedOrderId,
        setActiveTrackedOrderId,
        placeOrder,
        quoteOrder,
        updateOrderStatus,
        customCakes,
        verifyCakeAdvance,
        startCakeBaking,
        createCustomCakeRequest,
        promotionsConfig,
        updateStorewidePromotion,
        addCoupon,
        deleteCoupon,
        toggleCoupon,
        setProductOfferPrice,
        removeProductOfferPrice,
        validateCoupon,
        isStorewideActiveForWeb
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
