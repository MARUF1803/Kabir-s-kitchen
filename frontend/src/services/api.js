import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5143/api' : '/api');

export const resolveApiUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (API_BASE_URL.startsWith('/')) return url;
  return new URL(url, API_BASE_URL).toString();
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000
});

// Synchronously set initial Authorization header if token exists in localStorage
const initialToken = typeof window !== 'undefined' ? localStorage.getItem('kabirKitchenAccessToken') : null;
if (initialToken) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('kabirKitchenAccessToken', token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('kabirKitchenAccessToken');
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('kabirKitchenAccessToken');
  if (token) {
    if (config.headers?.set) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Axios defaults to application/json. FormData must let the browser set
  // its multipart boundary so ASP.NET Core can bind IFormFile parameters.
  if (config.data instanceof FormData) {
    if (config.headers?.delete) {
      config.headers.delete('Content-Type');
    } else {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kabirKitchenAccessToken');
      localStorage.removeItem('kabirKitchenAuthUser');
      delete apiClient.defaults.headers.common['Authorization'];
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ───────────────────────────────────────────────
export const authApi = {
  /**
   * POST /api/auth/login
   * Body: { emailOrPhone, password }
   * Returns LoginResponseDto with accessToken, userId, currentBranchId, and role.
   */
  login: (emailOrPhone, password) =>
    apiClient.post('/auth/login', { emailOrPhone, password }).then(r => r.data),

  /**
   * POST /api/auth/reset-password
   */
  resetPassword: (emailOrPhone, newPassword) =>
    apiClient.post('/auth/reset-password', { emailOrPhone, newPassword }).then(r => r.data),

  /**
   * GET /api/auth/me  (requires Bearer token)
   * Returns current authenticated user profile
   */
  me: () => apiClient.get('/auth/me').then(r => r.data),

  /**
   * POST /api/auth/logout
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAuthToken(null);
      localStorage.removeItem('kabirKitchenAuthUser');
    }
  },
};

export const mapLoginResponse = (data) => ({
  token: data.accessToken,
  user: {
    id: data.userId,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    branchId: data.currentBranchId,
    branchName: data.currentBranchName,
    assignedBranchIds: data.assignedBranchIds || [],
    phoneNumber: data.phoneNumber || ''
  }
});

// ─── Orders API ─────────────────────────────────────────────
export const ordersApi = {
  /** GET /api/orders?branchId=1&status=Active */
  list: (params = {}) => apiClient.get('/orders', { params }).then(r => r.data),

  /** POST /api/orders */
  create: (payload) => apiClient.post('/orders', payload).then(r => r.data),

  /** PUT /api/orders/:id/status — backend accepts the enum as a JSON string body. */
  updateStatus: (id, status) =>
    apiClient.put(`/orders/${id}/status`, status).then(r => r.data),

  /** GET /api/orders/:id */
  get: (id) => apiClient.get(`/orders/${id}`).then(r => r.data),

  /** Guest tracking is authorized by the order's phone number on the API. */
  getForTracking: (id, phone) =>
    apiClient.get(`/orders/${id}`, { params: phone ? { phone } : {} }).then(r => r.data),
};

// ─── Products / Menu API ─────────────────────────────────────
export const productsApi = {
  /** GET /api/menu/items?page=1&pageSize=100 */
  listPage: (params = {}) => apiClient.get('/menu/items', { params }).then(r => r.data),

  /** GET /api/menu/items/:id */
  get: (id, branchId) => apiClient.get(`/menu/items/${id}`, { params: { branchId } }).then(r => r.data),
};

export const categoriesApi = {
  /** GET /api/menu/categories */
  list: () => apiClient.get('/menu/categories').then(r => r.data),
};

export const branchesApi = {
  /** GET /api/branches */
  list: () => apiClient.get('/branches').then(r => r.data),
  get: (id) => apiClient.get(`/branches/${id}`).then(r => r.data),
  create: (data) => apiClient.post('/branches', data).then(r => r.data),
  update: (id, data) => apiClient.put(`/branches/${id}`, data).then(r => r.data),
  toggleActive: (id) => apiClient.patch(`/branches/${id}/toggle-active`).then(r => r.data),
};

export const promotionsApi = {
  /** Public automatic offers for a branch; order submission always revalidates eligibility. */
  listActive: (branchId) => apiClient.get('/promotions/active', { params: { branchId } }).then(r => r.data),
  quote: (payload) => apiClient.post('/promotions/quote', payload).then(r => r.data),
  calendar: (params = {}) => apiClient.get('/promotions/calendar', { params }).then(r => r.data),
  reports: () => apiClient.get('/promotions/reports').then(r => r.data),
  trackEngagement: (campaignId, branchId, type) =>
    apiClient.post('/promotions/engagement', { campaignId, branchId, type }),
};

export const bakeryApi = {
  quoteCustomCake: (payload) => apiClient.post('/bakery/custom-cake/quote', payload).then(r => r.data),
  createCustomCake: (payload) => apiClient.post('/bakery/custom-cake', payload).then(r => r.data),
  submitPaymentProof: (payload) => apiClient.post('/bakery/custom-cake/submit-payment-proof', payload).then(r => r.data),
  getCakeOrders: (branchId, search) => apiClient.get('/bakery/orders', { params: { branchId, search } }).then(r => r.data),
  applySpecialDiscount: (payload) => apiClient.post('/bakery/apply-discount', payload).then(r => r.data),
  verifyAdvance: (payload) => apiClient.post('/bakery/verify-advance', payload).then(r => r.data),
  startBaking: (cakeOrderId) => apiClient.put(`/bakery/${cakeOrderId}/start-baking`).then(r => r.data),
};

export const mapMenuItemToProduct = item => {
  const cleanName = item.name ? item.name.replace(/\s*\(\s*\d+(\.\d+)?\s*(kg|Kg|KG|pound|lb|gm)\s*\)/gi, '').trim() : '';
  return {
    id: item.id,
    dbCategoryId: item.rootCategoryId ?? item.categoryId,
    productCategoryId: item.categoryId,
    categoryId: item.rootCategorySlug || item.categorySlug || String(item.categoryId),
    categoryName: item.categoryName,
    subCategoryId: item.subCategoryId || '',
    subCategoryName: item.subCategoryName || '',
    categoryPath: item.categoryPath || item.categoryName || '',
    name: cleanName || item.name,
    slug: item.slug,
    description: item.description || '',
    image: item.imageUrl ? resolveApiUrl(item.imageUrl) : '/food-placeholder.svg',
    imageUrl: item.imageUrl ? resolveApiUrl(item.imageUrl) : '/food-placeholder.svg',
    basePrice: item.branchPrice ?? item.basePrice,
    branchPrices: {},
    prepTime: item.preparationTimeMinutes,
    preparationTimeMinutes: item.preparationTimeMinutes,
    rating: item.rating ?? 0,
    reviews: item.reviews ?? 0,
    isPopular: item.isPopular ?? false,
    isSpicy: item.isSpicy,
    isVeg: item.isVegetarian,
    isCustomCake: item.isCustomCake,
    isAvailable: item.isAvailable,
    variants: (item.variants || []).map(variant => ({
      id: variant.id,
      name: variant.variantName,
      priceDiff: variant.additionalPrice,
    })),
    addons: (item.addOns || []).map(addOn => ({
      id: addOn.id,
      name: addOn.name,
      price: addOn.price,
    })),
  };
};

// ─── Inventory API ───────────────────────────────────────────
export const inventoryApi = {
  /** GET /api/inventory/stocks?branchId=1 */
  list: (branchId) => apiClient.get('/inventory/stocks', { params: { branchId } }).then(r => r.data),

  /** GET /api/inventory/low-stock?branchId=1 */
  lowStock: (branchId) => apiClient.get('/inventory/low-stock', { params: { branchId } }).then(r => r.data),
};

// ─── Invoices API ───────────────────────────────────────────
export const invoicesApi = {
  /** GET /api/orders/:id/invoice */
  get: (orderId) => apiClient.get(`/orders/${orderId}/invoice`).then(r => r.data),

  /** URL for direct A4 PDF download */
  getPdfUrl: (orderId, phone) =>
    `${API_BASE_URL}/orders/${orderId}/invoice/pdf${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`,

  /** URL for direct Thermal Receipt PDF download */
  getReceiptPdfUrl: (orderId, width = 80, phone) =>
    `${API_BASE_URL}/orders/${orderId}/invoice/receipt-pdf?width=${width}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`,

  /** POST /api/orders/:id/print */
  recordPrint: (orderId, payload = {}) => apiClient.post(`/orders/${orderId}/print`, payload).then(r => r.data),

  /** POST /api/orders/:id/void */
  voidOrder: (orderId, payload) => apiClient.post(`/orders/${orderId}/void`, payload).then(r => r.data),

  /** POST /api/orders/:id/payments */
  addPayment: (orderId, payload) => apiClient.post(`/orders/${orderId}/payments`, payload).then(r => r.data),
};

// ─── Reports API ────────────────────────────────────────────
export const reportsApi = {
  /** GET /api/reports/sales */
  getSales: (params = {}) => apiClient.get('/reports/sales', { params }).then(r => r.data),

  /** URL for CSV export */
  getCsvUrl: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/sales/csv${query ? `?${query}` : ''}`;
  }
};

// ─── Hero Banners & Campaigns API ───────────────────────────
export const bannersApi = {
  /** GET /api/hero-banners?branchId=1 */
  getVisible: (branchId) => apiClient.get('/hero-banners', { params: { branchId } }).then(r => r.data),

  /** GET /api/hero-banners/admin */
  getAll: () => apiClient.get('/hero-banners/admin').then(r => r.data),

  /** POST /api/hero-banners */
  create: (data) => apiClient.post('/hero-banners', data).then(r => r.data),
  upload: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post('/hero-banners/upload', formData).then(r => r.data);
  },

  /** PUT /api/hero-banners/:id */
  update: (id, data) => apiClient.put(`/hero-banners/${id}`, data).then(r => r.data),

  /** DELETE /api/hero-banners/:id */
  delete: (id) => apiClient.delete(`/hero-banners/${id}`).then(r => r.data)
};

// ─── Procurement & Suppliers API ─────────────────────────────
export const suppliersApi = {
  list: () => apiClient.get('/suppliers').then(r => r.data),
  create: (data) => apiClient.post('/suppliers', data).then(r => r.data),
  update: (id, data) => apiClient.put(`/suppliers/${id}`, data).then(r => r.data),
};

export const procurementApi = {
  listPOs: (params = {}) => apiClient.get('/purchaseorders', { params }).then(r => r.data),
  getPO: (id) => apiClient.get(`/purchaseorders/${id}`).then(r => r.data),
  createPO: (data) => apiClient.post('/purchaseorders', data).then(r => r.data),
  receiveGRN: (id, data) => apiClient.post(`/purchaseorders/${id}/receive`, data).then(r => r.data),
  addPayment: (id, data) => apiClient.post(`/purchaseorders/${id}/payments`, data).then(r => r.data),
};

// ─── Staff / Users API ──────────────────────────────────────
export const usersApi = {
  /** GET /api/users?branchId=1 — list staff (branch-scoped) */
  list: (branchId) =>
    apiClient.get('/users', { params: branchId ? { branchId } : {} }).then(r => r.data),

  /** POST /api/users — create new staff member */
  create: (data) => apiClient.post('/users', data).then(r => r.data),

  /** PATCH /api/users/:id — update role or active status */
  update: (id, data) => apiClient.patch(`/users/${id}`, data).then(r => r.data),
};

// ─── Inventory Adjustment API ────────────────────────────────
export const inventoryAdjustApi = {
  /** POST /api/inventory/adjust — manual stock adjustment */
  adjust: (data) => apiClient.post('/inventory/adjust', data).then(r => r.data),
};

// ─── Customer Support & Staff Live Chat API ──────────────────
export const supportApi = {
  /** GET /api/support/conversations */
  list: (params = {}) => apiClient.get('/support/conversations', { params }).then(r => r.data),

  /** GET /api/support/conversations/:id */
  get: (id) => apiClient.get(`/support/conversations/${id}`).then(r => r.data),

  /** POST /api/support/conversations */
  create: (data) => apiClient.post('/support/conversations', data).then(r => r.data),

  /** POST /api/support/conversations/:id/messages */
  sendMessage: (id, text, messageType = 0) =>
    apiClient.post(`/support/conversations/${id}/messages`, {
      conversationId: id,
      text,
      messageType
    }).then(r => r.data),

  /** PUT /api/support/conversations/:id — update status or priority */
  update: (id, data) => apiClient.put(`/support/conversations/${id}`, data).then(r => r.data),

  /** POST /api/support/conversations/:id/ai */
  askAi: (id, question) => apiClient.post(`/support/conversations/${id}/ai`, { question }).then(r => r.data),
};

// ─── Inventory ERP APIs ──────────────────────────────────────

export const subRecipesApi = {
  list: () => apiClient.get('/subrecipes').then(r => r.data),
  get: (id) => apiClient.get(`/subrecipes/${id}`).then(r => r.data),
  create: (data) => apiClient.post('/subrecipes', data).then(r => r.data),
  stocks: (branchId) => apiClient.get('/subrecipes/stocks', { params: { branchId } }).then(r => r.data),
};

export const productionApi = {
  listBatches: (params = {}) => apiClient.get('/production/batches', { params }).then(r => r.data),
  getBatch: (id) => apiClient.get(`/production/batches/${id}`).then(r => r.data),
  createBatch: (data) => apiClient.post('/production/batches', data).then(r => r.data),
  startBatch: (id) => apiClient.post(`/production/batches/${id}/start`).then(r => r.data),
  completeBatch: (id, data) => apiClient.post(`/production/batches/${id}/complete`, data).then(r => r.data),
  postBatch: (id, data = {}) => apiClient.post(`/production/batches/${id}/post`, data).then(r => r.data),
  cancelBatch: (id, data) => apiClient.post(`/production/batches/${id}/cancel`, data).then(r => r.data),
};

export const reservoirsApi = {
  list: (branchId) => apiClient.get('/equipmentreservoirs', { params: { branchId } }).then(r => r.data),
  create: (data) => apiClient.post('/equipmentreservoirs', data).then(r => r.data),
  transferIn: (data) => apiClient.post('/equipmentreservoirs/transfer-in', data).then(r => r.data),
  discardSludge: (data) => apiClient.post('/equipmentreservoirs/discard-sludge', data).then(r => r.data),
  fullDrain: (data) => apiClient.post('/equipmentreservoirs/full-drain', data).then(r => r.data),
};

export const inventoryLotsApi = {
  list: (params = {}) => apiClient.get('/inventorylots', { params }).then(r => r.data),
  quarantine: (data) => apiClient.post('/inventorylots/quarantine', data).then(r => r.data),
  releaseQuarantine: (data) => apiClient.post('/inventorylots/release-quarantine', data).then(r => r.data),
};

export const finishedProductStocksApi = {
  list: (branchId) => apiClient.get('/inventory/finished-products', { params: { branchId } }).then(r => r.data),
};

export const uomConversionsApi = {
  list: (ingredientId) => apiClient.get('/uomconversions', { params: ingredientId ? { ingredientId } : {} }).then(r => r.data),
  create: (data) => apiClient.post('/uomconversions', data).then(r => r.data),
};

// ─── Table Reservations API ─────────────────────────────────
export const reservationsApi = {
  create: (data) => apiClient.post('/reservations', data).then(r => r.data),
  list: (params = {}) => apiClient.get('/reservations', { params }).then(r => r.data),
  getById: (id) => apiClient.get(`/reservations/${id}`).then(r => r.data),
  confirm: (id, data) => apiClient.put(`/reservations/${id}/confirm`, data).then(r => r.data),
  reject: (id, data) => apiClient.put(`/reservations/${id}/reject`, data).then(r => r.data),
  seat: (id) => apiClient.put(`/reservations/${id}/seat`).then(r => r.data),
  complete: (id) => apiClient.put(`/reservations/${id}/complete`).then(r => r.data),
  cancel: (id, reason) => apiClient.put(`/reservations/${id}/cancel`, null, { params: { reason } }).then(r => r.data),
};

// ─── Cash Shifts (Z-Report) API ─────────────────────────────
export const cashShiftsApi = {
  open: (data) => apiClient.post('/cash-shifts/open', data).then(r => r.data),
  getCurrent: (branchId) => apiClient.get('/cash-shifts/current', { params: { branchId } }).then(r => r.data),
  cashDrop: (id, data) => apiClient.post(`/cash-shifts/${id}/cash-drop`, data).then(r => r.data),
  close: (id, data) => apiClient.post(`/cash-shifts/${id}/close`, data).then(r => r.data),
  list: (params = {}) => apiClient.get('/cash-shifts', { params }).then(r => r.data),
};

// ─── Staff Biometric Attendance API ─────────────────────────
export const attendanceApi = {
  daily: (params) => apiClient.get('/attendance/daily', { params }).then(r => r.data),
  punch: (data) => apiClient.post('/attendance/punch', data).then(r => r.data),
  manual: (data) => apiClient.post('/attendance/manual', data).then(r => r.data),
};

export default apiClient;
