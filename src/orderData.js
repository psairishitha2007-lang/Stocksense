import { isFinishedProduct, isRecipeMaterial, UNITS } from './inventoryData.js'

export const RECIPE_UNITS = ['g', 'kg', 'ml', 'litre', 'pieces', 'packets', 'packs', 'boxes', 'sets', 'books', 'sheets']
export const ORDER_STATUSES = ['Pending', 'In Progress', 'Ready', 'Completed', 'Cancelled']

const UNIT_GROUP = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  litre: { family: 'volume', factor: 1000 },
}

export function convertQuantity(quantity, fromUnit, toUnit) {
  if (fromUnit === toUnit) return quantity
  const from = UNIT_GROUP[fromUnit]
  const to = UNIT_GROUP[toUnit]
  if (!from || !to || from.family !== to.family) return null
  return quantity * from.factor / to.factor
}

export function getRecipeUnitIssues(lines, recipes, items) {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const issues = []
  for (const line of lines) {
    if (!line?.productId) continue
    const product = itemsById.get(line.productId)
    if (!product) {
      issues.push(`Product ${line.productId} no longer exists in inventory.`)
      continue
    }
    if (!isFinishedProduct(product)) {
      issues.push(`${product.name} is not a finished product and cannot be used in a production order.`)
      continue
    }
    const components = recipes[product.id]
    if (components !== undefined && !Array.isArray(components)) {
      issues.push(`The recipe for ${product.name} is invalid.`)
      continue
    }
    for (const component of components ?? []) {
      if (!component || typeof component !== 'object') {
        issues.push(`The recipe for ${product.name} contains an invalid material entry.`)
        continue
      }
      const material = itemsById.get(component.materialId)
      if (!material) {
        issues.push(`A material in the recipe for ${product.name} no longer exists in inventory.`)
        continue
      }
      if (!isRecipeMaterial(material)) {
        issues.push(`${material.name} in the recipe for ${product.name} is not a raw material or packaging supply.`)
        continue
      }
      if (!UNITS.includes(material.unit)) {
        issues.push(`The inventory unit for ${material.name} is invalid.`)
        continue
      }
      if (!Number.isFinite(component.quantity) || component.quantity <= 0
        || !RECIPE_UNITS.includes(component.unit)) {
        issues.push(`The recipe quantity or unit for ${material.name} is invalid.`)
        continue
      }
      if (convertQuantity(1, component.unit, material.unit) === null) {
        issues.push(`${material.name} is stocked in ${material.unit}, but its recipe uses ${component.unit}. Use the same unit or a compatible mass/volume unit.`)
      }
    }
  }
  return issues
}

export function calculateOrderRequirements(lines, recipes, items) {
  const requirements = new Map()
  const finishedById = new Map(items.map((item) => [item.id, item]))

  for (const line of lines) {
    const product = finishedById.get(line.productId)
    if (!product || !isFinishedProduct(product)) continue
    for (const component of recipes[product.id] ?? []) {
      const material = finishedById.get(component.materialId)
      if (!material || !isRecipeMaterial(material)) continue
      const needed = convertQuantity(component.quantity * line.quantity, component.unit, material.unit)
      if (needed === null) continue
      const current = requirements.get(material.id)
      requirements.set(material.id, {
        materialId: material.id,
        materialName: material.name,
        sku: material.sku,
        quantity: (current?.quantity ?? 0) + needed,
        unit: material.unit,
      })
    }
  }

  return [...requirements.values()]
}

export function getRequirementShortages(requirements, items, reservations = {}) {
  return requirements.flatMap((requirement) => {
    const material = items.find((item) => item.id === requirement.materialId)
    const available = Math.max(0, (material?.quantity ?? 0) - (reservations[requirement.materialId] ?? 0))
    return requirement.quantity > available
      ? [{ ...requirement, available, shortage: requirement.quantity - available }]
      : []
  })
}

export function getReservations(orders) {
  return orders.reduce((reserved, order) => {
    if (!order.confirmed || order.productionRecorded || order.status === 'Cancelled') return reserved
    for (const requirement of order.requirements ?? []) {
      reserved[requirement.materialId] = (reserved[requirement.materialId] ?? 0) + requirement.quantity
    }
    return reserved
  }, {})
}

export function getDemoRecipes(items, categoryId = 'home-foods') {
  const findId = (sku) => items.find((item) => item.sku === sku)?.id
  const recipesByCategory = {
    'home-foods': () => {
      const cupcake = findId('FIN-003')
      const flour = findId('RAW-001')
      const sugar = findId('RAW-007')
      const eggs = findId('RAW-003')
      return cupcake && flour && sugar && eggs
        ? {
          [cupcake]: [
            { id: 'recipe-cupcake-flour', materialId: flour, quantity: 100, unit: 'g' },
            { id: 'recipe-cupcake-sugar', materialId: sugar, quantity: 30, unit: 'g' },
            { id: 'recipe-cupcake-egg', materialId: eggs, quantity: 1, unit: 'pieces' },
          ],
        }
        : {}
    },
    'pencil-arts': () => {
      const product = findId('ART-FIN-001')
      const pencil = findId('ART-RAW-001')
      const sketchbook = findId('ART-RAW-002')
      return product && pencil && sketchbook
        ? { [product]: [
          { id: 'recipe-art-pencil', materialId: pencil, quantity: 2, unit: 'pieces' },
          { id: 'recipe-art-paper', materialId: sketchbook, quantity: 0.1, unit: 'books' },
        ] }
        : {}
    },
    'clays-handicrafts': () => {
      const product = findId('CLAY-FIN-001')
      const clay = findId('CLAY-RAW-001')
      const varnish = findId('CLAY-RAW-003')
      return product && clay && varnish
        ? { [product]: [
          { id: 'recipe-clay-pot-clay', materialId: clay, quantity: 350, unit: 'g' },
          { id: 'recipe-clay-pot-varnish', materialId: varnish, quantity: 20, unit: 'ml' },
        ] }
        : {}
    },
    'kids-toys': () => {
      const product = findId('TOY-FIN-001')
      const blocks = findId('TOY-RAW-001')
      const box = findId('TOY-SUP-001')
      return product && blocks && box
        ? { [product]: [
          { id: 'recipe-toy-blocks', materialId: blocks, quantity: 24, unit: 'pieces' },
          { id: 'recipe-toy-box', materialId: box, quantity: 1, unit: 'pieces' },
        ] }
        : {}
    },
    supermarket: () => {
      const product = findId('MKT-FIN-001')
      const tomato = findId('MKT-RAW-001')
      const bag = findId('MKT-SUP-001')
      return product && tomato && bag
        ? { [product]: [
          { id: 'recipe-market-tomato', materialId: tomato, quantity: 0.5, unit: 'kg' },
          { id: 'recipe-market-bag', materialId: bag, quantity: 1, unit: 'pieces' },
        ] }
        : {}
    },
    'all-businesses': () => {
      const product = findId('MIX-FIN-001')
      const wax = findId('MIX-RAW-001')
      const carton = findId('MIX-SUP-001')
      return product && wax && carton
        ? { [product]: [
          { id: 'recipe-mix-wax', materialId: wax, quantity: 300, unit: 'g' },
          { id: 'recipe-mix-carton', materialId: carton, quantity: 1, unit: 'pieces' },
        ] }
        : {}
    },
  }
  return recipesByCategory[categoryId]?.() ?? {}
}

export function createDemoOrders(items, recipes = {}) {
  const product = items.find((item) => item.type === 'Finished Product' && recipes[item.id]?.length)
    ?? items.find((item) => item.type === 'Finished Product')
  if (!product) return []
  return [{
    id: 'ORD-1001',
    customer: 'Sophie Lane',
    orderDate: new Date().toISOString().slice(0, 10),
    deliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: 'Pending',
    confirmed: false,
    productionRecorded: false,
    dispatched: false,
    lines: [{ productId: product.id, quantity: 2 }],
    requirements: [],
    notes: 'Demo proposed order',
  }]
}
