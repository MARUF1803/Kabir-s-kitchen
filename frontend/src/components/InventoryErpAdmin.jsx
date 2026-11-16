import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, Package, Flame, Clock, ShieldAlert, Scale,
  PlusCircle, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronRight, Play, CheckCheck, Ban, Droplet, X,
  FlaskConical, Zap, Thermometer
} from 'lucide-react';
import {
  subRecipesApi,
  productionApi,
  reservoirsApi,
  inventoryLotsApi,
  finishedProductStocksApi,
  uomConversionsApi,
  inventoryApi
} from '../services/api';

const ERP_SUBTABS = [
  { id: 'subrecipes', label: 'Sub-Recipes', icon: Layers },
  { id: 'finished', label: 'Finished Products', icon: Package },
  { id: 'production', label: 'Production Work Orders', icon: Flame },
  { id: 'reservoirs', label: 'Equipment Reservoirs', icon: Droplet },
  { id: 'lots', label: 'Lots & FEFO Traceability', icon: Clock },
  { id: 'uom', label: 'UOM Conversions', icon: Scale },
];

const STORAGE_CONDITIONS = [
  { value: 1, label: 'Ambient (Room Temp)' },
  { value: 2, label: 'Chilled (2–8°C)' },
  { value: 3, label: 'Deep Frozen (-18°C)' },
];

const BASE_UNITS = [
  { value: 1, label: 'Gram (g)' },
  { value: 2, label: 'Kilogram (kg)' },
  { value: 3, label: 'Milliliter (ml)' },
  { value: 4, label: 'Liter (L)' },
  { value: 5, label: 'Piece (pcs)' },
];

const BATCH_STATUS = {
  1: { label: 'Draft', bg: '#f1f5f9', color: '#475569' },
  2: { label: 'Planned', bg: '#e0f2fe', color: '#0369a1' },
  3: { label: 'InProgress', bg: '#fef9c3', color: '#854d0e' },
  4: { label: 'Completed', bg: '#fef3c7', color: '#d97706' },
  5: { label: 'Posted ✓', bg: '#dcfce7', color: '#15803d' },
  6: { label: 'Cancelled', bg: '#fee2e2', color: '#dc2626' },
};

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' };
const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '5px' };
const btnPrimary = { padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const btnSecondary = { padding: '9px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' };

export default function InventoryErpAdmin({ activeBranchId }) {
  const [activeTab, setActiveTab] = useState('production');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [subRecipes, setSubRecipes] = useState([]);
  const [subRecipeStocks, setSubRecipeStocks] = useState([]);
  const [finishedStocks, setFinishedStocks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reservoirs, setReservoirs] = useState([]);
  const [lots, setLots] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  // ── Create Sub-Recipe Modal ─────────────────────────────────────────────
  const [showCreateSubRecipe, setShowCreateSubRecipe] = useState(false);
  const [srForm, setSrForm] = useState({ name: '', code: '', description: '', baseUnit: 1, standardBatchYield: 10, storageCondition: 1, hasExpiry: false, shelfLifeDays: '', ingredients: [] });
  const [srSaving, setSrSaving] = useState(false);

  // ── Create Production Batch Modal ───────────────────────────────────────
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [newBatch, setNewBatch] = useState({ targetType: 1, subRecipeId: '', menuItemId: '', plannedQuantity: 10, productionNotes: '' });
  const [batchSaving, setBatchSaving] = useState(false);

  // ── Complete Batch Modal ────────────────────────────────────────────────
  const [completeBatchTarget, setCompleteBatchTarget] = useState(null);
  const [completeForm, setCompleteForm] = useState({ acceptedQuantity: '', scrapQuantity: 0, completionNotes: '' });
  const [completeSaving, setCompleteSaving] = useState(false);

  // ── Create Reservoir Modal ──────────────────────────────────────────────
  const [showCreateReservoir, setShowCreateReservoir] = useState(false);
  const [resvForm, setResvForm] = useState({ equipmentName: '', equipmentCode: '', ingredientId: '', maxCapacity: '' });
  const [resvSaving, setResvSaving] = useState(false);

  // ── Transfer Into Reservoir Modal ───────────────────────────────────────
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferForm, setTransferForm] = useState({ quantity: '', remarks: '' });
  const [transferSaving, setTransferSaving] = useState(false);

  // ── Drain Reservoir Modal ───────────────────────────────────────────────
  const [drainTarget, setDrainTarget] = useState(null);
  const [drainSaving, setDrainSaving] = useState(false);
  const [drainRemarks, setDrainRemarks] = useState('');

  const loadData = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'subrecipes') {
        const [srList, srStocks] = await Promise.all([
          subRecipesApi.list(),
          subRecipesApi.stocks(activeBranchId)
        ]);
        setSubRecipes(srList || []);
        setSubRecipeStocks(srStocks || []);
      } else if (activeTab === 'finished') {
        const stocks = await finishedProductStocksApi.list(activeBranchId);
        setFinishedStocks(stocks || []);
      } else if (activeTab === 'production') {
        const [batchList, srList, ingList] = await Promise.all([
          productionApi.listBatches({ branchId: activeBranchId }),
          subRecipesApi.list(),
          inventoryApi.list(activeBranchId)
        ]);
        setBatches(batchList || []);
        setSubRecipes(srList || []);
        setIngredients(ingList || []);
      } else if (activeTab === 'reservoirs') {
        const [list, ingList] = await Promise.all([
          reservoirsApi.list(activeBranchId),
          inventoryApi.list(activeBranchId)
        ]);
        setReservoirs(list || []);
        setIngredients(ingList || []);
      } else if (activeTab === 'lots') {
        const list = await inventoryLotsApi.list({ branchId: activeBranchId });
        setLots(list || []);
      } else if (activeTab === 'uom') {
        const list = await uomConversionsApi.list();
        setUoms(list || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load ERP data.');
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateSubRecipe = async () => {
    setSrSaving(true); setError(''); setSuccess('');
    try {
      await subRecipesApi.create({
        name: srForm.name, code: srForm.code, description: srForm.description,
        baseUnit: parseInt(srForm.baseUnit), standardBatchYield: parseFloat(srForm.standardBatchYield),
        storageCondition: parseInt(srForm.storageCondition),
        hasExpiry: srForm.hasExpiry, shelfLifeDays: srForm.shelfLifeDays ? parseInt(srForm.shelfLifeDays) : null,
        ingredients: srForm.ingredients.map(i => ({ ingredientId: parseInt(i.ingredientId), quantity: parseFloat(i.quantity) }))
      });
      setSuccess('Sub-Recipe সফলভাবে তৈরি হয়েছে!');
      setShowCreateSubRecipe(false);
      setSrForm({ name: '', code: '', description: '', baseUnit: 1, standardBatchYield: 10, storageCondition: 1, hasExpiry: false, shelfLifeDays: '', ingredients: [] });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Sub-Recipe তৈরি করতে সমস্যা।');
    } finally {
      setSrSaving(false);
    }
  };

  const handleStartBatch = async (batchId) => {
    setError(''); setSuccess('');
    try {
      await productionApi.startBatch(batchId);
      setSuccess('Production batch শুরু হয়েছে! 🔥');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start batch.');
    }
  };

  const handleCompleteBatch = async () => {
    if (!completeBatchTarget) return;
    setCompleteSaving(true); setError(''); setSuccess('');
    try {
      await productionApi.completeBatch(completeBatchTarget.id, {
        acceptedQuantity: parseFloat(completeForm.acceptedQuantity || completeBatchTarget.plannedQuantity),
        scrapQuantity: parseFloat(completeForm.scrapQuantity || 0),
        completionNotes: completeForm.completionNotes
      });
      setSuccess('Batch সম্পন্ন! এখন "Post Stock" করুন।');
      setCompleteBatchTarget(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete batch.');
    } finally {
      setCompleteSaving(false);
    }
  };

  const handlePostBatch = async (batchId) => {
    setError(''); setSuccess('');
    try {
      await productionApi.postBatch(batchId, { idempotencyKey: `post-${batchId}-${Date.now()}` });
      setSuccess('Batch stock-এ post হয়েছে! 📦');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post batch.');
    }
  };

  const handleCancelBatch = async (batchId) => {
    if (!window.confirm('এই batch বাতিল করবেন?')) return;
    setError(''); setSuccess('');
    try {
      await productionApi.cancelBatch(batchId, { cancellationReason: 'Cancelled by admin.' });
      setSuccess('Batch বাতিল করা হয়েছে।');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel batch.');
    }
  };

  const handleCreateBatch = async () => {
    setBatchSaving(true); setError(''); setSuccess('');
    try {
      await productionApi.createBatch({
        branchId: activeBranchId,
        targetType: parseInt(newBatch.targetType),
        subRecipeId: newBatch.targetType == 1 && newBatch.subRecipeId ? parseInt(newBatch.subRecipeId) : null,
        menuItemId: newBatch.targetType == 2 && newBatch.menuItemId ? parseInt(newBatch.menuItemId) : null,
        plannedQuantity: parseFloat(newBatch.plannedQuantity),
        productionNotes: newBatch.productionNotes || null
      });
      setSuccess('নতুন Production Work Order তৈরি হয়েছে!');
      setShowCreateBatch(false);
      setNewBatch({ targetType: 1, subRecipeId: '', menuItemId: '', plannedQuantity: 10, productionNotes: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create batch.');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleCreateReservoir = async () => {
    setResvSaving(true); setError(''); setSuccess('');
    try {
      await reservoirsApi.create({
        branchId: activeBranchId,
        equipmentName: resvForm.equipmentName,
        equipmentCode: resvForm.equipmentCode || null,
        ingredientId: resvForm.ingredientId ? parseInt(resvForm.ingredientId) : null,
        maxCapacity: parseFloat(resvForm.maxCapacity)
      });
      setSuccess('Equipment Reservoir তৈরি হয়েছে!');
      setShowCreateReservoir(false);
      setResvForm({ equipmentName: '', equipmentCode: '', ingredientId: '', maxCapacity: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create reservoir.');
    } finally {
      setResvSaving(false);
    }
  };

  const handleTransferIn = async () => {
    if (!transferTarget) return;
    setTransferSaving(true); setError(''); setSuccess('');
    try {
      await reservoirsApi.transferIn({
        equipmentReservoirId: transferTarget.id,
        quantity: parseFloat(transferForm.quantity),
        sourceInventoryLotId: null,
        remarks: transferForm.remarks || `Transfer into ${transferTarget.equipmentName}`
      });
      setSuccess(`${transferTarget.equipmentName}-এ ${transferForm.quantity}L তেল/তরল যোগ হয়েছে!`);
      setTransferTarget(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer.');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleFullDrain = async () => {
    if (!drainTarget) return;
    setDrainSaving(true); setError(''); setSuccess('');
    try {
      await reservoirsApi.fullDrain({
        equipmentReservoirId: drainTarget.id,
        remarks: drainRemarks || `Full drain of ${drainTarget.equipmentName}`
      });
      setSuccess(`${drainTarget.equipmentName} সম্পূর্ণ খালি (drain) করা হয়েছে।`);
      setDrainTarget(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to drain.');
    } finally {
      setDrainSaving(false);
    }
  };

  const handleQuarantineLot = async (lotId) => {
    const reason = window.prompt('Quarantine-এর কারণ লিখুন:');
    if (!reason) return;
    setError(''); setSuccess('');
    try {
      await inventoryLotsApi.quarantine({ lotId, reason });
      setSuccess(`Lot #${lotId} quarantine করা হয়েছে।`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to quarantine lot.');
    }
  };

  const handleReleaseQuarantine = async (lotId) => {
    setError(''); setSuccess('');
    try {
      await inventoryLotsApi.releaseQuarantine({ lotId });
      setSuccess(`Lot #${lotId} quarantine থেকে active করা হয়েছে।`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to release quarantine.');
    }
  };

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', overflowX: 'auto' }}>
        {ERP_SUBTABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setError(''); setSuccess(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: isActive ? '#0f172a' : '#f8fafc',
                color: isActive ? '#fff' : '#64748b',
                fontWeight: isActive ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} /><span>{success}</span>
        </div>
      )}

      {/* Content */}
      <div style={{ marginTop: '16px' }}>
        {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Loading ERP data...</div>}

        {/* ═══ 1. PRODUCTION WORK ORDERS ═══ */}
        {!loading && activeTab === 'production' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Production Batches & Work Orders</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={() => setShowCreateBatch(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#ea580c', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                  <PlusCircle size={14} /> নতুন Work Order
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Batch #</th>
                  <th style={{ padding: '10px' }}>Target Item</th>
                  <th style={{ padding: '10px' }}>Planned Qty</th>
                  <th style={{ padding: '10px' }}>Accepted Qty</th>
                  <th style={{ padding: '10px' }}>Unit Cost</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>এখনো কোনো Production Batch নেই। উপরে "নতুন Work Order" বাটন ক্লিক করুন।</td></tr>
                ) : (
                  batches.map((b) => {
                    const st = BATCH_STATUS[b.status] || BATCH_STATUS[1];
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{b.batchNumber}</td>
                        <td style={{ padding: '10px' }}>
                          {b.targetType === 1
                            ? <span style={{ color: '#0284c7', fontWeight: 600 }}>[Sub-Recipe] {b.subRecipeName}</span>
                            : <span style={{ color: '#16a34a', fontWeight: 600 }}>[Finished] {b.menuItemName}</span>}
                        </td>
                        <td style={{ padding: '10px' }}>{b.plannedQuantity}</td>
                        <td style={{ padding: '10px' }}>{b.acceptedQuantity ?? '—'}</td>
                        <td style={{ padding: '10px' }}>
                          {b.costSnapshot?.fullProductionUnitCost != null
                            ? `৳${b.costSnapshot.fullProductionUnitCost.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {(b.status === 1 || b.status === 2) && (
                              <button onClick={() => handleStartBatch(b.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Play size={11} /> Start
                              </button>
                            )}
                            {b.status === 3 && (
                              <button onClick={() => { setCompleteBatchTarget(b); setCompleteForm({ acceptedQuantity: b.plannedQuantity, scrapQuantity: 0, completionNotes: '' }); }} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#d97706', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCheck size={11} /> Complete
                              </button>
                            )}
                            {b.status === 4 && !b.isPosted && (
                              <button onClick={() => handlePostBatch(b.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCheck size={11} /> Post Stock
                              </button>
                            )}
                            {(b.status === 1 || b.status === 2) && (
                              <button onClick={() => handleCancelBatch(b.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Ban size={11} /> Cancel
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
        )}

        {/* ═══ 2. SUB-RECIPES ═══ */}
        {!loading && activeTab === 'subrecipes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Sub-Recipe Master & Branch Stock</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={async () => { const ing = await inventoryApi.list(activeBranchId); setIngredients(ing || []); setShowCreateSubRecipe(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                  <PlusCircle size={14} /> নতুন Sub-Recipe
                </button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Code</th>
                  <th style={{ padding: '10px' }}>Sub-Recipe Name</th>
                  <th style={{ padding: '10px' }}>Storage</th>
                  <th style={{ padding: '10px' }}>Current Stock</th>
                  <th style={{ padding: '10px' }}>Available Stock</th>
                  <th style={{ padding: '10px' }}>Moving Avg Cost</th>
                  <th style={{ padding: '10px' }}>BOM Ingredients</th>
                </tr>
              </thead>
              <tbody>
                {subRecipes.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>কোনো Sub-Recipe নেই। উপরে "নতুন Sub-Recipe" বাটন ক্লিক করুন।</td></tr>
                ) : (
                  subRecipes.map((sr) => {
                    const stock = subRecipeStocks.find((s) => s.subRecipeId === sr.id);
                    return (
                      <tr key={sr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{sr.code}</td>
                        <td style={{ padding: '10px', fontWeight: 700, color: '#0f172a' }}>{sr.name}</td>
                        <td style={{ padding: '10px' }}>
                          {sr.storageCondition === 1 ? '🌡 Ambient' : sr.storageCondition === 2 ? '❄ Chilled' : '🧊 DeepFrozen'}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{stock ? stock.currentStockQuantity : 0}</td>
                        <td style={{ padding: '10px', color: '#16a34a', fontWeight: 700 }}>{stock ? stock.availableQuantity : 0}</td>
                        <td style={{ padding: '10px' }}>৳{stock ? stock.movingAverageCostPerUnit?.toFixed(2) : '0.00'}</td>
                        <td style={{ padding: '10px', color: '#64748b' }}>{sr.ingredients?.length || 0} component(s)</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 3. FINISHED PRODUCTS ═══ */}
        {!loading && activeTab === 'finished' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Batch-Produced Finished Goods Stock</h3>
              <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.82rem', color: '#1d4ed8' }}>
              💡 Finished product stock তৈরি হয় Production Work Order → Post Stock করলে। নতুন stock তৈরি করতে Production tab ব্যবহার করুন।
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Menu Item</th>
                  <th style={{ padding: '10px' }}>Current Stock</th>
                  <th style={{ padding: '10px' }}>Reserved</th>
                  <th style={{ padding: '10px' }}>Quarantined</th>
                  <th style={{ padding: '10px' }}>Available Stock</th>
                  <th style={{ padding: '10px' }}>Unit Moving Cost</th>
                </tr>
              </thead>
              <tbody>
                {finishedStocks.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>এখনো কোনো batch-produced stock নেই। Production tab থেকে batch post করুন।</td></tr>
                ) : (
                  finishedStocks.map((fs) => (
                    <tr key={fs.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#0f172a' }}>{fs.menuItemName}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{fs.currentStockQuantity}</td>
                      <td style={{ padding: '10px', color: '#ca8a04' }}>{fs.reservedQuantity}</td>
                      <td style={{ padding: '10px', color: '#dc2626' }}>{fs.quarantinedQuantity}</td>
                      <td style={{ padding: '10px', color: '#16a34a', fontWeight: 700 }}>{fs.availableQuantity}</td>
                      <td style={{ padding: '10px' }}>৳{fs.movingAverageCostPerUnit?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 4. EQUIPMENT RESERVOIRS ═══ */}
        {!loading && activeTab === 'reservoirs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Equipment Reservoirs (Frying Oil & Reusable Fluids)</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={() => setShowCreateReservoir(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#d97706', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                  <PlusCircle size={14} /> নতুন Equipment
                </button>
              </div>
            </div>
            {reservoirs.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                <Droplet size={40} style={{ marginBottom: '10px', opacity: 0.4 }} />
                <div>কোনো reservoir নেই। Deep Fryer, Chocolate Melter ইত্যাদি যোগ করুন।</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {reservoirs.map((r) => {
                  const pct = Math.min(100, (r.currentFluidQuantity / (r.maxCapacity || 1)) * 100);
                  const fillColor = pct > 60 ? '#16a34a' : pct > 25 ? '#eab308' : '#dc2626';
                  return (
                    <div key={r.id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', marginBottom: '2px' }}>{r.equipmentName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
                        🧴 Fluid: <strong>{r.ingredientName || 'N/A'}</strong> {r.equipmentCode && `(${r.equipmentCode})`}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.83rem' }}>
                        <span>Fluid Level:</span><strong>{r.currentFluidQuantity?.toFixed(1)} / {r.maxCapacity} L</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.83rem' }}>
                        <span>Avg Cost:</span><strong>৳{r.currentUnitCost?.toFixed(2)} / L</strong>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: fillColor, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setTransferTarget(r); setTransferForm({ quantity: '', remarks: '' }); }} style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          ⬆ Transfer In
                        </button>
                        <button onClick={() => { setDrainTarget(r); setDrainRemarks(''); }} style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                          🪣 Full Drain
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ 5. LOTS & FEFO TRACEABILITY ═══ */}
        {!loading && activeTab === 'lots' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Inventory Lots (FEFO & Expiry Traceability)</h3>
              <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Lot #</th>
                  <th style={{ padding: '10px' }}>Layer / Item</th>
                  <th style={{ padding: '10px' }}>Remaining Qty</th>
                  <th style={{ padding: '10px' }}>Unit Cost</th>
                  <th style={{ padding: '10px' }}>Expiry Date</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lots.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>কোনো inventory lot নেই। Purchase Order বা Production Batch post করলে lot তৈরি হয়।</td></tr>
                ) : (
                  lots.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', background: l.isExpired ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{l.lotNumber}</td>
                      <td style={{ padding: '10px' }}>
                        {l.lotType === 1 ? `🌾 [Raw] ${l.ingredientName}` : l.lotType === 2 ? `🍲 [SubRecipe] ${l.subRecipeName}` : `📦 [Finished] ${l.menuItemName}`}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{l.remainingQuantity}</td>
                      <td style={{ padding: '10px' }}>৳{l.unitCost?.toFixed(2)}</td>
                      <td style={{ padding: '10px', color: l.isExpired ? '#dc2626' : '#0f172a', fontWeight: l.isExpired ? 700 : 400 }}>
                        {l.expiryDateUtc ? new Date(l.expiryDateUtc).toLocaleDateString('en-BD') : 'Non-perishable'}
                        {l.isExpired && ' ⚠ Expired!'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                          background: l.status === 1 ? '#dcfce7' : l.status === 2 ? '#fef2f2' : '#f1f5f9',
                          color: l.status === 1 ? '#15803d' : l.status === 2 ? '#dc2626' : '#64748b'
                        }}>
                          {l.status === 1 ? 'Active' : l.status === 2 ? 'Quarantined' : l.status === 3 ? 'Depleted' : 'Disposed'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {l.status === 1 && (
                            <button onClick={() => handleQuarantineLot(l.id)} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600 }}>
                              🔒 Quarantine
                            </button>
                          )}
                          {l.status === 2 && (
                            <button onClick={() => handleReleaseQuarantine(l.id)} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#fff', color: '#16a34a', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600 }}>
                              ✓ Release
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ 6. UOM CONVERSIONS ═══ */}
        {!loading && activeTab === 'uom' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Package UOM Conversions</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Ingredient</th>
                  <th style={{ padding: '10px' }}>From Package Unit</th>
                  <th style={{ padding: '10px' }}>Conversion Multiplier</th>
                  <th style={{ padding: '10px' }}>Base Storage Unit</th>
                  <th style={{ padding: '10px' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {uoms.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>কোনো UOM Conversion নেই।</td></tr>
                ) : (
                  uoms.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{u.ingredientName}</td>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#0284c7' }}>1 {u.fromUnit}</td>
                      <td style={{ padding: '10px' }}>= {u.multiplier}</td>
                      <td style={{ padding: '10px' }}>
                        {u.toBaseUnit === 1 ? 'Gram' : u.toBaseUnit === 2 ? 'Kilogram' : u.toBaseUnit === 3 ? 'Milliliter' : u.toBaseUnit === 4 ? 'Liter' : 'Piece'}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>{u.packageDescription || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ MODAL: Create Production Work Order ═══ */}
      {showCreateBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '500px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>🔥 নতুন Production Work Order</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Batch produce করার জন্য work order তৈরি করুন</p>
              </div>
              <button onClick={() => setShowCreateBatch(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Target Type *</label>
                <select value={newBatch.targetType} onChange={e => setNewBatch(f => ({ ...f, targetType: e.target.value, subRecipeId: '', menuItemId: '' }))} style={inputStyle}>
                  <option value={1}>Sub-Recipe (Base sauce, dough, marinade)</option>
                  <option value={2}>Finished Product (Burger, cake, etc.)</option>
                </select>
              </div>
              {newBatch.targetType == 1 ? (
                <div>
                  <label style={labelStyle}>Sub-Recipe নির্বাচন *</label>
                  <select value={newBatch.subRecipeId} onChange={e => setNewBatch(f => ({ ...f, subRecipeId: e.target.value }))} style={inputStyle}>
                    <option value="">-- Sub-Recipe বেছে নিন --</option>
                    {subRecipes.map(sr => <option key={sr.id} value={sr.id}>{sr.code} — {sr.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Finished Product Item *</label>
                  <input value={newBatch.menuItemId} onChange={e => setNewBatch(f => ({ ...f, menuItemId: e.target.value }))} placeholder="Menu Item ID নম্বর দিন" style={inputStyle} type="number" />
                </div>
              )}
              <div>
                <label style={labelStyle}>Planned Quantity *</label>
                <input type="number" value={newBatch.plannedQuantity} onChange={e => setNewBatch(f => ({ ...f, plannedQuantity: e.target.value }))} min="0.01" step="0.01" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Production Notes (Optional)</label>
                <textarea value={newBatch.productionNotes} onChange={e => setNewBatch(f => ({ ...f, productionNotes: e.target.value }))} rows={2} placeholder="e.g. Special batch for Eid rush" style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowCreateBatch(false)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleCreateBatch} disabled={batchSaving} style={{ ...btnPrimary, opacity: batchSaving ? 0.7 : 1 }}>
                {batchSaving ? 'তৈরি হচ্ছে...' : '🔥 Work Order তৈরি'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Complete Batch ═══ */}
      {completeBatchTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '460px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>✅ Batch Complete করুন</h3>
              <button onClick={() => setCompleteBatchTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.83rem', color: '#16a34a' }}>
                Batch: <strong>{completeBatchTarget.batchNumber}</strong> | Planned: <strong>{completeBatchTarget.plannedQuantity}</strong>
              </div>
              <div>
                <label style={labelStyle}>Accepted Quantity (গৃহীত পরিমাণ) *</label>
                <input type="number" value={completeForm.acceptedQuantity} onChange={e => setCompleteForm(f => ({ ...f, acceptedQuantity: e.target.value }))} min="0" step="0.01" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Scrap / Waste Quantity</label>
                <input type="number" value={completeForm.scrapQuantity} onChange={e => setCompleteForm(f => ({ ...f, scrapQuantity: e.target.value }))} min="0" step="0.01" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Completion Notes</label>
                <textarea value={completeForm.completionNotes} onChange={e => setCompleteForm(f => ({ ...f, completionNotes: e.target.value }))} rows={2} placeholder="e.g. Good quality output" style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setCompleteBatchTarget(null)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleCompleteBatch} disabled={completeSaving} style={{ ...btnPrimary, background: '#d97706', opacity: completeSaving ? 0.7 : 1 }}>
                {completeSaving ? 'সম্পন্ন হচ্ছে...' : '✅ Batch Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Create Sub-Recipe ═══ */}
      {showCreateSubRecipe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>🍲 নতুন Sub-Recipe তৈরি করুন</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>Base sauce, dough, marinade, cake sponge ইত্যাদি</p>
              </div>
              <button onClick={() => setShowCreateSubRecipe(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Sub-Recipe Name *</label>
                  <input value={srForm.name} onChange={e => setSrForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Burger Base Sauce" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Code *</label>
                  <input value={srForm.code} onChange={e => setSrForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. SR-BBS-01" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input value={srForm.description} onChange={e => setSrForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Base Unit *</label>
                  <select value={srForm.baseUnit} onChange={e => setSrForm(f => ({ ...f, baseUnit: e.target.value }))} style={inputStyle}>
                    {BASE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Standard Batch Yield *</label>
                  <input type="number" value={srForm.standardBatchYield} onChange={e => setSrForm(f => ({ ...f, standardBatchYield: e.target.value }))} min="0.01" step="0.01" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Storage Condition *</label>
                  <select value={srForm.storageCondition} onChange={e => setSrForm(f => ({ ...f, storageCondition: e.target.value }))} style={inputStyle}>
                    {STORAGE_CONDITIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Shelf Life (Days)</label>
                  <input type="number" value={srForm.shelfLifeDays} onChange={e => setSrForm(f => ({ ...f, shelfLifeDays: e.target.value, hasExpiry: !!e.target.value }))} placeholder="e.g. 3 (optional)" min="0" style={inputStyle} />
                </div>
              </div>

              {/* BOM Ingredients */}
              <div style={{ marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>BOM Ingredients (উপকরণ)</label>
                  <button
                    onClick={() => setSrForm(f => ({ ...f, ingredients: [...f.ingredients, { ingredientId: '', quantity: '' }] }))}
                    style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >+ Add Ingredient</button>
                </div>
                {srForm.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto 60px', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <select value={ing.ingredientId} onChange={e => { const newIng = [...srForm.ingredients]; newIng[idx].ingredientId = e.target.value; setSrForm(f => ({ ...f, ingredients: newIng })); }} style={inputStyle}>
                      <option value="">-- Ingredient --</option>
                      {ingredients.map(i => <option key={i.ingredientId} value={i.ingredientId}>{i.ingredientName}</option>)}
                    </select>
                    <input type="number" value={ing.quantity} onChange={e => { const newIng = [...srForm.ingredients]; newIng[idx].quantity = e.target.value; setSrForm(f => ({ ...f, ingredients: newIng })); }} placeholder="Qty" min="0.001" step="0.001" style={{ ...inputStyle, width: '90px' }} />
                    <button onClick={() => setSrForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }))} style={{ padding: '7px', borderRadius: '5px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {srForm.ingredients.length === 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '6px 0' }}>Ingredients না দিলেও চলবে — পরে যোগ করা যাবে।</div>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowCreateSubRecipe(false)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleCreateSubRecipe} disabled={srSaving} style={{ ...btnPrimary, background: '#0284c7', opacity: srSaving ? 0.7 : 1 }}>
                {srSaving ? 'তৈরি হচ্ছে...' : '🍲 Sub-Recipe তৈরি'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Create Equipment Reservoir ═══ */}
      {showCreateReservoir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '460px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>🛢 নতুন Equipment Reservoir</h3>
              <button onClick={() => setShowCreateReservoir(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Equipment Name *</label>
                <input value={resvForm.equipmentName} onChange={e => setResvForm(f => ({ ...f, equipmentName: e.target.value }))} placeholder="e.g. Main Deep Fryer" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Equipment Code</label>
                <input value={resvForm.equipmentCode} onChange={e => setResvForm(f => ({ ...f, equipmentCode: e.target.value }))} placeholder="e.g. FRY-01 (optional)" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fluid Ingredient (তেল/তরল)</label>
                <select value={resvForm.ingredientId} onChange={e => setResvForm(f => ({ ...f, ingredientId: e.target.value }))} style={inputStyle}>
                  <option value="">-- Ingredient বেছে নিন (optional) --</option>
                  {ingredients.map(i => <option key={i.ingredientId} value={i.ingredientId}>{i.ingredientName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Max Capacity (Liters) *</label>
                <input type="number" value={resvForm.maxCapacity} onChange={e => setResvForm(f => ({ ...f, maxCapacity: e.target.value }))} placeholder="e.g. 20" min="0.1" step="0.1" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowCreateReservoir(false)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleCreateReservoir} disabled={resvSaving} style={{ ...btnPrimary, background: '#d97706', opacity: resvSaving ? 0.7 : 1 }}>
                {resvSaving ? 'তৈরি হচ্ছে...' : '🛢 Reservoir তৈরি'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Transfer In to Reservoir ═══ */}
      {transferTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '400px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>⬆ Transfer Into {transferTarget.equipmentName}</h3>
              <button onClick={() => setTransferTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.83rem', color: '#1d4ed8' }}>
                Current: {transferTarget.currentFluidQuantity?.toFixed(1)}L / {transferTarget.maxCapacity}L capacity
              </div>
              <div>
                <label style={labelStyle}>Transfer Quantity (Liters) *</label>
                <input type="number" value={transferForm.quantity} onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))} min="0.1" step="0.1" placeholder="e.g. 5" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Remarks</label>
                <input value={transferForm.remarks} onChange={e => setTransferForm(f => ({ ...f, remarks: e.target.value }))} placeholder="e.g. Fresh palm oil top-up" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setTransferTarget(null)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleTransferIn} disabled={transferSaving} style={{ ...btnPrimary, background: '#0284c7', opacity: transferSaving ? 0.7 : 1 }}>
                {transferSaving ? 'Transfer হচ্ছে...' : '⬆ Transfer করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Full Drain ═══ */}
      {drainTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '400px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#dc2626' }}>🪣 Full Drain — {drainTarget.equipmentName}</h3>
              <button onClick={() => setDrainTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.83rem', color: '#dc2626', fontWeight: 600 }}>
                ⚠ এই equipment সম্পূর্ণ খালি হবে। {drainTarget.currentFluidQuantity?.toFixed(1)}L তরল ডিসকার্ড হবে।
              </div>
              <div>
                <label style={labelStyle}>Drain Reason / Remarks *</label>
                <input value={drainRemarks} onChange={e => setDrainRemarks(e.target.value)} placeholder="e.g. Oil degraded after 3 days use" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDrainTarget(null)} style={btnSecondary}>বাতিল</button>
              <button onClick={handleFullDrain} disabled={drainSaving} style={{ ...btnPrimary, background: '#dc2626', opacity: drainSaving ? 0.7 : 1 }}>
                {drainSaving ? 'Drain হচ্ছে...' : '🪣 Full Drain Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
