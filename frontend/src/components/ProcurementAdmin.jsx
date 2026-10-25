import { useState, useEffect, useCallback } from 'react';
import {
  Building2, PlusCircle, DollarSign, FileText, ArrowDownToLine, RefreshCw, X
} from 'lucide-react';
import { suppliersApi, procurementApi } from '../services/api';

export default function ProcurementAdmin({ activeBranch }) {
  const branchId = activeBranch?.id || 1;
  const [activeSubTab, setActiveSubTab] = useState('orders'); // 'orders' | 'suppliers'
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [grnTargetPo, setGrnTargetPo] = useState(null);
  const [paymentTargetPo, setPaymentTargetPo] = useState(null);

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
      { ingredientId: 1, ingredientName: 'Rice / Grains', quantityOrdered: 50, unitUsed: 'Kilogram', unitCost: 110 }
    ]
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
      const [suppliersData, posData] = await Promise.all([
        suppliersApi.list(),
        procurementApi.listPOs({ branchId })
      ]);
      setSuppliers(suppliersData || []);
      setPurchaseOrders(posData || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load procurement data.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This starts asynchronous API requests.
    loadData();
  }, [loadData]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await suppliersApi.create(newSupplier);
      setShowAddSupplierModal(false);
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      setSuccessMsg('Supplier added successfully.');
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create supplier.');
    }
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!newPo.supplierId) {
      alert('Please select a supplier.');
      return;
    }
    try {
      await procurementApi.createPO({
        branchId: activeBranch?.id || 1,
        supplierId: parseInt(newPo.supplierId),
        invoiceOrChallanNumber: newPo.invoiceOrChallanNumber,
        notes: newPo.notes,
        items: newPo.items.map(i => ({
          ingredientId: parseInt(i.ingredientId),
          quantityOrdered: parseFloat(i.quantityOrdered),
          unitUsed: i.unitUsed,
          unitCost: parseFloat(i.unitCost)
        }))
      });
      setShowCreatePoModal(false);
      setSuccessMsg('Purchase Order created successfully.');
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
      receivedItems: po.items.map(item => ({
        purchaseOrderItemId: item.id || item.ingredientId,
        ingredientName: item.ingredientName || `Ingredient #${item.ingredientId}`,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityOrdered,
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
      setSuccessMsg(`Goods Receipt Note processed! Live inventory stock and supplier payable ledger updated.`);
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

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await procurementApi.addPayment(paymentTargetPo.id, {
        branchId: activeBranch?.id || 1,
        amount: parseFloat(paymentData.amount),
        method: paymentData.method,
        transactionReference: paymentData.transactionReference,
        notes: paymentData.notes
      });
      setPaymentTargetPo(null);
      setSuccessMsg(`Payment of ৳${paymentData.amount} recorded! Ledger and cash drawer updated.`);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to record supplier payment.');
    }
  };

  const totalPayableAll = suppliers.reduce((s, sup) => s + (sup.totalPayableBalance || 0), 0);

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
          <span>✓ {successMsg}</span>
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
                  <th style={{ padding: '14px 18px' }}>Total Amount</th>
                  <th style={{ padding: '14px 18px' }}>Due Amount</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      No purchase orders recorded for this branch yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map(po => {
                    const isReceived = po.status === 'Received';
                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>{po.poNumber}</td>
                        <td style={{ padding: '14px 18px' }}>{po.supplierName}</td>
                        <td style={{ padding: '14px 18px', color: '#64748b' }}>
                          {new Date(po.orderDateUtc).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {po.items?.length || 0} ingredient(s)
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700 }}>৳{(po.totalAmount || 0).toLocaleString()}</td>
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
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {!isReceived && (
                              <button
                                onClick={() => openGrnModal(po)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                <ArrowDownToLine size={13} /> Receive GRN
                              </button>
                            )}
                            {(po.dueAmount || 0) > 0 && (
                              <button
                                onClick={() => openPaymentModal(po)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                <DollarSign size={13} /> Pay Supplier
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
                {suppliers.map(sup => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Create Purchase Order ── */}
      {showCreatePoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create New Purchase Order</h3>
              <button onClick={() => setShowCreatePoModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Select Supplier</label>
                <select
                  required
                  value={newPo.supplierId}
                  onChange={e => setNewPo({ ...newPo, supplierId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Payable: ৳{s.totalPayableBalance})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Challan / Invoice Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CH-2026-901"
                  value={newPo.invoiceOrChallanNumber}
                  onChange={e => setNewPo({ ...newPo, invoiceOrChallanNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Order Notes</label>
                <textarea
                  placeholder="e.g. Regular weekly kitchen restock"
                  value={newPo.notes}
                  onChange={e => setNewPo({ ...newPo, notes: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem' }}>Ordered Ingredients</h4>
                {newPo.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Item Name / ID</label>
                      <input
                        type="text"
                        value={item.ingredientName}
                        onChange={e => {
                          const updated = [...newPo.items];
                          updated[idx].ingredientName = e.target.value;
                          setNewPo({ ...newPo, items: updated });
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Qty (Kg/L/Pcs)</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantityOrdered}
                        onChange={e => {
                          const updated = [...newPo.items];
                          updated[idx].quantityOrdered = e.target.value;
                          setNewPo({ ...newPo, items: updated });
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Unit Cost (৳)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitCost}
                        onChange={e => {
                          const updated = [...newPo.items];
                          updated[idx].unitCost = e.target.value;
                          setNewPo({ ...newPo, items: updated });
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowCreatePoModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Create PO</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Receive Goods (GRN) ── */}
      {grnTargetPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '560px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Goods Received Note (GRN)</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>For {grnTargetPo.poNumber} — {grnTargetPo.supplierName}</div>
              </div>
              <button onClick={() => setGrnTargetPo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleReceiveGrn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Challan / Invoice Number</label>
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

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>Confirmed Intake Quantities</div>
                {grnData.receivedItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.ingredientName}</div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Qty Received</label>
                      <input
                        type="number"
                        value={item.quantityReceived}
                        onChange={e => {
                          const updated = [...grnData.receivedItems];
                          updated[idx].quantityReceived = e.target.value;
                          setGrnData({ ...grnData, receivedItems: updated });
                        }}
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Actual Unit Cost (৳)</label>
                      <input
                        type="number"
                        value={item.actualUnitCost}
                        onChange={e => {
                          const updated = [...grnData.receivedItems];
                          updated[idx].actualUnitCost = e.target.value;
                          setGrnData({ ...grnData, receivedItems: updated });
                        }}
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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

      {/* ── MODAL: Record Supplier Payment ── */}
      {paymentTargetPo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Pay Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>For {paymentTargetPo.poNumber} — {paymentTargetPo.supplierName}</div>
              </div>
              <button onClick={() => setPaymentTargetPo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={paymentTargetPo.dueAmount}
                  value={paymentData.amount}
                  onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', fontWeight: 700 }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Total Due: ৳{(paymentTargetPo.dueAmount || 0).toLocaleString()}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment Method</label>
                <select
                  value={paymentData.method}
                  onChange={e => setPaymentData({ ...paymentData, method: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Cash">Cash (Deducts Branch Cash Drawer)</option>
                  <option value="bKash">bKash Merchant</option>
                  <option value="Card">Bank / Card Transfer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Voucher / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. VOUCHER-901 / TXN-8822"
                  value={paymentData.transactionReference}
                  onChange={e => setPaymentData({ ...paymentData, transactionReference: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setPaymentTargetPo(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Record Payment</button>
              </div>
            </form>
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
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Supplier / Company Name</label>
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
