import { useMemo, useState } from 'react'
import { ITEM_TYPES, STOCK_OUT_REASONS, UNITS, UNIT_OPTIONS_BY_CATEGORY } from './inventoryData.js'
import { calculateOrderRequirements, getRecipeUnitIssues, getRequirementShortages } from './orderData.js'
import { useCurrency } from './currencyContext.js'
import { CategoryIllustration } from './CategoryBranding.jsx'

function Modal({ title, description, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`management-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-heading">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

function ItemForm({ item, items, businessCategory, onSave, onClose }) {
  const { currency } = useCurrency()
  const categoryUnits = UNIT_OPTIONS_BY_CATEGORY[businessCategory] ?? UNITS
  const availableUnits = item && !categoryUnits.includes(item.unit) ? [...categoryUnits, item.unit] : categoryUnits
  const showFoodFields = businessCategory === 'home-foods'
  const showArtFields = businessCategory === 'pencil-arts'
  const showCraftFields = businessCategory === 'clays-handicrafts'
  const showExpiryField = showFoodFields || businessCategory === 'supermarket'
  const showFlexibleDetails = businessCategory === 'all-businesses'
  const [costCurrencyCode, setCostCurrencyCode] = useState(item?.currencyCode ?? currency)
  const [sellingPriceCurrencyCode, setSellingPriceCurrencyCode] = useState(item?.sellingPriceCurrencyCode ?? item?.currencyCode ?? currency)
  const [values, setValues] = useState(() => ({
    name: item?.name ?? '',
    sku: item?.sku ?? '',
    category: item?.category ?? '',
    type: item?.type ?? ITEM_TYPES[0],
    unit: item?.unit ?? categoryUnits[0] ?? UNITS[0],
    quantity: String(item?.quantity ?? ''),
    costPerUnit: String(item?.costPerUnit ?? ''),
    sellingPrice: item?.sellingPrice == null ? '' : String(item.sellingPrice),
    reorderLevel: String(item?.reorderLevel ?? ''),
    supplier: item?.supplier ?? '',
    ingredients: item?.metadata?.ingredients ?? '',
    productionDate: item?.metadata?.productionDate ?? '',
    expiryDate: item?.metadata?.expiryDate ?? '',
    size: item?.metadata?.size ?? '',
    medium: item?.metadata?.medium ?? '',
    material: item?.metadata?.material ?? '',
    productionStatus: item?.metadata?.productionStatus ?? 'Ready',
    details: item?.metadata?.details ?? '',
  }))
  const [errors, setErrors] = useState({})

  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    if (name === 'costPerUnit') setCostCurrencyCode(currency)
    if (name === 'sellingPrice') setSellingPriceCurrencyCode(currency)
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!values.name.trim()) nextErrors.name = 'Enter a product name.'
    if (businessCategory === 'supermarket' && !values.sku.trim()) nextErrors.sku = 'Enter a SKU.'
    else if (values.sku.trim() && items.some((existing) => existing.sku?.trim().toLowerCase() === values.sku.trim().toLowerCase() && existing.id !== item?.id)) {
      nextErrors.sku = 'This SKU is already used by another item.'
    }
    if (!values.category.trim()) nextErrors.category = 'Enter a category.'
    if (values.productionDate && values.expiryDate && values.expiryDate < values.productionDate) {
      nextErrors.expiryDate = 'Expiry date must be on or after the production date.'
    }
    if (!ITEM_TYPES.includes(values.type)) nextErrors.type = 'Choose a valid item type.'
    if (!availableUnits.includes(values.unit)) nextErrors.unit = 'Choose a valid unit for this business category.'
    for (const field of ['quantity', 'reorderLevel']) {
      const number = Number(values[field])
      if (values[field] === '' || !Number.isFinite(number) || number < 0) {
        nextErrors[field] = 'Enter a valid number of zero or more.'
      }
    }
    if (values.costPerUnit !== '' && (!Number.isFinite(Number(values.costPerUnit)) || Number(values.costPerUnit) < 0)) {
      nextErrors.costPerUnit = 'Enter a valid cost of zero or more.'
    }
    if (values.sellingPrice !== '' && (!Number.isFinite(Number(values.sellingPrice)) || Number(values.sellingPrice) < 0)) {
      nextErrors.sellingPrice = 'Enter a valid selling price of zero or more.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSave({
      ...item,
      id: item?.id ?? `item-${crypto.randomUUID()}`,
      name: values.name.trim(),
      sku: values.sku.trim() || `SKU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      category: values.category.trim(),
      type: values.type,
      unit: values.unit,
      quantity: Number(values.quantity),
      costPerUnit: values.costPerUnit === '' ? undefined : Number(values.costPerUnit),
      ...(values.sellingPrice === '' ? { sellingPrice: undefined } : { sellingPrice: Number(values.sellingPrice) }),
      ...(values.sellingPrice === '' ? { sellingPriceCurrencyCode: undefined } : { sellingPriceCurrencyCode }),
      currencyCode: costCurrencyCode,
      reorderLevel: Number(values.reorderLevel),
      supplier: values.supplier.trim(),
      metadata: {
        ...(showFoodFields ? {
          ingredients: values.ingredients.trim(),
          productionDate: values.productionDate,
          expiryDate: values.expiryDate,
        } : {}),
        ...(showArtFields ? { size: values.size.trim(), medium: values.medium.trim() } : {}),
        ...(showCraftFields ? { material: values.material.trim(), productionStatus: values.productionStatus } : {}),
        ...(businessCategory === 'supermarket' ? { expiryDate: values.expiryDate } : {}),
        ...(showFlexibleDetails ? { details: values.details.trim() } : {}),
      },
      initials: item?.initials ?? (values.type === 'Raw Material' ? '📦' : '🧁'),
      tone: item?.tone ?? 'wheat',
    })
  }

  return (
    <Modal
      title={item ? 'Edit item' : 'Add an item'}
      description={item ? 'Update product details. Quantity changes are recorded in inventory history.' : 'Add a product to this browser-local inventory.'}
      onClose={onClose}
    >
      <form className="management-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="Product name *" error={errors.name}>
            <input autoFocus name="name" value={values.name} onChange={change} placeholder={({
              'home-foods': 'e.g. Homemade banana bread',
              'pencil-arts': 'e.g. Pencil sketch portrait',
              'clays-handicrafts': 'e.g. Hand-painted clay pot',
              'kids-toys': 'e.g. Wooden toy car',
              supermarket: 'e.g. Basmati rice',
              'all-businesses': 'e.g. A product you make or sell',
            })[businessCategory]} />
          </Field>
          <Field label={businessCategory === 'supermarket' ? 'SKU *' : 'SKU (optional)'} error={errors.sku}>
            <input name="sku" value={values.sku} onChange={change} placeholder={businessCategory === 'supermarket' ? 'e.g. SNK-007' : 'Generated if left blank'} />
          </Field>
          <Field label="Category *" error={errors.category}>
            <input name="category" value={values.category} onChange={change} placeholder="e.g. Baking essentials" />
          </Field>
          <Field label="Type *" error={errors.type}>
            <select name="type" value={values.type} onChange={change}>
              {ITEM_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Unit *" error={errors.unit}>
            <select name="unit" value={values.unit} onChange={change}>
              {availableUnits.map((unit) => <option key={unit}>{unit}</option>)}
            </select>
          </Field>
          <Field label={item ? 'Available quantity *' : 'Opening stock *'} error={errors.quantity}>
            <input type="number" min="0" step="any" name="quantity" value={values.quantity} onChange={change} placeholder="0" />
          </Field>
          <Field label={`Unit cost (${currency}, optional)`} error={errors.costPerUnit}>
            <input type="number" min="0" step="any" name="costPerUnit" value={values.costPerUnit} onChange={change} placeholder="Leave blank if unknown" />
          </Field>
          <Field label={`Selling price (${currency}, optional)`} error={errors.sellingPrice}>
            <input type="number" min="0" step="any" name="sellingPrice" value={values.sellingPrice} onChange={change} placeholder="Not set" />
          </Field>
          <Field label="Reorder level *" error={errors.reorderLevel}>
            <input type="number" min="0" step="any" name="reorderLevel" value={values.reorderLevel} onChange={change} placeholder="0" />
          </Field>
          <Field label="Supplier (optional)" className="form-field-full">
            <input name="supplier" value={values.supplier} onChange={change} placeholder="e.g. Mill & Grain Co." />
          </Field>
          {showFoodFields && <>
            <Field label="Ingredients (optional)" className="form-field-full"><textarea name="ingredients" rows="2" value={values.ingredients} onChange={change} placeholder="e.g. flour, butter, cocoa" /></Field>
            <Field label="Production date (optional)"><input type="date" name="productionDate" value={values.productionDate} onChange={change} /></Field>
          </>}
          {showExpiryField && <Field label="Expiry date (optional)"><input type="date" name="expiryDate" value={values.expiryDate} onChange={change} /></Field>}
          {showArtFields && <>
            <Field label="Artwork size (optional)"><input name="size" value={values.size} onChange={change} placeholder="e.g. A4" /></Field>
            <Field label="Medium (optional)"><input name="medium" value={values.medium} onChange={change} placeholder="e.g. graphite and charcoal" /></Field>
          </>}
          {showCraftFields && <>
            <Field label="Primary material (optional)"><input name="material" value={values.material} onChange={change} placeholder="e.g. air-dry clay" /></Field>
            <Field label="Production status"><select name="productionStatus" value={values.productionStatus} onChange={change}><option>Planned</option><option>In progress</option><option>Ready</option></select></Field>
          </>}
          {showFlexibleDetails && <Field label="Extra details (optional)" className="form-field-full"><textarea name="details" rows="2" value={values.details} onChange={change} placeholder="Add details that matter to your business" /></Field>}
        </div>
        {item && item.currencyCode && item.currencyCode !== currency && <div className="form-demo-note">This existing amount is recorded as {item.currencyCode}. It is shown as {currency} without conversion; changing the cost value records it in {currency}.</div>}
        <div className="form-demo-note">Unit cost is optional; leave it blank when unknown. Data is saved only in this browser when local storage is available.</div>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit">{item ? 'Save changes' : 'Add item'}</button>
        </div>
      </form>
    </Modal>
  )
}

function StockMovementForm({ type, items, reservations, initialItemId, onSave, onClose }) {
  const { currency, formatNumber } = useCurrency()
  const [values, setValues] = useState({
    itemId: initialItemId ?? items[0]?.id ?? '',
    quantity: '',
    date: new Date().toISOString().slice(0, 10),
    supplier: '',
    cost: '',
    reason: type === 'Stock Out' ? STOCK_OUT_REASONS[0] : '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const selectedItem = items.find((item) => item.id === values.itemId)
  const available = selectedItem ? Math.max(0, selectedItem.quantity - (reservations[selectedItem.id] ?? 0)) : 0

  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    const quantity = Number(values.quantity)
    if (!selectedItem) nextErrors.itemId = 'Choose an item.'
    if (values.quantity === '' || !Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = 'Enter a quantity greater than zero.'
    if (!values.date) nextErrors.date = 'Choose a transaction date.'
    if (type === 'Stock In' && (values.cost === '' || !Number.isFinite(Number(values.cost)) || Number(values.cost) < 0)) {
      nextErrors.cost = 'Enter a valid cost of zero or more.'
    }
    if (type === 'Stock Out' && !STOCK_OUT_REASONS.includes(values.reason)) nextErrors.reason = 'Choose a reason.'
    if (type === 'Stock Out' && selectedItem && quantity > available) {
      nextErrors.quantity = `Only ${formatNumber(available, { maximumFractionDigits: 2 })} ${selectedItem.unit} unreserved stock available.`
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onSave({
      item: selectedItem,
      quantity,
      unit: selectedItem.unit,
      date: values.date,
      supplier: values.supplier.trim(),
      cost: type === 'Stock In' ? Number(values.cost) : selectedItem.costPerUnit,
      currencyCode: currency,
      reason: type === 'Stock In' ? 'Received' : values.reason,
      notes: values.notes.trim(),
    })
  }

  return (
    <Modal
      title={type}
      description={type === 'Stock In' ? 'Record received goods and update the available balance.' : 'Record sold, used, damaged, or otherwise removed stock.'}
      onClose={onClose}
    >
      <form className="management-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="Item *" error={errors.itemId} className="form-field-full">
            <select name="itemId" value={values.itemId} onChange={change}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatNumber(Math.max(0, item.quantity - (reservations[item.id] ?? 0)), { maximumFractionDigits: 2 })} {item.unit} available</option>)}
            </select>
          </Field>
          <Field label={type === 'Stock In' ? 'Quantity received *' : 'Quantity removed *'} error={errors.quantity}>
            <input type="number" min="0" step="any" name="quantity" value={values.quantity} onChange={change} placeholder="0" />
          </Field>
          <Field label="Date *" error={errors.date}>
            <input type="date" name="date" value={values.date} onChange={change} />
          </Field>
          {type === 'Stock In' ? (
            <>
              <Field label="Supplier">
                <input name="supplier" value={values.supplier} onChange={change} placeholder={selectedItem?.supplier || 'Supplier name'} />
              </Field>
              <Field label={`Cost per unit (${currency}) *`} error={errors.cost}>
                <input type="number" min="0" step="any" name="cost" value={values.cost} onChange={change} placeholder={selectedItem && Number.isFinite(selectedItem.costPerUnit) ? formatNumber(selectedItem.costPerUnit, { maximumFractionDigits: 2 }) : 'Enter received unit cost'} />
              </Field>
            </>
          ) : (
            <Field label="Reason *" error={errors.reason} className="form-field-full">
              <select name="reason" value={values.reason} onChange={change}>
                {STOCK_OUT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </Field>
          )}
          <Field label="Notes (optional)" className="form-field-full">
            <textarea name="notes" rows="3" value={values.notes} onChange={change} placeholder="Add a note about this movement" />
          </Field>
        </div>
        {selectedItem && <div className="stock-balance-hint">Current balance: <strong>{formatNumber(selectedItem.quantity, { maximumFractionDigits: 2 })} {selectedItem.unit}</strong>{(reservations[selectedItem.id] ?? 0) > 0 && <> · Reserved: <strong>{formatNumber(reservations[selectedItem.id], { maximumFractionDigits: 2 })} {selectedItem.unit}</strong> · Unreserved: <strong>{formatNumber(available, { maximumFractionDigits: 2 })} {selectedItem.unit}</strong></>}</div>}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit">{type === 'Stock In' ? 'Record stock in' : 'Record stock out'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ItemDetails({ item, onClose, onEdit, onMovement }) {
  const { formatMoney, currency, formatNumber } = useCurrency()
  const isOut = item.quantity <= 0
  const isLow = !isOut && item.quantity <= item.reorderLevel
  return (
    <Modal title="Item details" description={`Inventory record for ${item.sku}.`} onClose={onClose}>
      <div className="item-details">
        <div className="details-title">
          <span className={`item-thumb ${item.tone}`}>{item.initials}</span>
          <div><h3>{item.name}</h3><span>{item.category} · {item.type}</span></div>
        </div>
        <div className="details-grid">
          <div><span>SKU</span><strong>{item.sku}</strong></div>
          <div><span>Available quantity</span><strong>{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}</strong></div>
          <div><span>Cost per unit · display {currency}</span><strong>{Number.isFinite(item.costPerUnit) ? formatMoney(item.costPerUnit) : 'Not recorded'}</strong>{item.currencyCode && item.currencyCode !== currency && <small className="table-secondary">Recorded as {item.currencyCode}; not converted</small>}</div>
          {item.sellingPrice != null && <div><span>Selling price · display {currency}</span><strong>{formatMoney(item.sellingPrice)}</strong>{item.sellingPriceCurrencyCode && item.sellingPriceCurrencyCode !== currency && <small className="table-secondary">Recorded as {item.sellingPriceCurrencyCode}; not converted</small>}</div>}
          <div><span>Reorder level</span><strong>{formatNumber(item.reorderLevel, { maximumFractionDigits: 2 })} {item.unit}</strong></div>
          <div><span>Stock status</span><strong className={isLow || isOut ? 'details-low' : 'details-ok'}>{isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}</strong></div>
          <div><span>Record source</span><strong>{item.dataSource === 'demo' ? 'Sample demo data' : 'Entered in this browser'}</strong></div>
          <div><span>Supplier</span><strong>{item.supplier || 'Not specified'}</strong></div>
          {Object.entries(item.metadata ?? {}).filter(([, value]) => value).map(([key, value]) => <div key={key}><span>{({
            ingredients: 'Ingredients',
            productionDate: 'Production date',
            expiryDate: 'Expiry date',
            size: 'Size',
            medium: 'Medium',
            material: 'Material',
            productionStatus: 'Production status',
            details: 'Extra details',
          })[key] ?? key}</span><strong>{value}</strong></div>)}
        </div>
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
          <button className="secondary-button" type="button" onClick={() => onMovement('Stock Out')}>Stock out</button>
          <button className="primary-button" type="button" onClick={onEdit}>Edit item</button>
        </div>
      </div>
    </Modal>
  )
}

function StockStatus({ item }) {
  const out = item.quantity <= 0
  const low = !out && item.quantity <= item.reorderLevel
  return <span className={`status-pill ${low || out ? 'critical' : 'in-stock'} inventory-status`}><span />{out ? 'Out of stock' : low ? 'Low stock' : 'In stock'}</span>
}

function ItemTable({ items, onAction }) {
  const { formatMoney, currency, formatNumber } = useCurrency()
  return (
    <div className="table-wrap inventory-table-wrap">
      <table className="inventory-table">
        <thead><tr>
          <th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>TYPE</th><th>AVAILABLE</th><th>COST / UNIT</th><th>SELL PRICE</th><th>REORDER</th><th>STATUS</th><th>ACTIONS</th>
        </tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><div className="item-cell"><span className={`item-thumb ${item.tone}`}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.dataSource === 'demo' ? 'Demo example' : 'User-entered'}{item.supplier ? ` · ${item.supplier}` : ''}</small></span></div></td>
              <td><span className="sku-value">{item.sku}</span></td>
              <td>{item.category}</td>
              <td><span className={`type-badge ${item.type === 'Finished Product' ? 'finished' : ''}`}>{item.type}</span></td>
              <td><strong>{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}</strong></td>
              <td title={`Recorded as ${item.currencyCode ?? 'unknown'}; displayed as ${currency} without exchange-rate conversion.`}>{Number.isFinite(item.costPerUnit) ? formatMoney(item.costPerUnit) : 'Not recorded'}{item.currencyCode && item.currencyCode !== currency && <small className="table-secondary">Recorded {item.currencyCode}</small>}</td>
              <td title={item.sellingPrice == null ? undefined : `Recorded as ${item.sellingPriceCurrencyCode ?? item.currencyCode ?? 'USD'}; displayed as ${currency} without exchange-rate conversion.`}>{item.sellingPrice == null ? '—' : formatMoney(item.sellingPrice)}{item.sellingPriceCurrencyCode && item.sellingPriceCurrencyCode !== currency && <small className="table-secondary">Recorded {item.sellingPriceCurrencyCode}</small>}</td>
              <td>{formatNumber(item.reorderLevel, { maximumFractionDigits: 2 })} {item.unit}</td>
              <td><StockStatus item={item} /></td>
              <td>
                <div className="row-actions">
                  <button type="button" onClick={() => onAction('view', item)} aria-label={`View ${item.name}`}>View</button>
                  <button type="button" onClick={() => onAction('edit', item)} aria-label={`Edit ${item.name}`}>Edit</button>
                  <button className="delete-action" type="button" onClick={() => onAction('delete', item)} aria-label={`Delete ${item.name}`}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {!items.length && <tr><td className="empty-state" colSpan="10">No items match those search and filter choices.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function ItemsPage({ items, search, onSearchChange, onAction, onAdd, businessCategory }) {
  const [typeFilter, setTypeFilter] = useState('All types')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [stockFilter, setStockFilter] = useState('All stock')
  const [sortBy, setSortBy] = useState('name')
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items])
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.sku} ${item.category} ${item.type} ${item.supplier}`.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'All types' || item.type === typeFilter
    const matchesCategory = categoryFilter === 'All categories' || item.category === categoryFilter
    const matchesStock = stockFilter === 'All stock'
      || (stockFilter === 'Low stock' ? item.quantity > 0 && item.quantity <= item.reorderLevel
        : stockFilter === 'Out of stock' ? item.quantity <= 0 : item.quantity > item.reorderLevel)
    return matchesSearch && matchesType && matchesCategory && matchesStock
  }).sort((a, b) => {
    if (sortBy === 'quantity') return a.quantity - b.quantity || a.name.localeCompare(b.name)
    if (sortBy === 'low-stock') return Number(b.quantity <= b.reorderLevel) - Number(a.quantity <= a.reorderLevel) || a.name.localeCompare(b.name)
    if (sortBy === 'sku') return a.sku.localeCompare(b.sku)
    if (sortBy === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  }), [items, search, typeFilter, categoryFilter, stockFilter, sortBy])

  return (
    <section className="page-content management-page">
      <div className="page-title-row">
        <div><div className="eyebrow">YOUR PRODUCT CATALOG</div><h1>Items</h1><p className="welcome-subtitle">Manage materials, finished products, resale goods, and supplies.</p></div>
        <button type="button" className="primary-button" onClick={onAdd}>＋ Add item</button>
      </div>
      <div className="demo-banner"><span>LOCAL DATA</span> Opening examples are marked “Demo example”; items you add are marked “User-entered”. Changes save in this browser when available, but do not sync to other devices.</div>
      <div className="management-stats">
        <div><span>All items</span><strong>{items.length}</strong></div>
        <div><span>Raw materials</span><strong>{items.filter((item) => item.type === 'Raw Material').length}</strong></div>
        <div><span>Finished / resale</span><strong>{items.filter((item) => item.type === 'Finished Product' || item.type === 'Resale Product').length}</strong></div>
        <div><span>Low stock</span><strong className="metric-alert">{items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel).length}</strong></div>
        <div><span>Out of stock</span><strong className="metric-alert">{items.filter((item) => item.quantity <= 0).length}</strong></div>
      </div>
      <article className="panel management-panel">
        <div className="management-toolbar">
          <div><h2>All items</h2><p>{filteredItems.length} of {items.length} products</p></div>
          <div className="filter-controls">
            <label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search items" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search items..." /></label>
            <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All types</option>{ITEM_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
            <select aria-label="Filter by stock status" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option>All stock</option><option>Low stock</option><option>Out of stock</option><option>In stock</option></select>
            <select aria-label="Sort items" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Sort: name</option><option value="sku">Sort: SKU</option><option value="category">Sort: category</option><option value="quantity">Sort: quantity</option><option value="low-stock">Sort: low stock first</option></select>
          </div>
        </div>
        <ItemTable items={filteredItems} onAction={onAction} />
        {!items.length && <div className="business-empty-state"><CategoryIllustration category={businessCategory} /><strong>Your inventory is ready to begin</strong><span>Add your first product to start tracking stock.</span></div>}
        <div className="table-footer">Showing <strong>{filteredItems.length}</strong> of {items.length} items <span>Demo examples and user-entered records</span></div>
      </article>
    </section>
  )
}

function TransactionTable({ transactions }) {
  const { formatNumber, formatDate } = useCurrency()
  return (
    <div className="table-wrap inventory-table-wrap">
      <table className="transaction-table">
        <thead><tr><th>DATE</th><th>ITEM</th><th>TRANSACTION</th><th>QUANTITY</th><th>REASON / NOTES</th><th>RESULTING BALANCE</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{formatDate(new Date(transaction.createdAt ?? `${transaction.date}T00:00:00`), { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
              <td><strong>{transaction.itemName}</strong><small className="table-secondary">{transaction.sku}</small></td>
              <td><span className={`transaction-badge ${['Stock In', 'Opening stock', 'Production output'].includes(transaction.type) ? 'in' : ['Stock Out', 'Production usage', 'Order dispatch'].includes(transaction.type) ? 'out' : 'adjustment'}`}>{transaction.type}</span></td>
              <td className={['Stock Out', 'Production usage', 'Order dispatch'].includes(transaction.type) ? 'quantity-negative' : 'quantity-positive'}>{['Stock Out', 'Production usage', 'Order dispatch'].includes(transaction.type) ? '−' : '+'}{formatNumber(transaction.quantity, { maximumFractionDigits: 2 })}</td>
              <td>{transaction.reason}{transaction.notes && <small className="table-secondary">{transaction.notes}</small>}</td>
              <td><strong>{formatNumber(transaction.balance, { maximumFractionDigits: 2 })}</strong> {transaction.unit}</td>
            </tr>
          ))}
          {!transactions.length && <tr><td className="empty-state" colSpan="6">No transactions have been recorded yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function InventoryPage({ items, transactions, reservations = {}, onMovement, businessCategory }) {
  const { formatNumber } = useCurrency()
  const [movementType, setMovementType] = useState('')
  const lowItems = items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel)
  const outItems = items.filter((item) => item.quantity <= 0)
  return (
    <section className="page-content management-page">
      <div className="page-title-row">
        <div><div className="eyebrow">STOCK CONTROL</div><h1>Inventory</h1><p className="welcome-subtitle">Track stock movements and keep every balance up to date.</p></div>
        <div className="page-button-group">
          <button type="button" className="secondary-button" onClick={() => setMovementType('Stock Out')}>− Stock out</button>
          <button type="button" className="primary-button" onClick={() => setMovementType('Stock In')}>＋ Stock in</button>
        </div>
      </div>
      <div className="demo-banner"><span>LOCAL DATA</span> Every recorded movement updates balances and history saved in this browser when available. This is not a secure database or a cross-device sync.</div>
      <div className="management-stats inventory-summary">
        <div><span>Tracked products</span><strong>{items.length}</strong></div>
        <div><span>Low-stock alerts</span><strong className={lowItems.length ? 'metric-alert' : ''}>{lowItems.length}</strong></div>
        <div><span>Out of stock</span><strong className={outItems.length ? 'metric-alert' : ''}>{outItems.length}</strong></div>
        <div><span>Transactions recorded</span><strong>{transactions.length}</strong></div>
        <div><span>Measurement units</span><strong>{new Set(items.map((item) => item.unit)).size}</strong></div>
      </div>
      <article className="panel management-panel alerts-panel">
        <div className="management-toolbar">
          <div><h2>Stock alerts</h2><p>Out-of-stock items and items at or below their configured reorder level.</p></div>
          <span className="alert-count">{lowItems.length + outItems.length}</span>
        </div>
        {!items.length ? (
          <div className="business-empty-state"><CategoryIllustration category={businessCategory} /><strong>Your inventory is ready to begin</strong><span>Add a product to start tracking stock and movements.</span></div>
        ) : lowItems.length || outItems.length ? (
          <div className="low-alert-list">
            {[...outItems, ...lowItems].map((item) => <div className="low-alert-row" key={item.id}>
              <span className={`item-thumb ${item.tone}`}>{item.initials}</span>
              <span className="alert-item-copy"><strong>{item.name}</strong><small>{item.sku} · Reorder at {formatNumber(item.reorderLevel, { maximumFractionDigits: 2 })} {item.unit}</small></span>
              <span className="alert-quantity">{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}<small>available</small></span>
              <span className="status-pill critical inventory-status"><span />{item.quantity <= 0 ? 'Out of stock' : 'Low stock'}</span>
            </div>)}
          </div>
        ) : <p className="all-stock-good">Everything is above its reorder level.</p>}
      </article>
      <article className="panel management-panel history-panel">
        <div className="management-toolbar">
          <div><h2>Inventory history</h2><p>Every balance change is listed here, newest first.</p></div>
          <span className="history-count">{transactions.length} transactions</span>
        </div>
        <TransactionTable transactions={transactions} />
        <div className="table-footer"><span>Stock movement history · Browser-local data</span></div>
      </article>
      {movementType && <StockMovementForm type={movementType} items={items} reservations={reservations} onClose={() => setMovementType('')} onSave={(movement) => {
        onMovement(movementType, movement)
        setMovementType('')
      }} />}
    </section>
  )
}

export function ItemFormModal({ item, items, businessCategory, onSave, onClose }) {
  return <ItemForm item={item} items={items} businessCategory={businessCategory} onSave={onSave} onClose={onClose} />
}

export function ItemDetailsModal({ item, onClose, onEdit, onMovement }) {
  return <ItemDetails item={item} onClose={onClose} onEdit={onEdit} onMovement={onMovement} />
}

export function StockMovementModal({ type, items, reservations = {}, initialItemId, onSave, onClose }) {
  return <StockMovementForm type={type} items={items} reservations={reservations} initialItemId={initialItemId} onSave={onSave} onClose={onClose} />
}

export function SimulatorPage({ items, recipes, reservations = {}, businessCategory }) {
  const { formatMoney, formatNumber, currency } = useCurrency()
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [extraDemand, setExtraDemand] = useState('0')
  const item = items.find((candidate) => candidate.id === itemId)
  const projected = item ? item.quantity - Math.max(0, Number(extraDemand) || 0) : 0
  const lowStockCount = items.filter((candidate) => candidate.quantity <= candidate.reorderLevel).length
  const projectedLow = item && projected <= item.reorderLevel
  const projectedValue = item && Number.isFinite(item.costPerUnit) ? Math.max(0, projected) * item.costPerUnit : null
  const [productId, setProductId] = useState(items.find((candidate) => candidate.type === 'Finished Product')?.id ?? '')
  const [orderQuantity, setOrderQuantity] = useState('1')
  const productRequirements = useMemo(
    () => calculateOrderRequirements([{ productId, quantity: Number(orderQuantity) || 0 }], recipes, items),
    [productId, orderQuantity, recipes, items],
  )
  const materialCostsAvailable = productRequirements.length > 0 && productRequirements.every((requirement) => {
    const material = items.find((candidate) => candidate.id === requirement.materialId)
    return material && Number.isFinite(material.costPerUnit) && material.currencyCode === currency
  })
  const unitIssues = useMemo(
    () => getRecipeUnitIssues([{ productId, quantity: Number(orderQuantity) || 0 }], recipes, items),
    [productId, orderQuantity, recipes, items],
  )
  const productShortages = getRequirementShortages(productRequirements, items, reservations)
  const selectedProduct = items.find((candidate) => candidate.id === productId)
  const hasRecipe = Boolean(recipes[productId]?.length)
  const validQuantity = Number.isFinite(Number(orderQuantity)) && Number(orderQuantity) > 0
  const canFulfill = hasRecipe && validQuantity && productShortages.length === 0 && unitIssues.length === 0

  return (
    <section className="page-content management-page simulator-page">
      <div className="page-title-row">
        <div><div className="eyebrow">YOUR SECRET WEAPON</div><h1>What If? Simulator</h1><p className="welcome-subtitle">Try a stock scenario using your current browser-local inventory.</p></div>
      </div>
      <div className="demo-banner"><span>DEMO SIMULATION</span> Scenarios do not change your inventory. Actual inventory changes appear here automatically.</div>
      <div className="simulator-page-grid">
        <article className="panel scenario-panel">
          <div className="simulator-category-heading"><div className="management-toolbar"><div><h2>Plan for a busy day</h2><p>See how extra demand could affect a product&apos;s stock.</p></div></div><CategoryIllustration category={businessCategory} /></div>
          <div className="scenario-form">
            <Field label="Choose an item">
              <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
                {items.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({formatNumber(candidate.quantity, { maximumFractionDigits: 2 })} {candidate.unit})</option>)}
              </select>
            </Field>
            <Field label="What if demand increases by...">
              <div className="demand-input-wrap"><input type="number" min="0" step="any" value={extraDemand} onChange={(event) => setExtraDemand(event.target.value)} /><span>{item?.unit ?? 'units'}</span></div>
            </Field>
          </div>
          {item && <div className="scenario-result">
            <div><span>Current stock</span><strong>{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}</strong></div>
            <div><span>After extra demand</span><strong className={projectedLow ? 'metric-alert' : ''}>{formatNumber(projected, { maximumFractionDigits: 2 })} {item.unit}</strong></div>
            <div><span>Reorder level</span><strong>{formatNumber(item.reorderLevel, { maximumFractionDigits: 2 })} {item.unit}</strong></div>
            <div><span>Estimated remaining value</span><strong>{projectedValue === null ? 'Cost not recorded' : formatMoney(projectedValue, item.currencyCode)}</strong></div>
            <div className={`scenario-verdict${projectedLow ? ' warning' : ''}`}>{projectedLow ? `This scenario puts ${item.name} at or below its reorder level.` : 'This item stays above its reorder level in this scenario.'}</div>
          </div>}
        </article>
        <aside className="simulator-summary">
          <span className="summary-star">✦</span>
          <span className="tip-eyebrow">CURRENT INVENTORY SNAPSHOT</span>
          <strong>{items.length} products</strong>
          <p>{lowStockCount} currently at or below their reorder level.</p>
          <div className="simulator-summary-foot">Snapshot reflects your latest Stock In and Stock Out records.</div>
        </aside>
      </div>
      <article className="panel management-panel simulator-recipe-panel">
        <div className="management-toolbar"><div><h2>What if you receive this order?</h2><p>Estimate recipe materials and shortages without changing stock or creating an order.</p></div></div>
        <div className="scenario-form simulator-order-form">
          <Field label="Finished product">
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {items.filter((candidate) => candidate.type === 'Finished Product').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </Field>
          <Field label="Order quantity">
            <input type="number" min="1" step="any" value={orderQuantity} onChange={(event) => setOrderQuantity(event.target.value)} />
          </Field>
        </div>
        <div className="simulator-material-result">
          {!selectedProduct && <p className="order-muted">Add a finished product to use this simulator.</p>}
          {selectedProduct && !hasRecipe && <p className="recipe-warning">No recipe is saved for {selectedProduct.name}; add one in Recipes to calculate material needs.</p>}
          {unitIssues.map((issue) => <p className="recipe-warning" key={issue}>{issue}</p>)}
          {productRequirements.map((requirement) => {
            const stock = items.find((candidate) => candidate.id === requirement.materialId)
            const available = stock ? Math.max(0, stock.quantity - (reservations[stock.id] ?? 0)) : 0
            const shortage = productShortages.find((entry) => entry.materialId === requirement.materialId)
            const remaining = available - requirement.quantity
            return <div className="requirement-row" key={requirement.materialId}><span>{requirement.materialName}</span><strong>{formatNumber(requirement.quantity, { maximumFractionDigits: 2 })} {requirement.unit} required</strong><small>{formatNumber(available, { maximumFractionDigits: 2 })} {stock?.unit ?? ''} available · {formatNumber(remaining, { maximumFractionDigits: 2 })} {stock?.unit ?? ''} remaining{shortage ? ` · short ${formatNumber(shortage.shortage, { maximumFractionDigits: 2 })} ${shortage.unit}` : ''}</small></div>
          })}
          {productRequirements.length > 0 && <div className="simulator-cost-estimate"><span>Estimated material cost</span><strong>{materialCostsAvailable ? formatMoney(productRequirements.reduce((total, requirement) => total + requirement.quantity * items.find((candidate) => candidate.id === requirement.materialId).costPerUnit, 0)) : 'Not available'}</strong><small>{materialCostsAvailable ? 'All material costs are recorded in the selected currency.' : 'One or more material costs are missing or recorded in a different currency; no conversion is applied.'}</small></div>}
          {selectedProduct && hasRecipe && validQuantity && (canFulfill
            ? <p className="recipe-success">This proposal can be fulfilled with current available materials. Stock is unchanged.</p>
            : <p className="recipe-warning">This proposal cannot be fulfilled with current available materials. Stock is unchanged.</p>)}
          <p className="simulator-no-side-effects">Simulation only · no stock movement or order is created.</p>
        </div>
      </article>
    </section>
  )
}
