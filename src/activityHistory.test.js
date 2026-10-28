import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activityRecordsToCsv,
  appendActivityRecord,
  createActivityRecord,
  filterActivityRecords,
  normalizeActivityHistory,
} from './activityHistory.js'
import {
  loadApplicationDataSnapshot,
  saveApplicationData,
  createApplicationBackup,
  validateApplicationBackup,
} from './applicationStorage.js'
import { createDemoWorkspaces } from './categoryInventoryData.js'
import { getSalesQuantities, getStockDeltas, adjustStock } from './commerceData.js'

function makeRecord(id, timestamp, overrides = {}) {
  return {
    id,
    category: 'inventory',
    action: 'item-edited',
    description: 'Updated stock item',
    timestamp,
    ...overrides,
  }
}

function installMemoryStorage() {
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem(key) { return values.get(key) ?? null },
      setItem(key, value) { values.set(key, String(value)) },
    },
  }
  return values
}

test('activity records are stored per business category and survive workspace reload', () => {
  const values = installMemoryStorage()
  const workspaces = createDemoWorkspaces()
  workspaces['home-foods'].activityHistory = [makeRecord('home-1', '2026-10-24T10:00:00.000Z')]
  workspaces.supermarket.activityHistory = [makeRecord('market-1', '2026-10-24T11:00:00.000Z', { category: 'purchases' })]

  const saved = saveApplicationData({
    workspaces,
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
  })
  assert.equal(saved.saved, true)
  const loaded = loadApplicationDataSnapshot(JSON.parse(values.get('kosthagara-application-v1')), createDemoWorkspaces())
  assert.equal(loaded.workspaces['home-foods'].activityHistory[0].id, 'home-1')
  assert.equal(loaded.workspaces.supermarket.activityHistory[0].id, 'market-1')
  assert.equal(loaded.workspaces['pencil-arts'].activityHistory.length, 0)
  delete globalThis.window
})

test('malformed and duplicate stored history entries are ignored without rejecting workspace data', () => {
  const workspaces = createDemoWorkspaces()
  const parsed = {
    version: 1,
    workspaces: Object.fromEntries(Object.entries(workspaces).map(([id, workspace]) => [id, {
      ...workspace,
      activityHistory: id === 'home-foods' ? [
        makeRecord('valid', '2026-10-24T10:00:00.000Z'),
        makeRecord('valid', '2026-10-24T09:00:00.000Z'),
        { id: 'bad', category: 'password', timestamp: 'not-a-date' },
      ] : undefined,
    }])),
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
  }
  const loaded = loadApplicationDataSnapshot(parsed, createDemoWorkspaces())
  assert.deepEqual(loaded.workspaces['home-foods'].activityHistory.map(({ id }) => id), ['valid'])
  assert.ok(loaded.workspaces['home-foods'].items.length > 0)
  assert.equal(loaded.workspaces.supermarket.activityHistory.length, 0)
})

test('backup validation accepts older workspaces without activity and rejects invalid activity arrays', () => {
  const application = {
    workspaces: createDemoWorkspaces(),
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
  }
  const currencySettings = { countryCode: 'USA', currency: 'USD', locale: 'en-US' }
  const oldBackup = createApplicationBackup(application, currencySettings)
  assert.equal(validateApplicationBackup(oldBackup).valid, true)

  const backupWithHistory = createApplicationBackup({
    ...application,
    workspaces: {
      ...application.workspaces,
      'home-foods': {
        ...application.workspaces['home-foods'],
        activityHistory: [makeRecord('audit-1', '2026-10-24T10:00:00.000Z')],
      },
    },
  }, currencySettings)
  assert.equal(validateApplicationBackup(backupWithHistory).valid, true)
  backupWithHistory.data.application.workspaces['home-foods'].activityHistory = [{ id: 'bad' }]
  assert.equal(validateApplicationBackup(backupWithHistory).valid, false)
})

test('activity history sorts newest first, filters by query, category, and local date', () => {
  const records = [
    makeRecord('old', '2026-10-20T10:00:00.000Z', { itemName: 'Flour' }),
    makeRecord('new', '2026-10-24T10:00:00.000Z', {
      category: 'sales',
      description: 'Completed order SO-12',
      orderName: 'SO-12',
    }),
    makeRecord('middle', '2026-10-22T10:00:00.000Z', { category: 'purchases', itemName: 'Sugar' }),
  ]
  assert.deepEqual(normalizeActivityHistory(records).map(({ id }) => id), ['new', 'middle', 'old'])
  const filtered = filterActivityRecords(records, {
    query: 'SO-12',
    category: 'sales',
    from: '2026-10-24',
    to: '2026-10-24',
  })
  assert.deepEqual(filtered.map(({ id }) => id), ['new'])
})

test('CSV output escapes commas, quotes, and newlines', () => {
  const csv = activityRecordsToCsv([makeRecord('csv', '2026-10-24T10:00:00.000Z', {
    description: 'Updated "Flour", stock\nand notes',
    itemName: 'Flour, organic',
    quantity: 3.5,
    unit: 'kg',
  })])
  assert.match(csv, /^"Timestamp","Category","Action","Description"/)
  assert.ok(csv.includes('"Updated ""Flour"", stock\nand notes"'))
  assert.ok(csv.includes('"Flour, organic"'))
  assert.ok(csv.endsWith('"3.5","kg"'))
  assert.equal(activityRecordsToCsv([]).split('\r\n').length, 1)
})

test('append prevents duplicate record IDs and rejects invalid records', () => {
  const record = makeRecord('same', '2026-10-24T10:00:00.000Z')
  const once = appendActivityRecord([], record)
  const twice = appendActivityRecord(once, record)
  assert.equal(twice.length, 1)
  assert.throws(() => appendActivityRecord([], { ...record, category: 'password' }), /invalid/)
})

test('successful inventory and sales stock changes can be logged; failed adjustments add no record', () => {
  const items = createDemoWorkspaces()['home-foods'].items
  const product = items.find((item) => item.type === 'Finished Product')
  const initialHistory = []
  const changedItems = adjustStock(items, { [product.id]: -1 })
  const inventoryRecord = createActivityRecord({
    category: 'inventory',
    action: 'stock-adjusted',
    description: `Stock out recorded for ${product.name}`,
    itemName: product.name,
    quantity: 1,
    unit: product.unit,
  }, new Date('2026-10-24T10:00:00.000Z'))
  const afterInventory = appendActivityRecord(initialHistory, inventoryRecord)
  assert.equal(changedItems.find(({ id }) => id === product.id).quantity, product.quantity - 1)
  assert.equal(afterInventory.length, 1)

  assert.throws(() => adjustStock(items, { [product.id]: -(product.quantity + 1) }), /Not enough unreserved stock/)
  assert.equal(afterInventory.length, 1)

  const salesDeltas = getStockDeltas({}, getSalesQuantities([{ itemId: product.id, quantity: product.quantity + 1 }]), false, true)
  assert.throws(() => adjustStock(items, salesDeltas), /Not enough unreserved stock/)
  assert.equal(afterInventory.length, 1)

  const enoughStockItem = { ...product, quantity: product.quantity + 10 }
  const salesItems = items.map((item) => item.id === product.id ? enoughStockItem : item)
  const successfulSalesDeltas = getStockDeltas({}, getSalesQuantities([{ itemId: product.id, quantity: 2 }]), false, true)
  const afterSaleItems = adjustStock(salesItems, successfulSalesDeltas)
  const salesRecord = createActivityRecord({
    category: 'sales',
    action: 'sales-order-completed',
    description: 'Completed sales order SO-1001',
    orderName: 'SO-1001',
  }, new Date('2026-10-24T11:00:00.000Z'))
  const finalHistory = appendActivityRecord(afterInventory, salesRecord)
  assert.equal(afterSaleItems.find(({ id }) => id === product.id).quantity, enoughStockItem.quantity - 2)
  assert.equal(finalHistory.length, 2)
})

test('history filtering and CSV preparation do not mutate inventory or sales records', () => {
  const items = createDemoWorkspaces()['home-foods'].items
  const salesOrders = [{ id: 'SO-12', status: 'Completed', lines: [{ itemId: items[0].id, quantity: 1, unitPrice: 2.5 }] }]
  const beforeItems = structuredClone(items)
  const beforeOrders = structuredClone(salesOrders)
  const records = [makeRecord('view', '2026-10-24T10:00:00.000Z', { itemName: items[0].name })]

  const visible = filterActivityRecords(records, { query: items[0].name })
  activityRecordsToCsv(visible)

  assert.deepEqual(items, beforeItems)
  assert.deepEqual(salesOrders, beforeOrders)
})
