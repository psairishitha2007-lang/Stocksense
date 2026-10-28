import assert from 'node:assert/strict'
import test from 'node:test'
import {
  confirmProductionOrder,
  savePurchaseOrderTransaction,
  saveSalesOrderTransaction,
  transitionProductionOrder,
} from './businessTransactions.js'
import { createDemoWorkspaces } from './categoryInventoryData.js'
import { getReservations } from './orderData.js'
import { loadApplicationDataSnapshot, saveApplicationData } from './applicationStorage.js'

const NOW = new Date('2026-10-24T12:00:00.000Z')
const currencyCode = 'USD'

function createFixture() {
  const workspaces = createDemoWorkspaces()
  const workspace = workspaces['home-foods']
  const flour = workspace.items.find((item) => item.id === 'item-flour')
  const cupcake = workspace.items.find((item) => item.id === 'item-cupcake')
  flour.quantity = 2
  cupcake.quantity = 4
  return { workspaces, workspace, flour, cupcake }
}

function applyTransactionResult(workspace, result, orderField) {
  assert.equal(result.success, true, result.error)
  workspace.items = result.items
  workspace.transactions = result.transactions
  workspace[orderField] = result.orders
}

function saleOrder(overrides = {}) {
  return {
    id: 'SO-1001',
    customer: 'Test customer',
    orderDate: '2026-10-24',
    currencyCode,
    status: 'Pending',
    lines: [{ itemId: 'item-cupcake', quantity: 1, unitPrice: 3 }],
    ...overrides,
  }
}

function purchaseOrder(supplierId, overrides = {}) {
  return {
    id: 'PO-1001',
    supplierId,
    orderDate: '2026-10-24',
    expectedDate: '2026-10-30',
    currencyCode,
    status: 'Ordered',
    lines: [{ itemId: 'item-flour', unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 0 }],
    ...overrides,
  }
}

function saveSale(workspace, nextOrder, reservations = {}) {
  return saveSalesOrderTransaction({
    items: workspace.items,
    transactions: workspace.transactions,
    orders: workspace.salesOrders,
    nextOrder,
    reservations,
    now: NOW,
    idFactory: (() => {
      let id = 0
      return () => `test-${++id}`
    })(),
  })
}

function savePurchase(workspace, nextOrder, reservations = {}) {
  return savePurchaseOrderTransaction({
    items: workspace.items,
    transactions: workspace.transactions,
    orders: workspace.purchaseOrders,
    suppliers: workspace.suppliers,
    nextOrder,
    reservations,
    now: NOW,
    idFactory: (() => {
      let id = 0
      return () => `test-${++id}`
    })(),
  })
}

function transition(workspace, orderId, action, actualUsage = [], reservations = {}) {
  return transitionProductionOrder({
    orders: workspace.orders,
    orderId,
    action,
    actualUsage,
    items: workspace.items,
    transactions: workspace.transactions,
    reservations,
    now: NOW,
    idFactory: (() => {
      let id = 0
      return () => `test-${++id}`
    })(),
  })
}

test('sales completion, completed edits, cancellation, and repeated saves reconcile stock once', () => {
  const { workspace, cupcake } = createFixture()
  const initialBalance = cupcake.quantity
  const initialTransactionCount = workspace.transactions.length

  const pending = saveSale(workspace, saleOrder())
  applyTransactionResult(workspace, pending, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance)
  assert.equal(workspace.transactions.length, initialTransactionCount)

  const completed = saveSale(workspace, saleOrder({ status: 'Completed' }))
  applyTransactionResult(workspace, completed, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance - 1)
  assert.equal(workspace.transactions[0].type, 'Sales fulfillment')

  const repeated = saveSale(workspace, saleOrder({ status: 'Completed' }))
  applyTransactionResult(workspace, repeated, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance - 1)
  assert.equal(workspace.transactions.length, initialTransactionCount + 1)

  const edited = saveSale(workspace, saleOrder({
    status: 'Completed',
    lines: [{ itemId: cupcake.id, quantity: 2, unitPrice: 3.5 }],
  }))
  applyTransactionResult(workspace, edited, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance - 2)
  assert.equal(workspace.transactions[0].quantity, 1)

  const cancelled = saveSale(workspace, saleOrder({
    status: 'Cancelled',
    lines: [{ itemId: cupcake.id, quantity: 2, unitPrice: 3.5 }],
  }))
  applyTransactionResult(workspace, cancelled, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance)
  assert.equal(workspace.transactions[0].type, 'Sales cancellation reversal')

  const repeatedCancel = saveSale(workspace, saleOrder({
    status: 'Cancelled',
    lines: [{ itemId: cupcake.id, quantity: 2, unitPrice: 3.5 }],
  }))
  applyTransactionResult(workspace, repeatedCancel, 'salesOrders')
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialBalance)
  assert.equal(workspace.transactions.length, initialTransactionCount + 3)
})

test('invalid and insufficient sales changes leave every workspace collection untouched', () => {
  const { workspace, cupcake } = createFixture()
  const original = structuredClone(workspace)
  const invalid = saveSale(workspace, saleOrder({
    status: 'Completed',
    lines: [{ itemId: cupcake.id, quantity: 1, unitPrice: Number.NaN }],
  }))
  assert.equal(invalid.success, false)
  assert.deepEqual(workspace, original)

  const shortage = saveSale(workspace, saleOrder({
    status: 'Completed',
    lines: [{ itemId: cupcake.id, quantity: 99, unitPrice: 3 }],
  }))
  assert.equal(shortage.success, false)
  assert.match(shortage.error, /Not enough unreserved stock/)
  assert.deepEqual(workspace, original)

  const unsupportedCurrency = saveSale(workspace, saleOrder({ currencyCode: 'XXX' }))
  assert.equal(unsupportedCurrency.success, false)
  const duplicateLines = saveSale(workspace, saleOrder({
    lines: [
      { itemId: cupcake.id, quantity: 1, unitPrice: 3 },
      { itemId: cupcake.id, quantity: 1, unitPrice: 3 },
    ],
  }))
  assert.equal(duplicateLines.success, false)
  assert.deepEqual(workspace, original)
})

test('purchase partial, cumulative, repeated receipts and cancellation reverse only applied quantities', () => {
  const { workspace, flour } = createFixture()
  const initialBalance = flour.quantity
  const initialTransactionCount = workspace.transactions.length
  const supplierId = workspace.suppliers[0].id

  const created = savePurchase(workspace, purchaseOrder(supplierId))
  applyTransactionResult(workspace, created, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance)

  const firstReceipt = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Partially Received',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 2 }],
  }))
  applyTransactionResult(workspace, firstReceipt, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance + 2)
  assert.equal(workspace.purchaseOrders[0].status, 'Partially Received')

  const sameReceipt = savePurchase(workspace, workspace.purchaseOrders[0])
  applyTransactionResult(workspace, sameReceipt, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance + 2)
  assert.equal(workspace.transactions.length, initialTransactionCount + 1)

  const increasedReceipt = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Partially Received',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 4 }],
  }))
  applyTransactionResult(workspace, increasedReceipt, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance + 4)
  assert.equal(workspace.transactions[0].quantity, 2)

  const cancelled = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Cancelled',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 4 }],
  }))
  applyTransactionResult(workspace, cancelled, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance)
  assert.equal(workspace.transactions[0].type, 'Purchase cancellation reversal')
  assert.equal(workspace.purchaseOrders[0].status, 'Cancelled')

  const repeatedCancel = savePurchase(workspace, workspace.purchaseOrders[0])
  applyTransactionResult(workspace, repeatedCancel, 'purchaseOrders')
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialBalance)
  assert.equal(workspace.transactions.length, initialTransactionCount + 3)
})

test('purchase receipt validation and reservation failures are atomic', () => {
  const { workspace, flour } = createFixture()
  const original = structuredClone(workspace)
  const supplierId = workspace.suppliers[0].id
  const invalidDraftReceipt = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Draft',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 1 }],
  }))
  assert.equal(invalidDraftReceipt.success, false)
  assert.deepEqual(workspace, original)

  const receipt = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Partially Received',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 4 }],
  }))
  assert.equal(receipt.success, true)
  const protectedReceipt = {
    ...workspace,
    items: receipt.items,
    transactions: receipt.transactions,
    purchaseOrders: receipt.orders,
  }
  const reversal = savePurchase(protectedReceipt, purchaseOrder(supplierId, {
    status: 'Cancelled',
    lines: [{ itemId: flour.id, unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 4 }],
  }), { [flour.id]: 3 })
  assert.equal(reversal.success, false)
  assert.match(reversal.error, /Not enough unreserved stock/)
  assert.deepEqual(protectedReceipt.items, receipt.items)
  assert.deepEqual(protectedReceipt.transactions, receipt.transactions)
  assert.deepEqual(protectedReceipt.purchaseOrders, receipt.orders)
})

test('production reserves without deduction, consumes actual materials, dispatches once, and rejects repeated transitions', () => {
  const { workspace, flour, cupcake } = createFixture()
  const order = {
    id: 'ORD-2001',
    customer: 'Production test',
    orderDate: '2026-10-24',
    deliveryDate: '2026-10-25',
    status: 'Pending',
    confirmed: false,
    productionRecorded: false,
    dispatched: false,
    lines: [{ productId: cupcake.id, quantity: 2 }],
    requirements: [],
  }
  workspace.orders = [order, ...workspace.orders]
  const initialFlour = flour.quantity
  const initialCupcakes = cupcake.quantity

  const confirmed = confirmProductionOrder({
    orders: workspace.orders,
    orderId: order.id,
    items: workspace.items,
    recipes: workspace.recipes,
    reservations: getReservations(workspace.orders),
    now: NOW,
  })
  assert.equal(confirmed.success, true, confirmed.error)
  workspace.orders = confirmed.orders
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialFlour)
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialCupcakes)
  assert.deepEqual(getReservations(workspace.orders)[flour.id], 0.2)

  const started = transition(workspace, order.id, 'start', [], getReservations(workspace.orders))
  assert.equal(started.success, true)
  workspace.orders = started.orders
  const productionOrder = workspace.orders.find((entry) => entry.id === order.id)
  const usage = productionOrder.requirements.map((requirement) => ({
    materialId: requirement.materialId,
    quantity: requirement.quantity,
  }))
  const flourUsage = usage.find((entry) => entry.materialId === flour.id)
  flourUsage.quantity = 0.15
  const produced = transition(workspace, order.id, 'produce', usage, getReservations(workspace.orders))
  assert.equal(produced.success, true, produced.error)
  workspace.items = produced.items
  workspace.transactions = produced.transactions
  workspace.orders = produced.orders
  assert.equal(workspace.items.find((item) => item.id === flour.id).quantity, initialFlour - 0.15)
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialCupcakes + 2)
  assert.equal(workspace.orders.find((entry) => entry.id === order.id).status, 'Ready')
  assert.equal(getReservations(workspace.orders)[flour.id] ?? 0, 0)

  const repeatedProduction = transition(workspace, order.id, 'produce', usage)
  assert.equal(repeatedProduction.success, false)
  assert.deepEqual(repeatedProduction.items, undefined)
  const completed = transition(workspace, order.id, 'complete')
  assert.equal(completed.success, true, completed.error)
  workspace.items = completed.items
  workspace.transactions = completed.transactions
  workspace.orders = completed.orders
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialCupcakes)
  assert.equal(workspace.orders.find((entry) => entry.id === order.id).status, 'Completed')

  const repeatedDispatch = transition(workspace, order.id, 'complete')
  assert.equal(repeatedDispatch.success, false)
  assert.equal(workspace.items.find((item) => item.id === cupcake.id).quantity, initialCupcakes)
})

test('production cancellation releases reservations without stock movement', () => {
  const { workspace, flour, cupcake } = createFixture()
  const initialTransactionCount = workspace.transactions.length
  const order = {
    id: 'ORD-2002',
    status: 'Pending',
    confirmed: false,
    productionRecorded: false,
    dispatched: false,
    lines: [{ productId: cupcake.id, quantity: 1 }],
    requirements: [],
  }
  workspace.orders = [order, ...workspace.orders]
  const confirmed = confirmProductionOrder({
    orders: workspace.orders,
    orderId: order.id,
    items: workspace.items,
    recipes: workspace.recipes,
    now: NOW,
  })
  assert.equal(confirmed.success, true)
  workspace.orders = confirmed.orders
  const beforeItems = structuredClone(workspace.items)
  const cancelled = transition(workspace, order.id, 'cancel', [], getReservations(workspace.orders))
  assert.equal(cancelled.success, true)
  workspace.orders = cancelled.orders
  assert.deepEqual(workspace.items, beforeItems)
  assert.equal(getReservations(workspace.orders)[flour.id] ?? 0, 0)
  assert.equal(workspace.transactions.length, initialTransactionCount)
})

test('failed production confirmation, consumption, and dispatch leave all records unchanged', () => {
  const { workspace, flour, cupcake } = createFixture()
  const order = {
    id: 'ORD-2003',
    status: 'Pending',
    confirmed: false,
    productionRecorded: false,
    dispatched: false,
    lines: [{ productId: cupcake.id, quantity: 2 }],
    requirements: [],
  }
  workspace.orders = [order]
  const confirmation = confirmProductionOrder({
    orders: workspace.orders,
    orderId: order.id,
    items: workspace.items.map((item) => item.id === flour.id ? { ...item, quantity: 0.1 } : item),
    recipes: workspace.recipes,
    now: NOW,
  })
  assert.equal(confirmation.success, false)
  assert.deepEqual(workspace.orders, [order])

  const confirmed = confirmProductionOrder({
    orders: workspace.orders,
    orderId: order.id,
    items: workspace.items,
    recipes: workspace.recipes,
    now: NOW,
  })
  workspace.orders = confirmed.orders.map((entry) => ({ ...entry, status: 'In Progress' }))
  const beforeProduce = {
    items: structuredClone(workspace.items),
    transactions: structuredClone(workspace.transactions),
    orders: structuredClone(workspace.orders),
  }
  const invalidUsage = transition(workspace, order.id, 'produce', [])
  assert.equal(invalidUsage.success, false)
  assert.deepEqual(workspace.items, beforeProduce.items)
  assert.deepEqual(workspace.transactions, beforeProduce.transactions)
  assert.deepEqual(workspace.orders, beforeProduce.orders)

  const usage = workspace.orders[0].requirements.map((requirement) => ({
    materialId: requirement.materialId,
    quantity: requirement.quantity,
  }))
  const excessiveUsage = usage.map((entry) => entry.materialId === flour.id
    ? { ...entry, quantity: workspace.items.find((item) => item.id === flour.id).quantity + 1 }
    : entry)
  const insufficient = transition(workspace, order.id, 'produce', excessiveUsage)
  assert.equal(insufficient.success, false)
  assert.deepEqual(workspace.items, beforeProduce.items)
  assert.deepEqual(workspace.transactions, beforeProduce.transactions)
  assert.deepEqual(workspace.orders, beforeProduce.orders)

  const invalidDispatchOrder = {
    ...workspace.orders[0],
    status: 'Ready',
    productionRecorded: true,
    lines: [{ productId: cupcake.id, quantity: cupcake.quantity + 1 }],
  }
  workspace.orders = [invalidDispatchOrder]
  const beforeDispatch = structuredClone(workspace)
  const dispatch = transition(workspace, order.id, 'complete')
  assert.equal(dispatch.success, false)
  assert.deepEqual(workspace, beforeDispatch)
})

test('transaction outcomes survive workspace saves and reloads without crossing categories', () => {
  const { workspaces, workspace, cupcake } = createFixture()
  const completed = saveSale(workspace, saleOrder({ status: 'Completed' }))
  applyTransactionResult(workspace, completed, 'salesOrders')
  const supplierId = workspace.suppliers[0].id
  const purchase = savePurchase(workspace, purchaseOrder(supplierId, {
    status: 'Partially Received',
    lines: [{ itemId: 'item-flour', unit: 'kg', quantity: 5, unitCost: 2.4, receivedQuantity: 1 }],
  }))
  applyTransactionResult(workspace, purchase, 'purchaseOrders')
  const productionOrder = {
    id: 'ORD-persisted',
    status: 'Pending',
    confirmed: false,
    productionRecorded: false,
    dispatched: false,
    lines: [{ productId: cupcake.id, quantity: 1 }],
    requirements: [],
  }
  workspace.orders = [productionOrder]
  const confirmedProduction = confirmProductionOrder({
    orders: workspace.orders,
    orderId: productionOrder.id,
    items: workspace.items,
    recipes: workspace.recipes,
    now: NOW,
  })
  assert.equal(confirmedProduction.success, true)
  workspace.orders = confirmedProduction.orders
  const started = transition(workspace, productionOrder.id, 'start', [], getReservations(workspace.orders))
  workspace.orders = started.orders
  const orderRequirements = workspace.orders[0].requirements
  const productionUsage = orderRequirements.map((entry) => ({
    materialId: entry.materialId,
    quantity: entry.quantity,
  }))
  const recorded = transition(workspace, productionOrder.id, 'produce', productionUsage, getReservations(workspace.orders))
  assert.equal(recorded.success, true)
  workspace.items = recorded.items
  workspace.transactions = recorded.transactions
  workspace.orders = recorded.orders
  const dispatched = transition(workspace, productionOrder.id, 'complete')
  assert.equal(dispatched.success, true)
  workspace.items = dispatched.items
  workspace.transactions = dispatched.transactions
  workspace.orders = dispatched.orders
  const persistedBalances = Object.fromEntries(workspace.items.map((item) => [item.id, item.quantity]))
  const application = {
    workspaces,
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
  }
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem(key) { return values.get(key) ?? null },
      setItem(key, value) { values.set(key, String(value)) },
    },
  }
  try {
    assert.equal(saveApplicationData(application).saved, true)
    const loaded = loadApplicationDataSnapshot(
      JSON.parse(values.get('kosthagara-application-v1')),
      createDemoWorkspaces(),
    )
    const loadedWorkspace = loaded.workspaces['home-foods']
    for (const [itemId, quantity] of Object.entries(persistedBalances)) {
      assert.equal(loadedWorkspace.items.find((item) => item.id === itemId).quantity, quantity)
    }
    assert.ok(loadedWorkspace.transactions.some((entry) => entry.type === 'Sales fulfillment'))
    assert.ok(loadedWorkspace.transactions.some((entry) => entry.type === 'Purchase receipt'))
    assert.ok(loadedWorkspace.transactions.some((entry) => entry.type === 'Production usage'))
    assert.ok(loadedWorkspace.transactions.some((entry) => entry.type === 'Production output'))
    assert.ok(loadedWorkspace.transactions.some((entry) => entry.type === 'Order dispatch'))
    assert.equal(loadedWorkspace.salesOrders[0].status, 'Completed')
    assert.equal(loadedWorkspace.purchaseOrders[0].status, 'Partially Received')
    assert.equal(loadedWorkspace.orders[0].status, 'Completed')
    assert.equal(loadedWorkspace.transactions[0].type, 'Order dispatch')
    assert.equal(loaded.workspaces.supermarket.salesOrders.length, 0)

    const switchedCategory = loaded.workspaces.supermarket
    assert.notEqual(switchedCategory.items.find((item) => item.id === cupcake.id)?.quantity, persistedBalances[cupcake.id])
    const returnedWorkspace = loaded.workspaces['home-foods']
    assert.equal(returnedWorkspace.items.find((item) => item.id === cupcake.id).quantity, persistedBalances[cupcake.id])
  } finally {
    delete globalThis.window
  }
})
