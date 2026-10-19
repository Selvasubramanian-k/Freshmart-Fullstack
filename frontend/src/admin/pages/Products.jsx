import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Package, Upload } from 'lucide-react'
import { api } from '../../shared/api/client.js'
import { resolveImage } from '../../shared/utils/images.js'
import { CATEGORIES } from '../../customer/data/categories.js'
import { Empty, ErrorNote, Modal, PageHead } from '../components/ui.jsx'
import { rs } from '../utils/format.js'

const CATS = CATEGORIES.filter(c => c.id !== 'all')
const CAT_LABEL = Object.fromEntries(CATS.map(c => [c.id, c.label]))
const TAGS = ['popular', 'new', 'sale', 'organic']
const LOW = 10

const daysLeft = (date) => {
  if (!date) return null
  const ms = new Date(`${date}T23:59:59`) - new Date()
  return Math.floor(ms / 86400000)
}

const EMPTY = { name: '', category: 'fruits', unit: '1 kg', price: '', mrp: '', stock: '', tag: 'popular', image_url: '', expiry_date: '', description: '', is_active: true }

function ProductForm({ initial, onSaved, onClose }) {
  const editing = Boolean(initial?.pid)
  const [f, setF] = useState(() => editing ? {
    ...EMPTY, ...initial,
    price: String(initial.price), mrp: initial.mrp ? String(initial.mrp) : '', stock: String(initial.stock),
    image_url: initial.image_url || '', expiry_date: initial.expiry_date || '', description: initial.description || '',
  } : EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try { const r = await api.upload('/api/admin/uploads', file); setF(s => ({ ...s, image_url: r.image_url })) }
    catch (err) { setError(err.message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const submit = async (e) => {
    e.preventDefault()
    const price = Number(f.price), mrp = f.mrp ? Number(f.mrp) : null, stock = Number(f.stock)
    if (f.name.trim().length < 2)            return setError('Enter the product name.')
    if (!(price > 0))                        return setError('Enter a valid selling price.')
    if (mrp !== null && mrp < price)         return setError('MRP cannot be less than the selling price.')
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be a whole number (0 or more).')

    const body = {
      name: f.name.trim(), category: f.category, unit: f.unit.trim() || '1 pc', price, stock, tag: f.tag,
      description: f.description.trim(), is_active: f.is_active,
      image_url: f.image_url.trim() || null,
    }
    if (editing) { body.mrp = mrp ?? 0; body.expiry_date = f.expiry_date || '' }
    else { body.mrp = mrp; body.expiry_date = f.expiry_date || null }

    setBusy(true); setError('')
    try {
      const saved = editing
        ? await api.put(`/api/admin/products/${initial.pid}`, body)
        : await api.post('/api/admin/products', body)
      onSaved(saved, editing)
    } catch (err) { setError(err.message); setBusy(false) }
  }

  const preview = resolveImage(f.image_url)

  return (
    <Modal title={editing ? 'Edit product' : 'Add product'} onClose={onClose} wide>
      <form className="ad-form" onSubmit={submit} noValidate>
        <div className="ad-form-img">
          <div className="ad-img-preview">{preview ? <img src={preview} alt="" /> : <Package size={36} />}</div>
          <div className="ad-form-img-side">
            <label className="ad-btn ghost">
              <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
            </label>
            <input className="ad-input" placeholder="or paste an image URL" value={f.image_url} onChange={set('image_url')} />
            <span className="ad-muted ad-small">JPG, PNG or WEBP, up to 2 MB</span>
          </div>
        </div>

        <label className="ad-field full">Product name<input className="ad-input" value={f.name} onChange={set('name')} placeholder="e.g. Fresh Tomato" autoFocus /></label>
        <label className="ad-field">Category
          <select className="ad-input" value={f.category} onChange={set('category')}>
            {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="ad-field">Unit<input className="ad-input" value={f.unit} onChange={set('unit')} placeholder="1 kg, 500 g, 1 L" /></label>
        <label className="ad-field">Selling price (₹)<input className="ad-input" inputMode="decimal" value={f.price} onChange={set('price')} /></label>
        <label className="ad-field">MRP (₹, optional)<input className="ad-input" inputMode="decimal" value={f.mrp} onChange={set('mrp')} placeholder="shown struck through" /></label>
        <label className="ad-field">Stock<input className="ad-input" inputMode="numeric" value={f.stock} onChange={set('stock')} /></label>
        <label className="ad-field">Expiry date<input className="ad-input" type="date" value={f.expiry_date} onChange={set('expiry_date')} /></label>
        <label className="ad-field">Tag
          <select className="ad-input" value={f.tag} onChange={set('tag')}>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="ad-check"><input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Visible to customers</label>
        <label className="ad-field full">Description<textarea className="ad-input" rows={2} value={f.description} onChange={set('description')} /></label>

        <div className="full"><ErrorNote>{error}</ErrorNote></div>
        <div className="ad-form-actions full">
          <button type="button" className="ad-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ad-btn" disabled={busy || uploading}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
        </div>
      </form>
    </Modal>
  )
}

function StockCell({ product, onChange }) {
  const [val, setVal] = useState(String(product.stock))
  const [busy, setBusy] = useState(false)
  useEffect(() => { setVal(String(product.stock)) }, [product.stock])
  const dirty = val !== String(product.stock)
  const save = async () => {
    const n = Number(val)
    if (!Number.isInteger(n) || n < 0) { setVal(String(product.stock)); return }
    setBusy(true)
    try { await api.patch(`/api/admin/products/${product.pid}/stock`, { stock: n }); onChange(n) }
    finally { setBusy(false) }
  }
  return (
    <div className={`ad-stockcell ${product.stock === 0 ? 'out' : product.stock <= LOW ? 'low' : ''}`}>
      <input className="ad-input sm" inputMode="numeric" aria-label={`Stock for ${product.name}`} value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
      {dirty && <button className="ad-btn sm" disabled={busy} onClick={save}>Save</button>}
    </div>
  )
}

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [items, setItems]   = useState(null)
  const [error, setError]   = useState('')
  const [q, setQ]           = useState('')
  const [cat, setCat]       = useState('')
  const lowOnly             = params.get('low') === '1'
  const [editing, setEditing] = useState(null)   // null | {} (new) | product

  const load = useCallback(() => api.get('/api/admin/products').then(setItems).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => (items || []).filter(p =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
    (!cat || p.category === cat) &&
    (!lowOnly || p.stock <= LOW)
  ), [items, q, cat, lowOnly])

  const onSaved = (saved, wasEdit) => {
    setItems(xs => wasEdit ? xs.map(x => x.pid === saved.pid ? saved : x) : [saved, ...xs])
    setEditing(null)
  }
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try { await api.del(`/api/admin/products/${p.pid}`); setItems(xs => xs.filter(x => x.pid !== p.pid)) }
    catch (e) { setError(e.message) }
  }
  const toggleActive = async (p) => {
    const saved = await api.put(`/api/admin/products/${p.pid}`, { is_active: !p.is_active })
    setItems(xs => xs.map(x => x.pid === p.pid ? saved : x))
  }

  return (
    <>
      <PageHead title="Products" sub={items ? `${items.length} products · ${items.filter(p => p.stock <= LOW).length} low on stock` : ''}>
        <button className="ad-btn" onClick={() => setEditing({})}><Plus size={16} /> Add product</button>
      </PageHead>

      <div className="ad-toolbar">
        <div className="ad-search"><Search size={16} /><input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="ad-input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label className="ad-check">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setParams(e.target.checked ? { low: '1' } : {})} /> Low stock only
        </label>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!items ? <p className="ad-muted">Loading products…</p> : list.length === 0 ? (
        <Empty icon={Package} title={items.length ? 'No products match' : 'No products yet'} text={items.length ? 'Try a different search or filter.' : 'Add your first product to start selling.'}>
          {!items.length && <button className="ad-btn" onClick={() => setEditing({})}><Plus size={16} /> Add product</button>}
        </Empty>
      ) : (
        <div className="ad-card flush">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Expiry</th><th>Visible</th><th /></tr></thead>
              <tbody>
                {list.map(p => {
                  const left = daysLeft(p.expiry_date)
                  return (
                    <tr key={p.pid} className={p.is_active ? '' : 'dim'}>
                      <td>
                        <div className="ad-prod">
                          <span className="ad-thumb">{resolveImage(p.image_url) ? <img src={resolveImage(p.image_url)} alt="" loading="lazy" /> : <Package size={18} />}</span>
                          <div><b>{p.name}</b><span className="ad-muted">{p.unit} · #{p.pid}</span></div>
                        </div>
                      </td>
                      <td>{CAT_LABEL[p.category] || p.category}</td>
                      <td>
                        <b>{rs(p.price)}</b>
                        {p.mrp && <span className="ad-mrp">{rs(p.mrp)}</span>}
                      </td>
                      <td><StockCell product={p} onChange={(n) => setItems(xs => xs.map(x => x.pid === p.pid ? { ...x, stock: n } : x))} /></td>
                      <td>
                        {p.expiry_date ? (
                          <span className={left < 0 ? 'ad-exp bad' : left <= 3 ? 'ad-exp warn' : 'ad-muted'}>
                            {left < 0 ? 'Expired' : left === 0 ? 'Today' : p.expiry_date}
                          </span>
                        ) : <span className="ad-muted">—</span>}
                      </td>
                      <td>
                        <button className={`ad-mini-switch ${p.is_active ? 'on' : ''}`} role="switch" aria-checked={p.is_active}
                          aria-label={`Visible: ${p.name}`} onClick={() => toggleActive(p)}><span /></button>
                      </td>
                      <td className="ad-row-actions">
                        <button className="ad-icon-btn" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><Pencil size={16} /></button>
                        <button className="ad-icon-btn danger" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <ProductForm initial={editing} onSaved={onSaved} onClose={() => setEditing(null)} />}
    </>
  )
}
