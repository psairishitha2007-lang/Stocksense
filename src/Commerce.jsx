import { useMemo, useRef, useState } from 'react'
import { useCurrency } from './currencyContext.js'
import {
  getDateRangeStart,
  PURCHASE_ORDER_STATUSES,
  SALES_ORDER_STATUSES,
} from './commerceData.js'

const today = () => new Date().toISOString().slice(0, 10)
const dateLabel = (date, locale) => date
  ? new Date(`${date}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

function Dialog({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className={`management-modal commerce-dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-heading">
          <h2>{title}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Money({ amount, currency }) {
  const { formatMoney } = useCurrency()
  return <>{formatMoney(amount, currency)}</>
}

function SalesOrderForm({ order, orders, items, currency, onSave, onClose }) {
  const { formatMoney, formatNumber } = useCurrency()
  const nextNumber = Math.max(1000, ...orders.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1
  const [customer, setCustomer] = useState(order?.customer ?? '')
  const [phone, setPhone] = useState(order?.phone ?? '')
  const [email, setEmail] = useState(order?.email ?? '')
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? today())
  const [lines, setLines] = useState(order?.lines?.length
    ? order.lines.map((line) => ({ ...line, quantity: String(line.quantity), unitPrice: String(line.unitPrice) }))
    : [{ itemId: '', quantity: '1', unitPrice: '' }])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const sellableItems = items.filter((item) => ['Finished Product', 'Resale Product'].includes(item.type))
  const orderNumber = order?.id ?? `SO-${nextNumber}`
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0)

  function patchLine(index, key, value) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line))
    setError('')
  }

  function chooseItem(index, itemId) {
    const item = sellableItems.find((entry) => entry.id === itemId)
    const itemPriceCurrency = item?.sellingPriceCurrencyCode ?? item?.currencyCode
    setLines((current) => current.map((line, lineIndex) => lineIndex === index
      ? { ...line, itemId, unitPrice: item?.sellingPrice == null || itemPriceCurrency !== (order?.currencyCode ?? currency) ? '' : String(item.sellingPrice) }
      : line))
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!customer.trim() || !orderDate || !lines.length) {
      setError('Customer name, order date, and at least one product are required.')
      return
    }
    if (lines.some((line) => !sellableItems.some((item) => item.id === line.itemId)
      || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0
      || line.unitPrice === '' || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0)) {
      setError('Choose an available product and enter a positive quantity and valid unit price for each line.')
      return
    }
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      setError('Add each product only once; combine its quantity on that line.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    const saved = onSave({
      ...order,
      id: orderNumber,
      customer: customer.trim(),
      phone: phone.trim(),
      email: email.trim(),
      orderDate,
      currencyCode: order?.currencyCode ?? currency,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    }, setError)
    if (saved === false) {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog title={order ? `Edit ${order.id}` : 'Create customer order'} onClose={onClose} wide>
      <form className="management-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="form-field"><span>Order number</span><input value={orderNumber} readOnly /></label>
          <label className="form-field"><span>Order date *</span><input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required /></label>
          <label className="form-field"><span>Customer name *</span><input autoFocus value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer or business name" /></label>
          <label className="form-field"><span>Phone</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contact number" /></label>
          <label className="form-field form-field-full"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        </div>
        <div className="commerce-lines-heading"><strong>Products and quantities</strong><button type="button" className="text-link" onClick={() => setLines((current) => [...current, { itemId: '', quantity: '1', unitPrice: '' }])}>＋ Add product</button></div>
        <div className="commerce-line-editor">
          {lines.map((line, index) => {
            const product = sellableItems.find((item) => item.id === line.itemId)
            return <div className="commerce-line" key={`sale-line-${index}`}>
              <label className="form-field"><span>Product *</span><select value={line.itemId} onChange={(event) => chooseItem(index, event.target.value)}><option value="">Choose product</option>{sellableItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
              <label className="form-field"><span>Quantity *</span><input type="number" min="0" step="any" value={line.quantity} onChange={(event) => patchLine(index, 'quantity', event.target.value)} /></label>
              <label className="form-field"><span>Unit price ({order?.currencyCode ?? currency}) *</span><input type="number" min="0" step="any" value={line.unitPrice} onChange={(event) => patchLine(index, 'unitPrice', event.target.value)} /></label>
              <div className="commerce-line-total"><span>Line total</span><strong>{formatMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), order?.currencyCode ?? currency)}</strong><small>{product ? `${formatNumber(Number(line.quantity) || 0, { maximumFractionDigits: 3 })} ${product.unit}` : '—'}</small></div>
              {lines.length > 1 && <button type="button" className="remove-line-button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove product line ${index + 1}`}>×</button>}
              {product && (product.sellingPriceCurrencyCode ?? product.currencyCode) !== (order?.currencyCode ?? currency) && <p className="commerce-help commerce-line-currency-note">Product price is recorded in {product.sellingPriceCurrencyCode ?? product.currencyCode}. Enter an order price in {order?.currencyCode ?? currency}; no conversion is applied.</p>}
            </div>
          })}
        </div>
        <div className="commerce-total"><span>Order total · {order?.currencyCode ?? currency}</span><strong>{formatMoney(total, order?.currencyCode ?? currency)}</strong></div>
        <p className="commerce-help">Stock is deducted only when the order is marked Completed. Pending and Confirmed orders do not reserve stock.</p>
        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="submit" disabled={isSubmitting}>{order ? 'Save changes' : 'Create order'}</button></div>
      </form>
    </Dialog>
  )
}

function SalesOrderDetails({ order, items, onClose, onEdit, onStatusChange, onDelete }) {
  const { formatMoney, formatNumber, locale } = useCurrency()
  const [error, setError] = useState('')
  const total = order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  function changeStatus(status) {
    const success = onStatusChange({ ...order, status })
    if (!success) setError('The inventory could not be updated for this status. Check available stock and try again.')
    else setError('')
  }
  return (
    <Dialog title={`Order ${order.id}`} onClose={onClose} wide>
      <div className="commerce-details">
        <div className="commerce-summary-grid">
          <div><span>Customer</span><strong>{order.customer}</strong></div>
          <div><span>Status</span><strong><span className={`commerce-status ${order.status.toLowerCase()}`}>{order.status}</span></strong></div>
          <div><span>Order date</span><strong>{dateLabel(order.orderDate, locale)}</strong></div>
          <div><span>Contact</span><strong>{order.phone || order.email || 'Not provided'}</strong></div>
        </div>
        {order.email && <p className="commerce-muted">Email: {order.email}</p>}
        <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>QTY</th><th>UNIT PRICE</th><th>LINE TOTAL</th></tr></thead>
          <tbody>{order.lines.map((line) => {
            const item = items.find((candidate) => candidate.id === line.itemId)
            return <tr key={line.itemId}><td>{item?.name ?? 'Removed product'}</td><td>{formatNumber(line.quantity, { maximumFractionDigits: 3 })} {item?.unit}</td><td><Money amount={line.unitPrice} currency={order.currencyCode} /></td><td><Money amount={line.quantity * line.unitPrice} currency={order.currencyCode} /></td></tr>
          })}</tbody>
        </table></div>
        <div className="commerce-total"><span>Order total · {order.currencyCode}</span><strong>{formatMoney(total, order.currencyCode)}</strong></div>
        <p className="commerce-help">{order.status === 'Completed'
          ? 'This order has deducted its item quantities from stock. Cancelling it will restore those quantities.'
          : order.status === 'Cancelled'
            ? 'This order is cancelled. Stock was restored only if it had previously been deducted.'
            : 'No stock has been deducted. Stock changes only when this order is marked Completed.'}</p>
        {error && <p className="form-error-message" role="alert">{error}</p>}
        <div className="form-actions commerce-actions">
          {order.status !== 'Cancelled' && <button className="secondary-button" type="button" onClick={onEdit}>Edit order</button>}
          {SALES_ORDER_STATUSES.filter((status) => status !== order.status).map((status) => <button className={status === 'Cancelled' ? 'secondary-button danger-button' : 'secondary-button'} type="button" key={status} onClick={() => changeStatus(status)}>{status === 'Completed' ? 'Complete order' : `Set ${status}`}</button>)}
          {order.status === 'Cancelled' && <button className="secondary-button danger-button" type="button" onClick={onDelete}>Delete cancelled order</button>}
          <button className="secondary-button" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </Dialog>
  )
}

function QuickSaleForm({ items, currency, onSave, onClose }) {
  const { formatMoney, formatNumber } = useCurrency()
  const saleableItems = items.filter((item) => ['Finished Product', 'Resale Product'].includes(item.type) && item.quantity > 0)
  const [itemId, setItemId] = useState(saleableItems[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState(() => {
    const item = saleableItems[0]
    return item?.sellingPrice != null && (item.sellingPriceCurrencyCode ?? item.currencyCode) === currency
      ? String(item.sellingPrice) : ''
  })
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const item = saleableItems.find((entry) => entry.id === itemId)
  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0)

  function chooseItem(nextId) {
    const nextItem = saleableItems.find((entry) => entry.id === nextId)
    const priceCurrency = nextItem?.sellingPriceCurrencyCode ?? nextItem?.currencyCode
    setItemId(nextId)
    setUnitPrice(nextItem?.sellingPrice != null && priceCurrency === currency ? String(nextItem.sellingPrice) : '')
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!item || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0
      || !Number.isFinite(Number(unitPrice)) || unitPrice === '' || Number(unitPrice) < 0) {
      setError('Choose an in-stock product, enter a positive quantity, and enter its unit price.')
      return
    }
    submitting.current = true
    const order = {
      id: `QS-${crypto.randomUUID()}`,
      customer: 'Walk-in customer',
      phone: '',
      email: '',
      orderDate: today(),
      currencyCode: currency,
      status: 'Completed',
      lines: [{ itemId, quantity: Number(quantity), unitPrice: Number(unitPrice) }],
      source: 'Quick sale',
    }
    if (onSave(order)) onClose()
    else {
      submitting.current = false
      setError('The sale was not recorded. Check available stock and try again.')
    }
  }

  return <Dialog title="Record a sale" onClose={onClose}>
    <form className="management-form" onSubmit={submit} noValidate>
      {saleableItems.length ? <>
        <label className="form-field"><span>Product *</span><select value={itemId} onChange={(event) => chooseItem(event.target.value)}>{saleableItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatNumber(entry.quantity, { maximumFractionDigits: 3 })} {entry.unit} available</option>)}</select></label>
        <div className="form-grid">
          <label className="form-field"><span>Quantity sold *</span><input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <label className="form-field"><span>Unit price ({currency}) *</span><input type="number" min="0" step="any" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label>
        </div>
        {item && <div className="stock-balance-hint">Available now: <strong>{formatNumber(item.quantity, { maximumFractionDigits: 3 })} {item.unit}</strong> · Sale total: <strong>{formatMoney(total, currency)}</strong></div>}
        {item && item.sellingPrice != null && (item.sellingPriceCurrencyCode ?? item.currencyCode) !== currency && <p className="commerce-help">This product price is recorded in {item.sellingPriceCurrencyCode ?? item.currencyCode}. Enter the amount for this sale in {currency}; no conversion is applied.</p>}
      </> : <p className="commerce-empty-note">No in-stock finished or resale products are available to sell.</p>}
      <p className="commerce-help">This creates a completed sales order. Stock is deducted immediately through the same order and report records used by the sales page.</p>
      {error && <p className="form-error-message" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={!saleableItems.length}>Record sale</button></div>
    </form>
  </Dialog>
}

export function SalesOrdersPage({ orders, items, currency, onSave, onDelete }) {
  const { formatNumber, locale } = useCurrency()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [dialog, setDialog] = useState(null)
  const filtered = useMemo(() => orders.filter((order) => {
    const productNames = order.lines.map((line) => items.find((item) => item.id === line.itemId)?.name ?? '').join(' ')
    return `${order.id} ${order.customer} ${order.phone} ${order.email} ${productNames}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === 'All statuses' || order.status === statusFilter)
  }), [items, orders, search, statusFilter])
  const completed = orders.filter((order) => order.status === 'Completed')

  return <section className="page-content management-page commerce-page">
    <div className="page-title-row"><div><div className="eyebrow">CUSTOMER FULFILMENT</div><h1>Sales orders</h1><p className="welcome-subtitle">Record customer orders and fulfill them against available inventory.</p></div><div className="sales-page-actions"><button className="secondary-button" type="button" onClick={() => setDialog({ type: 'quick-sale' })}>Record a sale</button><button className="primary-button" type="button" onClick={() => setDialog({ type: 'create' })}>＋ Create order</button></div></div>
    <div className="demo-banner"><span>LOCAL DATA</span> Orders are stored in this browser when available. Stock is deducted on Completed, restored on Cancelled only after deduction, and never deducted twice.</div>
    <div className="management-stats"><div><span>Total orders</span><strong>{orders.length}</strong></div><div><span>Pending</span><strong>{orders.filter((order) => order.status === 'Pending').length}</strong></div><div><span>Completed</span><strong>{completed.length}</strong></div><div><span>Recorded sales revenue</span><strong className="commerce-stat-money"><CurrencyTotals totals={sumByCurrency(completed, (order) => order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), (order) => order.currencyCode)} /></strong></div></div>
    <article className="panel management-panel"><div className="management-toolbar"><div><h2>All sales orders</h2><p>{filtered.length} of {orders.length} orders</p></div><div className="filter-controls"><label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search sales orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, product..." /></label><select aria-label="Filter sales orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{SALES_ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div></div>
      <div className="table-wrap inventory-table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER & CONTACT</th><th>PRODUCTS</th><th>DATE</th><th>TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
        {filtered.map((order) => <tr key={order.id}><td><strong>{order.id}</strong></td><td>{order.customer}<small className="commerce-table-sub">{order.phone || order.email || 'No contact details'}</small></td><td>{order.lines.map((line) => `${items.find((item) => item.id === line.itemId)?.name ?? 'Removed product'} × ${formatNumber(line.quantity, { maximumFractionDigits: 3 })}`).join(', ')}</td><td>{dateLabel(order.orderDate, locale)}</td><td><Money amount={order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)} currency={order.currencyCode} /></td><td><span className={`commerce-status ${order.status.toLowerCase()}`}>{order.status}</span></td><td><button className="row-action" type="button" onClick={() => setDialog({ type: 'details', order })}>View</button></td></tr>)}
        {!filtered.length && <tr><td className="empty-state" colSpan="7">{orders.length ? 'No sales orders match those search and filter choices.' : 'No customer orders yet. Create one to start recording sales.'}</td></tr>}
      </tbody></table></div>
    </article>
    {dialog?.type === 'create' && <SalesOrderForm orders={orders} items={items} currency={currency} onClose={() => setDialog(null)} onSave={(order, setError) => { const saved = onSave(order); if (saved) setDialog(null); else setError('The order was not saved because inventory could not be reconciled.'); return saved }} />}
    {dialog?.type === 'quick-sale' && <QuickSaleForm items={items} currency={currency} onClose={() => setDialog(null)} onSave={onSave} />}
    {dialog?.type === 'edit' && <SalesOrderForm order={dialog.order} orders={orders} items={items} currency={currency} onClose={() => setDialog(null)} onSave={(order, setError) => { const saved = onSave(order); if (saved) setDialog({ type: 'details', order }); else setError('The order was not saved because inventory could not be reconciled.'); return saved }} />}
    {dialog?.type === 'details' && <SalesOrderDetails order={orders.find((entry) => entry.id === dialog.order.id) ?? dialog.order} items={items} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: 'edit', order: orders.find((entry) => entry.id === dialog.order.id) ?? dialog.order })} onStatusChange={onSave} onDelete={() => { onDelete(orders.find((entry) => entry.id === dialog.order.id) ?? dialog.order); setDialog(null) }} />}
  </section>
}

function SupplierForm({ supplier, onSave, onClose }) {
  const [values, setValues] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', notes: supplier?.notes ?? '' })
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    if (!values.name.trim()) {
      setError('Enter a supplier name.')
      return
    }
    onSave({ ...supplier, ...values, name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim(), notes: values.notes.trim() }, setError)
  }
  return <Dialog title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
    <form className="management-form" onSubmit={submit} noValidate>
      <label className="form-field"><span>Supplier name *</span><input autoFocus value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
      <label className="form-field"><span>Phone</span><input type="tel" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} /></label>
      <label className="form-field"><span>Email</span><input type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label>
      <label className="form-field"><span>Notes</span><textarea rows="3" value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></label>
      {error && <p className="form-error-message" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="submit">Save supplier</button></div>
    </form>
  </Dialog>
}

function PurchaseOrderForm({ order, orders, suppliers, items, currency, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? '')
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? today())
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ?? '')
  const [status, setStatus] = useState(order?.status ?? 'Draft')
  const [lines, setLines] = useState(order?.lines?.length
    ? order.lines.map((line) => ({ ...line, quantity: String(line.quantity), unitCost: String(line.unitCost) }))
    : [{ itemId: '', quantity: '1', unitCost: '' }])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const nextId = Math.max(1000, ...orders.map((entry) => Number(entry.id.replace(/\D/g, '')) || 0)) + 1
  const orderId = order?.id ?? `PO-${nextId}`
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0)

  function patchLine(index, key, value) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line))
    setError('')
  }
  function chooseItem(index, itemId) {
    const item = items.find((entry) => entry.id === itemId)
    const itemCostCurrency = item?.currencyCode
    setLines((current) => current.map((line, lineIndex) => lineIndex === index
      ? { ...line, itemId, unitCost: item && itemCostCurrency === (order?.currencyCode ?? currency) ? String(item.costPerUnit ?? '') : '' }
      : line))
    setError('')
  }
  function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    if (!supplierId || !suppliers.some((supplier) => supplier.id === supplierId) || !orderDate || !lines.length) {
      setError('Choose a supplier, order date, and at least one inventory item.')
      return
    }
    if (expectedDate && expectedDate < orderDate) {
      setError('Expected delivery must be on or after the order date.')
      return
    }
    if (lines.some((line) => !items.some((item) => item.id === line.itemId)
      || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0
      || line.unitCost === '' || !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0
      || Number(line.receivedQuantity ?? 0) > Number(line.quantity))) {
      setError('Choose a valid inventory item, enter a positive quantity and a valid unit cost, and keep ordered quantity at or above received quantity.')
      return
    }
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      setError('Add each inventory item only once; combine its quantity on that line.')
      return
    }
    if (lines.some((line) => Number(line.receivedQuantity ?? 0) > 0) && status === 'Draft') {
      setError('An order with received goods cannot be changed back to Draft.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    const saved = onSave({
      ...order,
      id: orderId,
      supplierId,
      orderDate,
      expectedDate,
      status,
      currencyCode: order?.currencyCode ?? currency,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost),
        unit: items.find((item) => item.id === line.itemId).unit,
        receivedQuantity: Number(line.receivedQuantity ?? 0),
      })),
    }, setError)
    if (saved === false) {
      submitting.current = false
      setIsSubmitting(false)
    }
  }
  return <Dialog title={order ? `Edit ${order.id}` : 'Create purchase order'} onClose={onClose} wide>
    <form className="management-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <label className="form-field"><span>Purchase order</span><input value={orderId} readOnly /></label>
        <label className="form-field"><span>Status</span>{lines.some((line) => Number(line.receivedQuantity ?? 0) > 0)
          ? <input value={status} readOnly />
          : <select value={status} onChange={(event) => setStatus(event.target.value)}><option>Draft</option><option>Ordered</option></select>}</label>
        <label className="form-field"><span>Supplier *</span><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="form-field"><span>Order date *</span><input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></label>
        <label className="form-field"><span>Expected delivery</span><input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></label>
      </div>
      <div className="commerce-lines-heading"><strong>Items to purchase</strong><button type="button" className="text-link" onClick={() => setLines((current) => [...current, { itemId: '', quantity: '1', unitCost: '', receivedQuantity: 0 }])}>＋ Add item</button></div>
      <div className="commerce-line-editor">{lines.map((line, index) => <div className="commerce-line purchase-line" key={`purchase-line-${index}`}>
        <label className="form-field"><span>Inventory item *</span><select value={line.itemId} onChange={(event) => chooseItem(index, event.target.value)}><option value="">Choose item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
        <label className="form-field"><span>Quantity ({items.find((item) => item.id === line.itemId)?.unit ?? 'unit'}) *</span><input type="number" min="0" step="any" value={line.quantity} onChange={(event) => patchLine(index, 'quantity', event.target.value)} /></label>
        <label className="form-field"><span>Unit cost ({order?.currencyCode ?? currency}) *</span><input type="number" min="0" step="any" value={line.unitCost} onChange={(event) => patchLine(index, 'unitCost', event.target.value)} />{items.find((item) => item.id === line.itemId)?.currencyCode && items.find((item) => item.id === line.itemId)?.currencyCode !== (order?.currencyCode ?? currency) && <small className="table-secondary">Item cost is recorded in {items.find((item) => item.id === line.itemId).currencyCode}; enter this purchase&apos;s cost in {order?.currencyCode ?? currency}.</small>}</label>
        <div className="commerce-line-total"><span>Received so far</span><strong>{line.receivedQuantity ?? 0}</strong><small>updated via Receive delivery</small></div>
        {lines.length > 1 && <button type="button" className="remove-line-button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove item line ${index + 1}`}>×</button>}
      </div>)}</div>
      <p className="commerce-total"><span>Order value · {order?.currencyCode ?? currency}</span><strong><Money amount={total} currency={order?.currencyCode ?? currency} /></strong></p>
      <p className="commerce-help">Creating or ordering a purchase does not change inventory. Stock increases only when a delivery is recorded.</p>
      {error && <p className="form-error-message" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="submit" disabled={isSubmitting}>Save purchase order</button></div>
    </form>
  </Dialog>
}

function ReceiveForm({ order, items, onSave, onClose }) {
  const [lines, setLines] = useState(order.lines.map((line) => ({ ...line, receivedQuantity: String(line.receivedQuantity ?? 0) })))
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    if (lines.some((line) => !Number.isFinite(Number(line.receivedQuantity)) || Number(line.receivedQuantity) < 0 || Number(line.receivedQuantity) > line.quantity)) {
      setError('Received quantities must be zero or more and cannot exceed the ordered quantity.')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    const saved = onSave({ ...order, lines: lines.map((line) => ({ ...line, receivedQuantity: Number(line.receivedQuantity) })) }, setError)
    if (saved === false) {
      submitting.current = false
      setIsSubmitting(false)
    }
  }
  return <Dialog title={`Receive delivery · ${order.id}`} onClose={onClose} wide>
    <form className="management-form" onSubmit={submit} noValidate>
      <p className="commerce-help">Enter the cumulative quantity received to date for each item. Only the increase since the previous delivery is added to stock.</p>
      {lines.map((line, index) => {
        const item = items.find((entry) => entry.id === line.itemId)
        return <div className="receive-line" key={line.itemId}>
          <div><strong>{item?.name ?? 'Removed item'}</strong><small>Ordered {line.quantity} {item?.unit ?? ''} · previously received {line.receivedQuantity ?? 0}</small></div>
          <label className="form-field"><span>Received to date</span><input aria-label={`${item?.name ?? 'Item'} received quantity`} type="number" min="0" max={line.quantity} step="any" value={line.receivedQuantity} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, receivedQuantity: event.target.value } : entry))} /></label>
        </div>
      })}
      {error && <p className="form-error-message" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Close</button><button className="primary-button" type="submit" disabled={isSubmitting}>Record quantities received</button></div>
    </form>
  </Dialog>
}

export function PurchasesPage({ suppliers, orders, items, currency, onSaveSupplier, onDeleteSupplier, onSaveOrder, onDeleteOrder }) {
  const { formatNumber, locale } = useCurrency()
  const [tab, setTab] = useState('orders')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')
  const filteredOrders = orders.filter((order) => {
    const supplier = suppliers.find((entry) => entry.id === order.supplierId)?.name ?? ''
    const itemNames = order.lines.map((line) => items.find((item) => item.id === line.itemId)?.name ?? '').join(' ')
    return `${order.id} ${supplier} ${itemNames}`.toLowerCase().includes(search.toLowerCase())
      && (statusFilter === 'All statuses' || order.status === statusFilter)
  })
  const outstandingCount = orders.filter((order) => ['Draft', 'Ordered', 'Partially Received'].includes(order.status)).length
  const committedTotals = sumByCurrency(orders.filter((order) => order.status !== 'Cancelled'), (order) => order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), (order) => order.currencyCode)

  function deleteSupplier(supplier) {
    if (orders.some((order) => order.supplierId === supplier.id)) {
      setNotice('This supplier is used by a purchase order and cannot be deleted.')
      return
    }
    if (window.confirm(`Delete ${supplier.name}?`)) onDeleteSupplier(supplier.id)
  }
  function deleteOrder(order) {
    if (order.lines.some((line) => Number(line.receivedQuantity ?? 0) > 0)) {
      setNotice('This order has received goods. Cancel it to reverse its stock receipts before deleting.')
      return
    }
    onDeleteOrder(order.id)
  }
  return <section className="page-content management-page commerce-page">
    <div className="page-title-row"><div><div className="eyebrow">REPLENISHMENT &amp; SUPPLIERS</div><h1>Purchases</h1><p className="welcome-subtitle">Manage supplier details, purchase orders, and actual deliveries.</p></div><button className="primary-button" type="button" onClick={() => setDialog({ type: tab === 'suppliers' ? 'supplier' : 'order' })}>{tab === 'suppliers' ? '＋ Add supplier' : '＋ Create purchase order'}</button></div>
    <div className="demo-banner"><span>LOCAL DATA</span> Purchase orders and receipts are stored in this browser when available. They do not represent supplier payments; stock changes only when received quantities are recorded.</div>
    {notice && <div className="commerce-inline-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
    <div className="management-stats"><div><span>Suppliers</span><strong>{suppliers.length}</strong></div><div><span>Outstanding orders</span><strong>{outstandingCount}</strong></div><div><span>Received purchase orders</span><strong>{orders.filter((order) => order.status === 'Received').length}</strong></div><div><span>Open order value</span><strong className="commerce-stat-money"><CurrencyTotals totals={committedTotals} /></strong></div></div>
    <div className="commerce-tabs" role="tablist" aria-label="Purchase management"><button type="button" role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Purchase orders</button><button type="button" role="tab" aria-selected={tab === 'suppliers'} className={tab === 'suppliers' ? 'active' : ''} onClick={() => setTab('suppliers')}>Suppliers</button></div>
    {tab === 'orders' ? <article className="panel management-panel"><div className="management-toolbar"><div><h2>Purchase orders</h2><p>{filteredOrders.length} of {orders.length} orders</p></div><div className="filter-controls"><label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search purchase orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, supplier, item..." /></label><select aria-label="Filter purchase orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{PURCHASE_ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div></div>
      <div className="table-wrap inventory-table-wrap"><table><thead><tr><th>ORDER</th><th>SUPPLIER</th><th>ORDER DATE</th><th>EXPECTED</th><th>RECEIVED</th><th>ORDER VALUE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
        {filteredOrders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong></td><td>{suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? 'Removed supplier'}</td><td>{dateLabel(order.orderDate, locale)}</td><td>{dateLabel(order.expectedDate, locale)}</td><td>{order.lines.reduce((sum, line) => sum + Number(line.receivedQuantity ?? 0), 0)} / {order.lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td><Money amount={order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)} currency={order.currencyCode} /></td><td><span className={`commerce-status ${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span></td><td><div className="row-actions"><button type="button" onClick={() => setDialog({ type: 'details', order })}>View</button>{order.status !== 'Cancelled' && order.status !== 'Received' && <button type="button" onClick={() => setDialog({ type: 'edit-order', order })}>Edit</button>}</div></td></tr>)}
        {!filteredOrders.length && <tr><td className="empty-state" colSpan="8">{orders.length ? 'No purchase orders match those filters.' : 'No purchase orders yet. Add a supplier, then record an order.'}</td></tr>}
      </tbody></table></div>
    </article> : <article className="panel management-panel"><div className="management-toolbar"><div><h2>Suppliers</h2><p>Contact details associated with purchase orders.</p></div><label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search suppliers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers..." /></label></div>
      <div className="table-wrap inventory-table-wrap"><table><thead><tr><th>SUPPLIER</th><th>PHONE</th><th>EMAIL</th><th>NOTES</th><th>ACTIONS</th></tr></thead><tbody>{suppliers.filter((supplier) => `${supplier.name} ${supplier.phone} ${supplier.email} ${supplier.notes}`.toLowerCase().includes(search.toLowerCase())).map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong></td><td>{supplier.phone || '—'}</td><td>{supplier.email || '—'}</td><td>{supplier.notes || '—'}</td><td><div className="row-actions"><button type="button" onClick={() => setDialog({ type: 'supplier', supplier })}>Edit</button><button type="button" onClick={() => deleteSupplier(supplier)}>Delete</button></div></td></tr>)}
        {!suppliers.length && <tr><td className="empty-state" colSpan="5">No suppliers yet. Add a supplier before creating a purchase order.</td></tr>}</tbody></table></div>
    </article>}
    {dialog?.type === 'supplier' && <SupplierForm supplier={dialog.supplier} onClose={() => setDialog(null)} onSave={(supplier, setError) => { const success = onSaveSupplier(supplier); if (success) setDialog(null); else setError('A supplier with this name already exists.') }} />}
    {dialog?.type === 'order' && <PurchaseOrderForm orders={orders} suppliers={suppliers} items={items} currency={currency} onClose={() => setDialog(null)} onSave={(order, setError) => { const saved = onSaveOrder(order); if (saved) setDialog(null); else setError('The order was not saved because its inventory changes could not be reconciled.'); return saved }} />}
    {dialog?.type === 'edit-order' && <PurchaseOrderForm order={dialog.order} orders={orders} suppliers={suppliers} items={items} currency={currency} onClose={() => setDialog(null)} onSave={(order, setError) => { const saved = onSaveOrder(order); if (saved) setDialog({ type: 'details', order }); else setError('The order was not saved because its inventory changes could not be reconciled.'); return saved }} />}
    {dialog?.type === 'receive' && <ReceiveForm order={dialog.order} items={items} onClose={() => setDialog(null)} onSave={(order, setError) => { const saved = onSaveOrder(order); if (saved) setDialog({ type: 'details', order }); else setError('Stock could not be updated. Confirm that inventory remains available for this adjustment.'); return saved }} />}
    {dialog?.type === 'details' && <Dialog title={`Purchase order ${dialog.order.id}`} onClose={() => setDialog(null)} wide>
      <div className="commerce-details"><div className="commerce-summary-grid"><div><span>Supplier</span><strong>{suppliers.find((supplier) => supplier.id === dialog.order.supplierId)?.name ?? 'Removed supplier'}</strong></div><div><span>Status</span><strong>{dialog.order.status}</strong></div><div><span>Order date</span><strong>{dateLabel(dialog.order.orderDate, locale)}</strong></div><div><span>Expected delivery</span><strong>{dateLabel(dialog.order.expectedDate, locale)}</strong></div></div>
        <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>ORDERED</th><th>RECEIVED</th><th>UNIT COST</th><th>LINE VALUE</th></tr></thead><tbody>{dialog.order.lines.map((line) => <tr key={line.itemId}><td>{items.find((item) => item.id === line.itemId)?.name ?? 'Removed item'}</td><td>{formatNumber(line.quantity, { maximumFractionDigits: 3 })} {items.find((item) => item.id === line.itemId)?.unit}</td><td>{formatNumber(line.receivedQuantity ?? 0, { maximumFractionDigits: 3 })}</td><td><Money amount={line.unitCost} currency={dialog.order.currencyCode} /></td><td><Money amount={line.quantity * line.unitCost} currency={dialog.order.currencyCode} /></td></tr>)}</tbody></table></div>
        <p className="commerce-help">{dialog.order.status === 'Cancelled' ? 'This order is cancelled; received stock was removed only when inventory allowed the reversal.' : 'Ordered quantities do not affect stock. Only recorded receipts have increased inventory.'}</p>
        <div className="form-actions commerce-actions">{!['Cancelled', 'Received'].includes(dialog.order.status) && <button className="primary-button" type="button" onClick={() => setDialog({ type: 'receive', order: dialog.order })}>Receive delivery</button>}{!['Cancelled', 'Received'].includes(dialog.order.status) && <button className="secondary-button" type="button" onClick={() => setDialog({ type: 'edit-order', order: dialog.order })}>Edit order</button>}{dialog.order.status !== 'Cancelled' && <button className="secondary-button danger-button" type="button" onClick={() => { const cancelled = { ...dialog.order, status: 'Cancelled' }; if (onSaveOrder(cancelled)) setDialog({ type: 'details', order: cancelled }); else setNotice('Cancellation would reduce stock below the available quantity. Correct inventory before cancelling.') }}>Cancel order</button>}{dialog.order.status === 'Cancelled' && <button className="secondary-button danger-button" type="button" onClick={() => deleteOrder(dialog.order)}>Delete cancelled order</button>}<button className="secondary-button" type="button" onClick={() => setDialog(null)}>Close</button></div>
      </div>
    </Dialog>}
  </section>
}

function CurrencyTotals({ totals }) {
  const entries = Object.entries(totals)
  if (!entries.length) return <span>—</span>
  return <span className="currency-total-list">{entries.map(([currency, amount]) => <span key={currency}><Money amount={amount} currency={currency} /></span>)}</span>
}

function sumByCurrency(records, getValue, getCurrency) {
  return records.reduce((totals, record) => {
    const amount = getValue(record)
    const currency = getCurrency(record)
    if (Number.isFinite(amount) && currency) totals[currency] = (totals[currency] ?? 0) + amount
    return totals
  }, {})
}

function ExpenseForm({ currency, onSave, onClose }) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Other business expense')
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!description.trim() || !date || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a description, date, and amount greater than zero.')
      return
    }
    onSave({
      id: `expense-${crypto.randomUUID()}`,
      description: description.trim(),
      category,
      date,
      amount: Number(amount),
      currencyCode: currency,
    })
    onClose()
  }

  return <Dialog title="Add a business expense" onClose={onClose}>
    <form className="management-form" onSubmit={submit} noValidate>
      <label className="form-field"><span>Description *</span><input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. market stall fee" /></label>
      <div className="form-grid">
        <label className="form-field"><span>Type</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Other business expense</option><option>Packaging</option><option>Transport</option><option>Fees</option><option>Utilities</option></select></label>
        <label className="form-field"><span>Date *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="form-field"><span>Amount ({currency}) *</span><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      </div>
      <p className="commerce-help">Record costs paid outside purchase orders here. Do not enter purchase receipts again, or they would be counted twice.</p>
      {error && <p className="form-error-message" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save expense</button></div>
    </form>
  </Dialog>
}

export function ReportsPage({ items, orders, purchaseOrders, transactions, expenses = [], onAddExpense, onDeleteExpense }) {
  const { formatNumber, locale, currency } = useCurrency()
  const [range, setRange] = useState('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState(today())
  const start = range === 'custom' ? customStart : getDateRangeStart(range)
  const isInRange = (date) => (!start || date >= start) && (!customEnd || range !== 'custom' || date <= customEnd)
  const sales = orders.filter((order) => order.status === 'Completed' && isInRange(order.orderDate))
  const purchases = purchaseOrders.filter((order) => order.status !== 'Cancelled' && isInRange(order.orderDate))
  const filteredExpenses = expenses.filter((expense) => isInRange(expense.date))
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const revenueTotals = sumByCurrency(sales, (order) => order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), (order) => order.currencyCode)
  const purchaseTotals = sumByCurrency(purchases, (order) => order.lines.reduce((sum, line) => sum + line.receivedQuantity * line.unitCost, 0), (order) => order.currencyCode)
  const expenseTotals = sumByCurrency(filteredExpenses, (expense) => expense.amount, (expense) => expense.currencyCode)
  const costTotals = {}
  let costsAvailable = sales.length > 0
  for (const order of sales) {
    for (const line of order.lines) {
      const item = items.find((entry) => entry.id === line.itemId)
      if (!item || !Number.isFinite(item.costPerUnit) || item.currencyCode !== order.currencyCode) {
        costsAvailable = false
        continue
      }
      costTotals[order.currencyCode] = (costTotals[order.currencyCode] ?? 0) + line.quantity * item.costPerUnit
    }
  }
  const profitTotals = costsAvailable
    ? Object.fromEntries([...new Set([...Object.keys(revenueTotals), ...Object.keys(expenseTotals)])].map((code) => [
      code,
      (revenueTotals[code] ?? 0) - (costTotals[code] ?? 0) - (expenseTotals[code] ?? 0),
    ]))
    : null
  const soldByItem = new Map()
  for (const order of sales) for (const line of order.lines) {
    const current = soldByItem.get(line.itemId) ?? { quantity: 0, totals: {} }
    current.quantity += line.quantity
    current.totals[order.currencyCode] = (current.totals[order.currencyCode] ?? 0) + line.quantity * line.unitPrice
    soldByItem.set(line.itemId, current)
  }
  const bestSellers = [...soldByItem.entries()].sort((left, right) => right[1].quantity - left[1].quantity).slice(0, 6)
  const movements = transactions.filter((entry) => isInRange(entry.date)).slice(0, 20)
  const lowItems = items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel)
  const outItems = items.filter((item) => item.quantity <= 0)
  const valuedItems = items.filter((item) => Number.isFinite(item.costPerUnit) && Number.isFinite(item.quantity) && item.currencyCode)
  const inventoryValueTotals = sumByCurrency(valuedItems, (item) => item.quantity * item.costPerUnit, (item) => item.currencyCode)
  const unknownCostCount = items.length - valuedItems.length
  const salesByProductForChart = bestSellers.slice(0, 5)
  const maxSold = Math.max(1, ...salesByProductForChart.map(([, data]) => data.quantity))

  return <section className="page-content management-page commerce-page">
    <div className="page-title-row"><div><div className="eyebrow">BUSINESS INSIGHTS</div><h1>Reports</h1><p className="welcome-subtitle">Review recorded inventory, order, and purchasing activity.</p></div><label className="report-range">Date range<select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All dates</option><option value="custom">Custom range</option></select></label></div>
    {range === 'custom' && <div className="report-custom-range"><label className="form-field"><span>From</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label className="form-field"><span>Through</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}
    <div className="demo-banner"><span>LOCAL DATA</span> Reports summarize sample and user-entered records saved in this browser. No missing sales, costs, or payments are invented.</div>
    <div className="report-card-grid">
      <article className="panel report-card"><span>Current inventory value</span><strong><CurrencyTotals totals={inventoryValueTotals} /></strong><small>On-hand quantity × recorded unit cost, grouped by original currency. {unknownCostCount ? `${unknownCostCount} item${unknownCostCount === 1 ? '' : 's'} missing cost data are excluded.` : ''}</small></article>
      <article className="panel report-card"><span>Sales revenue · completed orders</span><strong><CurrencyTotals totals={revenueTotals} /></strong><small>{sales.length ? `${sales.length} completed orders in the selected date range.` : 'No completed sales orders in the selected date range.'}</small></article>
      <article className="panel report-card"><span>Purchase cost · received goods</span><strong><CurrencyTotals totals={purchaseTotals} /></strong><small>Received quantities × recorded unit costs. This is not a payment or cash-spending ledger.</small></article>
      <article className="panel report-card"><span>Other business expenses</span><strong><CurrencyTotals totals={expenseTotals} /></strong><small>Manual expenses recorded for the date range. Received purchase costs are shown separately and are not counted again.</small></article>
      <article className="panel report-card"><span>Estimated profit / loss</span><strong>{profitTotals ? <CurrencyTotals totals={profitTotals} /> : 'Not available'}</strong><small>{profitTotals ? 'Estimate = completed sales revenue − estimated cost of sold items − recorded other expenses. Costs use current item costs, not a historical cost ledger.' : 'Record completed sales and ensure every sold product has a unit cost in the same currency as its order to estimate profit.'}</small></article>
    </div>
    <div className="report-two-column">
      <article className="panel management-panel"><div className="panel-heading"><div><h2>Stock attention</h2><p>Current counts are not limited by the sales date range.</p></div></div><div className="report-stock-counts"><div><span>Low stock</span><strong>{lowItems.length}</strong></div><div><span>Out of stock</span><strong>{outItems.length}</strong></div></div>
        <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>ON HAND</th><th>REORDER LEVEL</th><th>STATUS</th></tr></thead><tbody>{[...outItems, ...lowItems].slice(0, 12).map((item) => <tr key={item.id}><td>{item.name}</td><td>{formatNumber(item.quantity, { maximumFractionDigits: 3 })} {item.unit}</td><td>{formatNumber(item.reorderLevel, { maximumFractionDigits: 3 })} {item.unit}</td><td>{item.quantity <= 0 ? 'Out of stock' : 'Low stock'}</td></tr>)}{!outItems.length && !lowItems.length && <tr><td colSpan="4" className="empty-state">No low-stock or out-of-stock items.</td></tr>}</tbody></table></div>
      </article>
      <article className="panel management-panel"><div className="panel-heading"><div><h2>Best-selling products</h2><p>Based on completed sales orders only.</p></div></div><div className="report-chart">{salesByProductForChart.map(([itemId, data]) => <div className="report-bar-row" key={itemId}><span>{items.find((item) => item.id === itemId)?.name ?? 'Removed product'}</span><div className="report-bar-track"><i style={{ width: `${Math.max(3, data.quantity / maxSold * 100)}%` }} /></div><strong>{formatNumber(data.quantity, { maximumFractionDigits: 3 })}</strong></div>)}{!salesByProductForChart.length && <p className="commerce-empty-note">Completed sales will appear here. Pending and confirmed orders are not counted as sales.</p>}</div>
        <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>QTY SOLD</th><th>REVENUE</th></tr></thead><tbody>{bestSellers.map(([itemId, data]) => <tr key={itemId}><td>{items.find((item) => item.id === itemId)?.name ?? 'Removed product'}</td><td>{formatNumber(data.quantity, { maximumFractionDigits: 3 })}</td><td><CurrencyTotals totals={data.totals} /></td></tr>)}{!bestSellers.length && <tr><td className="empty-state" colSpan="3">No recorded product sales yet.</td></tr>}</tbody></table></div>
      </article>
    </div>
    <article className="panel management-panel report-movement-panel"><div className="panel-heading"><div><h2>Inventory movement history</h2><p>Recorded stock additions, deductions, and reversals in this date range.</p></div></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>ITEM</th><th>MOVEMENT</th><th>QUANTITY</th><th>REASON</th><th>BALANCE</th></tr></thead><tbody>{movements.map((entry) => <tr key={entry.id}><td>{dateLabel(entry.date, locale)}</td><td>{entry.itemName}</td><td>{entry.type}</td><td>{formatNumber(entry.quantity, { maximumFractionDigits: 3 })} {entry.unit}</td><td>{entry.reason}</td><td>{formatNumber(entry.balance, { maximumFractionDigits: 3 })} {entry.unit}</td></tr>)}{!movements.length && <tr><td colSpan="6" className="empty-state">No inventory movements in this date range.</td></tr>}</tbody></table></div></article>
    <article className="panel management-panel report-movement-panel"><div className="panel-heading"><div><h2>Other business expenses</h2><p>Manually recorded costs, separate from purchase order receipts.</p></div><button className="primary-button" type="button" onClick={() => setShowExpenseForm(true)}>＋ Add expense</button></div><div className="table-wrap"><table><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>TYPE</th><th>AMOUNT</th><th>ACTION</th></tr></thead><tbody>{filteredExpenses.map((expense) => <tr key={expense.id}><td>{dateLabel(expense.date, locale)}</td><td>{expense.description}</td><td>{expense.category}</td><td><Money amount={expense.amount} currency={expense.currencyCode} /></td><td><button className="row-action" type="button" onClick={() => onDeleteExpense(expense.id)}>Delete</button></td></tr>)}{!filteredExpenses.length && <tr><td colSpan="5" className="empty-state">No manual expenses in this date range. Add an expense such as transport, packaging, or a market fee.</td></tr>}</tbody></table></div></article>
    {showExpenseForm && <ExpenseForm currency={currency} onSave={onAddExpense} onClose={() => setShowExpenseForm(false)} />}
  </section>
}
