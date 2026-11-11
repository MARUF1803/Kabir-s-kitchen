import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';
import { bannersApi, promotionsApi, resolveApiUrl } from '../services/api';
import { useApp } from '../context/useApp';
import { restaurantDateTimeToUtc, utcToRestaurantDateTimeInput } from '../utils/restaurantTime';
import './HeroBannerAdmin.css';

const defaultBannerDates = (timeZone = 'Asia/Dhaka') => {
  const now = new Date();
  const plus7 = new Date(Date.now() + 7 * 86400000);
  return {
    start: utcToRestaurantDateTimeInput(now, timeZone),
    end: utcToRestaurantDateTimeInput(plus7, timeZone)
  };
};

const emptyForm = {
  title: '', subtitle: '', buttonText: 'Order now', buttonLink: '#menu', displayOrder: 0,
  isActive: true, startDate: defaultBannerDates().start, endDate: defaultBannerDates().end, branchId: '',
  mediaType: 'Image', mediaUrl: '', posterUrl: '', altText: '', promotionCampaignId: ''
};

const bannerTemplates = [
  { name: 'Weekend Food Deals', title: 'Weekend Food Deals', subtitle: 'A fresh weekend menu, prepared to order.', buttonText: 'Explore menu', buttonLink: '#menu' },
  { name: 'Chicken and Fast Food Offers', title: 'Chicken & Fast Food', subtitle: 'Find your next favorite from the kitchen.', buttonText: 'Order now', buttonLink: '#menu' },
  { name: 'Chinese and Thai Specials', title: 'Chinese & Thai Specials', subtitle: 'Wok-fresh dishes made for sharing.', buttonText: 'Explore menu', buttonLink: '#menu' },
  { name: 'Combo and Family Meals', title: 'Meals for the Whole Table', subtitle: 'Browse combos and family-sized favorites.', buttonText: 'View meals', buttonLink: '#menu' },
  { name: 'Cake and Dessert Promotions', title: 'Cakes & Desserts', subtitle: 'Celebrate with a cake made for your occasion.', buttonText: 'Explore cakes', buttonLink: '#cakes' },
  { name: 'Lunch Deals and Happy Hour', title: 'Lunch & Happy Hour', subtitle: 'See what is available at your selected branch.', buttonText: 'See menu', buttonLink: '#menu' },
  { name: 'Seasonal Campaign', title: 'Celebrate the Season', subtitle: 'Seasonal favorites, freshly prepared.', buttonText: 'Discover more', buttonLink: '#menu' }
];

export default function HeroBannerAdmin() {
  const { branches } = useApp();
  const [banners, setBanners] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [timeZone, setTimeZone] = useState('Asia/Dhaka');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [image, setImage] = useState(null);
  const imagePreviewUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [bannerResult, campaignResult] = await Promise.allSettled([
        bannersApi.getAll(),
        promotionsApi.calendar()
      ]);
      if (bannerResult.status === 'fulfilled') {
        setBanners(bannerResult.value);
      } else {
        throw bannerResult.reason;
      }
      if (campaignResult.status === 'fulfilled') {
        setCampaigns(campaignResult.value.campaigns || []);
        setTimeZone(campaignResult.value.timeZoneId || 'Asia/Dhaka');
      } else {
        setCampaigns([]);
        setError(campaignResult.reason.response?.data?.message || 'Campaign records could not be loaded; linked campaign copy is unavailable.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  // oxlint-disable-next-line react/set-state-in-effect -- This effect loads campaign data from the API.
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setImage(null);
    setError('');
    setSelectedTemplate('');
  };

  const applyTemplate = (templateName) => {
    setSelectedTemplate(templateName);
    const template = bannerTemplates.find(item => item.name === templateName);
    if (template) setForm(current => ({ ...current, ...template }));
  };

  const selectCampaign = (campaignId) => {
    const campaign = campaigns.find(item => String(item.id) === campaignId);
    setForm(current => ({
      ...current,
      promotionCampaignId: campaignId,
      ...(campaign ? {
        startDate: utcToRestaurantDateTimeInput(campaign.startDateUtc, timeZone),
        endDate: utcToRestaurantDateTimeInput(campaign.endDateUtc, timeZone),
        branchId: campaign.branchId ? String(campaign.branchId) : current.branchId
      } : {})
    }));
  };

  const selectedCampaign = campaigns.find(item => String(item.id) === form.promotionCampaignId);
  const campaignBadge = selectedCampaign
    ? `${selectedCampaign.discountType === 'Percentage' ? `${selectedCampaign.discountValue}%` : `৳${selectedCampaign.discountValue}`} OFF${selectedCampaign.couponCode ? ` · CODE ${selectedCampaign.couponCode}` : ''}`
    : '';
  const previewImage = imagePreviewUrl || form.mediaUrl;

  const edit = (banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      buttonText: banner.buttonText,
      buttonLink: banner.buttonLink || '',
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
      startDate: utcToRestaurantDateTimeInput(banner.startDate, timeZone),
      endDate: utcToRestaurantDateTimeInput(banner.endDate, timeZone),
      branchId: banner.branchId || '',
      mediaType: banner.mediaType || 'Image',
      mediaUrl: resolveApiUrl(banner.mediaUrl || banner.imageUrl || ''),
      posterUrl: resolveApiUrl(banner.posterUrl || ''),
      altText: banner.altText || '',
      promotionCampaignId: banner.promotionCampaignId ? String(banner.promotionCampaignId) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        buttonText: form.buttonText,
        buttonLink: form.buttonLink || '',
        displayOrder: Number(form.displayOrder) || 0,
        isActive: Boolean(form.isActive),
        startDate: restaurantDateTimeToUtc(form.startDate, timeZone).toISOString(),
        endDate: restaurantDateTimeToUtc(form.endDate, timeZone).toISOString(),
        branchId: form.branchId ? Number(form.branchId) : null,
        mediaType: form.mediaType === 'Video' ? 2 : form.mediaType === 'ProductPromotion' ? 3 : form.mediaType === 'CategoryPromotion' ? 4 : form.mediaType === 'Campaign' ? 5 : 1,
        mediaUrl: form.mediaUrl || '',
        imageUrl: form.mediaUrl || '',
        posterUrl: form.posterUrl || '',
        altText: form.altText.trim(),
        promotionCampaignId: form.promotionCampaignId ? Number(form.promotionCampaignId) : null,
        campaignName: '',
        badgeText: ''
      };

      if (image) {
        const uploadedImage = await bannersApi.upload(image);
        payload.imageUrl = uploadedImage.imageUrl;
        payload.mediaUrl = uploadedImage.imageUrl;
      }

      if (editingId) await bannersApi.update(editingId, payload);
      else await bannersApi.create(payload);
      reset();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      setError('');
      await bannersApi.delete(id);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete campaign.');
    }
  };

  return (
    <section className="banner-admin">
      <div className="banner-admin__heading">
        <div><span className="eyebrow">Campaign management</span><h2>Banner Studio</h2><p>Build scheduled storefront banners. Discount badges and names are derived from the linked server campaign.</p></div>
        <button className="button button--primary" onClick={reset}><Plus size={17} /> New slide</button>
      </div>
      <div className="banner-admin__layout">
        <form className="banner-form" onSubmit={save}>
          <div className="banner-form__head"><h3>{editingId ? 'Edit slide' : 'Create media slide'}</h3>{editingId && <button type="button" onClick={reset} aria-label="Cancel edit"><X size={18} /></button>}</div>

          <label>Start from a template
            <select value={selectedTemplate} onChange={event => applyTemplate(event.target.value)}>
              <option value="">Choose a template</option>
              {bannerTemplates.map(template => <option key={template.name} value={template.name}>{template.name}</option>)}
            </select>
          </label>
          
          <div className="banner-form__row">
            <label>Media Type
              <select value={form.mediaType} onChange={e => setForm({ ...form, mediaType: e.target.value })}>
                <option value="Image">Photo Image</option>
                <option value="Video">Muted Video (MP4/WebM)</option>
                <option value="ProductPromotion">Product Card Promotion</option>
                <option value="CategoryPromotion">Category Promotion</option>
                <option value="Campaign">Flash Campaign Banner</option>
              </select>
            </label>
            <label>Linked promotion
              <select value={form.promotionCampaignId} onChange={event => selectCampaign(event.target.value)}>
                <option value="">No promotion (editorial banner)</option>
                {campaigns.filter(campaign => ['Scheduled', 'Active'].includes(campaign.status)).map(campaign =>
                  <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.status}</option>
                )}
              </select>
            </label>
          </div>
          <p style={{ margin: '-4px 0 0', color: '#64748b', fontSize: 12 }}>
            {selectedCampaign
              ? `Verified offer badge: ${campaignBadge}. The server hides this banner when its campaign is not eligible.`
              : 'Promotional discount claims require selecting a real campaign.'}
          </p>

          <label>Media URL (Image or Video)
            <input value={form.mediaUrl} onChange={e => setForm({ ...form, mediaUrl: e.target.value })} placeholder="https://.../video.mp4 or https://.../image.jpg" required={!image} />
          </label>
          {form.mediaType !== 'Video' && (
            <label>Upload image
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} />
              <small>JPG, PNG, or WebP; maximum 5 MB.</small>
            </label>
          )}
          {form.mediaType !== 'Video' && (
            <label>Image description (alt text)
              <input value={form.altText} onChange={event => setForm({ ...form, altText: event.target.value })} required maxLength={300} placeholder="Describe the image for screen readers" />
            </label>
          )}

          {form.mediaType === 'Video' && (
            <label>Video Poster Image URL (Preview fallback)
              <input value={form.posterUrl} onChange={e => setForm({ ...form, posterUrl: e.target.value })} placeholder="https://.../poster.jpg" />
            </label>
          )}

          <label>Title
            <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label>Subtitle / Description
            <input value={form.subtitle} onChange={event => setForm({ ...form, subtitle: event.target.value })} required />
          </label>

          <div className="banner-form__row">
            <label>Button text<input value={form.buttonText} onChange={event => setForm({ ...form, buttonText: event.target.value })} placeholder="e.g. Order Now" /></label>
            <label>Button link<input value={form.buttonLink} onChange={event => setForm({ ...form, buttonLink: event.target.value })} placeholder="#menu or #cakes" /></label>
          </div>

          <div className="banner-form__row">
            <label>Start date ({timeZone})<input type="datetime-local" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} required /></label>
            <label>End date ({timeZone})<input type="datetime-local" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} required /></label>
          </div>

          <div className="banner-form__row">
            <label>Display order<input type="number" min="0" value={form.displayOrder} onChange={event => setForm({ ...form, displayOrder: event.target.value })} /></label>
            <label>Target Branch<select value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          </div>

          <label className="banner-form__checkbox"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /><span>Active and visible on storefront</span></label>

          <section aria-label="Banner preview" style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>Preview</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                {['desktop', 'mobile'].map(device => <button key={device} type="button" aria-pressed={previewDevice === device} onClick={() => setPreviewDevice(device)}>{device}</button>)}
              </div>
            </div>
            <article style={{ position: 'relative', overflow: 'hidden', margin: '12px auto 0', width: previewDevice === 'mobile' ? 'min(100%, 320px)' : '100%', minHeight: previewDevice === 'mobile' ? 220 : 180, borderRadius: 10, background: '#0c251c', color: '#fff' }}>
              {previewImage && <img src={previewImage} alt={form.altText || 'Banner preview'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.48 }} />}
              <div style={{ position: 'relative', display: 'grid', alignContent: 'center', gap: 8, minHeight: 'inherit', padding: 20 }}>
                {campaignBadge && <strong style={{ width: 'fit-content', padding: '5px 9px', borderRadius: 99, background: '#f97316' }}>{campaignBadge}</strong>}
                <h3 style={{ margin: 0 }}>{form.title || 'Banner headline'}</h3>
                <p style={{ margin: 0 }}>{form.subtitle || 'Banner description'}</p>
                <span style={{ width: 'fit-content', borderRadius: 8, padding: '8px 12px', background: '#fff', color: '#0c251c', fontWeight: 700 }}>{form.buttonText || 'Call to action'}</span>
              </div>
            </article>
          </section>

          {error && <div className="form-error">{error}</div>}
          <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create slide'}</button>
        </form>
        <div className="banner-admin__list">
          <div className="banner-admin__list-head"><h3>Saved banners</h3><span>{banners.length} total</span></div>
          {loading ? <div className="banner-admin__empty">Loading banners…</div> : banners.length === 0 ? <div className="banner-admin__empty"><CalendarDays size={26} /><strong>No banners yet</strong><span>Create a banner and optionally link an eligible campaign.</span></div> : banners.map(banner => (
            <article className="banner-admin__item" key={banner.id}>
              {banner.imageUrl && <img src={resolveApiUrl(banner.imageUrl)} alt={banner.altText || ''} />}
              <div><span className={`banner-admin__status ${banner.isActive ? 'active' : ''}`}>{banner.isActive ? 'Active' : 'Paused'}</span><h4>{banner.title}</h4><p>{banner.subtitle}</p>{banner.badgeText && <small>{banner.badgeText} · {banner.campaignName}</small>}<small>{new Date(banner.startDate).toLocaleString()} – {new Date(banner.endDate).toLocaleString()} · {banner.branchId ? `Branch ${banner.branchId}` : 'All branches'}</small></div>
              <div className="banner-admin__actions"><button onClick={() => edit(banner)} aria-label="Edit campaign"><Pencil size={17} /></button><button onClick={() => remove(banner.id)} aria-label="Delete campaign"><Trash2 size={17} /></button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
