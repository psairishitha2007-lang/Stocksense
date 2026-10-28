import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustStock, getPurchaseStatus, getStockDeltas } from './commerceData.js'

const items = [
  { id: 'flour', name: 'Flour', quantity: 8, unit: 'kg' },
  { id: 'sugar', name: 'Sugar', quantity: 3, unit: 'kg' },
]

test('stock deltas reconcile previously applied quantities with the next order', () => {
  assert.deepEqual(
    getStockDeltas({ flour: 4, sugar: 2 }, { flour: 6 }, true, true),
    { flour: -2, sugar: 2 },
  )
})

test('stock deltas do not change inventory for unapplied orders', () => {
  assert.deepEqual(
    getStockDeltas({ flour: 4 }, { flour: 7 }, false, false),
    {},
  )
})

test('stock adjustment preserves reservations and updates the requested item', () => {
  const updated = adjustStock(items, { flour: -5, sugar: 2 }, { flour: 3 })
  assert.deepEqual(updated.map(({ quantity }) => quantity), [3, 5])
  assert.deepEqual(updated[1], { ...items[1], quantity: 5 })
})

test('stock adjustment rejects an issue that would consume reserved stock', () => {
  assert.throws(
    () => adjustStock(items, { flour: -6 }, { flour: 3 }),
    /Not enough unreserved stock/,
  )
})

test('stock adjustment rejects unknown items instead of silently dropping deltas', () => {
  assert.throws(
    () => adjustStock(items, { missing: -1 }),
    /no longer exists/,
  )
})

test('purchase status follows cumulative receipts', () => {
  assert.equal(getPurchaseStatus([{ quantity: 5, receivedQuantity: 0 }], 'Ordered'), 'Ordered')
  assert.equal(getPurchaseStatus([{ quantity: 5, receivedQuantity: 2 }], 'Ordered'), 'Partially Received')
  assert.equal(getPurchaseStatus([{ quantity: 5, receivedQuantity: 5 }], 'Ordered'), 'Received')
  assert.equal(getPurchaseStatus([{ quantity: 5, receivedQuantity: 5 }], 'Cancelled'), 'Cancelled')
})
