import { convertQuantity } from './orderData.js'

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function finiteProduct(...values) {
  const product = values.reduce((total, value) => total * value, 1)
  return Number.isFinite(product) ? product : null
}

function finiteSum(values) {
  const sum = values.reduce((total, value) => total + value, 0)
  return Number.isFinite(sum) ? sum : null
}

function convertedQuantity(quantity, fromUnit, toUnit) {
  const converted = convertQuantity(quantity, fromUnit, toUnit)
  return Number.isFinite(converted) ? converted : null
}

export function calculatePlannerScenario(scenario, items = [], reservations = {}) {
  const plannedQuantityValue = numberOrNull(scenario.productQuantity)
  const plannedQuantity = plannedQuantityValue > 0 ? plannedQuantityValue : null
  const packagingCostPerProduct = numberOrNull(scenario.packagingCostPerProduct)
  const otherExpenses = numberOrNull(scenario.otherExpenses)
  const sellingPrice = numberOrNull(scenario.sellingPrice)
  const materials = scenario.materials ?? []
  const materialResults = materials.map((material) => {
    const quantityPerProduct = numberOrNull(material.quantityPerProduct)
    const costPerUnit = numberOrNull(material.costPerUnit)
    const name = typeof material.name === 'string' ? material.name.trim() : ''
    const unit = typeof material.unit === 'string' ? material.unit.trim() : ''
    const requiredQuantity = plannedQuantity !== null && quantityPerProduct !== null
      ? finiteProduct(plannedQuantity, quantityPerProduct)
      : null
    const linkedItem = items.find((item) => item.id === material.itemId)
    const stockInPlannerUnits = linkedItem
      ? convertedQuantity(linkedItem.quantity, linkedItem.unit, unit)
      : null
    const reservedInPlannerUnits = linkedItem
      ? convertedQuantity(reservations[linkedItem.id] ?? 0, linkedItem.unit, unit)
      : null
    const availableQuantity = stockInPlannerUnits === null || reservedInPlannerUnits === null
      ? null
      : Math.max(0, stockInPlannerUnits - reservedInPlannerUnits)
    const requiredInStockUnits = linkedItem && requiredQuantity !== null
      ? convertedQuantity(requiredQuantity, unit, linkedItem.unit)
      : null
    const cost = quantityPerProduct !== null && costPerUnit !== null && plannedQuantity !== null
      ? finiteProduct(plannedQuantity, quantityPerProduct, costPerUnit)
      : null

    return {
      ...material,
      name,
      unit,
      quantityPerProduct,
      costPerUnit,
      requiredQuantity,
      requiredInStockUnits,
      linkedItem,
      availableQuantity,
      shortage: requiredInStockUnits === null || availableQuantity === null
        ? null
        : Math.max(0, requiredInStockUnits - availableQuantity),
      cost,
      hasIncompleteInputs: !name || !unit || quantityPerProduct === null || costPerUnit === null
        || requiredQuantity === null || cost === null,
    }
  })
  const hasIncompleteMaterial = materialResults.some((material) => material.hasIncompleteInputs)
  const materialCost = hasIncompleteMaterial
    ? null
    : finiteSum(materialResults.map((material) => material.cost))
  const materialRequirements = plannedQuantity === null
    ? null
    : materialResults.every((material) => !material.hasIncompleteInputs)
  const packagingCost = plannedQuantity !== null && packagingCostPerProduct !== null
    ? finiteProduct(plannedQuantity, packagingCostPerProduct)
    : null
  const totalCost = materialCost !== null && packagingCost !== null && otherExpenses !== null
    ? finiteSum([materialCost, packagingCost, otherExpenses])
    : null
  const costPerProductValue = totalCost !== null && plannedQuantity > 0
    ? totalCost / plannedQuantity
    : null
  const costPerProduct = Number.isFinite(costPerProductValue) ? costPerProductValue : null
  const projectedRevenue = plannedQuantity !== null && sellingPrice !== null
    ? finiteProduct(plannedQuantity, sellingPrice)
    : null
  const profit = totalCost !== null && projectedRevenue !== null
    ? Number.isFinite(projectedRevenue - totalCost) ? projectedRevenue - totalCost : null
    : null
  const profitMarginValue = profit !== null && projectedRevenue > 0
    ? (profit / projectedRevenue) * 100
    : null
  const profitMargin = Number.isFinite(profitMarginValue) ? profitMarginValue : null
  const variableCost = materialCost !== null && packagingCost !== null
    ? finiteSum([materialCost, packagingCost])
    : null
  const variableCostPerProduct = variableCost !== null && plannedQuantity > 0
    ? variableCost / plannedQuantity
    : null
  const breakEvenEstimate = variableCostPerProduct !== null
    && sellingPrice !== null
    && sellingPrice > variableCostPerProduct
    && otherExpenses !== null
    ? Math.ceil(otherExpenses / (sellingPrice - variableCostPerProduct))
    : null
  const breakEvenQuantity = Number.isFinite(breakEvenEstimate) ? breakEvenEstimate : null
  const linkedProduct = items.find((item) => item.id === scenario.inventoryProductId)
  const productShortage = linkedProduct && plannedQuantity !== null
    ? Math.max(0, plannedQuantity - Math.max(0, linkedProduct.quantity - (reservations[linkedProduct.id] ?? 0)))
    : null

  return {
    plannedQuantity,
    materialResults,
    materialCost,
    hasIncompleteMaterial,
    materialRequirements,
    packagingCost,
    otherExpenses,
    totalCost,
    costPerProduct,
    projectedRevenue,
    profit,
    profitMargin,
    breakEvenQuantity,
    linkedProduct,
    productShortage,
  }
}

export function createPlannerScenario(category, currency, index = 1) {
  return {
    id: `planner-${crypto.randomUUID()}`,
    name: `Scenario ${index}`,
    category,
    currencyCode: currency,
    productName: '',
    productQuantity: '',
    inventoryProductId: '',
    packagingCostPerProduct: '',
    otherExpenses: '',
    sellingPrice: '',
    materials: [],
  }
}
