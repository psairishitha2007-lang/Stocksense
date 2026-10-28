export const SALES_ORDER_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled']
export const PURCHASE_ORDER_STATUSES = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled']

export function getSalesQuantities(lines = []) {
  return lines.reduce((totals, line) => {
    totals[line.itemId] = (totals[line.itemId] ?? 0) + Number(line.quantity)
    return totals
  }, {})
}

export function getReceivedQuantities(lines = []) {
  return lines.reduce((totals, line) => {
    totals[line.itemId] = (totals[line.itemId] ?? 0) + Number(line.receivedQuantity ?? 0)
    return totals
  }, {})
}

export function getStockDeltas(previous, next, previousApplied, nextApplied) {
  const oldQuantities = previousApplied ? previous : {}
  const newQuantities = nextApplied ? next : {}
  const itemIds = new Set([...Object.keys(oldQuantities), ...Object.keys(newQuantities)])
  return Object.fromEntries([...itemIds].map((itemId) => [
    itemId,
    (oldQuantities[itemId] ?? 0) - (newQuantities[itemId] ?? 0),
  ]).filter(([, delta]) => delta !== 0))
}

export function adjustStock(items, deltas, reservations = {}) {
  const changedItems = items.map((item) => {
    const delta = deltas[item.id] ?? 0
    const reserved = reservations[item.id] ?? 0
    if (!Number.isFinite(item.quantity) || item.quantity < 0
      || !Number.isFinite(delta)
      || !Number.isFinite(reserved) || reserved < 0) {
      throw new TypeError(`Invalid stock adjustment for ${item.name}.`)
    }
    const nextQuantity = item.quantity + delta
    if (!Number.isFinite(nextQuantity)) {
      throw new RangeError(`Stock adjustment for ${item.name} is outside the supported quantity range.`)
    }
    const minimum = Math.max(0, reserved)
    if (nextQuantity < minimum) {
      throw new RangeError(`Not enough unreserved stock for ${item.name}. ${minimum} ${item.unit} must remain available.`)
    }
    return delta === 0 ? item : { ...item, quantity: nextQuantity }
  })

  const missingItem = Object.keys(deltas).find((itemId) => !items.some((item) => item.id === itemId))
  if (missingItem) throw new Error(`Inventory item ${missingItem} no longer exists.`)
  return changedItems
}

export function getPurchaseStatus(lines, currentStatus) {
  if (currentStatus === 'Cancelled' || currentStatus === 'Draft') return currentStatus
  if (lines.every((line) => Number(line.receivedQuantity ?? 0) >= Number(line.quantity))) return 'Received'
  if (lines.every((line) => Number(line.receivedQuantity ?? 0) === 0)) return 'Ordered'
  return 'Partially Received'
}

export function getDateRangeStart(range, now = new Date()) {
  if (range === 'all') return ''
  const days = Number(range)
  const start = new Date(now)
  start.setDate(start.getDate() - days + 1)
  return start.toISOString().slice(0, 10)
}
