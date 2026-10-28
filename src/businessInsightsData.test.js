import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateBusinessInsights,
  filterInsightItems,
  insightsToCsv,
} from './businessInsightsData.js'

const NOW = new Date('2026-10-24T12:00:00.000Z')
const items = [
  { id: 'low', name: 'Low flour', sku: 'A,1', category: 'Baking', unit: 'kg', quantity: 2, reorderLevel: 3, costPerUnit: 4, currencyCode: 'USD', targetStock: 10 },
  { id: 'excess', name: 'Extra sugar', sku: 'B2', category: 'Baking', unit: 'kg', quantity: 12, reorderLevel: 2, costPerUnit: 2, currencyCode: 'USD', targetStock: 10 },
  { id: 'unsold', name: 'Quiet tea', sku: 'C3', category: 'Drinks', unit: 'packs', quantity: 4, reorderLevel: 1, costPerUnit: 3, currencyCode: 'EUR' },
  { id: 'missing-cost', name: 'Unknown cost', sku: 'D4', category: 'Drinks', unit: 'pieces', quantity: 3, reorderLevel: 1 },
]

function order(id, orderDate, status, lines, currencyCode = 'USD') {
  return { id, orderDate, status, lines, currencyCode }
}

test('inventory valuation uses stored cost and groups totals by currency without conversion', () => {
  const insights = calculateBusinessInsights({ items, now: NOW })
  assert.equal(insights.inventoryValueByCurrency.USD, 32)
  assert.equal(insights.inventoryValueByCurrency.EUR, 12)
  assert.equal(insights.valuedItemCount, 3)
  assert.equal(insights.totalItemCount, 4)
  const formatted = Object.entries(insights.inventoryValueByCurrency)
    .map(([currency, amount]) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount))
  assert.deepEqual(formatted, ['$32.00', '€12.00'])
})

test('reorder and excess recommendations use configured thresholds and explicit targets only', () => {
  const insights = calculateBusinessInsights({ items, now: NOW })
  assert.deepEqual(insights.reorderItems.map((item) => item.id), ['low'])
  assert.deepEqual(insights.excessItems.map(({ item }) => item.id), ['excess'])
  assert.deepEqual(insights.itemsWithoutTarget.map((item) => item.id), ['unsold', 'missing-cost'])
  assert.ok(insights.recommendations.some(({ id }) => id === 'reorder-low'))
  assert.ok(insights.recommendations.some(({ id }) => id === 'excess-excess'))
  assert.ok(insights.recommendations.some(({ id }) => id === 'missing-stock-targets'))
})

test('missing or invalid costs are excluded and never interpreted as zero', () => {
  const changed = [
    ...items,
    { id: 'bad-cost', name: 'Bad cost', category: 'Baking', unit: 'kg', quantity: 2, reorderLevel: 1, costPerUnit: Number.NaN, currencyCode: 'USD' },
  ]
  const insights = calculateBusinessInsights({ items: changed, now: NOW })
  assert.equal(insights.inventoryValueByCurrency.USD, 32)
  assert.deepEqual(insights.missingCostItems.map((item) => item.id), ['missing-cost'])
  assert.deepEqual(insights.invalidCostItems.map((item) => item.id), ['bad-cost'])
  assert.ok(insights.recommendations.some(({ id }) => id === 'missing-cost-missing-cost'))
  assert.ok(insights.recommendations.some(({ id }) => id === 'invalid-cost-bad-cost'))
})

test('trends, profit, fast/slow items, and demand estimates use dated completed orders only', () => {
  const trendItems = [
    ...items,
    { id: 'sales-2', name: 'Sales item two', unit: 'pieces', quantity: 8, reorderLevel: 1, costPerUnit: 0, currencyCode: 'USD' },
    { id: 'sales-3', name: 'Sales item three', unit: 'pieces', quantity: 8, reorderLevel: 1, costPerUnit: 0, currencyCode: 'USD' },
    { id: 'sales-4', name: 'Sales item four', unit: 'pieces', quantity: 8, reorderLevel: 1, costPerUnit: 0, currencyCode: 'USD' },
  ]
  const salesOrders = [
    order('old-history', '2026-08-01', 'Completed', [{ itemId: 'low', quantity: 1, unitPrice: 9 }]),
    order('previous', '2026-09-20', 'Completed', [{ itemId: 'low', quantity: 2, unitPrice: 10 }]),
    order('current', '2026-10-20', 'Completed', [
      { itemId: 'low', quantity: 3, unitPrice: 10 },
      { itemId: 'sales-2', quantity: 2, unitPrice: 0 },
      { itemId: 'sales-3', quantity: 1, unitPrice: 0 },
      { itemId: 'sales-4', quantity: 0.5, unitPrice: 0 },
    ]),
    order('cancelled', '2026-10-21', 'Cancelled', [{ itemId: 'low', quantity: 100, unitPrice: 100 }]),
    order('pending', '2026-10-22', 'Pending', [{ itemId: 'low', quantity: 200, unitPrice: 100 }]),
  ]
  const insights = calculateBusinessInsights({ items: trendItems, salesOrders, periodDays: 30, now: NOW })
  assert.equal(insights.demandHistory.sufficient, true)
  assert.equal(insights.salesTrend.current.revenueByCurrency.USD, 30)
  assert.equal(insights.salesTrend.previous.revenueByCurrency.USD, 20)
  assert.equal(insights.salesTrend.changePercent, 50)
  assert.equal(insights.estimatedGrossProfitByCurrency.USD, 18)
  assert.equal(insights.demandEstimates.find(({ item }) => item.id === 'low').dailyAverage, 0.1)
  assert.ok(insights.fastMovingItems.some(({ item }) => item.id === 'low'))
  assert.ok(insights.slowMovingItems.some(({ item }) => item.id === 'sales-4'))
  assert.ok(insights.noSalesItems.some(({ item }) => item.id === 'unsold'))
})

test('gross profit is unavailable when sold item cost is missing or currency differs', () => {
  const salesOrders = [
    order('history', '2026-08-01', 'Completed', [{ itemId: 'low', quantity: 1, unitPrice: 9 }]),
    order('missing-cost-sale', '2026-10-20', 'Completed', [{ itemId: 'missing-cost', quantity: 1, unitPrice: 10 }]),
  ]
  const insights = calculateBusinessInsights({ items, salesOrders, periodDays: 30, now: NOW })
  assert.equal(insights.grossProfitAvailable, false)
  assert.equal(insights.estimatedGrossProfitByCurrency, null)
})

test('insufficient observation period suppresses estimates and no-sales conclusions', () => {
  const salesOrders = [order('recent', '2026-10-10', 'Completed', [{ itemId: 'low', quantity: 2, unitPrice: 10 }])]
  const insights = calculateBusinessInsights({ items, salesOrders, periodDays: 90, now: NOW })
  assert.equal(insights.demandHistory.sufficient, false)
  assert.deepEqual(insights.demandEstimates, [])
  assert.deepEqual(insights.noSalesItems, [])
  assert.ok(insights.recommendations.some(({ id }) => id === 'insufficient-sales-history'))
})

test('reorder guidance accounts for matching-unit open purchase quantities without creating orders', () => {
  const insights = calculateBusinessInsights({
    items,
    purchaseOrders: [{
      id: 'PO-open',
      status: 'Partially Received',
      lines: [{ itemId: 'low', unit: 'kg', quantity: 10, receivedQuantity: 4 }],
    }, {
      id: 'PO-cancelled',
      status: 'Cancelled',
      lines: [{ itemId: 'low', unit: 'kg', quantity: 100, receivedQuantity: 0 }],
    }],
    now: NOW,
  })
  const recommendation = insights.recommendations.find(({ id }) => id === 'reorder-low')
  assert.match(recommendation.support, /6 kg remain on open purchase orders/)
  assert.match(recommendation.nextAction, /open purchase order/)
})

test('missing dates, malformed sales, cancelled purchases, and inconsistent units are reported safely', () => {
  const purchaseOrders = [{
    id: 'PO-1',
    status: 'Ordered',
    lines: [{ itemId: 'low', unit: 'pieces' }],
  }, {
    id: 'PO-2',
    status: 'Cancelled',
    lines: [{ itemId: 'excess', unit: 'pieces' }],
  }]
  const insights = calculateBusinessInsights({
    items,
    salesOrders: [
      order('bad-date', 'not-a-date', 'Completed', [{ itemId: 'low', quantity: 1, unitPrice: 2 }]),
      order('bad-line', '2026-10-21', 'Completed', [{ itemId: 'low', quantity: -1, unitPrice: 2 }]),
    ],
    purchaseOrders,
    now: NOW,
  })
  assert.equal(insights.dataQuality.missingSalesDateCount, 1)
  assert.equal(insights.dataQuality.invalidSalesOrderCount, 1)
  assert.equal(insights.dataQuality.unitIssues.length, 1)
  assert.equal(insights.dataQuality.unitIssues[0].orderName, 'PO-1')
})

test('item filtering and CSV export support category/search filters and escaped delimiters', () => {
  assert.deepEqual(filterInsightItems(items, { search: 'a,1', category: 'Baking' }).map((item) => item.id), ['low'])
  const insights = calculateBusinessInsights({ items, now: NOW })
  const csv = insightsToCsv(insights)
  assert.ok(csv.startsWith('"Type","Severity","Product"'))
  assert.ok(csv.includes('"Low flour"'))
  assert.ok(csv.includes('"A,1"'))
  assert.ok(csv.includes('"Extra sugar exceeds its configured stock target"'))
})

test('insight calculations do not mutate stored item, sales, or purchase data', () => {
  const originalItems = structuredClone(items)
  const salesOrders = [order('sale', '2026-10-20', 'Completed', [{ itemId: 'low', quantity: 1, unitPrice: 10 }])]
  const purchaseOrders = [{ id: 'PO-3', status: 'Ordered', lines: [{ itemId: 'low', unit: 'kg' }] }]
  const originalSales = structuredClone(salesOrders)
  const originalPurchases = structuredClone(purchaseOrders)
  calculateBusinessInsights({ items, salesOrders, purchaseOrders, now: NOW })
  filterInsightItems(items, { search: 'flour' })
  insightsToCsv(calculateBusinessInsights({ items, salesOrders, purchaseOrders, now: NOW }))
  assert.deepEqual(items, originalItems)
  assert.deepEqual(salesOrders, originalSales)
  assert.deepEqual(purchaseOrders, originalPurchases)
})

test('empty and malformed datasets return safe zero metrics and useful data-quality guidance', () => {
  const empty = calculateBusinessInsights({ items: null, salesOrders: {}, purchaseOrders: null, now: NOW })
  assert.equal(empty.totalItemCount, 0)
  assert.deepEqual(empty.inventoryValueByCurrency, {})
  assert.deepEqual(empty.reorderItems, [])
  assert.deepEqual(empty.dataQuality.unitIssues, [])
  assert.ok(empty.recommendations.some(({ id }) => id === 'insufficient-sales-history'))
  assert.equal(calculateBusinessInsights(null,).totalItemCount, 0)
})
