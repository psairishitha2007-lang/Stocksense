import {
  adjustStock,
  getPurchaseStatus,
  getReceivedQuantities,
  getSalesQuantities,
  getStockDeltas,
  PURCHASE_ORDER_STATUSES,
  SALES_ORDER_STATUSES,
} from './commerceData.js'
import {
  calculateOrderRequirements,
  getRecipeUnitIssues,
  getRequirementShortages,
} from './orderData.js'
import { isFinishedProduct } from './inventoryData.js'
import { CURRENCIES } from './businessData.js'

const CURRENCY_CODES = new Set(CURRENCIES.map(({ code }) => code))

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function defaultId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `transaction-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createMovement(item, delta, { type, reason, currencyCode, supplier, cost, idFactory, now, notes }) {
  return {
    id: `transaction-${idFactory()}`,
    date: now.toISOString().slice(0, 10),
    createdAt: now.toISOString(),
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    type,
    quantity: Math.abs(delta),
    reason,
    balance: item.quantity,
    unit: item.unit,
    ...(supplier ? { supplier } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(currencyCode ? { currencyCode } : {}),
    notes,
  }
}

export function saveSalesOrderTransaction({
  items,
  transactions,
  orders,
  nextOrder,
  reservations = {},
  now = new Date(),
  idFactory = defaultId,
}) {
  if (!nextOrder || typeof nextOrder !== 'object') {
    return { success: false, error: 'Sales order is invalid. Check the customer, date, products, quantities, and prices.' }
  }
  const existing = orders.find((order) => order.id === nextOrder.id)
  const status = nextOrder.status ?? 'Pending'
  const salesTotal = Array.isArray(nextOrder.lines)
    ? nextOrder.lines.reduce((sum, line) => sum + Number(line?.quantity) * Number(line?.unitPrice), 0)
    : Number.NaN
  if (!SALES_ORDER_STATUSES.includes(status)
    || typeof nextOrder.customer !== 'string' || !nextOrder.customer.trim()
    || !validDate(nextOrder.orderDate)
    || !CURRENCY_CODES.has(nextOrder.currencyCode)
    || !Array.isArray(nextOrder.lines) || !nextOrder.lines.length
    || new Set(nextOrder.lines.map((line) => line?.itemId)).size !== nextOrder.lines.length
    || !Number.isFinite(salesTotal)
    || nextOrder.lines.some((line) => !line || !items.some((item) => item.id === line.itemId)
      || !Number.isFinite(line.quantity) || line.quantity <= 0
      || !Number.isFinite(line.unitPrice) || line.unitPrice < 0
      || !Number.isFinite(line.quantity * line.unitPrice))) {
    return { success: false, error: 'Sales order is invalid. Check the customer, date, products, quantities, and prices.' }
  }

  const order = { ...nextOrder, status }
  const deltas = getStockDeltas(
    getSalesQuantities(existing?.lines),
    getSalesQuantities(order.lines),
    existing?.status === 'Completed',
    order.status === 'Completed',
  )
  let changedItems
  try {
    changedItems = adjustStock(items, deltas, reservations)
  } catch (error) {
    return { success: false, error: error.message }
  }
  const movements = Object.entries(deltas).map(([itemId, delta]) => {
    const item = changedItems.find((entry) => entry.id === itemId)
    const isRestore = delta > 0
    return createMovement(item, delta, {
      type: isRestore ? 'Sales cancellation reversal' : 'Sales fulfillment',
      reason: isRestore ? `Stock restored for ${order.id}` : `Fulfillment for ${order.id}`,
      currencyCode: order.currencyCode,
      idFactory,
      now,
      notes: isRestore ? 'Previously deducted sales stock was restored once.' : 'Stock deducted when the sales order was completed.',
    })
  })
  const nextOrders = existing
    ? orders.map((entry) => entry.id === order.id ? order : entry)
    : [order, ...orders]
  return {
    success: true,
    order,
    existing,
    deltas,
    items: changedItems,
    transactions: [...movements, ...transactions],
    orders: nextOrders,
  }
}

export function savePurchaseOrderTransaction({
  items,
  transactions,
  orders,
  suppliers,
  nextOrder,
  reservations = {},
  now = new Date(),
  idFactory = defaultId,
}) {
  if (!nextOrder || typeof nextOrder !== 'object') {
    return { success: false, error: 'Purchase order is invalid. Check its supplier, dates, item units, quantities, and costs.' }
  }
  const existing = orders.find((order) => order.id === nextOrder.id)
  const orderTotal = Array.isArray(nextOrder.lines)
    ? nextOrder.lines.reduce((sum, line) => sum + Number(line?.quantity) * Number(line?.unitCost), 0)
    : Number.NaN
  const receivedTotal = Array.isArray(nextOrder.lines)
    ? nextOrder.lines.reduce((sum, line) => sum + Number(line?.receivedQuantity ?? 0) * Number(line?.unitCost), 0)
    : Number.NaN
  if (!PURCHASE_ORDER_STATUSES.includes(nextOrder.status)
    || !suppliers.some((supplier) => supplier?.id === nextOrder.supplierId)
    || !validDate(nextOrder.orderDate)
    || !CURRENCY_CODES.has(nextOrder.currencyCode)
    || !Array.isArray(nextOrder.lines) || !nextOrder.lines.length
    || new Set(nextOrder.lines.map((line) => line?.itemId)).size !== nextOrder.lines.length
    || !Number.isFinite(orderTotal) || !Number.isFinite(receivedTotal)
    || nextOrder.lines.some((line) => !line || !items.some((item) => item.id === line.itemId)
      || !Number.isFinite(line.quantity) || line.quantity <= 0
      || !Number.isFinite(line.unitCost) || line.unitCost < 0
      || !Number.isFinite(line.quantity * line.unitCost)
      || !Number.isFinite(line.receivedQuantity ?? 0) || (line.receivedQuantity ?? 0) < 0
      || !Number.isFinite((line.receivedQuantity ?? 0) * line.unitCost)
      || (line.receivedQuantity ?? 0) > line.quantity
      || items.find((item) => item.id === line.itemId)?.unit !== line.unit)
    || (nextOrder.status === 'Draft' && nextOrder.lines.some((line) => Number(line.receivedQuantity ?? 0) > 0))) {
    return { success: false, error: 'Purchase order is invalid. Check its supplier, dates, item units, quantities, and costs.' }
  }
  const isReceiving = nextOrder.lines.some((line) => {
    const oldLine = existing?.lines.find((entry) => entry.itemId === line.itemId)
    return Number(line.receivedQuantity ?? 0) > Number(oldLine?.receivedQuantity ?? 0)
  })
  if (isReceiving && !['Ordered', 'Partially Received'].includes(existing?.status ?? nextOrder.status)) {
    return { success: false, error: 'Mark the purchase order Ordered before recording a delivery.' }
  }

  const order = {
    ...nextOrder,
    status: nextOrder.status === 'Cancelled'
      ? 'Cancelled'
      : getPurchaseStatus(nextOrder.lines, nextOrder.status),
  }
  const deltas = getStockDeltas(
    getReceivedQuantities(order.lines),
    getReceivedQuantities(existing?.lines),
    order.status !== 'Cancelled',
    Boolean(existing && existing.status !== 'Cancelled'),
  )
  let changedItems
  try {
    changedItems = adjustStock(items, deltas, reservations)
  } catch (error) {
    return { success: false, error: error.message }
  }
  const supplierName = suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? ''
  const movements = Object.entries(deltas).map(([itemId, delta]) => {
    const item = changedItems.find((entry) => entry.id === itemId)
    const isReceipt = delta > 0
    return createMovement(item, delta, {
      type: isReceipt ? 'Purchase receipt' : 'Purchase cancellation reversal',
      reason: isReceipt ? `Receipt for ${order.id}` : `Stock reversal for ${order.id}`,
      supplier: supplierName,
      cost: order.lines.find((line) => line.itemId === itemId)?.unitCost,
      currencyCode: order.currencyCode,
      idFactory,
      now,
      notes: isReceipt ? 'Received quantity added once to inventory.' : 'Previously received stock removed on purchase cancellation.',
    })
  })
  const nextOrders = existing
    ? orders.map((entry) => entry.id === order.id ? order : entry)
    : [order, ...orders]
  return {
    success: true,
    order,
    existing,
    deltas,
    items: changedItems,
    transactions: [...movements, ...transactions],
    orders: nextOrders,
  }
}

export function confirmProductionOrder({
  orders,
  orderId,
  items,
  recipes,
  reservations = {},
  now = new Date(),
}) {
  const order = orders.find((entry) => entry.id === orderId)
  if (!order || order.confirmed || order.status !== 'Pending') {
    return { success: false, error: 'This production order is no longer available to confirm.' }
  }
  if (!Array.isArray(order.lines) || order.lines.length === 0
    || order.lines.some((line) => !line
      || !Number.isFinite(line.quantity) || line.quantity <= 0
      || !isFinishedProduct(items.find((item) => item.id === line.productId)))) {
    return { success: false, error: 'Production order products and quantities are invalid.' }
  }
  const requirements = calculateOrderRequirements(order.lines, recipes, items)
  if (requirements.some((requirement) => !Number.isFinite(requirement.quantity) || requirement.quantity <= 0)) {
    return { success: false, error: 'The recipe requirements exceed the supported quantity range.' }
  }
  const missingRecipe = order.lines.some((line) => !recipes[line.productId]?.length)
  const issues = getRecipeUnitIssues(order.lines, recipes, items)
  if (issues.length) return { success: false, error: `Cannot confirm this order: ${issues.join(' ')}` }
  if (missingRecipe || !requirements.length) {
    return { success: false, error: 'Cannot confirm this order until every finished product has a saved recipe.' }
  }
  const shortages = getRequirementShortages(requirements, items, reservations)
  if (shortages.length) {
    return {
      success: false,
      error: `Cannot confirm: shortage of ${shortages.map((part) => `${part.materialName} (${part.shortage} ${part.unit})`).join(', ')}.`,
    }
  }
  const updatedOrder = { ...order, confirmed: true, requirements, confirmedAt: now.toISOString() }
  return {
    success: true,
    order: updatedOrder,
    orders: orders.map((entry) => entry.id === orderId ? updatedOrder : entry),
  }
}

export function transitionProductionOrder({
  orders,
  orderId,
  action,
  actualUsage = [],
  items,
  transactions,
  reservations = {},
  now = new Date(),
  idFactory = defaultId,
}) {
  const order = orders.find((entry) => entry.id === orderId)
  if (!order) return { success: false, error: 'Production order no longer exists.' }

  if (action === 'cancel') {
    if (order.productionRecorded || order.status === 'Completed') {
      return { success: false, error: 'Production has already been recorded; this order cannot be cancelled without a manual stock adjustment.' }
    }
    const updatedOrder = { ...order, status: 'Cancelled', reservationReleased: true }
    return {
      success: true,
      order: updatedOrder,
      orders: orders.map((entry) => entry.id === orderId ? updatedOrder : entry),
    }
  }

  if (action === 'start') {
    if (!order.confirmed || order.status !== 'Pending') {
      return { success: false, error: 'Only confirmed pending production orders can be started.' }
    }
    const updatedOrder = { ...order, status: 'In Progress' }
    return {
      success: true,
      order: updatedOrder,
      orders: orders.map((entry) => entry.id === orderId ? updatedOrder : entry),
    }
  }

  if (action !== 'produce' && action !== 'complete') {
    return { success: false, error: 'Unsupported production order action.' }
  }
  if (action === 'produce' && (order.status !== 'In Progress' || order.productionRecorded)) {
    return { success: false, error: 'Only in-progress production orders can be recorded once.' }
  }
  if (action === 'complete' && (order.status !== 'Ready' || order.dispatched)) {
    return { success: false, error: 'Only ready production orders can be dispatched once.' }
  }

  let deltas
  let nextStatus
  let movements
  if (action === 'produce') {
    const requirements = order.requirements ?? []
    if (!Array.isArray(actualUsage)) {
      return { success: false, error: 'Production usage is invalid. Review the actual quantities and try again.' }
    }
    const usageIds = new Set(actualUsage.map((usage) => usage?.materialId))
    if (!Array.isArray(requirements)
      || actualUsage.length !== requirements.length
      || usageIds.size !== actualUsage.length
      || actualUsage.some((usage) => !usage || !requirements.some((requirement) => requirement.materialId === usage.materialId)
        || !Number.isFinite(usage.quantity) || usage.quantity < 0)) {
      return { success: false, error: 'Production usage is invalid. Review the actual quantities and try again.' }
    }
    const productTotals = getProductionProductTotals(order)
    if (!productTotals) return { success: false, error: 'Production output is invalid. Review the product quantities and try again.' }
    const changes = new Map()
    for (const usage of actualUsage) changes.set(usage.materialId, (changes.get(usage.materialId) ?? 0) - usage.quantity)
    for (const [productId, quantity] of Object.entries(productTotals)) changes.set(productId, (changes.get(productId) ?? 0) + quantity)
    const otherReservations = { ...reservations }
    for (const requirement of requirements) {
      otherReservations[requirement.materialId] = Math.max(
        0,
        (otherReservations[requirement.materialId] ?? 0) - requirement.quantity,
      )
    }
    deltas = Object.fromEntries(changes)
    nextStatus = 'Ready'
    try {
      const changedItems = adjustStock(items, deltas, otherReservations)
      movements = [
        ...actualUsage.flatMap((usage) => {
          if (usage.quantity === 0) return []
          const item = changedItems.find((entry) => entry.id === usage.materialId)
          return [createMovement(item, -usage.quantity, {
            type: 'Production usage',
            reason: `Production for ${order.id}`,
            idFactory,
            now,
            notes: 'Reserved recipe materials issued to production.',
          })]
        }),
        ...Object.entries(productTotals).map(([productId, quantity]) => {
          const item = changedItems.find((entry) => entry.id === productId)
          return createMovement(item, quantity, {
            type: 'Production output',
            reason: `Production for ${order.id}`,
            idFactory,
            now,
            notes: 'Finished products added to available stock.',
          })
        }),
      ]
      const updatedOrder = {
        ...order,
        status: nextStatus,
        productionRecorded: true,
        productionRecordedAt: now.toISOString(),
      }
      return {
        success: true,
        order: updatedOrder,
        orders: orders.map((entry) => entry.id === orderId ? updatedOrder : entry),
        items: changedItems,
        transactions: [...movements, ...transactions],
        deltas,
      }
    } catch (error) {
      return { success: false, error: `Production could not be recorded: ${error.message}` }
    }
  }

  const productTotals = getProductionProductTotals(order)
  if (!productTotals) return { success: false, error: 'Dispatch quantities are invalid. Review the order and try again.' }
  deltas = Object.fromEntries(Object.entries(productTotals).map(([id, quantity]) => [id, -quantity]))
  try {
    const changedItems = adjustStock(items, deltas, reservations)
    movements = Object.entries(productTotals).map(([productId, quantity]) => {
      const item = changedItems.find((entry) => entry.id === productId)
      return createMovement(item, -quantity, {
        type: 'Order dispatch',
        reason: `Dispatch for ${order.id}`,
        idFactory,
        now,
        notes: 'Finished goods deducted once on order completion.',
      })
    })
    const updatedOrder = {
      ...order,
      status: 'Completed',
      dispatched: true,
      dispatchedAt: now.toISOString(),
    }
    return {
      success: true,
      order: updatedOrder,
      orders: orders.map((entry) => entry.id === orderId ? updatedOrder : entry),
      items: changedItems,
      transactions: [...movements, ...transactions],
      deltas,
    }
  } catch (error) {
    return { success: false, error: `Dispatch could not be completed: ${error.message}` }
  }
}

function getProductionProductTotals(order) {
  if (!Array.isArray(order.lines) || order.lines.length === 0
    || order.lines.some((line) => !line || typeof line.productId !== 'string')) return null
  const productTotals = order.lines.reduce((totals, line) => {
    totals[line.productId] = (totals[line.productId] ?? 0) + line.quantity
    return totals
  }, {})
  return Object.values(productTotals).every((quantity) => Number.isFinite(quantity) && quantity > 0)
    ? productTotals
    : null
}
