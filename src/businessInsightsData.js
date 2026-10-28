import { CURRENCIES } from './businessData.js'

const DEFAULT_OBSERVATION_DAYS = 90
const MINIMUM_DEMAND_HISTORY_DAYS = 28
const MINIMUM_ITEMS_FOR_MOVEMENT_RANKING = 4

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function dateOffset(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function daysBetween(first, last) {
  return Math.floor((Date.parse(`${last}T00:00:00.000Z`) - Date.parse(`${first}T00:00:00.000Z`)) / 86400000)
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0
}

function isSupportedCurrency(currencyCode) {
  return typeof currencyCode === 'string' && CURRENCIES.some(({ code }) => code === currencyCode)
}

function groupTotals(records, getAmount, getCurrency) {
  return records.reduce((totals, record) => {
    const currency = getCurrency(record)
    const amount = getAmount(record)
    if (isSupportedCurrency(currency) && Number.isFinite(amount)) {
      const total = (totals[currency] ?? 0) + amount
      if (Number.isFinite(total)) totals[currency] = total
    }
    return totals
  }, {})
}

export function calculateBusinessInsights(options = {}) {
  const {
    items = [],
    salesOrders = [],
    purchaseOrders = [],
    periodDays = DEFAULT_OBSERVATION_DAYS,
    now = new Date(),
  } = options && typeof options === 'object' ? options : {}
  const today = now.toISOString().slice(0, 10)
  const days = Number(periodDays)
  const observationDays = Number.isInteger(days) && days > 0 ? days : DEFAULT_OBSERVATION_DAYS
  const periodStart = dateOffset(today, -(observationDays - 1))
  const previousStart = dateOffset(periodStart, -observationDays)
  const previousEnd = dateOffset(periodStart, -1)
  const safeItems = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : []
  const itemsById = new Map(safeItems.filter((item) => typeof item.id === 'string').map((item) => [item.id, item]))
  const validCompletedOrders = []
  let invalidSalesOrderCount = 0
  let invalidSalesLineCount = 0
  let missingSalesDateCount = 0
  const incompleteSalesDates = []

  for (const order of Array.isArray(salesOrders) ? salesOrders : []) {
    if (!order || typeof order !== 'object' || order.status !== 'Completed') continue
    if (!validDate(order.orderDate)) {
      missingSalesDateCount += 1
      incompleteSalesDates.push('')
      continue
    }
    if (!Array.isArray(order.lines) || !order.lines.length || !isSupportedCurrency(order.currencyCode)) {
      invalidSalesOrderCount += 1
      incompleteSalesDates.push(order.orderDate)
      continue
    }
    const validLines = []
    for (const line of order.lines) {
      if (!line || typeof line.itemId !== 'string'
        || !Number.isFinite(line.quantity) || line.quantity <= 0
        || !Number.isFinite(line.unitPrice) || line.unitPrice < 0
        || !Number.isFinite(line.quantity * line.unitPrice)
        || !itemsById.has(line.itemId)) {
        invalidSalesLineCount += 1
        incompleteSalesDates.push(order.orderDate)
        continue
      }
      validLines.push(line)
    }
    if (!validLines.length) {
      invalidSalesOrderCount += 1
      continue
    }
    validCompletedOrders.push({ ...order, lines: validLines })
  }

  const inventoryValues = []
  const missingCostItems = []
  const invalidQuantityItems = []
  const invalidCostItems = []
  const invalidThresholdItems = []
  const reorderItems = []
  const excessItems = []
  const missingTargetItems = []
  const unitIssues = []
  const outstandingPurchaseQuantities = new Map()

  for (const item of safeItems) {
    if (!isFiniteNonNegative(item.quantity)) {
      invalidQuantityItems.push(item)
    }
    if (isFiniteNonNegative(item.quantity) && isFiniteNonNegative(item.costPerUnit)
      && Number.isFinite(item.quantity * item.costPerUnit)
      && isSupportedCurrency(item.currencyCode)) {
      inventoryValues.push({
        currencyCode: item.currencyCode,
        value: item.quantity * item.costPerUnit,
      })
    } else if (item.costPerUnit === undefined || item.costPerUnit === null || item.costPerUnit === '') {
      missingCostItems.push(item)
    } else if (typeof item.costPerUnit !== 'number' || !Number.isFinite(item.costPerUnit) || item.costPerUnit < 0) {
      invalidCostItems.push(item)
    } else if (!isSupportedCurrency(item.currencyCode)) {
      missingCostItems.push(item)
    } else if (!Number.isFinite(item.quantity * item.costPerUnit)) {
      invalidCostItems.push(item)
    }

    if (Number.isFinite(item.quantity) && item.quantity >= 0
      && Number.isFinite(item.reorderLevel) && item.reorderLevel >= 0
      && item.quantity <= item.reorderLevel) reorderItems.push(item)
    if (!Number.isFinite(item.reorderLevel) || item.reorderLevel < 0) invalidThresholdItems.push(item)

    const target = item.targetStock ?? item.maxStock ?? item.targetQuantity ?? item.maximumStock
    if (target !== undefined) {
      if (Number.isFinite(item.quantity) && Number.isFinite(target) && target >= 0 && item.quantity > target) {
        excessItems.push({ item, target })
      } else if (!Number.isFinite(target) || target < 0) {
        invalidThresholdItems.push(item)
      }
    } else {
      missingTargetItems.push(item)
    }
  }

  for (const order of Array.isArray(purchaseOrders) ? purchaseOrders : []) {
    if (!order || typeof order !== 'object' || order.status === 'Cancelled' || !Array.isArray(order.lines)) continue
    for (const line of order.lines) {
      const item = itemsById.get(line?.itemId)
      if (item && line.unit && item.unit && line.unit !== item.unit) {
        unitIssues.push({ item, orderName: order.id ?? 'Purchase order', lineUnit: line.unit })
      }
      if (item && ['Draft', 'Ordered', 'Partially Received'].includes(order.status)
        && line.unit === item.unit
        && Number.isFinite(line.quantity) && line.quantity >= 0
        && Number.isFinite(line.receivedQuantity ?? 0) && (line.receivedQuantity ?? 0) >= 0) {
        const remaining = Math.max(0, line.quantity - (line.receivedQuantity ?? 0))
        if (remaining > 0) {
          const current = outstandingPurchaseQuantities.get(item.id) ?? { quantity: 0, orders: [] }
          current.quantity += remaining
          current.orders.push(order.id ?? 'Purchase order')
          outstandingPurchaseQuantities.set(item.id, current)
        }
      }
    }
  }

  const firstSalesDate = validCompletedOrders.reduce((first, order) =>
    !first || order.orderDate < first ? order.orderDate : first, '')
  const historyCoverageDays = firstSalesDate ? Math.max(1, daysBetween(firstSalesDate, today) + 1) : 0
  const hasSufficientHistory = historyCoverageDays >= Math.max(MINIMUM_DEMAND_HISTORY_DAYS, observationDays)
  const periodSales = validCompletedOrders.filter((order) => order.orderDate >= periodStart && order.orderDate <= today)
  const previousSales = validCompletedOrders.filter((order) => order.orderDate >= previousStart && order.orderDate <= previousEnd)
  const incompleteCurrentSales = incompleteSalesDates.some((date) => !date || (date >= periodStart && date <= today))

  function summarizeSales(orders) {
    const revenueByCurrency = {}
    const quantitiesByItem = new Map()
    let lineCount = 0
    for (const order of orders) {
      for (const line of order.lines) {
        const lineRevenue = line.quantity * line.unitPrice
        if (!Number.isFinite(lineRevenue)) {
          continue
        }
        const revenueTotal = (revenueByCurrency[order.currencyCode] ?? 0) + lineRevenue
        if (!Number.isFinite(revenueTotal)) continue
        revenueByCurrency[order.currencyCode] = revenueTotal
        lineCount += 1
        quantitiesByItem.set(line.itemId, (quantitiesByItem.get(line.itemId) ?? 0) + line.quantity)
      }
    }
    return { revenueByCurrency, quantitiesByItem, lineCount, orders: orders.length }
  }

  const currentSales = summarizeSales(periodSales)
  const previousPeriodSales = summarizeSales(previousSales)
  const grossProfitByCurrency = {}
  let grossProfitAvailable = validCompletedOrders.some((order) => order.orderDate >= periodStart && order.orderDate <= today)
    && !incompleteCurrentSales
  for (const order of periodSales) {
    for (const line of order.lines) {
      const item = itemsById.get(line.itemId)
      if (!item || !isFiniteNonNegative(item.costPerUnit) || item.currencyCode !== order.currencyCode) {
        grossProfitAvailable = false
        continue
      }
      const grossProfit = (grossProfitByCurrency[order.currencyCode] ?? 0)
        + (line.unitPrice - item.costPerUnit) * line.quantity
      if (!Number.isFinite(grossProfit)) {
        grossProfitAvailable = false
        continue
      }
      grossProfitByCurrency[order.currencyCode] = grossProfit
    }
  }

  const demandByItem = safeItems.map((item) => {
    const soldQuantity = currentSales.quantitiesByItem.get(item.id) ?? 0
    const dailyAverage = hasSufficientHistory ? soldQuantity / observationDays : null
    return { item, soldQuantity, dailyAverage }
  })
  const soldWithDemand = demandByItem.filter((entry) => entry.soldQuantity > 0 && entry.dailyAverage !== null)
    .sort((first, second) => second.dailyAverage - first.dailyAverage
      || String(first.item.name ?? '').localeCompare(String(second.item.name ?? '')))
  const rankedCount = Math.ceil(soldWithDemand.length * 0.25)
  const fastMovingItems = soldWithDemand.length >= MINIMUM_ITEMS_FOR_MOVEMENT_RANKING
    ? soldWithDemand.slice(0, rankedCount)
    : []
  const slowMovingItems = soldWithDemand.length >= MINIMUM_ITEMS_FOR_MOVEMENT_RANKING
    ? soldWithDemand.slice(-rankedCount)
    : []
  const noSalesItems = hasSufficientHistory
    ? demandByItem.filter((entry) => entry.soldQuantity === 0)
    : []
  const demandEstimates = hasSufficientHistory
    ? demandByItem.map((entry) => ({
      ...entry,
      observationDays,
      estimatedNextPeriodDemand: entry.soldQuantity,
      method: `${entry.soldQuantity} completed units over the last ${observationDays} calendar days`,
    }))
    : []

  const currentCurrencyTotals = groupTotals(inventoryValues, (entry) => entry.value, (entry) => entry.currencyCode)
  const recommendations = []
  for (const item of reorderItems) {
    const incoming = outstandingPurchaseQuantities.get(item.id)
    recommendations.push({
      id: `reorder-${item.id}`,
      severity: item.quantity <= 0 ? 'high' : 'medium',
      title: item.quantity <= 0 ? `${item.name} is out of stock` : `${item.name} is at or below its reorder level`,
      detected: `On hand: ${item.quantity} ${item.unit}; configured reorder level: ${item.reorderLevel} ${item.unit}.`,
      support: `Current inventory record ${item.sku ? `(${item.sku})` : ''} shows the quantity and threshold.${incoming ? ` ${incoming.quantity} ${item.unit} remain on open purchase orders (${incoming.orders.join(', ')}).` : ' No matching open purchase quantity was found.'}`,
      why: item.quantity <= 0 ? 'The recorded stock balance is zero or lower.' : 'Stock is at or below the threshold configured for this item.',
      nextAction: incoming
        ? 'Review the open purchase order and expected delivery before deciding whether another order is needed.'
        : 'Review the item in Inventory and decide whether to create or update a purchase order.',
      assumptions: 'Uses the current stored quantity, reorder level, and matching-unit unreceived quantities on Draft, Ordered, or Partially Received purchases; no purchase is created automatically.',
      page: item.supplier ? 'Purchases' : 'Inventory',
      product: item,
    })
  }
  for (const { item, dailyAverage } of slowMovingItems) {
    recommendations.push({
      id: `slow-${item.id}`,
      severity: 'low',
      title: `${item.name} is among the slower-moving items`,
      detected: `Recorded average: ${dailyAverage.toFixed(3)} ${item.unit} per day over ${observationDays} days.`,
      support: `${currentSales.quantitiesByItem.get(item.id)} units from completed, dated sales orders in the selected observation period.`,
      why: 'Slower observed movement may leave stock on hand for longer, though demand can vary by season or business.',
      nextAction: 'Review current purchasing plans and the item’s stock level; do not reduce stock solely on this estimate.',
      assumptions: 'Ranked against other items with sales in this workspace using the lower quartile of their simple historical daily averages.',
      page: 'Inventory',
      product: item,
    })
  }
  for (const { item, target } of excessItems) {
    recommendations.push({
      id: `excess-${item.id}`,
      severity: 'low',
      title: `${item.name} exceeds its configured stock target`,
      detected: `On hand: ${item.quantity} ${item.unit}; configured target: ${target} ${item.unit}.`,
      support: 'Current inventory record contains an explicit target or maximum stock field.',
      why: 'Purchasing above the configured target may tie up cash or increase storage needs.',
      nextAction: 'Review future purchasing and the item’s configured stock target.',
      assumptions: 'A target value was explicitly stored; this is not inferred from reorder level.',
      page: 'Purchases',
      product: item,
    })
  }
  for (const item of invalidThresholdItems) {
    recommendations.push({
      id: `invalid-threshold-${item.id}`,
      severity: 'medium',
      title: `${item.name} has an invalid stock threshold`,
      detected: 'Its reorder level or configured target is missing, negative, or not numeric.',
      support: 'Current inventory item threshold fields.',
      why: 'Invalid thresholds prevent reliable reorder and excess-stock recommendations.',
      nextAction: 'Review the item’s reorder level and any explicit target stock value.',
      assumptions: 'No threshold is inferred from historical sales or purchase records.',
      page: 'Inventory',
      product: item,
    })
  }
  for (const { item, dailyAverage } of fastMovingItems) {
    recommendations.push({
      id: `fast-${item.id}`,
      severity: 'medium',
      title: `${item.name} is among the faster-moving items`,
      detected: `Recorded average: ${dailyAverage.toFixed(3)} ${item.unit} per day over ${observationDays} days.`,
      support: `${currentSales.quantitiesByItem.get(item.id)} units from completed, dated sales orders in the selected observation period.`,
      why: 'Higher recorded demand can make stockouts more likely if replenishment is delayed.',
      nextAction: 'Monitor this item more frequently and review its reorder threshold.',
      assumptions: 'A simple historical average; it is not a guaranteed forecast and assumes sales units match the inventory unit.',
      page: 'Inventory',
      product: item,
    })
  }
  for (const entry of noSalesItems) {
    recommendations.push({
      id: `no-sales-${entry.item.id}`,
      severity: 'low',
      title: `${entry.item.name} had no recorded sales in the observation period`,
      detected: `No valid completed sale was recorded during the last ${observationDays} days.`,
      support: 'Completed sales orders with valid dates were checked; cancelled, pending, and confirmed orders were excluded.',
      why: 'No sales may indicate slow demand, incomplete records, or a product that is not sold individually.',
      nextAction: 'Review sales records and consider whether current stock levels remain appropriate.',
      assumptions: `Sales history reaches back ${historyCoverageDays} days; no sales before the available recorded history can be inferred.`,
      page: 'Sales orders',
      product: entry.item,
    })
  }
  if (!hasSufficientHistory) {
    recommendations.push({
      id: 'insufficient-sales-history',
      severity: 'info',
      title: 'Sales history is not yet sufficient for demand estimates',
      detected: `The oldest valid completed sales record covers ${historyCoverageDays} day${historyCoverageDays === 1 ? '' : 's'}; at least ${Math.max(MINIMUM_DEMAND_HISTORY_DAYS, observationDays)} days are required for this period.`,
      support: 'Only valid, dated completed sales orders count toward history coverage.',
      why: 'A shorter history may not represent a useful demand pattern.',
      nextAction: 'Continue recording dated sales and revisit insights when the observation period is covered.',
      assumptions: `Requires at least 28 days and full coverage of the selected ${observationDays}-day observation period.`,
      page: 'Sales orders',
    })
  }
  if (hasSufficientHistory && soldWithDemand.length < MINIMUM_ITEMS_FOR_MOVEMENT_RANKING) {
    recommendations.push({
      id: 'insufficient-movement-comparison',
      severity: 'info',
      title: 'Not enough products with sales to rank fast and slow movers',
      detected: `${soldWithDemand.length} products have completed sales in the observation period; at least ${MINIMUM_ITEMS_FOR_MOVEMENT_RANKING} are required for a relative ranking.`,
      support: 'Completed, dated sales orders in the selected period.',
      why: 'A relative movement ranking is not meaningful with too few sold products.',
      nextAction: 'Continue recording dated sales for additional products before comparing movement speed.',
      assumptions: 'Ranks the highest and lowest 25% of sold products when at least four products have sales.',
      page: 'Sales orders',
    })
  }
  for (const item of missingCostItems) {
    recommendations.push({
      id: `missing-cost-${item.id}`,
      severity: 'medium',
      title: `${item.name} is missing usable cost or currency information`,
      detected: 'The inventory value cannot include this item without a valid unit cost and recorded currency.',
      support: 'Current item record has no unit cost or currency code.',
      why: 'Missing cost data makes inventory valuation and gross-profit estimates incomplete.',
      nextAction: 'Review the item record and add a known unit cost and currency if available.',
      assumptions: 'No missing cost is treated as zero.',
      page: 'Items',
      product: item,
    })
  }
  for (const item of invalidCostItems) {
    recommendations.push({
      id: `invalid-cost-${item.id}`,
      severity: 'high',
      title: `${item.name} has an invalid unit cost`,
      detected: 'The stored cost is not a finite, non-negative number.',
      support: 'Current inventory item cost field.',
      why: 'Invalid costs must be corrected before reliable valuation or profit analysis.',
      nextAction: 'Review and correct the item’s recorded unit cost.',
      assumptions: 'The item is excluded from monetary calculations until corrected.',
      page: 'Items',
      product: item,
    })
  }
  for (const item of invalidQuantityItems) {
    recommendations.push({
      id: `invalid-quantity-${item.id}`,
      severity: 'high',
      title: `${item.name} has an invalid stock quantity`,
      detected: 'The recorded quantity is missing, negative, or not a finite number.',
      support: 'Current inventory item quantity field.',
      why: 'Invalid quantity prevents reliable stock valuation and threshold comparisons.',
      nextAction: 'Review the item’s on-hand quantity and correct it in Inventory.',
      assumptions: 'The item is excluded from valid quantity metrics.',
      page: 'Inventory',
      product: item,
    })
  }
  if (missingTargetItems.length) {
    recommendations.push({
      id: 'missing-stock-targets',
      severity: 'info',
      title: 'Excess stock cannot be assessed for items without targets',
      detected: `${missingTargetItems.length} of ${safeItems.length} items do not have an explicit maximum or target stock quantity.`,
      support: 'Inventory records currently provide reorder levels but no configured upper stock targets for these items.',
      why: 'A reorder level is a minimum threshold and does not establish how much stock is excessive.',
      nextAction: 'If excess-stock monitoring is useful, configure explicit item targets in your inventory process before drawing conclusions.',
      assumptions: 'No target is inferred from reorder level, sales averages, or purchase history.',
      page: 'Inventory',
    })
  }
  for (const [issueIndex, issue] of unitIssues.entries()) {
    recommendations.push({
      id: `unit-${issue.orderName}-${issue.item.id}-${issueIndex}`,
      severity: 'high',
      title: `${issue.item.name} has inconsistent purchase and inventory units`,
      detected: `Inventory unit: ${issue.item.unit}; ${issue.orderName} unit: ${issue.lineUnit}.`,
      support: 'The current inventory item and a non-cancelled purchase order line use different unit labels.',
      why: 'Adding received purchase quantities under inconsistent units can make stock figures misleading.',
      nextAction: 'Review the purchase order and item units before recording or relying on receipts.',
      assumptions: 'Units are compared by exact label; this insight does not convert them.',
      page: 'Purchases',
      product: issue.item,
    })
  }

  const salesTrend = {
    current: currentSales,
    previous: previousPeriodSales,
    currentStart: periodStart,
    currentEnd: today,
    previousStart,
    previousEnd,
    comparisonAvailable: firstSalesDate !== '' && firstSalesDate <= previousEnd,
    changePercent: null,
    changePercentByCurrency: {},
  }
  if (salesTrend.comparisonAvailable) {
    const currencies = new Set([
      ...Object.keys(currentSales.revenueByCurrency),
      ...Object.keys(previousPeriodSales.revenueByCurrency),
    ])
    for (const currency of currencies) {
      const previous = previousPeriodSales.revenueByCurrency[currency] ?? 0
      const current = currentSales.revenueByCurrency[currency] ?? 0
      if (previous !== 0) {
        salesTrend.changePercentByCurrency[currency] = ((current - previous) / previous) * 100
      }
    }
    const comparableCurrencies = Object.keys(salesTrend.changePercentByCurrency)
    if (comparableCurrencies.length === 1) {
      salesTrend.changePercent = salesTrend.changePercentByCurrency[comparableCurrencies[0]]
    }
  }

  return {
    periodDays: observationDays,
    periodStart,
    today,
    previousStart,
    previousEnd,
    inventoryValueByCurrency: currentCurrencyTotals,
    valuedItemCount: inventoryValues.length,
    totalItemCount: safeItems.length,
    missingCostItems,
    invalidCostItems,
    invalidQuantityItems,
    invalidThresholdItems,
    reorderItems,
    excessItems,
    itemsWithoutTarget: missingTargetItems,
    fastMovingItems,
    slowMovingItems,
    noSalesItems,
    demandEstimates,
    demandHistory: { firstSalesDate, days: historyCoverageDays, sufficient: hasSufficientHistory },
    salesTrend,
    estimatedGrossProfitByCurrency: grossProfitAvailable ? grossProfitByCurrency : null,
    grossProfitAvailable,
    dataQuality: {
      missingSalesDateCount,
      invalidSalesOrderCount,
      invalidSalesLineCount,
      unitIssues,
      incompleteCurrentSales,
    },
    recommendations,
  }
}

export function filterInsightItems(items, { search = '', category = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase()
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || typeof item !== 'object') return false
    const categoryMatches = category === 'all' || item.category === category
    const searchMatches = !query || `${item.name ?? ''} ${item.sku ?? ''} ${item.category ?? ''}`
      .toLocaleLowerCase().includes(query)
    return categoryMatches && searchMatches
  })
}

function csvCell(value) {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export function insightsToCsv(insights, recommendations = insights.recommendations) {
  const headings = ['Type', 'Severity', 'Product', 'SKU', 'Category', 'Finding', 'Detection', 'Evidence', 'Why it matters', 'Suggested action', 'Assumptions', 'Value']
  const metricRows = [
    ...Object.entries(insights.inventoryValueByCurrency).map(([currency, amount]) => [
      'Metric', '', '', '', '', `Inventory value (${currency})`, 'Current quantity × recorded unit cost', '', '', '', 'Grouped by stored currency; no conversion.', amount,
    ]),
    ['Metric', '', '', '', '', 'Items at or below reorder level', '', '', '', '', 'Uses current quantity and configured reorder level.', insights.reorderItems.length],
    ['Metric', '', '', '', '', 'Items above configured stock target', '', '', '', '', 'Only explicit target/max fields are used.', insights.excessItems.length],
    ...Object.entries(insights.salesTrend.current.revenueByCurrency).map(([currency, amount]) => [
      'Metric', '', '', '', '', `Sales revenue (${currency})`, `${insights.salesTrend.currentStart} through ${insights.salesTrend.currentEnd}`, 'Valid dated Completed sales orders only.', '', '', 'Grouped by stored currency; no conversion.', amount,
    ]),
    ...(insights.estimatedGrossProfitByCurrency
      ? Object.entries(insights.estimatedGrossProfitByCurrency).map(([currency, amount]) => [
        'Metric', '', '', '', '', `Estimated gross profit (${currency})`, 'Completed sales less current item costs', '', '', '', 'Uses current costs, not historical cost at sale.', amount,
      ])
      : [['Metric', '', '', '', '', 'Estimated gross profit', 'Not available', 'Required cost or matching currency data is missing.', '', '', 'Missing costs are not treated as zero.', '']]),
  ]
  return [
    headings.map(csvCell).join(','),
    ...metricRows.map((row) => row.map(csvCell).join(',')),
    ...recommendations.map((recommendation) => [
      'Recommendation',
      recommendation.severity,
      recommendation.product?.name,
      recommendation.product?.sku,
      recommendation.product?.category,
      recommendation.title,
      recommendation.detected,
      recommendation.support,
      recommendation.why,
      recommendation.nextAction,
      recommendation.assumptions,
      '',
    ].map(csvCell).join(',')),
  ].join('\r\n')
}
