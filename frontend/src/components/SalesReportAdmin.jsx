import { useState, useEffect, useCallback } from 'react';
import {
  Download, RefreshCw, Users, PieChart,
  CreditCard, AlertCircle
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { reportsApi } from '../services/api';

export default function SalesReportAdmin() {
  const { branches, selectedBranchId } = useApp();
  const [filterBranchId, setFilterBranchId] = useState(selectedBranchId || '');
  const [period, setPeriod] = useState('all'); // 'today' | '7days' | '30days' | 'all'
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    try {
      const now = new Date();
      let fromUtc = null;
      let toUtc = null;

      if (period === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        fromUtc = start.toISOString();
      } else if (period === '7days') {
        const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      } else if (period === '30days') {
        const start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        fromUtc = start.toISOString();
      }

      const params = {};
      if (filterBranchId) params.branchId = filterBranchId;
      if (fromUtc) params.fromUtc = fromUtc;
      if (toUtc) params.toUtc = toUtc;

      const data = await reportsApi.getSales(params);
      setReport(data);
      setError(null);
    } catch (requestError) {
      console.error('Unable to load sales report.', requestError);
      setError('Live backend report unavailable. Check API connection.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId, period]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- This starts an asynchronous API request.
    fetchReport();
  }, [fetchReport]);

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    fetchReport();
  };

  const handleExportCsv = () => {
    const params = {};
    if (filterBranchId) params.branchId = filterBranchId;
    const url = reportsApi.getCsvUrl(params);
    window.open(url, '_blank');
  };

  const summary = report?.summary || {
    grossSales: 0,
    totalDiscounts: 0,
    totalTax: 0,
    netSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalPaid: 0,
    outstandingDue: 0
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top Bar Controls ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Financial Intelligence & Audit
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Sales & Reconciliation Dashboard
          </h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Branch filter */}
          <select
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1.5px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#f8fafc',
              color: '#1e293b'
            }}
          >
            <option value="">All Branches</option>
            {branches?.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Period selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: 8 }}>
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 0,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: period === p.id ? '#0c251c' : 'transparent',
                  color: period === p.id ? '#fff' : '#64748b'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 0,
              background: 'linear-gradient(135deg, #0c251c 0%, #ea580c 100%)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(234,88,12,0.2)'
            }}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── KPI Metric Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Gross Revenue</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
            ৳{summary.grossSales.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>Before discounts & taxes</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Discounts Allowed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>
            -৳{summary.totalDiscounts.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Campaigns & promo codes</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Govt VAT (5%)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', margin: '4px 0' }}>
            ৳{summary.totalTax.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>Tax collected for audit</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Total Sales</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', margin: '4px 0' }}>
            ৳{summary.netSales.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>Billed order total</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Tickets & AOV</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
            {summary.totalOrders} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>orders</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 700 }}>AOV: ৳{summary.averageOrderValue.toFixed(1)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Collected vs Due</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: summary.outstandingDue > 0 ? '#b45309' : '#15803d', margin: '4px 0' }}>
            ৳{summary.totalPaid.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: summary.outstandingDue > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
            {summary.outstandingDue > 0 ? `৳${summary.outstandingDue.toLocaleString()} Outstanding Due` : '100% Paid'}
          </div>
        </div>
      </div>

      {/* ── Channel & Payment Breakdown Tables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        
        {/* Sales by Channel */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={18} color="#ea580c" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Sales by Channel / Source</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <th style={{ padding: '10px 16px' }}>Channel</th>
                <th style={{ padding: '10px 16px' }}>Orders</th>
                <th style={{ padding: '10px 16px' }}>Gross</th>
                <th style={{ padding: '10px 16px' }}>Net Sales</th>
              </tr>
            </thead>
            <tbody>
              {report?.byChannel && report.byChannel.length > 0 ? (
                report.byChannel.map((ch, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: '#0f172a' }}>{ch.channel}</td>
                    <td style={{ padding: '11px 16px', color: '#64748b' }}>{ch.orderCount}</td>
                    <td style={{ padding: '11px 16px', color: '#64748b' }}>৳{ch.grossSales.toLocaleString()}</td>
                    <td style={{ padding: '11px 16px', fontWeight: 800, color: '#0c251c' }}>৳{ch.netSales.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No channel data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sales by Payment Method */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} color="#0c251c" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Payment Method Breakdown</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                <th style={{ padding: '10px 16px' }}>Payment Method</th>
                <th style={{ padding: '10px 16px' }}>Transactions</th>
                <th style={{ padding: '10px 16px' }}>Collected Total</th>
              </tr>
            </thead>
            <tbody>
              {report?.byPaymentMethod && report.byPaymentMethod.length > 0 ? (
                report.byPaymentMethod.map((pm, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: '#0f172a' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        background: pm.paymentMethod === 'Cash' ? '#fef3c7' : pm.paymentMethod === 'bKash' ? '#fce7f3' : '#e0f2fe',
                        color: pm.paymentMethod === 'Cash' ? '#92400e' : pm.paymentMethod === 'bKash' ? '#9d174d' : '#0369a1'
                      }}>
                        {pm.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#64748b' }}>{pm.transactionCount}</td>
                    <td style={{ padding: '11px 16px', fontWeight: 800, color: '#15803d' }}>৳{pm.totalAmount.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No payment method data recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cashier Shift Closings ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="#ea580c" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Cashier Shift Closings & Audit Log</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
              <th style={{ padding: '10px 16px' }}>Cashier / Staff</th>
              <th style={{ padding: '10px 16px' }}>Branch</th>
              <th style={{ padding: '10px 16px' }}>Orders Handled</th>
              <th style={{ padding: '10px 16px' }}>Gross Revenue</th>
              <th style={{ padding: '10px 16px' }}>Cash Collected</th>
              <th style={{ padding: '10px 16px' }}>Digital / Other</th>
              <th style={{ padding: '10px 16px' }}>Void Orders</th>
            </tr>
          </thead>
          <tbody>
            {report?.cashierShifts && report.cashierShifts.length > 0 ? (
              report.cashierShifts.map((cs, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 800, color: '#0f172a' }}>{cs.cashierName}</td>
                  <td style={{ padding: '11px 16px', color: '#64748b' }}>{cs.branchName}</td>
                  <td style={{ padding: '11px 16px', color: '#64748b' }}>{cs.totalOrders}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 700 }}>৳{cs.grossSales.toLocaleString()}</td>
                  <td style={{ padding: '11px 16px', color: '#b45309', fontWeight: 700 }}>৳{cs.cashCollected.toLocaleString()}</td>
                  <td style={{ padding: '11px 16px', color: '#0369a1', fontWeight: 700 }}>৳{cs.digitalCollected.toLocaleString()}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {cs.voidOrdersCount > 0 ? (
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{cs.voidOrdersCount} voids</span>
                    ) : (
                      <span style={{ color: '#16a34a' }}>0</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  No shift data logged yet for this filter range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
