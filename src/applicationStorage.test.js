import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createApplicationBackup,
  loadApplicationDataSnapshot,
  restoreApplicationBackup,
  validateApplicationBackup,
} from './applicationStorage.js'
import { createDemoWorkspaces } from './categoryInventoryData.js'

function makeBackup() {
  const workspaces = createDemoWorkspaces()
  const home = workspaces['home-foods']
  home.items[0] = { ...home.items[0], quantity: 7.25, costPerUnit: 2.37, currencyCode: 'USD' }
  home.transactions[0] = { ...home.transactions[0], quantity: 7.25, balance: 7.25, cost: 2.37, currencyCode: 'USD' }
  home.salesOrders.push({
    id: 'sale-1',
    customer: 'Test customer',
    orderDate: '2026-10-24',
    currencyCode: 'USD',
    status: 'Completed',
    lines: [{ itemId: home.items[0].id, quantity: 2, unitPrice: 3.19 }],
  })
  home.purchaseOrders.push({
    id: 'purchase-1',
    supplierId: home.suppliers[0].id,
    orderDate: '2026-10-24',
    currencyCode: 'USD',
    status: 'Partially Received',
    lines: [{ itemId: home.items[0].id, unit: home.items[0].unit, quantity: 5, unitCost: 2.37, receivedQuantity: 2 }],
  })
  home.plannerScenarios.push({
    id: 'scenario-1',
    name: 'Autumn batch',
    category: 'home-foods',
    currencyCode: 'USD',
    productName: 'Bread',
    productQuantity: '12',
    packagingCostPerProduct: '0.15',
    otherExpenses: '3.50',
    sellingPrice: '4.25',
    inventoryProductId: home.items[0].id,
    materials: [{
      id: 'material-1',
      itemId: home.items[0].id,
      name: home.items[0].name,
      quantityPerProduct: '0.5',
      unit: home.items[0].unit,
      costPerUnit: '2.37',
    }],
  })
  return createApplicationBackup({
    workspaces,
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
    customApplicationField: { preserved: true },
  }, {
    countryCode: 'USA',
    locale: 'en-IN',
    currency: 'USD',
  }, '2026-10-24T12:00:00.000Z')
}

function installMemoryStorage() {
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem(key) { return values.get(key) ?? null },
      setItem(key, value) { values.set(key, String(value)) },
      removeItem(key) { values.delete(key) },
    },
  }
  return values
}

test('backup export contains its version, timestamp, scope, and supported business data', () => {
  const backup = makeBackup()
  const validation = validateApplicationBackup(backup)

  assert.equal(backup.format, 'kosthagara-backup')
  assert.equal(backup.backupVersion, 1)
  assert.equal(backup.exportedAt, '2026-10-24T12:00:00.000Z')
  assert.match(backup.description, /all category workspaces/)
  assert.equal(validation.valid, true)
  assert.equal(validation.data.application.workspaces['home-foods'].items[0].quantity, 7.25)
  assert.equal(validation.data.application.workspaces['home-foods'].salesOrders[0].lines[0].unitPrice, 3.19)
  assert.equal(validation.data.application.workspaces['home-foods'].purchaseOrders[0].lines[0].unitCost, 2.37)
  assert.equal(validation.data.application.workspaces['home-foods'].plannerScenarios[0].materials[0].costPerUnit, '2.37')
  assert.deepEqual(validation.data.application.customApplicationField, { preserved: true })
})

test('backup export excludes credential-like fields and validation rejects backups containing them', () => {
  const backup = createApplicationBackup({
    ...makeBackup().data.application,
    customApplicationField: {
      preserved: true,
      accessToken: 'must-not-export',
      nested: { oneTimeCode: '123456' },
    },
  }, { countryCode: 'USA', locale: 'en-IN', currency: 'USD' }, '2026-10-24T12:00:00.000Z')

  assert.deepEqual(backup.data.application.customApplicationField, { preserved: true, nested: {} })
  assert.match(backup.description, /tokens, credentials, and OTP values are excluded/)
  assert.equal(validateApplicationBackup(backup).valid, true)

  const unsafeBackup = structuredClone(backup)
  unsafeBackup.data.application.customApplicationField.apiSecret = 'must-not-import'
  const validation = validateApplicationBackup(unsafeBackup)
  assert.equal(validation.valid, false)
  assert.match(validation.message, /contains password, authentication, credential, token, or OTP fields/)

  const values = installMemoryStorage()
  values.set('kosthagara-application-v1', 'existing application')
  values.set('kosthagara-currency-v1', 'existing currency')
  const result = restoreApplicationBackup(unsafeBackup)
  assert.equal(result.saved, false)
  assert.equal(values.get('kosthagara-application-v1'), 'existing application')
  assert.equal(values.get('kosthagara-currency-v1'), 'existing currency')
  delete globalThis.window
})

test('backup validation rejects malformed structure, unsupported versions, and invalid types', () => {
  const backup = makeBackup()

  assert.equal(validateApplicationBackup(null).valid, false)
  assert.match(validateApplicationBackup({ ...backup, backupVersion: 2 }).message, /Unsupported backup version/)
  assert.match(validateApplicationBackup({ ...backup, data: { ...backup.data, application: undefined } }).message, /Required application/)

  const invalidQuantity = structuredClone(backup)
  invalidQuantity.data.application.workspaces['home-foods'].items[0].quantity = '7.25'
  assert.match(validateApplicationBackup(invalidQuantity).message, /invalid inventory/)

  const invalidCurrency = structuredClone(backup)
  invalidCurrency.data.currencySettings.currency = 'XXX-NOT-A-CURRENCY'
  assert.match(validateApplicationBackup(invalidCurrency).message, /country, currency, or locale settings/)
})

test('backup validation rejects unsupported business currencies and malformed business dates', () => {
  const invalidSaleCurrency = makeBackup()
  invalidSaleCurrency.data.application.workspaces['home-foods'].salesOrders[0].currencyCode = 'XXX'
  assert.equal(validateApplicationBackup(invalidSaleCurrency).valid, false)

  const invalidItemCurrency = makeBackup()
  invalidItemCurrency.data.application.workspaces['home-foods'].items[0].currencyCode = 'XXX'
  assert.equal(validateApplicationBackup(invalidItemCurrency).valid, false)

  const invalidPurchaseCurrency = makeBackup()
  invalidPurchaseCurrency.data.application.workspaces['home-foods'].purchaseOrders[0].currencyCode = 'XXX'
  assert.equal(validateApplicationBackup(invalidPurchaseCurrency).valid, false)

  const invalidExpenseCurrency = makeBackup()
  invalidExpenseCurrency.data.application.workspaces['home-foods'].expenses = [{
    id: 'expense-1',
    description: 'Transport',
    date: '2026-10-24',
    amount: 5,
    currencyCode: 'XXX',
  }]
  assert.equal(validateApplicationBackup(invalidExpenseCurrency).valid, false)

  const invalidSalesDate = makeBackup()
  invalidSalesDate.data.application.workspaces['home-foods'].salesOrders[0].orderDate = 'not-a-date'
  assert.equal(validateApplicationBackup(invalidSalesDate).valid, false)

  const invalidPurchaseDate = makeBackup()
  invalidPurchaseDate.data.application.workspaces['home-foods'].purchaseOrders[0].expectedDate = '2026-02-30'
  assert.equal(validateApplicationBackup(invalidPurchaseDate).valid, false)
})

test('local workspace loading blocks unsupported order currencies without modifying saved data', () => {
  const workspaces = createDemoWorkspaces()
  workspaces['home-foods'].salesOrders.push({
    id: 'sale-invalid-currency',
    currencyCode: 'XXX',
    lines: [],
  })

  assert.throws(() => loadApplicationDataSnapshot({
    version: 1,
    workspaces,
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: true,
  }, createDemoWorkspaces()), /incomplete or invalid/)
})

test('invalid backups never modify existing local application or currency data', () => {
  const values = installMemoryStorage()
  values.set('kosthagara-application-v1', 'existing application')
  values.set('kosthagara-currency-v1', 'existing currency')
  const backup = makeBackup()
  backup.backupVersion = 99

  const result = restoreApplicationBackup(backup)
  assert.equal(result.saved, false)
  assert.equal(values.get('kosthagara-application-v1'), 'existing application')
  assert.equal(values.get('kosthagara-currency-v1'), 'existing currency')
  delete globalThis.window
})

test('valid backup restore preserves inventory, orders, planner, currency, and unknown fields exactly', () => {
  const values = installMemoryStorage()
  const backup = makeBackup()
  const result = restoreApplicationBackup(backup)

  assert.equal(result.saved, true)
  const restoredApplication = JSON.parse(values.get('kosthagara-application-v1'))
  const restoredCurrency = JSON.parse(values.get('kosthagara-currency-v1'))
  const home = restoredApplication.workspaces['home-foods']
  assert.equal(home.items[0].quantity, 7.25)
  assert.equal(home.items[0].costPerUnit, 2.37)
  assert.equal(home.transactions[0].quantity, 7.25)
  assert.equal(home.salesOrders[0].lines[0].unitPrice, 3.19)
  assert.equal(home.purchaseOrders[0].lines[0].receivedQuantity, 2)
  assert.equal(home.plannerScenarios[0].otherExpenses, '3.50')
  assert.deepEqual(restoredApplication.customApplicationField, { preserved: true })
  assert.deepEqual(restoredCurrency, backup.data.currencySettings)
  assert.equal(home.transactions.length, backup.data.application.workspaces['home-foods'].transactions.length)
  delete globalThis.window
})

test('failed partial storage writes roll back the pre-import data', () => {
  const values = installMemoryStorage()
  values.set('kosthagara-application-v1', 'existing application')
  values.set('kosthagara-currency-v1', 'existing currency')
  let currencyWriteCount = 0
  globalThis.window.localStorage.setItem = (key, value) => {
    if (key === 'kosthagara-currency-v1' && currencyWriteCount++ === 0) throw new Error('quota exceeded')
    values.set(key, String(value))
  }

  const result = restoreApplicationBackup(makeBackup())
  assert.equal(result.saved, false)
  assert.match(result.message, /Existing browser data was restored/)
  assert.equal(values.get('kosthagara-application-v1'), 'existing application')
  assert.equal(values.get('kosthagara-currency-v1'), 'existing currency')
  delete globalThis.window
})
