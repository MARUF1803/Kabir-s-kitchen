import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, Package, Flame, Clock, ShieldAlert, Scale,
  PlusCircle, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronRight, Play, CheckCheck, Ban, ArrowDownRight, Droplet
} from 'lucide-react';
import {
  subRecipesApi,
  productionApi,
  reservoirsApi,
  inventoryLotsApi,
  finishedProductStocksApi,
  uomConversionsApi
} from '../services/api';

const ERP_SUBTABS = [
  { id: 'subrecipes', label: 'Sub-Recipes', icon: Layers },
  { id: 'finished', label: 'Finished Products', icon: Package },
  { id: 'production', label: 'Production Work Orders', icon: Flame },
  { id: 'reservoirs', label: 'Equipment Reservoirs', icon: Droplet },
  { id: 'lots', label: 'Lots & FEFO Traceability', icon: Clock },
  { id: 'uom', label: 'UOM Conversions', icon: Scale },
];

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

  // Modal / Action states
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [newBatch, setNewBatch] = useState({
    targetType: 1, // 1: SubRecipe, 2: FinishedProduct
    subRecipeId: '',
    menuItemId: '',
    plannedQuantity: 10,
    productionNotes: ''
  });

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
        const [batchList, srList] = await Promise.all([
          productionApi.listBatches({ branchId: activeBranchId }),
          subRecipesApi.list()
        ]);
        setBatches(batchList || []);
        setSubRecipes(srList || []);
      } else if (activeTab === 'reservoirs') {
        const list = await reservoirsApi.list(activeBranchId);
        setReservoirs(list || []);
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

  const handleStartBatch = async (batchId) => {
    try {
      await productionApi.startBatch(batchId);
      setSuccess('Production batch started.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start batch.');
    }
  };

  const handlePostBatch = async (batchId) => {
    try {
      await productionApi.postBatch(batchId);
      setSuccess('Production batch posted to inventory ledgers!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post batch.');
    }
  };

  const handleQuarantineLot = async (lotId) => {
    const reason = window.prompt('Enter quarantine reason:');
    if (!reason) return;
    try {
      await inventoryLotsApi.quarantine({ lotId, reason });
      setSuccess(`Lot #${lotId} quarantined.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to quarantine lot.');
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#0f172a' : '#f8fafc',
                color: isActive ? '#fff' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ margin: '12px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Content */}
      <div style={{ marginTop: '16px' }}>
        {loading && <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Loading ERP data...</div>}

        {/* 1. Production Tab */}
        {!loading && activeTab === 'production' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                Production Batches & Work Orders
              </h3>
              <button
                onClick={loadData}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
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
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No production batches recorded for this branch yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>{b.batchNumber}</td>
                      <td style={{ padding: '10px' }}>
                        {b.targetType === 1 ? (
                          <span style={{ color: '#0284c7', fontWeight: 600 }}>[SubRecipe] {b.subRecipeName}</span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>[Finished] {b.menuItemName}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>{b.plannedQuantity}</td>
                      <td style={{ padding: '10px' }}>{b.acceptedQuantity}</td>
                      <td style={{ padding: '10px' }}>
                        {b.costSnapshot?.fullProductionUnitCost != null
                          ? `৳${b.costSnapshot.fullProductionUnitCost.toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: b.status === 5 ? '#dcfce7' : b.status === 4 ? '#fef9c3' : b.status === 3 ? '#e0f2fe' : '#f1f5f9',
                          color: b.status === 5 ? '#15803d' : b.status === 4 ? '#854d0e' : b.status === 3 ? '#0369a1' : '#475569'
                        }}>
                          {b.status === 1 ? 'Draft' : b.status === 2 ? 'Planned' : b.status === 3 ? 'InProgress' : b.status === 4 ? 'Completed' : b.status === 5 ? 'Posted' : 'Cancelled'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {b.status === 2 && (
                            <button
                              onClick={() => handleStartBatch(b.id)}
                              style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#0284c7', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Play size={12} /> Start
                            </button>
                          )}
                          {b.status === 4 && !b.isPosted && (
                            <button
                              onClick={() => handlePostBatch(b.id)}
                              style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <CheckCheck size={12} /> Post Stock
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

        {/* 2. Sub-Recipes Tab */}
        {!loading && activeTab === 'subrecipes' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Sub-Recipe Master & Branch Stock
            </h3>
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
                {subRecipes.map((sr) => {
                  const stock = subRecipeStocks.find((s) => s.subRecipeId === sr.id);
                  return (
                    <tr key={sr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{sr.code}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#0f172a' }}>{sr.name}</td>
                      <td style={{ padding: '10px' }}>
                        {sr.storageCondition === 1 ? 'Ambient' : sr.storageCondition === 2 ? 'Chilled' : 'DeepFrozen'}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {stock ? stock.currentStockQuantity : 0}
                      </td>
                      <td style={{ padding: '10px', color: '#16a34a', fontWeight: 700 }}>
                        {stock ? stock.availableQuantity : 0}
                      </td>
                      <td style={{ padding: '10px' }}>
                        ৳{stock ? stock.movingAverageCostPerUnit.toFixed(2) : '0.00'}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b' }}>
                        {sr.ingredients?.length || 0} component(s)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Finished Products Tab */}
        {!loading && activeTab === 'finished' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Batch-Produced Finished Goods Stock
            </h3>
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
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No batch-produced products stocked yet. (Produce batches in Production tab to replenish).
                    </td>
                  </tr>
                ) : (
                  finishedStocks.map((fs) => (
                    <tr key={fs.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 700, color: '#0f172a' }}>{fs.menuItemName}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{fs.currentStockQuantity}</td>
                      <td style={{ padding: '10px', color: '#ca8a04' }}>{fs.reservedQuantity}</td>
                      <td style={{ padding: '10px', color: '#dc2626' }}>{fs.quarantinedQuantity}</td>
                      <td style={{ padding: '10px', color: '#16a34a', fontWeight: 700 }}>{fs.availableQuantity}</td>
                      <td style={{ padding: '10px' }}>৳{fs.movingAverageCostPerUnit.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Equipment Reservoirs Tab */}
        {!loading && activeTab === 'reservoirs' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Equipment Reservoirs (Frying Oil & Reusable Fluids)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {reservoirs.map((r) => (
                <div key={r.id} style={{ padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', marginBottom: '4px' }}>
                    {r.equipmentName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                    Fluid: <strong>{r.ingredientName}</strong> ({r.equipmentCode || 'No code'})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span>Fluid Level:</span>
                    <strong>{r.currentFluidQuantity} / {r.maxCapacity} L</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.85rem' }}>
                    <span>Weighted Avg Cost:</span>
                    <strong>৳{r.currentUnitCost.toFixed(2)} / L</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, (r.currentFluidQuantity / (r.maxCapacity || 1)) * 100)}%`,
                      height: '100%',
                      background: '#eab308'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Inventory Lots & FEFO Tab */}
        {!loading && activeTab === 'lots' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Inventory Lots (FEFO & Expiry Traceability)
            </h3>
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
                {lots.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{l.lotNumber}</td>
                    <td style={{ padding: '10px' }}>
                      {l.lotType === 1 ? `[Raw] ${l.ingredientName}` : l.lotType === 2 ? `[SubRecipe] ${l.subRecipeName}` : `[Finished] ${l.menuItemName}`}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{l.remainingQuantity}</td>
                    <td style={{ padding: '10px' }}>৳{l.unitCost.toFixed(2)}</td>
                    <td style={{ padding: '10px', color: l.isExpired ? '#dc2626' : '#0f172a' }}>
                      {l.expiryDateUtc ? new Date(l.expiryDateUtc).toLocaleDateString() : 'Non-perishable'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: l.status === 1 ? '#dcfce7' : l.status === 2 ? '#fef2f2' : '#f1f5f9',
                        color: l.status === 1 ? '#15803d' : l.status === 2 ? '#dc2626' : '#64748b'
                      }}>
                        {l.status === 1 ? 'Active' : l.status === 2 ? 'Quarantined' : l.status === 3 ? 'Depleted' : 'Disposed'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {l.status === 1 && (
                        <button
                          onClick={() => handleQuarantineLot(l.id)}
                          style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          Quarantine
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. UOM Conversions Tab */}
        {!loading && activeTab === 'uom' && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Package UOM Conversions
            </h3>
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
                {uoms.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{u.ingredientName}</td>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0284c7' }}>1 {u.fromUnit}</td>
                    <td style={{ padding: '10px' }}>= {u.multiplier}</td>
                    <td style={{ padding: '10px' }}>
                      {u.toBaseUnit === 1 ? 'Gram' : u.toBaseUnit === 2 ? 'Kilogram' : u.toBaseUnit === 3 ? 'Milliliter' : u.toBaseUnit === 4 ? 'Liter' : 'Piece'}
                    </td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{u.packageDescription || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

