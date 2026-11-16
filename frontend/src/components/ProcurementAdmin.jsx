import { useState, useEffect, useCallback } from 'react';
import {
  Building2, PlusCircle, DollarSign, FileText, ArrowDownToLine, RefreshCw, X,
  History, AlertCircle, CheckCircle2, Eye, Trash2, Plus
} from 'lucide-react';
import { suppliersApi, procurementApi, inventoryApi } from '../services/api';

const UNIT_OPTIONS = [
  { value: 'Liter', label: 'Liter (লিটার - Ltr)' },
  { value: 'Kilogram', label: 'Kilogram (কেজি - Kg)' },
  { value: 'Piece', label: 'Piece (পিস - Pcs)' },
  { value: 'Gram', label: 'Gram (গ্রাম - gm)' },
  { value: 'Milliliter', label: 'Milliliter (মি.লি. - ml)' },
];

const mapBaseUnitToString = (unit) => {
  if (unit === 4 || unit === 'Liter' || unit === 'liter') return 'Liter';
  if (unit === 2 || unit === 'Kilogram' || unit === 'kilogram') return 'Kilogram';
  if (unit === 5 || unit === 'Piece' || unit === 'piece') return 'Piece';
  if (unit === 1 || unit === 'Gram' || unit === 'gram') return 'Gram';
  if (unit === 3 || unit === 'Milliliter' || unit === 'milliliter') return 'Milliliter';
  return 'Kilogram';
};

export default function ProcurementAdmin({ activeBranch }) {
  const branchId = activeBranch?.id || 1;
  const [activeSubTab, setActiveSubTab] = useState('orders'); // 'orders' | 'suppliers'
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [grnTargetPo, setGrnTargetPo] = useState(null);
  const [paymentTargetPo, setPaymentTargetPo] = useState(null);
  const [detailsTargetPo, setDetailsTargetPo] = useState(null);

  // New Supplier Form
  const [newSupplier, setNewSupplier] = useState({
    name: '', contactPerson: '', phone: '', email: '', address: ''
  });

  // New PO Form
  const [newPo, setNewPo] = useState({
    supplierId: '',
    invoiceOrChallanNumber: '',
    notes: '',
    items: [
      { ingredientId: 5, ingredientName: 'Refined Cooking Oil', quantityOrdered: 10, unitUsed: 'Liter', unitCost: 200 }
    ],
    initialPayment: '',
    paymentMethod: 'Cash',
    paymentReference: ''
  });

  // GRN Form
  const [grnData, setGrnData] = useState({
    invoiceOrChallanNumber: '',
    notes: '',
    receivedItems: []
  });

  // Payment Form
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'Cash',
    transactionReference: '',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [suppliersData, posData, stocksData] = await Promise.all([
        suppliersApi.list(),
        procurementApi.listPOs({ branchId }),
        inventoryApi.list(branchId).catch(() => [])
      ]);
      setSuppliers(suppliersData || []);
      setPurchaseOrders(posData || []);
      setAvailableIngredients(stocksData || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load procurement data.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await suppliersApi.create(newSupplier);
      setShowAddSupplierModal(false);
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      setSuccessMsg('সাপ্লায়ার সফলভাবে তৈরি করা হয়েছে।');
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create supplier.');
    }
  };

  const handleIngredientNameChange = (idx, nameValue) => {
    const updated = [...newPo.items];
    updated[idx].ingredientName = nameValue;

    // Check if entered name matches an existing ingredient in system
    const matched = availableIngredients.find(
      i => i.ingredientName.toLowerCase() === nameValue.trim().toLowerCase()
    );
    if (matched) {
      updated[idx].ingredientId = matched.ingredientId;
      updated[idx].unitUsed = mapBaseUnitToString(matched.baseUnit);
      if (matched.lastPurchaseCostPerUnit > 0) {
        updated[idx].unitCost = matched.lastPurchaseCostPerUnit;
      }
    }
    setNewPo({ ...newPo, items: updated });
  };

  // Calculations for New PO
  const poItemsTotal = newPo.items.reduce((acc, it) => {
    const q = parseFloat(it.quantityOrdered) || 0;
    const c = parseFloat(it.unitCost) || 0;
    return acc + (q * c);
  }, 0);
  const initialPayNum = parseFloat(newPo.initialPayment) || 0;
  const poRemainingDue = Math.max(0, poItemsTotal - initialPayNum);
  const isInitialOverpaying = initialPayNum > poItemsTotal;

  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!newPo.supplierId) {
      alert('অনুগ্রহ করে একজন সাপ্লায়ার সিলেক্ট করুন।');
      return;
    }
    if (newPo.items.length === 0) {
      alert('অন্তত একটি কাঁচামাল/আইটেম যোগ করতে হবে।');
      return;
    }
    if (isInitialOverpaying) {
      alert(`তাত্ক্ষণিক পরিশোধের পরিমাণ (৳${initialPayNum}) মোট বিল (৳${poItemsTotal}) এর চেয়ে বেশি হতে পারবে না।`);
      return;
    }

    try {
      const created = await procurementApi.createPO({
        branchId: activeBranch?.id || 1,
        supplierId: parseInt(newPo.supplierId),
        invoiceOrChallanNumber: newPo.invoiceOrChallanNumber,
        notes: newPo.notes,
        items: newPo.items.map(i => ({
          ingredientId: parseInt(i.ingredientId) || 1,
          quantityOrdered: parseFloat(i.quantityOrdered) || 1,
          unitUsed: i.unitUsed || 'Kilogram',
          unitCost: parseFloat(i.unitCost) || 0
        }))
      });

      // If initial payment was made during purchase, record it immediately
      if (initialPayNum > 0 && created?.id) {
        await procurementApi.addPayment(created.id, {
          branchId: activeBranch?.id || 1,
          amount: initialPayNum,
          method: newPo.paymentMethod || 'Cash',
          transactionReference: newPo.paymentReference || 'Purchase advance payment',
          notes: 'Paid at purchase order creation'
        });
      }

      setShowCreatePoModal(false);
      setNewPo({
        supplierId: '',
        invoiceOrChallanNumber: '',
        notes: '',
        items: [{ ingredientId: 5, ingredientName: 'Refined Cooking Oil', quantityOrdered: 10, unitUsed: 'Liter', unitCost: 200 }],
        initialPayment: '',
        paymentMethod: 'Cash',
        paymentReference: ''
      });
      setSuccessMsg('Purchase Order সফলভাবে তৈরি করা হয়েছে।');
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create purchase order.');
    }
  };

  const openGrnModal = (po) => {
    setGrnTargetPo(po);
    setGrnData({
      invoiceOrChallanNumber: po.invoiceOrChallanNumber || '',
      notes: '',
      receivedItems: (po.items || []).map(item => ({
        purchaseOrderItemId: item.id || item.ingredientId,
        ingredientName: item.ingredientName || `Ingredient #${item.ingredientId}`,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityOrdered,
        unitUsed: item.unitUsed || 'Kilogram',
        actualUnitCost: item.unitCost
      }))
    });
  };

  const handleReceiveGrn = async (e) => {
    e.preventDefault();
    try {
      await procurementApi.receiveGRN(grnTargetPo.id, {
        invoiceOrChallanNumber: grnData.invoiceOrChallanNumber,
        notes: grnData.notes,
        receivedItems: grnData.receivedItems.map(i => ({
          purchaseOrderItemId: i.purchaseOrderItemId,
          quantityReceived: parseFloat(i.quantityReceived),
          actualUnitCost: parseFloat(i.actualUnitCost)
        }))
      });
      setGrnTargetPo(null);
      setSuccessMsg(`Goods Receipt Note (GRN) সম্পন্ন হয়েছে! ইনভেন্টরি স্টক ও সাপ্লায়ার লেজার আপডেট হয়েছে।`);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to process GRN.');
    }
  };

  const openPaymentModal = (po) => {
    setPaymentTargetPo(po);
    setPaymentData({
      amount: po.dueAmount || 0,
      method: 'Cash',
      transactionReference: '',
      notes: `Payment for ${po.poNumber}`
    });
  };

  // Payment calculations & validation
  const payingAmountNum = parseFloat(paymentData.amount) || 0;
  const maxAllowedDue = paymentTargetPo ? (paymentTargetPo.dueAmount || 0) : 0;
  const isOverpaying = payingAmountNum > maxAllowedDue;
  const remainingDueAfter = Math.max(0, maxAllowedDue - payingAmountNum);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (isOverpaying) {
      alert(`পেমেন্টের পরিমাণ (৳${payingAmountNum.toLocaleString()}) অবশিষ্ট বকেয়া (৳${maxAllowedDue.toLocaleString()}) এর চেয়ে বেশি হতে পারবে না।`);
      return;
    }
    if (payingAmountNum <= 0) {
      alert('পেমেন্টের পরিমাণ ০ টাকার চেয়ে বেশি হতে হবে।');
      return;
    }

    try {
      await procurementApi.addPayment(paymentTargetPo.id, {
        branchId: activeBranch?.id || 1,
        amount: payingAmountNum,
        method: paymentData.method,
        transactionReference: paymentData.transactionReference,
        notes: paymentData.notes
      });
      setPaymentTargetPo(null);
      setSuccessMsg(`৳${payingAmountNum.toLocaleString()} পেমেন্ট সফলভাবে সম্পন্ন হয়েছে এবং চালান লেজারে আপডেট হয়েছে।`);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to record supplier payment.');
    }
  };

  const totalPayableAll = suppliers.reduce((s, sup) => s + (sup.totalPayableBalance || 0), 0);

  const getMethodBadgeStyle = (method) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') return { bg: '#dcfce7', text: '#15803d' };
    if (m === 'bkash' || m === 'nagad') return { bg: '#fce7f3', text: '#be185d' };
    if (m === 'card' || m === 'bank') return { bg: '#e0f2fe', text: '#0369a1' };
    return { bg: '#f1f5f9', text: '#475569' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && <div role="alert" style={{ padding: '12px 16px', borderRadius: 8, color: '#b91c1c', background: '#fef2f2' }}>{error}</div>}

      {/* Top Banner / KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '10px' }}><DollarSign size={24} /></div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Supplier Payables</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>৳{totalPayableAll.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '12px', borderRadius: '10px' }}><FileText size={24} /></div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Purchase Orders</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{purchaseOrders.length}</div>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: '10px' }}><Building2 size={24} /></div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Registered Suppliers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{suppliers.length}</div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 18px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /> {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}><X size={16} /></button>
        </div>
      )}

      {/* Sub Tabs + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveSubTab('orders')}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: activeSubTab === 'orders' ? '#fff' : 'transparent',
              color: activeSubTab === 'orders' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'orders' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Purchase Orders & GRN
          </button>
          <button
            onClick={() => setActiveSubTab('suppliers')}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: activeSubTab === 'suppliers' ? '#fff' : 'transparent',
              color: activeSubTab === 'suppliers' ? '#0f172a' : '#64748b',
              boxShadow: activeSubTab === 'suppliers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Suppliers & Ledgers
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {activeSubTab === 'orders' ? (
            <button
              onClick={() => setShowCreatePoModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ea580c', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <PlusCircle size={15} /> Create Purchase Order
            </button>
          ) : (
            <button
              onClick={() => setShowAddSupplierModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#071c14', border: '1px solid #d4af37', color: '#d4af37', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <PlusCircle size={15} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      {activeSubTab === 'orders' ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>PO Number</th>
                  <th style={{ padding: '14px 18px' }}>Supplier</th>
                  <th style={{ padding: '14px 18px' }}>Date</th>
                  <th style={{ padding: '14px 18px' }}>Items</th>
                  <th style={{ padding: '14px 18px' }}>Total Bill</th>
                  <th style={{ padding: '14px 18px' }}>Paid Amount</th>
                  <th style={{ padding: '14px 18px' }}>Due Amount</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      No purchase orders recorded for this branch yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map(po => {
                    const isReceived = po.status === 'Received';
                    const hasPayments = (po.payments && po.payments.length > 0) || (po.paidAmount || 0) > 0;
                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>
                          <div>{po.poNumber}</div>
                          {po.invoiceOrChallanNumber && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Challan: {po.invoiceOrChallanNumber}</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 600 }}>{po.supplierName}</td>
                        <td style={{ padding: '14px 18px', color: '#64748b' }}>
                          {new Date(po.orderDateUtc).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600 }}>{po.items?.length || 0} item(s)</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {(po.items || []).map(i => `${i.quantityOrdered} ${i.unitUsed}`).join(', ')}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700 }}>৳{(po.totalAmount || 0).toLocaleString()}</td>
                        <td style={{ padding: '14px 18px', color: '#16a34a', fontWeight: 700 }}>
                          <div>৳{(po.paidAmount || 0).toLocaleString()}</div>
                          {hasPayments && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                              {po.payments?.length || 1} payment(s)
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: (po.dueAmount || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          ৳{(po.dueAmount || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                            background: isReceived ? '#dcfce7' : '#fef9c3',
                            color: isReceived ? '#15803d' : '#854d0e'
                          }}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              onClick={() => setDetailsTargetPo(po)}
                              title="View Invoice & Payments"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              <Eye size={13} /> View
                            </button>
                            {!isReceived && (
                              <button
                                onClick={() => openGrnModal(po)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0284c7', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                <ArrowDownToLine size={13} /> GRN
                              </button>
                            )}
                            {(po.dueAmount || 0) > 0 ? (
                              <button
                                onClick={() => openPaymentModal(po)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                              >
                                <DollarSign size={13} /> Pay Supplier
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, padding: '4px 8px', background: '#dcfce7', borderRadius: '6px' }}>
                                Fully Paid
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '14px 18px' }}>Supplier Name</th>
                  <th style={{ padding: '14px 18px' }}>Contact Person</th>
                  <th style={{ padding: '14px 18px' }}>Phone / Mobile</th>
                  <th style={{ padding: '14px 18px' }}>Email</th>
                  <th style={{ padding: '14px 18px' }}>Address</th>
                  <th style={{ padding: '14px 18px' }}>Payable Balance</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      No registered suppliers found. Click "Add Supplier" above.
                    </td>
                  </tr>
                ) : (
                  suppliers.map(sup => (
                    <tr key={sup.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>{sup.name}</td>
                      <td style={{ padding: '14px 18px' }}>{sup.contactPerson || '—'}</td>
                      <td style={{ padding: '14px 18px' }}>{sup.phone || '—'}</td>
                      <td style={{ padding: '14px 18px', color: '#64748b' }}>{sup.email || '—'}</td>
                      <td style={{ padding: '14px 18px', color: '#64748b' }}>{sup.address || '—'}</td>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: (sup.totalPayableBalance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                        ৳{(sup.totalPayableBalance || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: sup.isActive ? '#dcfce7' : '#fee2e2', color: sup.isActive ? '#15803d' : '#991b1b' }}>
                          {sup.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Create Purchase Order (With Clear Unit/UOM Selector) ── */}
      {showCreatePoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '720px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Create New Purchase Order</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>কাঁচামাল ও মালামাল ক্রয়ের সঠিক একক (লিটার, কেজি, পিস), চালান ও পেমেন্ট রেকর্ড</div>
              </div>
              <button onClick={() => setShowCreatePoModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreatePo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Select Supplier *</label>
                <select
                  required
                  value={newPo.supplierId}
                  onChange={e => setNewPo({ ...newPo, supplierId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Current Payable: ৳{s.totalPayableBalance})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Challan / Invoice Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CH-2026-901"
                    value={newPo.invoiceOrChallanNumber}
                    onChange={e => setNewPo({ ...newPo, invoiceOrChallanNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Order Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Regular weekly kitchen restock"
                    value={newPo.notes}
                    onChange={e => setNewPo({ ...newPo, notes: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Ingredients List With Explicit Unit Selector */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>ক্রয়কৃত আইটেম ও একক (Ordered Items & Units)</h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>তেল কিনলে লিটার, ডিম কিনলে পিস, চাল/চিকেন কিনলে কেজি নির্বাচন করুন</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPo({
                        ...newPo,
                        items: [...newPo.items, { ingredientId: 1, ingredientName: '', quantityOrdered: 1, unitUsed: 'Kilogram', unitCost: 0 }]
                      });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Plus size={13} /> Add Item
                  </button>
                </div>

                {newPo.items.map((item, idx) => {
                  const lineTotal = (parseFloat(item.quantityOrdered) || 0) * (parseFloat(item.unitCost) || 0);
                  const unitLabel = item.unitUsed || 'Unit';
                  return (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 1.2fr 1fr 1.1fr auto', gap: '8px', alignItems: 'center', marginBottom: '10px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      {/* Item Name */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>Item Name</label>
                        <input
                          type="text"
                          list={`ingredients-list-${idx}`}
                          required
                          placeholder="e.g. Cooking Oil / Rice"
                          value={item.ingredientName}
                          onChange={e => handleIngredientNameChange(idx, e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                        <datalist id={`ingredients-list-${idx}`}>
                          {availableIngredients.map(ing => (
                            <option key={ing.ingredientId} value={ing.ingredientName}>
                              {ing.ingredientName} ({mapBaseUnitToString(ing.baseUnit)})
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>Qty</label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={item.quantityOrdered}
                          onChange={e => {
                            const updated = [...newPo.items];
                            updated[idx].quantityOrdered = e.target.value;
                            setNewPo({ ...newPo, items: updated });
                          }}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>

                      {/* Unit Selector */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>একক (Unit)</label>
                        <select
                          value={item.unitUsed || 'Kilogram'}
                          onChange={e => {
                            const updated = [...newPo.items];
                            updated[idx].unitUsed = e.target.value;
                            setNewPo({ ...newPo, items: updated });
                          }}
                          style={{ width: '100%', padding: '8px 4px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
                        >
                          {UNIT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Unit Cost */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>দর (৳/{unitLabel})</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={item.unitCost}
                          onChange={e => {
                            const updated = [...newPo.items];
                            updated[idx].unitCost = e.target.value;
                            setNewPo({ ...newPo, items: updated });
                          }}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>

                      {/* Line Total */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: 600 }}>মোট টাকা</label>
                        <div style={{ padding: '8px 2px', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                          ৳{lineTotal.toLocaleString()}
                        </div>
                      </div>

                      {/* Delete */}
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'transparent', display: 'block' }}>X</label>
                        {newPo.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newPo.items.filter((_, i) => i !== idx);
                              setNewPo({ ...newPo, items: updated });
                            }}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Financial Summary & Initial Payment Box ── */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>মোট চালান মূল্য (Total Bill)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>৳{poItemsTotal.toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>তাত্ক্ষণিক পরিশোধ (Paid Now)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>৳{initialPayNum.toLocaleString()}</div>
                  </div>
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>অবশিষ্ট বকেয়া (Due Amount)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: poRemainingDue > 0 ? '#dc2626' : '#16a34a' }}>৳{poRemainingDue.toLocaleString()}</div>
                  </div>
                </div>

                {isInitialOverpaying && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
                    <AlertCircle size={15} /> মোট বিল (৳{poItemsTotal.toLocaleString()}) এর চেয়ে বেশি পরিশোধ দেওয়া সম্ভব নয়!
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>তাত্ক্ষণিক পরিশোধ (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      max={poItemsTotal}
                      placeholder="0 (বাকি থাকলে খালি রাখুন)"
                      value={newPo.initialPayment}
                      onChange={e => setNewPo({ ...newPo, initialPayment: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>Payment Method</label>
                    <select
                      value={newPo.paymentMethod}
                      onChange={e => setNewPo({ ...newPo, paymentMethod: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '0.85rem' }}
                    >
                      <option value="Cash">Cash (নগদ)</option>
                      <option value="bKash">bKash (বিকাশ)</option>
                      <option value="Nagad">Nagad (নগদ ওয়ালেট)</option>
                      <option value="Card">Bank / Card</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>Transaction / Voucher Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. TXN-129"
                      value={newPo.paymentReference}
                      onChange={e => setNewPo({ ...newPo, paymentReference: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setNewPo({ ...newPo, initialPayment: poItemsTotal })}
                    style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Pay Full (নগদ কেনা ৳{poItemsTotal.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPo({ ...newPo, initialPayment: '' })}
                    style={{ fontSize: '0.72rem', background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Full Credit (পুরো বকেয়া)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowCreatePoModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button
                  type="submit"
                  disabled={isInitialOverpaying}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: isInitialOverpaying ? '#94a3b8' : '#ea580c',
                    color: '#fff', fontWeight: 700, cursor: isInitialOverpaying ? 'not-allowed' : 'pointer'
                  }}
                >
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Receive Goods (GRN) ── */}
      {grnTargetPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Goods Received Note (GRN)</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>For {grnTargetPo.poNumber} — {grnTargetPo.supplierName}</div>
              </div>
              <button onClick={() => setGrnTargetPo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleReceiveGrn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Challan / Invoice Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CH-2026-FINAL"
                  value={grnData.invoiceOrChallanNumber}
                  onChange={e => setGrnData({ ...grnData, invoiceOrChallanNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Inspection Notes</label>
                <input
                  type="text"
                  placeholder="All items inspected and weighted at loading dock"
                  value={grnData.notes}
                  onChange={e => setGrnData({ ...grnData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px', color: '#334155' }}>Confirmed Intake Quantities</div>
                {grnData.receivedItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: '10px', alignItems: 'center', marginBottom: '8px', background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{item.ingredientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Ordered: {item.quantityOrdered} {item.unitUsed}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Qty ({item.unitUsed})</label>
                      <input
                        type="number"
                        step="any"
                        value={item.quantityReceived}
                        onChange={e => {
                          const updated = [...grnData.receivedItems];
                          updated[idx].quantityReceived = e.target.value;
                          setGrnData({ ...grnData, receivedItems: updated });
                        }}
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Cost (৳/{item.unitUsed})</label>
                      <input
                        type="number"
                        step="any"
                        value={item.actualUnitCost}
                        onChange={e => {
                          const updated = [...grnData.receivedItems];
                          updated[idx].actualUnitCost = e.target.value;
                          setGrnData({ ...grnData, receivedItems: updated });
                        }}
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setGrnTargetPo(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirm GRN Intake</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Record Supplier Payment (Detailed Ledger & Strict Validations) ── */}
      {paymentTargetPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Pay Supplier (চালান বিল পরিশোধ)</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {paymentTargetPo.poNumber} — <b>{paymentTargetPo.supplierName}</b>
                </div>
              </div>
              <button onClick={() => setPaymentTargetPo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            {/* Financial Ledger Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>মোট বিল (Total Bill)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>৳{(paymentTargetPo.totalAmount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>পূর্বে পরিশোধ (Paid)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>৳{(paymentTargetPo.paidAmount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>বর্তমান বকেয়া (Due)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>৳{(paymentTargetPo.dueAmount || 0).toLocaleString()}</div>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Payment Amount (৳) *</label>
                  <button
                    type="button"
                    onClick={() => setPaymentData({ ...paymentData, amount: maxAllowedDue })}
                    style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Pay Full Due (৳{maxAllowedDue.toLocaleString()})
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  max={maxAllowedDue}
                  value={paymentData.amount}
                  onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: isOverpaying ? '2px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '1.15rem', fontWeight: 800, color: isOverpaying ? '#dc2626' : '#0f172a'
                  }}
                />
                
                {/* Warning if overpaying */}
                {isOverpaying ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700, marginTop: '4px' }}>
                    <AlertCircle size={15} /> মোট বকেয়া ৳{maxAllowedDue.toLocaleString()} এর চেয়ে বেশি পরিশোধ করা সম্ভব নয়!
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>এই পেমেন্টের পর অবশিষ্ট বকেয়া থাকবে:</span>
                    <b style={{ color: remainingDueAfter > 0 ? '#dc2626' : '#16a34a' }}>৳{remainingDueAfter.toLocaleString()}</b>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment Method</label>
                  <select
                    value={paymentData.method}
                    onChange={e => setPaymentData({ ...paymentData, method: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="Cash">Cash (নগদ - ব্রাঞ্চ ক্যাশ ড্রয়ার)</option>
                    <option value="bKash">bKash (বিকাশ মার্চেন্ট)</option>
                    <option value="Nagad">Nagad (নগদ ওয়ালেট)</option>
                    <option value="Card">Bank / Card Transfer</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Voucher / Txn Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. VOUCHER-901 / TXN-8822"
                    value={paymentData.transactionReference}
                    onChange={e => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid part 1 in cash to delivery agent"
                  value={paymentData.notes}
                  onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              {/* ── Payment History for this Invoice ── */}
              <div style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px', marginTop: '6px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={15} /> এই চালানের পূর্ববর্তী সকল পেমেন্ট হিস্ট্রি
                </div>
                {paymentTargetPo.payments && paymentTargetPo.payments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {paymentTargetPo.payments.map((p, pIdx) => {
                      const badge = getMethodBadgeStyle(p.method);
                      return (
                        <div key={p.id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                          <div>
                            <span style={{ fontWeight: 700, marginRight: '8px' }}>#{pIdx + 1}</span>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: badge.bg, color: badge.text, marginRight: '8px' }}>
                              {p.method}
                            </span>
                            <span style={{ color: '#64748b' }}>{new Date(p.paymentDateUtc).toLocaleDateString()}</span>
                            {p.transactionReference && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>({p.transactionReference})</span>}
                          </div>
                          <div style={{ fontWeight: 800, color: '#16a34a' }}>
                            ৳{p.amount?.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    এখনো কোনো পূর্ববর্তী পেমেন্ট করা হয়নি।
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setPaymentTargetPo(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button
                  type="submit"
                  disabled={isOverpaying || payingAmountNum <= 0}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: (isOverpaying || payingAmountNum <= 0) ? '#94a3b8' : '#16a34a',
                    color: '#fff', fontWeight: 700,
                    cursor: (isOverpaying || payingAmountNum <= 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Record Payment (৳{payingAmountNum.toLocaleString()})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Full PO & Payment Ledger Details ── */}
      {detailsTargetPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '640px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Invoice & Payment Ledger</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{detailsTargetPo.poNumber} — {detailsTargetPo.supplierName}</div>
              </div>
              <button onClick={() => setDetailsTargetPo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            {/* Financial Status Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>মোট চালান মূল্য</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>৳{(detailsTargetPo.totalAmount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>পরিশোধিত টাকা</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>৳{(detailsTargetPo.paidAmount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 700 }}>বাকি টাকা (Due)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (detailsTargetPo.dueAmount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  ৳{(detailsTargetPo.dueAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#334155' }}>ক্রয়কৃত মালামাল ও একক (Ingredients)</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 12px' }}>Item</th>
                      <th style={{ padding: '8px 12px' }}>Ordered</th>
                      <th style={{ padding: '8px 12px' }}>Received</th>
                      <th style={{ padding: '8px 12px' }}>Unit Cost</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailsTargetPo.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.ingredientName || `Ingredient #${it.ingredientId}`}</td>
                        <td style={{ padding: '8px 12px' }}>{it.quantityOrdered} <b>{it.unitUsed}</b></td>
                        <td style={{ padding: '8px 12px' }}>{it.quantityReceived || 0} <b>{it.unitUsed}</b></td>
                        <td style={{ padding: '8px 12px' }}>৳{it.unitCost} / {it.unitUsed}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>৳{(it.lineTotal || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments History */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
                  পরিশোধের ইতিহাস (Payment Ledger - {detailsTargetPo.payments?.length || 0} টি কিস্তি)
                </h4>
                {(detailsTargetPo.dueAmount || 0) > 0 && (
                  <button
                    onClick={() => {
                      const po = detailsTargetPo;
                      setDetailsTargetPo(null);
                      openPaymentModal(po);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#16a34a', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <DollarSign size={12} /> Pay Due Amount
                  </button>
                )}
              </div>

              {detailsTargetPo.payments && detailsTargetPo.payments.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Method</th>
                        <th style={{ padding: '8px 12px' }}>Reference</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsTargetPo.payments.map((p, idx) => {
                        const badge = getMethodBadgeStyle(p.method);
                        return (
                          <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>#{idx + 1}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{new Date(p.paymentDateUtc).toLocaleString()}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: badge.bg, color: badge.text }}>
                                {p.method}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{p.transactionReference || '—'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>৳{(p.amount || 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  এখনো কোনো পেমেন্ট রেকর্ড করা হয়নি।
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setDetailsTargetPo(null)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add New Supplier ── */}
      {showAddSupplierModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '500px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Add New Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meghna Oil & Grains Ltd"
                  value={newSupplier.name}
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Md. Shahidul Islam"
                  value={newSupplier.contactPerson}
                  onChange={e => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 01711223344"
                  value={newSupplier.phone}
                  onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Email (Optional)</label>
                <input
                  type="email"
                  placeholder="supplier@company.com"
                  value={newSupplier.email}
                  onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Address</label>
                <input
                  type="text"
                  placeholder="e.g. Tejgaon I/A, Dhaka"
                  value={newSupplier.address}
                  onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddSupplierModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#071c14', color: '#d4af37', fontWeight: 700, cursor: 'pointer' }}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
