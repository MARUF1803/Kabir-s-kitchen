import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/useApp';
import apiClient, { promotionsApi } from '../services/api';
import {
  restaurantCalendarRange,
  restaurantDateTimeToUtc,
  shiftRestaurantCalendarDate,
  utcToRestaurantDateTimeInput
} from '../utils/restaurantTime';

const defaultSchedule = (timeZone = 'Asia/Dhaka') => {
  const now = new Date();
  const plus7Days = new Date(Date.now() + 7 * 86400000);
  return {
    start: utcToRestaurantDateTimeInput(now, timeZone),
    end: utcToRestaurantDateTimeInput(plus7Days, timeZone)
  };
};

const emptyForm = (timeZone = 'Asia/Dhaka') => {
  const schedule = defaultSchedule(timeZone);
  return {
    name: '',
    description: '',
    discountType: 'Percentage',
    discountValue: '',
    maximumDiscountAmount: '',
    targetType: 'AllItems',
    menuItemId: '',
    menuItemVariantId: '',
    categoryId: '',
    branchId: '',
    couponCode: '',
    minimumOrderAmount: 0,
    usageLimit: '',
    priority: 100,
    allowStacking: false,
    includeCustomCakes: false,
    repeatWeekly: false,
    status: 'Active',
    startDateUtc: schedule.start,
    endDateUtc: schedule.end
  };
};

const enumValues = {
  Percentage: 1,
  FixedAmount: 2,
  AllItems: 1,
  Product: 2,
  Variant: 3,
  Category: 4,
  Draft: 1,
  Scheduled: 2,
  Active: 3,
  Paused: 4,
  Expired: 5,
  Archived: 6
};

const statusChoices = ['Draft', 'Scheduled', 'Active', 'Paused', 'Expired', 'Archived'];
const formatCampaignTime = (value, timeZone) => new Intl.DateTimeFormat(undefined, {
  timeZone,
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(value));

function Metric({ label, value }) {
  return (
    <article style={{ ...cardStyle, padding: 14 }}>
      <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 5, fontSize: 20, color: '#0f172a' }}>{value}</strong>
    </article>
  );
}

async function loadAllMenuItems() {
  const items = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await apiClient.get('/menu/items', { params: { page, pageSize: 100 } });
    const result = response.data;
    if (!Array.isArray(result?.items) || typeof result.hasNextPage !== 'boolean') {
      throw new Error('The server returned an invalid paginated menu list.');
    }
    items.push(...result.items);
    hasNextPage = result.hasNextPage;
    page += 1;
  }

  return items;
}

export default function CampaignManagementAdmin() {
  const { branches, authUser } = useApp();
  const branchScoped = authUser?.role === 'BranchManager';
  const [campaigns, setCampaigns] = useState([]);
  const [campaignReports, setCampaignReports] = useState([]);
  const [campaignsAvailable, setCampaignsAvailable] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [calendarView, setCalendarView] = useState('week');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarTimeZone, setCalendarTimeZone] = useState('Asia/Dhaka');

  const branchOptions = useMemo(
    () => (branches || []).filter(branch => !branchScoped || Number(branch.id) === Number(authUser?.branchId)),
    [branches, branchScoped, authUser?.branchId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [calendarResponse, reportRows] = await Promise.all([
        promotionsApi.calendar(),
        promotionsApi.reports()
      ]);
      if (!Array.isArray(calendarResponse.campaigns)) {
        throw new Error('The server returned an invalid campaign list.');
      }
      if (!Array.isArray(reportRows)) {
        throw new Error('The server returned invalid campaign reporting data.');
      }
      setCampaigns(calendarResponse.campaigns);
      setCampaignReports(reportRows);
      setCalendarTimeZone(calendarResponse.timeZoneId || 'Asia/Dhaka');
      setCampaignsAvailable(true);
      const catalogResults = await Promise.allSettled([
        loadAllMenuItems(),
        apiClient.get('/menu/categories')
      ]);
      if (catalogResults[0].status === 'fulfilled') {
        setProducts(catalogResults[0].value);
      }
      if (catalogResults[1].status === 'fulfilled' && Array.isArray(catalogResults[1].value.data)) {
        setCategories(catalogResults[1].value.data);
      }
      setError(catalogResults.some(result => result.status === 'rejected')
        ? 'Campaigns loaded, but menu products or categories could not be loaded.'
        : '');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load campaigns from the server.');
      setCampaignsAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // oxlint-disable-next-line react/set-state-in-effect -- Load synchronizes the view with persisted campaigns.
  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setForm({ ...emptyForm(calendarTimeZone), branchId: branchScoped ? String(authUser?.branchId || '') : '' });
    setEditingId(null);
    setError('');
  };

  const edit = (campaign) => {
    setEditingId(campaign.id);
    setForm({
      ...campaign,
      discountValue: String(campaign.discountValue),
      maximumDiscountAmount: campaign.maximumDiscountAmount ?? '',
      branchId: campaign.branchId ?? '',
      minimumOrderAmount: campaign.minimumOrderAmount,
      usageLimit: campaign.usageLimit ?? '',
      startDateUtc: utcToRestaurantDateTimeInput(campaign.startDateUtc, calendarTimeZone),
      endDateUtc: utcToRestaurantDateTimeInput(campaign.endDateUtc, calendarTimeZone)
    });
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...form,
        discountType: enumValues[form.discountType],
        targetType: enumValues[form.targetType],
        status: enumValues[form.status],
        discountValue: Number(form.discountValue),
        maximumDiscountAmount: form.maximumDiscountAmount === '' ? null : Number(form.maximumDiscountAmount),
        menuItemId: form.targetType === 'Product' ? Number(form.menuItemId) : null,
        menuItemVariantId: form.targetType === 'Variant' ? Number(form.menuItemVariantId) : null,
        categoryId: form.targetType === 'Category' ? Number(form.categoryId) : null,
        branchId: form.branchId ? Number(form.branchId) : null,
        couponCode: form.couponCode.trim() || null,
        minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        priority: Number(form.priority) || 0,
        repeatWeekly: Boolean(form.repeatWeekly),
        startDateUtc: restaurantDateTimeToUtc(form.startDateUtc, calendarTimeZone).toISOString(),
        endDateUtc: restaurantDateTimeToUtc(form.endDateUtc, calendarTimeZone).toISOString()
      };
      if (editingId) {
        await apiClient.put(`/promotions/${editingId}`, payload);
      } else {
        await apiClient.post('/promotions', payload);
      }
      reset();
      setNotice('Campaign saved to the server.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (campaign, status) => {
    setError('');
    setNotice('');
    try {
      await apiClient.patch(`/promotions/${campaign.id}/status`, { status: enumValues[status] });
      setNotice(`Campaign ${status.toLowerCase()}.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update campaign status.');
    }
  };

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const calendarRange = useMemo(() => {
    return restaurantCalendarRange(calendarDate, calendarView, calendarTimeZone);
  }, [calendarDate, calendarView, calendarTimeZone]);

  const calendarCampaigns = useMemo(() => campaigns.filter(campaign =>
    new Date(campaign.endDateUtc) > calendarRange.start &&
    new Date(campaign.startDateUtc) < calendarRange.end
  ), [campaigns, calendarRange]);

  const calendarLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: calendarTimeZone
  }).format(calendarDate);

  const moveCalendar = (direction) => {
    setCalendarDate(current => {
      if (calendarView === 'day') return shiftRestaurantCalendarDate(current, { days: direction }, calendarTimeZone);
      if (calendarView === 'week') return shiftRestaurantCalendarDate(current, { days: direction * 7 }, calendarTimeZone);
      return shiftRestaurantCalendarDate(current, { months: direction }, calendarTimeZone);
    });
  };

  const metrics = useMemo(() => ({
    active: campaigns.filter(campaign => campaign.status === 'Active').length,
    scheduled: campaigns.filter(campaign => campaign.status === 'Scheduled').length,
    redemptions: campaignReports.reduce((sum, campaign) => sum + campaign.redemptions, 0),
    orders: campaignReports.reduce((sum, campaign) => sum + campaign.orders, 0),
    revenue: campaignReports.reduce((sum, campaign) => sum + campaign.revenue, 0),
    discount: campaignReports.reduce((sum, campaign) => sum + campaign.discountTotal, 0),
    impressions: campaignReports.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0),
    clicks: campaignReports.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0)
  }), [campaigns, campaignReports]);
  const overlappingCampaigns = useMemo(() => {
    const overlaps = [];
    for (let firstIndex = 0; firstIndex < campaigns.length; firstIndex += 1) {
      const first = campaigns[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < campaigns.length; secondIndex += 1) {
        const second = campaigns[secondIndex];
        const branchesOverlap = first.branchId == null || second.branchId == null ||
          Number(first.branchId) === Number(second.branchId);
        const datesOverlap = new Date(first.startDateUtc) < new Date(second.endDateUtc) &&
          new Date(second.startDateUtc) < new Date(first.endDateUtc);
        if (branchesOverlap && datesOverlap &&
            !['Archived', 'Expired'].includes(first.status) &&
            !['Archived', 'Expired'].includes(second.status)) {
          overlaps.push([first, second]);
        }
      }
    }
    return overlaps;
  }, [campaigns]);

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, paddingBottom: 32, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
      <header>
        <div style={{ color: '#c2410c', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>SERVER-VALIDATED PROMOTIONS</div>
        <h2 style={{ margin: '5px 0' }}>Offers &amp; Campaigns</h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          Campaign prices are calculated by the shared order engine. Only one highest-priority offer applies to an order.
        </p>
      </header>
      {error && <div role="alert" style={messageStyle('#fff1f2', '#be123c')}>{error}</div>}
      {notice && <div role="status" style={messageStyle('#ecfdf5', '#047857')}>{notice}</div>}

      {campaignsAvailable && (
        <>
          <section aria-label="Campaign metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Metric label="Active campaigns" value={metrics.active} />
            <Metric label="Scheduled campaigns" value={metrics.scheduled} />
            <Metric label="Recorded redemptions" value={metrics.redemptions} />
            <Metric label="Attributed orders" value={metrics.orders} />
            <Metric label="Attributed revenue" value={`৳${metrics.revenue.toFixed(2)}`} />
            <Metric label="Discount totals" value={`৳${metrics.discount.toFixed(2)}`} />
            <Metric label="Impressions" value={metrics.impressions.toLocaleString()} />
            <Metric label="Clicks" value={metrics.clicks.toLocaleString()} />
          </section>
          <p style={{ color: '#64748b', margin: '-8px 0 0', fontSize: 12 }}>
            Impression and click totals are recorded events, not unique visitors or verified conversions.
          </p>

          <section style={cardStyle} aria-label="Marketing calendar">
            {overlappingCampaigns.length > 0 && (
              <div role="status" style={messageStyle('#fffbeb', '#92400e')}>
                Schedule overlap: {overlappingCampaigns.map(([first, second]) => `${first.name} / ${second.name}`).join('; ')}.
                Pricing still applies only the highest-priority eligible promotion.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>Marketing calendar</h3>
                <small style={{ color: '#64748b' }}>Times shown in {calendarTimeZone}</small>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" style={smallButton} onClick={() => moveCalendar(-1)}>Previous</button>
                <button type="button" style={smallButton} onClick={() => setCalendarDate(new Date())}>Today</button>
                <button type="button" style={smallButton} onClick={() => moveCalendar(1)}>Next</button>
                {['day', 'week', 'month'].map(view => (
                  <button key={view} type="button" aria-pressed={calendarView === view} style={calendarView === view ? primaryButton : smallButton} onClick={() => setCalendarView(view)}>
                    {view[0].toUpperCase() + view.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <h4>{calendarLabel}</h4>
            {calendarCampaigns.length === 0
              ? <p style={{ color: '#64748b' }}>No campaigns in this {calendarView}. Use Previous and Next to browse scheduled campaigns.</p>
              : <div style={{ display: 'grid', gap: 8 }}>
                {calendarCampaigns.sort((a, b) => new Date(a.startDateUtc) - new Date(b.startDateUtc)).map(campaign => (
                  <article key={campaign.id} style={{ border: '1px solid #e2e8f0', borderLeft: '4px solid #c2410c', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                    <div><strong>{campaign.name}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{campaign.status} · {campaign.couponCode || 'Automatic offer'}</div></div>
                    <small>{formatCampaignTime(campaign.startDateUtc, calendarTimeZone)} – {formatCampaignTime(campaign.endDateUtc, calendarTimeZone)}</small>
                  </article>
                ))}
              </div>}
          </section>
        </>
      )}

      <form onSubmit={save} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit campaign' : 'Create an offer or coupon'}</h3>
        <div style={gridStyle}>
          <label style={labelStyle}>Campaign name
            <input required maxLength="160" value={form.name} onChange={e => update('name', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Description
            <input value={form.description || ''} onChange={e => update('description', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Discount type
            <select value={form.discountType} onChange={e => update('discountType', e.target.value)} style={inputStyle}>
              <option value="Percentage">Percentage</option><option value="FixedAmount">Fixed amount (৳)</option>
            </select>
          </label>
          <label style={labelStyle}>Discount value
            <input type="number" min="0.01" step="0.01" max={form.discountType === 'Percentage' ? 100 : undefined} required value={form.discountValue} onChange={e => update('discountValue', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Maximum discount (optional)
            <input type="number" min="0" step="0.01" value={form.maximumDiscountAmount} onChange={e => update('maximumDiscountAmount', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Offer applies to
            <select value={form.targetType} onChange={e => update('targetType', e.target.value)} style={inputStyle}>
              <option value="AllItems">All menu items</option><option value="Product">Product</option>
              <option value="Variant">Variant</option><option value="Category">Category</option>
            </select>
          </label>
          {form.targetType === 'Product' && (
            <label style={labelStyle}>Menu product
              <select required value={form.menuItemId || ''} onChange={e => update('menuItemId', e.target.value)} style={inputStyle}>
                <option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
          )}
          {form.targetType === 'Variant' && (
            <label style={labelStyle}>Menu variant ID
              <input type="number" min="1" required value={form.menuItemVariantId || ''} onChange={e => update('menuItemVariantId', e.target.value)} style={inputStyle} />
            </label>
          )}
          {form.targetType === 'Category' && (
            <label style={labelStyle}>Menu category
              <select required value={form.categoryId || ''} onChange={e => update('categoryId', e.target.value)} style={inputStyle}>
                <option value="">Select category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          )}
          <label style={labelStyle}>Coupon code (optional)
            <input value={form.couponCode || ''} onChange={e => update('couponCode', e.target.value.toUpperCase())} style={inputStyle} />
          </label>
          <label style={labelStyle}>Minimum order (৳)
            <input type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={e => update('minimumOrderAmount', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Max Orders / Stock Limit (optional)
            <input type="number" min="1" step="1" placeholder="e.g. 50 (auto-stops when reached)" value={form.usageLimit} onChange={e => update('usageLimit', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Priority (higher first)
            <input type="number" value={form.priority} onChange={e => update('priority', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Branch
            <select disabled={branchScoped} value={form.branchId} onChange={e => update('branchId', e.target.value)} style={inputStyle}>
              {!branchScoped && <option value="">All authorized branches</option>}
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Campaign Status
            <select value={form.status} onChange={e => update('status', e.target.value)} style={inputStyle}>
              {statusChoices.map(status => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Starts ({calendarTimeZone})
            <input
              type="datetime-local"
              required
              value={form.startDateUtc}
              onChange={e => {
                let v = e.target.value;
                if (v && v.length === 10) v = `${v}T00:00`;
                update('startDateUtc', v);
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>Ends ({calendarTimeZone})
            <input
              type="datetime-local"
              required
              value={form.endDateUtc}
              onChange={e => {
                let v = e.target.value;
                if (v && v.length === 10) v = `${v}T23:59`;
                update('endDateUtc', v);
              }}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 14px' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Quick Schedule:</span>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, '0');
              const d = String(now.getDate()).padStart(2, '0');
              setForm(f => ({ ...f, startDateUtc: `${y}-${m}-${d}T00:00`, endDateUtc: `${y}-${m}-${d}T23:59` }));
            }}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Today Only
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const plus7 = new Date(Date.now() + 7 * 86400000);
              setForm(f => ({
                ...f,
                startDateUtc: utcToRestaurantDateTimeInput(now, calendarTimeZone),
                endDateUtc: utcToRestaurantDateTimeInput(plus7, calendarTimeZone)
              }));
            }}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const plus30 = new Date(Date.now() + 30 * 86400000);
              setForm(f => ({
                ...f,
                startDateUtc: utcToRestaurantDateTimeInput(now, calendarTimeZone),
                endDateUtc: utcToRestaurantDateTimeInput(plus30, calendarTimeZone)
              }));
            }}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            30 Days
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, margin: '16px 0' }}>
          <label><input type="checkbox" checked={false} disabled /> Stacking is disabled to prevent unintended discounts.</label>
          <label><input type="checkbox" checked={form.includeCustomCakes} onChange={e => update('includeCustomCakes', e.target.checked)} /> Include custom cake menu items</label>
          <label><input type="checkbox" checked={Boolean(form.repeatWeekly)} onChange={e => update('repeatWeekly', e.target.checked)} /> Repeat weekly until paused or archived</label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving} style={primaryButton}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create campaign'}</button>
          {editingId && <button type="button" onClick={reset} style={secondaryButton}>Cancel edit</button>}
        </div>
      </form>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Campaign calendar list</h3>
        {loading ? <p>Loading campaigns…</p> : !campaignsAvailable ? (
          <p role="status" style={{ color: '#64748b' }}>Campaign data is unavailable. No local or sample campaign data is being shown.</p>
        ) : campaigns.length === 0 ? (
          <p style={{ color: '#64748b' }}>No campaigns are saved yet. Create an offer above to get started.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>{['Campaign', 'Offer', 'Branch', `Schedule (${calendarTimeZone})`, 'Redemptions', 'Orders / Revenue', 'State', 'Actions'].map(label => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>{campaigns.map(campaign => (
                <tr key={campaign.id}>
                  <td style={tdStyle}><strong>{campaign.name}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{campaign.couponCode || 'Automatic offer'}</div></td>
                  <td style={tdStyle}>{campaign.discountType === 'Percentage' ? `${campaign.discountValue}%` : `৳${campaign.discountValue}`}</td>
                  <td style={tdStyle}>{branches.find(branch => branch.id === campaign.branchId)?.name || 'All branches'}</td>
                  <td style={tdStyle}>{formatCampaignTime(campaign.startDateUtc, calendarTimeZone)}<br />to {formatCampaignTime(campaign.endDateUtc, calendarTimeZone)}{campaign.repeatWeekly && <><br /><small>Repeats weekly</small></>}</td>
                  <td style={tdStyle}>{campaign.redemptionCount}{campaign.usageLimit ? ` / ${campaign.usageLimit}` : ''}</td>
                  <td style={tdStyle}>{campaignReports.find(report => report.campaignId === campaign.id)?.orders || 0} / ৳{(campaignReports.find(report => report.campaignId === campaign.id)?.revenue || 0).toFixed(2)}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                      background: campaign.status === 'Active' ? '#dcfce7' : campaign.status === 'Paused' ? '#fef3c7' : campaign.status === 'Archived' ? '#fee2e2' : '#f1f5f9',
                      color: campaign.status === 'Active' ? '#15803d' : campaign.status === 'Paused' ? '#b45309' : campaign.status === 'Archived' ? '#b91c1c' : '#475569',
                      border: `1px solid ${campaign.status === 'Active' ? '#86efac' : campaign.status === 'Paused' ? '#fde68a' : campaign.status === 'Archived' ? '#fecdd3' : '#cbd5e1'}`
                    }}>
                      ● {campaign.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => edit(campaign)}
                        style={{ ...smallButton, fontWeight: 700 }}
                      >
                        ✏️ Edit
                      </button>

                      {campaign.status !== 'Archived' && (
                        <button
                          type="button"
                          onClick={() => changeStatus(campaign, campaign.status === 'Paused' ? 'Active' : 'Paused')}
                          style={{
                            ...smallButton,
                            fontWeight: 800,
                            background: campaign.status === 'Paused' ? '#dcfce7' : '#fffbeb',
                            color: campaign.status === 'Paused' ? '#15803d' : '#b45309',
                            borderColor: campaign.status === 'Paused' ? '#86efac' : '#fde68a'
                          }}
                          title={campaign.status === 'Paused' ? 'Turn this offer back ON' : 'Immediately STOP this offer'}
                        >
                          {campaign.status === 'Paused' ? '▶ Resume (Turn ON)' : '⏸ Pause (Turn OFF)'}
                        </button>
                      )}

                      {campaign.status !== 'Archived' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to permanently archive "${campaign.name}"?`)) {
                              changeStatus(campaign, 'Archived');
                            }
                          }}
                          style={{
                            ...smallButton,
                            fontWeight: 700,
                            background: '#fff1f2',
                            color: '#b91c1c',
                            borderColor: '#fecdd3'
                          }}
                        >
                          🗑️ Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,.05)' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14 };
const labelStyle = { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 700 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a' };
const primaryButton = { background: '#c2410c', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' };
const secondaryButton = { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer' };
const smallButton = { border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#334155' };
const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 };
const tdStyle = { padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 13, verticalAlign: 'top' };
const statusStyle = { display: 'inline-block', padding: '3px 8px', borderRadius: 20, background: '#fff7ed', color: '#9a3412', fontSize: 11, fontWeight: 800 };
const messageStyle = (background, color) => ({ background, color, borderRadius: 8, padding: '10px 12px', fontWeight: 700 });
