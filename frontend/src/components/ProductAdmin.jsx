import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Image, PackagePlus, Plus, Search } from 'lucide-react';
import apiClient, { mapMenuItemToProduct } from '../services/api';
import { useApp } from '../context/useApp';
import './ProductAdmin.css';

const emptyForm = {
  categoryId: '', name: '', slug: '', description: '', imageUrl: '', basePrice: '',
  preparationTimeMinutes: 30, isVegetarian: false, isSpicy: false,
  isBakeryItem: false, allowCustomization: false
};

const flattenCategoryTree = (categories, depth = 0) => categories.flatMap(category => [
  { id: category.id ?? category.categoryId, name: category.name, depth },
  ...flattenCategoryTree(category.subCategories || category.children || [], depth + 1)
]);

export default function ProductAdmin({ initialSearch = '' }) {
  const { addProduct } = useApp();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', parentCategoryId: '', icon: '🍽️' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== searchTerm) {
      setSearchTerm(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  const loadData = useCallback(async (requestedPage = page) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        apiClient.get('/menu/categories'),
        apiClient.get('/menu/items', {
          params: {
            page: requestedPage,
            pageSize: 50,
            categoryId: selectedCategory || undefined,
            search: searchTerm.trim() || undefined
          }
        })
      ]);
      if (currentRequestId !== requestId.current) return;
      setCategories(categoryResponse.data);
      if (!Array.isArray(productResponse.data.items)) {
        throw new Error('The product API returned an invalid page.');
      }
      setProducts(productResponse.data.items);
      setPage(productResponse.data.page);
      setTotalCount(productResponse.data.totalCount);
      setTotalPages(productResponse.data.totalPages);
    } catch (requestError) {
      if (currentRequestId === requestId.current) {
        setError(requestError.response?.data?.message || requestError.message || 'Unable to load products.');
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [page, searchTerm, selectedCategory]);

  // oxlint-disable-next-line react/set-state-in-effect -- This effect loads product data from the API.
  useEffect(() => {
    const timer = setTimeout(() => loadData(page), searchTerm ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, page, searchTerm]);

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const slugify = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const visibleProducts = products;
  const categoryOptions = flattenCategoryTree(categories);

  const createCategory = async () => {
    setError('');
    setMessage('');
    setSavingCategory(true);
    try {
      const payload = {
        name: newCategory.name.trim(),
        slug: newCategory.slug.trim() || slugify(newCategory.name),
        parentCategoryId: newCategory.parentCategoryId ? Number(newCategory.parentCategoryId) : null,
        description: null,
        imageUrl: null,
        icon: newCategory.icon,
        displayOrder: 0
      };
      const response = await apiClient.post('/menu/categories', payload);
      const categoryResponse = await apiClient.get('/menu/categories');
      setCategories(categoryResponse.data);
      setForm(current => ({ ...current, categoryId: String(response.data.id) }));
      setNewCategory({ name: '', slug: '', parentCategoryId: '', icon: '🍽️' });
      setMessage(`${response.data.name} category was created.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const imageUrl = form.imageUrl.trim();
    setSaving(true);

    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        basePrice: Number(form.basePrice),
        preparationTimeMinutes: Number(form.preparationTimeMinutes),
        slug: form.slug || slugify(form.name),
        description: form.description.trim(),
        imageUrl
      };
      const response = await apiClient.post('/menu/items', payload);
      
      // Sync immediately into unified AppContext (both POS & Web get it)
      if (addProduct) {
        addProduct(mapMenuItemToProduct(response.data));
      }

      setMessage(`${response.data.name} was added successfully.`);
      setForm(emptyForm);
      setPage(1);
      await loadData(1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the product to the database.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="product-admin">
      <div className="product-admin__heading">
        <div><span className="eyebrow">Catalog management</span><h2>Add a product</h2><p>Create a new item for the customer menu and POS.</p></div>
        <span className="product-admin__count"><Boxes size={17} /> {totalCount} products</span>
      </div>

      <div className="product-admin__layout">
        <form className="product-form" onSubmit={submit}>
          <div className="product-form__header"><h3>Product details</h3><span>All fields marked by the form are required where applicable.</span></div>
          <label>Category<select value={form.categoryId} onChange={event => updateField('categoryId', event.target.value)} required><option value="">Select category</option>{categoryOptions.map(category => <option key={category.id} value={category.id}>{`${'— '.repeat(category.depth)}${category.name}`}</option>)}</select></label>
          <label>Product name<input value={form.name} onChange={event => updateField('name', event.target.value)} placeholder="e.g. Chocolate Strawberry Cake" maxLength="160" required /></label>
          <div className="product-form__row">
            <label>Slug<input value={form.slug} onChange={event => updateField('slug', event.target.value)} placeholder="chocolate-strawberry-cake" maxLength="180" /></label>
            <label>Base price (৳)<input type="number" min="0" step="0.01" value={form.basePrice} onChange={event => updateField('basePrice', event.target.value)} placeholder="1250" required /></label>
          </div>
          <label>Description<textarea value={form.description} onChange={event => updateField('description', event.target.value)} placeholder="Describe ingredients, preparation, and serving details…" rows="4" required /></label>
          <label>Product image URL<input type="url" value={form.imageUrl} onChange={event => updateField('imageUrl', event.target.value)} placeholder="https://example.com/product.jpg" required /></label>
          <label>Preparation time (minutes)<input type="number" min="1" max="1440" value={form.preparationTimeMinutes} onChange={event => updateField('preparationTimeMinutes', event.target.value)} required /></label>
          <div className="product-form__flags">
            <label><input type="checkbox" checked={form.isVegetarian} onChange={event => updateField('isVegetarian', event.target.checked)} /><span>Vegetarian</span></label>
            <label><input type="checkbox" checked={form.isSpicy} onChange={event => updateField('isSpicy', event.target.checked)} /><span>Spicy</span></label>
            <label><input type="checkbox" checked={form.isBakeryItem} onChange={event => updateField('isBakeryItem', event.target.checked)} /><span>Bakery item</span></label>
            <label><input type="checkbox" checked={form.allowCustomization} onChange={event => updateField('allowCustomization', event.target.checked)} /><span>Customizable</span></label>
          </div>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <button className="button button--primary" type="submit" disabled={saving || loading}><Plus size={17} /> {saving ? 'Adding product…' : 'Add product'}</button>
          <details className="product-form__category-create">
            <summary>Create a category or child category</summary>
            <label>Parent category<select value={newCategory.parentCategoryId} onChange={event => setNewCategory(current => ({ ...current, parentCategoryId: event.target.value }))}><option value="">No parent (top-level category)</option>{categoryOptions.map(category => <option key={category.id} value={category.id}>{`${'— '.repeat(category.depth)}${category.name}`}</option>)}</select></label>
            <label>Category name<input value={newCategory.name} onChange={event => setNewCategory(current => ({ ...current, name: event.target.value }))} maxLength="160" /></label>
            <label>Category slug<input value={newCategory.slug} onChange={event => setNewCategory(current => ({ ...current, slug: event.target.value }))} maxLength="180" placeholder="Generated from the category name if blank" /></label>
            <label>Icon<input value={newCategory.icon} onChange={event => setNewCategory(current => ({ ...current, icon: event.target.value }))} maxLength="16" /></label>
            <button className="button button--ghost" type="button" onClick={createCategory} disabled={savingCategory || !newCategory.name.trim()}>
              {savingCategory ? 'Creating category…' : 'Create category'}
            </button>
          </details>
        </form>

        <div className="product-admin__list">
          <div className="product-admin__list-head"><div><h3>Catalog products</h3><span>Showing {visibleProducts.length} of {totalCount} products · Page {page} of {Math.max(totalPages, 1)}</span></div><PackagePlus size={20} /></div>
          <div className="product-admin__filters">
            <label className="product-admin__search"><Search size={16} /><input aria-label="Search products" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search by product or category" /></label>
            <select aria-label="Filter products by category" value={selectedCategory} onChange={event => { setSelectedCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categoryOptions.map(category => <option key={category.id} value={category.id}>{`${'— '.repeat(category.depth)}${category.name}`}</option>)}
            </select>
          </div>
          {loading ? <div className="product-admin__empty">Loading products…</div> : products.length === 0 ? <div className="product-admin__empty"><Image size={29} /><strong>No matching products</strong><span>Try a different search or category.</span></div> : (
              <div className="product-admin__items">
              {visibleProducts.map(product => (
                <article key={product.id}>
                  <img src={product.imageUrl || '/food-placeholder.svg'} alt={product.name} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/food-placeholder.svg'; }} />
                  <div><span>{product.categoryPath || product.categoryName}</span><strong>{product.name}</strong><small>৳{product.basePrice} · {product.preparationTimeMinutes} min</small></div>
                  <i className={product.isAvailable ? 'active' : 'inactive'}>{product.isAvailable ? 'Active' : 'Inactive'}</i>
                </article>
              ))}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <div className="product-admin__pagination">
              <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
