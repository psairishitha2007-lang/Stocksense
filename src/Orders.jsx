import { useMemo, useState } from 'react'
import { calculateOrderRequirements, convertQuantity, getRecipeUnitIssues, getRequirementShortages, ORDER_STATUSES, RECIPE_UNITS } from './orderData.js'
import { isRecipeMaterial } from './inventoryData.js'
import { useCurrency } from './currencyContext.js'
import { CategoryIllustration } from './CategoryBranding.jsx'

const displayDate = (date, locale) => date
  ? new Date(`${date}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

function Overlay({ children, title, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`management-modal order-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
        <header className="modal-heading">
          <div><h2 id="order-modal-title">{title}</h2></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function OrderForm({ order, items, recipes, reservations, onSave, onClose }) {
  const { formatNumber } = useCurrency()
  const [customer, setCustomer] = useState(order?.customer ?? '')
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(order?.deliveryDate ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [lines, setLines] = useState(order?.lines?.length ? order.lines : [{ productId: '', quantity: '1' }])
  const [error, setError] = useState('')
  const finishedProducts = items.filter((item) => item.type === 'Finished Product')
  const requirements = calculateOrderRequirements(lines.map((line) => ({ ...line, quantity: Number(line.quantity) || 0 })), recipes, items)
  const hasMissingRecipe = lines.some((line) => line.productId && !(recipes[line.productId]?.length))
  const unitIssues = getRecipeUnitIssues(lines, recipes, items)
  const shortages = getRequirementShortages(requirements, items, reservations)

  function changeLine(index, key, value) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line))
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    if (!customer.trim() || !orderDate || !deliveryDate || !lines.length) {
      setError('Customer, order date, delivery date, and at least one product are required.')
      return
    }
    if (deliveryDate < orderDate) {
      setError('Delivery date must be on or after the order date.')
      return
    }
    if (lines.some((line) => !finishedProducts.some((product) => product.id === line.productId) || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
      setError('Select a finished product and enter a quantity greater than zero for every line.')
      return
    }
    onSave({
      ...(order ?? {}),
      customer: customer.trim(),
      orderDate,
      deliveryDate,
      notes: notes.trim(),
      lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
    })
  }

  return (
    <Overlay title={order ? `Edit proposed order ${order.id}` : 'Create proposed order'} onClose={onClose} wide>
      <form className="management-form" onSubmit={submit} noValidate>
        <div className="proposed-callout"><strong>PROPOSED · NOT CONFIRMED</strong><span>Saving this order will not reserve or deduct stock. Review the material estimate, then confirm it from the order details.</span></div>
        <div className="form-grid">
          <label className="form-field"><span>Customer name *</span><input autoFocus value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer or business name" /></label>
          <label className="form-field"><span>Order date *</span><input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></label>
          <label className="form-field form-field-full"><span>Delivery date *</span><input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
        </div>
        <div className="order-lines-heading"><strong>Products and quantities</strong><button type="button" className="text-link" onClick={() => setLines((current) => [...current, { productId: '', quantity: '1' }])}>＋ Add product</button></div>
        <div className="order-line-editor">
          {lines.map((line, index) => (
            <div className="order-line-edit" key={`line-${index}`}>
              <label className="form-field"><span>Finished product *</span><select value={line.productId} onChange={(event) => changeLine(index, 'productId', event.target.value)}><option value="">Choose a product</option>{finishedProducts.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>)}</select></label>
              <label className="form-field"><span>Quantity *</span><input type="number" min="0" step="any" value={line.quantity} onChange={(event) => changeLine(index, 'quantity', event.target.value)} /></label>
              {lines.length > 1 && <button type="button" className="remove-line-button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove product line ${index + 1}`}>×</button>}
            </div>
          ))}
        </div>
        <label className="form-field order-notes-field"><span>Notes (optional)</span><textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery instructions or order notes" /></label>
        <div className="requirements-preview">
          <div className="requirements-heading"><strong>Material estimate</strong><span>Calculated from saved recipes; no stock changes yet.</span></div>
          {hasMissingRecipe && <p className="recipe-warning">One or more finished products need a saved recipe before this order can be confirmed.</p>}
          {unitIssues.map((issue) => <p className="recipe-warning" key={issue}>{issue}</p>)}
          {!requirements.length && !hasMissingRecipe && <p className="order-muted">Add products to calculate their material requirements.</p>}
          {requirements.map((requirement) => {
            const material = items.find((item) => item.id === requirement.materialId)
            return <div className="requirement-row" key={requirement.materialId}><span>{requirement.materialName}</span><strong>{formatNumber(requirement.quantity, { maximumFractionDigits: 3 })} {requirement.unit}</strong><small>{formatNumber(material?.quantity ?? 0, { maximumFractionDigits: 3 })} {material?.unit ?? ''} on hand</small></div>
          })}
          {shortages.length > 0 && <p className="recipe-warning">{shortages.length} ingredient shortage{shortages.length > 1 ? 's' : ''} found. This proposal can still be saved, but cannot be confirmed yet.</p>}
          {!hasMissingRecipe && requirements.length > 0 && shortages.length === 0 && <p className="recipe-success">Current stock covers this estimate. Confirmation will reserve the listed ingredients.</p>}
        </div>
        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{order ? 'Save proposal' : 'Save proposed order'}</button></div>
      </form>
    </Overlay>
  )
}

function RequirementList({ order, items, recipes, reservations }) {
  const { formatNumber } = useCurrency()
  const lines = order.lines.map((line) => ({ ...line, quantity: Number(line.quantity) }))
  const requirements = order.requirements?.length ? order.requirements : calculateOrderRequirements(lines, recipes, items)
  const otherReservations = { ...reservations }
  if (order.confirmed && !order.productionRecorded && order.status !== 'Cancelled') {
    for (const requirement of order.requirements ?? []) {
      otherReservations[requirement.materialId] = Math.max(0, (otherReservations[requirement.materialId] ?? 0) - requirement.quantity)
    }
  }
  const shortages = getRequirementShortages(requirements, items, otherReservations)
  const missingRecipe = lines.some((line) => !recipes[line.productId]?.length) && !order.requirements?.length
  const recipeIssues = getRecipeUnitIssues(lines, recipes, items)
  return (
    <div className="requirements-preview order-detail-requirements">
      <div className="requirements-heading"><strong>Raw material requirements</strong><span>{order.status === 'Cancelled' ? 'Any reservation was released on cancellation' : order.confirmed ? (order.productionRecorded ? 'Materials issued to production' : 'Reserved for this confirmed order') : 'Estimate only · not reserved'}</span></div>
      {missingRecipe && <p className="recipe-warning">A saved recipe is required for every product before confirmation.</p>}
      {recipeIssues.map((issue) => <p className="recipe-warning" key={issue}>{issue}</p>)}
      {requirements.map((requirement) => {
        const material = items.find((item) => item.id === requirement.materialId)
        const shortage = shortages.find((item) => item.materialId === requirement.materialId)
        return <div className="requirement-row" key={requirement.materialId}><span>{requirement.materialName}</span><strong>{formatNumber(requirement.quantity, { maximumFractionDigits: 3 })} {requirement.unit}</strong><small>{formatNumber(material?.quantity ?? 0, { maximumFractionDigits: 3 })} {material?.unit ?? ''} on hand{shortage ? ` · short ${formatNumber(shortage.shortage, { maximumFractionDigits: 3 })} ${shortage.unit}` : ''}</small></div>
      })}
      {requirements.length === 0 && !missingRecipe && <p className="order-muted">No material requirements are defined for this order.</p>}
      {shortages.length > 0 && <p className="recipe-warning">{shortages.length} raw material shortage{shortages.length > 1 ? 's' : ''} at current available stock.</p>}
      {!missingRecipe && requirements.length > 0 && !shortages.length && <p className="recipe-success">{order.confirmed ? 'Material reservation is covered.' : 'Materials are currently available.'}</p>}
    </div>
  )
}

function OrderDetails({ order, items, recipes, reservations, onClose, onEdit, onConfirm, onStart, onProduce, onComplete, onCancel }) {
  const { formatNumber, locale } = useCurrency()
  const orderRequirements = order.requirements?.length ? order.requirements : calculateOrderRequirements(order.lines, recipes, items)
  const otherReservations = { ...reservations }
  if (order.confirmed && !order.productionRecorded && order.status !== 'Cancelled') {
    for (const requirement of order.requirements ?? []) {
      otherReservations[requirement.materialId] = Math.max(0, (otherReservations[requirement.materialId] ?? 0) - requirement.quantity)
    }
  }
  const shortages = getRequirementShortages(orderRequirements, items, otherReservations)
  const noRecipe = order.lines.some((line) => !recipes[line.productId]?.length) && !order.requirements?.length
  const recipeIssues = getRecipeUnitIssues(order.lines, recipes, items)
  const canConfirm = !order.confirmed && order.status === 'Pending' && !noRecipe && !recipeIssues.length && !shortages.length
  const products = order.lines.map((line) => {
    const item = items.find((candidate) => candidate.id === line.productId)
    return { item, quantity: line.quantity }
  })
  return (
    <Overlay title={`Order ${order.id}`} onClose={onClose} wide>
      <div className="order-details-content">
        <div className="order-detail-summary">
          <div><span>Customer</span><strong>{order.customer}</strong></div>
          <div><span>Status</span><strong><span className={`order-status-pill ${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span></strong></div>
          <div><span>Order date</span><strong>{displayDate(order.orderDate, locale)}</strong></div>
          <div><span>Delivery date</span><strong>{displayDate(order.deliveryDate, locale)}</strong></div>
        </div>
        <div className="order-detail-products">
          <h3>Products</h3>
          {products.map(({ item, quantity }, index) => <div className="order-product-row" key={`${order.id}-${index}`}><span>{item?.name ?? 'Product removed'} <small>{item?.sku}</small></span><strong>{formatNumber(quantity, { maximumFractionDigits: 3 })} {item?.unit ?? ''}</strong></div>)}
          {order.notes && <p className="order-note">Note: {order.notes}</p>}
        </div>
        <RequirementList order={order} items={items} recipes={recipes} reservations={reservations} />
        <div className="order-flow-note">
          <strong>Stock change history</strong>
          <span>{order.status === 'Cancelled' ? 'This order was cancelled. Any reservation was released; no further stock changes will occur.' : order.confirmed ? (order.productionRecorded ? 'Raw materials were deducted once at production; finished goods were added.' : 'Materials are reserved, not deducted. Production has not been recorded.') : 'This proposal has not reserved or changed inventory.'}</span>
          {order.dispatched && <span>Finished products were deducted once when this order was completed.</span>}
        </div>
        <div className="form-actions order-detail-actions">
          {!order.confirmed && order.status === 'Pending' && <button type="button" className="secondary-button" onClick={onEdit}>Edit proposal</button>}
          {order.status !== 'Cancelled' && order.status !== 'Completed' && !order.productionRecorded && <button type="button" className="secondary-button danger-button" onClick={onCancel}>Cancel order</button>}
          {canConfirm && <button type="button" className="primary-button" onClick={onConfirm}>Confirm &amp; reserve materials</button>}
          {order.confirmed && order.status === 'Pending' && <button type="button" className="primary-button" onClick={onStart}>Start production</button>}
          {order.status === 'In Progress' && !order.productionRecorded && <button type="button" className="primary-button" onClick={onProduce}>Record production</button>}
          {order.status === 'Ready' && !order.dispatched && <button type="button" className="primary-button" onClick={onComplete}>Complete &amp; dispatch</button>}
        </div>
        {!canConfirm && !order.confirmed && order.status === 'Pending' && <p className="order-action-help">Confirmation requires valid saved recipes and enough unreserved raw materials.</p>}
      </div>
    </Overlay>
  )
}

function ProductionForm({ order, items, onSave, onClose }) {
  const { formatNumber } = useCurrency()
  const [actualUsage, setActualUsage] = useState(() => (order.requirements ?? []).map((requirement) => ({
    materialId: requirement.materialId,
    quantity: String(requirement.quantity),
  })))
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!actualUsage.length) {
      setError('This order has no saved material requirements. Add recipes before production.')
      return
    }
    if (actualUsage.some((usage) => usage.quantity === '' || !Number.isFinite(Number(usage.quantity)) || Number(usage.quantity) < 0)) {
      setError('Enter a valid actual quantity of zero or more for every raw material.')
      return
    }
    onSave(actualUsage.map((usage) => ({ materialId: usage.materialId, quantity: Number(usage.quantity) })))
  }

  return (
    <Overlay title={`Record production · ${order.id}`} onClose={onClose}>
      <form className="management-form" onSubmit={submit} noValidate>
        <p className="recipe-intro">Confirm the actual raw materials used. The reserved estimate is prefilled; change quantities to match production.</p>
        <div className="production-usage-list">
          {(order.requirements ?? []).map((requirement, index) => {
            const material = items.find((item) => item.id === requirement.materialId)
            return <label className="production-usage-row" key={requirement.materialId}>
              <span><strong>{material?.name ?? requirement.materialName}</strong><small>Planned: {formatNumber(requirement.quantity, { maximumFractionDigits: 3 })} {material?.unit ?? requirement.unit}</small></span>
              <input aria-label={`Actual ${material?.name ?? requirement.materialName} used`} type="number" min="0" step="any" value={actualUsage[index]?.quantity ?? ''} onChange={(event) => setActualUsage((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry))} />
              <small>{material?.unit ?? requirement.unit}</small>
            </label>
          })}
        </div>
        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="form-demo-note">Recording production deducts these actual quantities once, releases any unused reservation, and adds the ordered finished goods.</div>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Record actual usage</button></div>
      </form>
    </Overlay>
  )
}

function OrderStatus({ status }) {
  return <span className={`order-status-pill ${status.toLowerCase().replace(' ', '-')}`}>{status}</span>
}

export function OrdersPage({ orders, items, recipes, reservations, onCreate, onUpdate, onConfirm, onCancel, onStart, onProduce, onComplete, businessCategory }) {
  const { formatNumber, locale } = useCurrency()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [dialog, setDialog] = useState(null)
  const filtered = useMemo(() => orders.filter((order) => {
    const productsText = order.lines.map((line) => items.find((item) => item.id === line.productId)?.name ?? '').join(' ')
    const matches = `${order.id} ${order.customer} ${productsText} ${order.status}`.toLowerCase().includes(search.toLowerCase())
    return matches && (statusFilter === 'All statuses' || order.status === statusFilter)
  }), [orders, items, search, statusFilter])

  function openDetails(order) {
    setDialog({ type: 'details', order })
  }

  function orderAction(action, order) {
    setDialog(null)
    if (action === 'edit') setDialog({ type: 'edit', order })
    if (action === 'confirm') onConfirm(order)
    if (action === 'cancel') onCancel(order)
    if (action === 'start') onStart(order)
    if (action === 'produce') onProduce(order)
    if (action === 'complete') onComplete(order)
  }

  return (
    <section className="page-content management-page orders-page">
      <div className="page-title-row">
        <div><div className="eyebrow">CUSTOMER FULFILMENT</div><h1>Customer orders</h1><p className="welcome-subtitle">Build proposals, check ingredients, then confirm and fulfil each order.</p></div>
        <button className="primary-button" type="button" onClick={() => setDialog({ type: 'create' })}>＋ Create order</button>
      </div>
      <div className="demo-banner"><span>DEMO DATA</span> New orders are proposals until confirmed. Confirmed materials are reserved; stock changes only when production or dispatch is recorded.</div>
      <div className="management-stats">
        <div><span>Total orders</span><strong>{orders.length}</strong></div>
        <div><span>Proposed</span><strong>{orders.filter((order) => !order.confirmed && order.status === 'Pending').length}</strong></div>
        <div><span>In progress</span><strong>{orders.filter((order) => order.status === 'In Progress').length}</strong></div>
        <div><span>Ready to dispatch</span><strong>{orders.filter((order) => order.status === 'Ready').length}</strong></div>
      </div>
      <article className="panel management-panel">
        <div className="management-toolbar order-toolbar">
          <div><h2>All customer orders</h2><p>{filtered.length} of {orders.length} orders</p></div>
          <div className="filter-controls">
            <label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, product..." /></label>
            <select aria-label="Filter orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          </div>
        </div>
        <div className="table-wrap inventory-table-wrap">
          <table className="orders-table">
            <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PRODUCTS</th><th>ORDER DATE</th><th>DELIVERY</th><th>STATUS</th><th>TYPE</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filtered.map((order) => {
                const products = order.lines.map((line) => `${items.find((item) => item.id === line.productId)?.name ?? 'Removed product'} × ${formatNumber(line.quantity, { maximumFractionDigits: 3 })}`).join(', ')
                return <tr key={order.id}>
                  <td><strong>{order.id}</strong></td><td>{order.customer}</td>
                  <td className="order-product-list">{products}</td>
                  <td>{displayDate(order.orderDate, locale)}</td><td>{displayDate(order.deliveryDate, locale)}</td>
                  <td><OrderStatus status={order.status} /></td>
                  <td><span className={`confirmation-tag ${order.status === 'Cancelled' ? 'cancelled' : order.confirmed ? 'confirmed' : 'proposed'}`}>{order.status === 'Cancelled' ? 'Cancelled' : order.confirmed ? 'Confirmed' : 'Proposed'}</span></td>
                  <td><div className="row-actions"><button type="button" onClick={() => openDetails(order)} aria-label={`View order ${order.id}`}>View</button>{!order.confirmed && order.status === 'Pending' && <button type="button" onClick={() => setDialog({ type: 'edit', order })} aria-label={`Edit order ${order.id}`}>Edit</button>}</div></td>
                </tr>
              })}
              {!filtered.length && <tr><td className="empty-state" colSpan="8">No orders match those search and filter choices.</td></tr>}
            </tbody>
          </table>
        </div>
        {!orders.length && <div className="business-empty-state"><CategoryIllustration category={businessCategory} /><strong>No orders yet</strong><span>Your first customer order will appear here.</span></div>}
        <div className="table-footer">Showing <strong>{filtered.length}</strong> of {orders.length} orders <span>Demo order workflow</span></div>
      </article>

      {dialog?.type === 'create' && <OrderForm items={items} recipes={recipes} reservations={reservations} onClose={() => setDialog(null)} onSave={(data) => { onCreate(data); setDialog(null) }} />}
      {dialog?.type === 'edit' && <OrderForm order={dialog.order} items={items} recipes={recipes} reservations={reservations} onClose={() => setDialog(null)} onSave={(data) => { onUpdate(dialog.order, data); setDialog(null) }} />}
      {dialog?.type === 'details' && <OrderDetails order={orders.find((order) => order.id === dialog.order.id) ?? dialog.order} items={items} recipes={recipes} reservations={reservations} onClose={() => setDialog(null)} onEdit={() => orderAction('edit', dialog.order)} onConfirm={() => orderAction('confirm', dialog.order)} onStart={() => orderAction('start', dialog.order)} onProduce={() => setDialog({ type: 'production', order: dialog.order })} onComplete={() => orderAction('complete', dialog.order)} onCancel={() => orderAction('cancel', dialog.order)} />}
      {dialog?.type === 'production' && <ProductionForm order={dialog.order} items={items} onClose={() => setDialog(null)} onSave={(actualUsage) => { onProduce(dialog.order, actualUsage); setDialog(null) }} />}
    </section>
  )
}

function RecipeEditor({ product, items, initialRecipe, onSave, onClose }) {
  const rawMaterials = items.filter(isRecipeMaterial)
  const [components, setComponents] = useState(initialRecipe?.length
    ? initialRecipe.map((component) => ({ ...component, quantity: String(component.quantity) }))
    : [])
  const [error, setError] = useState('')

  function patchComponent(index, key, value) {
    setComponents((current) => current.map((component, componentIndex) => componentIndex === index ? { ...component, [key]: value } : component))
    setError('')
  }

  function addComponent() {
    const material = rawMaterials.find((candidate) => !components.some((component) => component.materialId === candidate.id))
    if (!material) {
      setError('Every available recipe material or supply is already in this recipe.')
      return
    }
    const unit = RECIPE_UNITS.includes(material.unit) ? material.unit : 'pieces'
    setComponents((current) => [...current, { id: `recipe-${crypto.randomUUID()}`, materialId: material.id, quantity: '1', unit }])
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    if (!components.length) {
      setError('Add at least one material or packaging component.')
      return
    }
    if (components.some((component) => !rawMaterials.some((material) => material.id === component.materialId) || !Number.isFinite(Number(component.quantity)) || Number(component.quantity) <= 0 || !RECIPE_UNITS.includes(component.unit))) {
      setError('Choose a valid material or supply and enter a quantity greater than zero for each component.')
      return
    }
    const uniqueMaterials = new Set(components.map((component) => component.materialId))
    if (uniqueMaterials.size !== components.length) {
      setError('A raw material can only appear once in a recipe.')
      return
    }
    for (const component of components) {
      const material = rawMaterials.find((candidate) => candidate.id === component.materialId)
      if (convertQuantity(1, component.unit, material.unit) === null) {
        setError(`${material.name} is stocked in ${material.unit}; choose a compatible recipe unit.`)
        return
      }
    }
    onSave(components.map((component) => ({ ...component, quantity: Number(component.quantity) })))
  }

  return (
    <Overlay title={`Recipe · ${product.name}`} onClose={onClose}>
      <form className="management-form" onSubmit={submit} noValidate>
        <p className="recipe-intro">Enter the quantity of each material or packaging supply needed to make one {product.unit === 'pieces' ? 'unit' : product.unit} of this finished product.</p>
        <div className="recipe-editor-list">
          {components.map((component, index) => {
            const material = rawMaterials.find((candidate) => candidate.id === component.materialId)
            const validUnits = RECIPE_UNITS.filter((unit) => material && convertQuantity(1, unit, material.unit) !== null)
            return <div className="recipe-edit-row" key={component.id ?? index}>
              <label className="form-field"><span>Material / supply *</span><select value={component.materialId} onChange={(event) => {
                const candidate = rawMaterials.find((entry) => entry.id === event.target.value)
                setComponents((current) => current.map((entry, entryIndex) => entryIndex === index
                  ? { ...entry, materialId: event.target.value, unit: candidate && convertQuantity(1, entry.unit, candidate.unit) !== null ? entry.unit : candidate?.unit ?? entry.unit }
                  : entry))
                setError('')
              }}><option value="">Choose material</option>{rawMaterials.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.unit}</option>)}</select></label>
              <label className="form-field"><span>Qty per unit *</span><input type="number" min="0" step="any" value={component.quantity} onChange={(event) => patchComponent(index, 'quantity', event.target.value)} /></label>
              <label className="form-field"><span>Unit *</span><select value={component.unit} onChange={(event) => patchComponent(index, 'unit', event.target.value)}>{validUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
              <button type="button" className="remove-line-button" onClick={() => setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))} aria-label={`Remove ${material?.name ?? 'material'} from recipe`}>×</button>
            </div>
          })}
        </div>
        <button type="button" className="secondary-button add-component-button" onClick={addComponent}>＋ Add material / supply</button>
        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="form-demo-note">Recipe edits affect new order estimates and What If? simulations. Confirmed orders keep their saved material requirements.</div>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save recipe</button></div>
      </form>
    </Overlay>
  )
}

export function RecipesPage({ items, recipes, onSave, onDelete }) {
  const { formatNumber } = useCurrency()
  const [editing, setEditing] = useState(null)
  const products = items.filter((item) => item.type === 'Finished Product')
  return (
    <section className="page-content management-page recipes-page">
      <div className="page-title-row">
        <div><div className="eyebrow">PRODUCTION PLANNING</div><h1>Recipes &amp; materials</h1><p className="welcome-subtitle">Define the ingredients needed for one unit of each finished product.</p></div>
      </div>
      <div className="demo-banner"><span>LOCAL DATA</span> Recipes are saved in this browser when available. Mass and volume convert within their own families; other units must match exactly.</div>
      <div className="recipe-cards">
        {products.map((product) => {
          const components = recipes[product.id] ?? []
          return <article className="panel recipe-card" key={product.id}>
            <div className="recipe-card-head"><span className={`item-thumb ${product.tone}`}>{product.initials}</span><div><h2>{product.name}</h2><p>{product.sku} · {product.category}</p></div>{components.length > 0 && <button type="button" className="row-action danger-button" onClick={() => { if (window.confirm(`Delete the recipe for ${product.name}? Existing confirmed orders will keep their saved requirements.`)) onDelete(product.id) }}>Delete recipe</button>}<button type="button" className="secondary-button" onClick={() => setEditing(product)}>{components.length ? 'Edit recipe' : 'Add recipe'}</button></div>
            <div className="recipe-card-body">
              {components.length ? components.map((component) => {
                const material = items.find((item) => item.id === component.materialId)
                return <div className="recipe-component-row" key={component.id}><span>{material?.name ?? 'Missing raw material'}</span><strong>{formatNumber(component.quantity, { maximumFractionDigits: 3 })} {component.unit}</strong><small>per {product.unit === 'pieces' ? 'unit' : product.unit}</small></div>
              }) : <p className="order-muted">No recipe saved yet. Orders using this product cannot be confirmed.</p>}
            </div>
          </article>
        })}
        {!products.length && <article className="panel empty-recipe-card">Add a finished product on the Items page to define a recipe.</article>}
      </div>
      {editing && <RecipeEditor product={editing} items={items} initialRecipe={recipes[editing.id]} onClose={() => setEditing(null)} onSave={(components) => { onSave(editing.id, components); setEditing(null) }} />}
    </section>
  )
}
