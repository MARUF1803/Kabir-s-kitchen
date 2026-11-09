const QUEUE_STORAGE_KEY = 'kabir_offline_orders_queue';
const CATALOG_STORAGE_KEY = 'kabir_cached_catalog';

export const offlineStorage = {
  // ── Queue Management ──
  getQueue: () => {
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  enqueueOrder: (orderPayload) => {
    try {
      const queue = offlineStorage.getQueue();
      const offlineId = `OFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const enrichedOrder = {
        ...orderPayload,
        offlineId,
        isOfflineOrder: true,
        syncStatus: 'Pending',
        queuedAt: new Date().toISOString()
      };
      queue.push(enrichedOrder);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new CustomEvent('kabir:offline-queue-updated', { detail: { count: queue.length } }));
      return enrichedOrder;
    } catch (err) {
      console.error('Failed to enqueue offline order:', err);
      return null;
    }
  },

  removeOrder: (offlineId) => {
    try {
      const queue = offlineStorage.getQueue().filter(o => o.offlineId !== offlineId);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      window.dispatchEvent(new CustomEvent('kabir:offline-queue-updated', { detail: { count: queue.length } }));
      return queue;
    } catch {
      return [];
    }
  },

  // ── Catalog Caching ──
  saveCatalog: (products, categories, branch) => {
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({
        products: products || [],
        categories: categories || [],
        branch: branch || null,
        cachedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Failed to cache catalog for offline use:', e);
    }
  },

  getCachedCatalog: () => {
    try {
      const data = localStorage.getItem(CATALOG_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // ── Batch Sync ──
  syncAll: async (ordersApi) => {
    const queue = offlineStorage.getQueue();
    if (queue.length === 0) return { success: 0, failed: 0, remaining: 0 };

    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        const payload = item.apiPayload || {
          branchId: item.branchId,
          orderType: item.orderType,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          deliveryAddress: item.deliveryAddress,
          customerNotes: item.notes ? `[OFFLINE SYNC] ${item.notes}` : '[OFFLINE SYNC]',
          couponCode: item.couponCode || null,
          idempotencyKey: item.idempotencyKey || `offline-${item.offlineId}`,
          items: item.items.map(i => ({
            menuItemId: Number(i.productId || i.id),
            menuItemVariantId: i.menuItemVariantId || null,
            quantity: i.qty,
            specialInstructions: i.notes || null,
            selectedAddOnIds: i.selectedAddOnIds || []
          }))
        };

        const serverOrder = await ordersApi.create(payload);
        if (serverOrder && serverOrder.id) {
          offlineStorage.removeOrder(item.offlineId);
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync offline order ${item.offlineId}:`, err);
        failedCount++;
      }
    }

    const remaining = offlineStorage.getQueue().length;
    return { success: successCount, failed: failedCount, remaining };
  }
};

