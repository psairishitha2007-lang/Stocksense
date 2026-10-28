export const UNIT_OPTIONS_BY_CATEGORY = {
  'home-foods': ['pieces', 'packets', 'packs', 'kg', 'g', 'litre', 'ml'],
  'pencil-arts': ['pieces', 'sets', 'books', 'sheets', 'packs', 'kg', 'g', 'ml'],
  'clays-handicrafts': ['pieces', 'sets', 'kg', 'g', 'ml', 'litre'],
  'kids-toys': ['pieces', 'packs', 'sets', 'boxes'],
  supermarket: ['pieces', 'packs', 'kg', 'g', 'litre', 'ml'],
  'all-businesses': ['pieces', 'packs', 'sets', 'kg', 'g', 'ml', 'litre'],
}
export const UNITS = [...new Set(Object.values(UNIT_OPTIONS_BY_CATEGORY).flat())]
export const ITEM_TYPES = ['Raw Material', 'Finished Product', 'Resale Product', 'Packaging & Supplies']
export const STOCK_OUT_REASONS = ['Sold', 'Consumed in production', 'Damaged', 'Other']
export const RECIPE_MATERIAL_TYPES = ['Raw Material', 'Packaging & Supplies']

export function isRecipeMaterial(item) {
  return RECIPE_MATERIAL_TYPES.includes(item.type)
}

export function isFinishedProduct(item) {
  return item.type === 'Finished Product'
}

export const DEMO_ITEMS = [
  { id: 'item-flour', name: 'Organic bread flour', sku: 'RAW-001', category: 'Baking essentials', type: 'Raw Material', quantity: 4, unit: 'kg', costPerUnit: 2.4, currencyCode: 'USD', reorderLevel: 10, supplier: 'Mill & Grain Co.', initials: '🌾', tone: 'wheat' },
  { id: 'item-chocolate', name: 'Belgian dark chocolate', sku: 'RAW-002', category: 'Chocolate & cocoa', type: 'Raw Material', quantity: 2, unit: 'kg', costPerUnit: 12.5, currencyCode: 'USD', reorderLevel: 5, supplier: 'Cocoa House', initials: '🍫', tone: 'chocolate' },
  { id: 'item-eggs', name: 'Free-range eggs', sku: 'RAW-003', category: 'Dairy & eggs', type: 'Raw Material', quantity: 18, unit: 'pieces', costPerUnit: 0.38, currencyCode: 'USD', reorderLevel: 24, supplier: 'Sunny Side Farm', initials: '🥚', tone: 'egg' },
  { id: 'item-vanilla', name: 'Vanilla bean paste', sku: 'RAW-004', category: 'Flavourings', type: 'Raw Material', quantity: 1, unit: 'packets', costPerUnit: 8.75, currencyCode: 'USD', reorderLevel: 3, supplier: 'Baker’s Pantry', initials: '🍯', tone: 'honey' },
  { id: 'item-butter', name: 'Cultured butter', sku: 'RAW-005', category: 'Dairy & eggs', type: 'Raw Material', quantity: 3, unit: 'kg', costPerUnit: 7.2, currencyCode: 'USD', reorderLevel: 8, supplier: 'Sunny Side Farm', initials: '🧈', tone: 'egg' },
  { id: 'item-almond', name: 'Almond flour', sku: 'RAW-006', category: 'Baking essentials', type: 'Raw Material', quantity: 2, unit: 'kg', costPerUnit: 9.4, currencyCode: 'USD', reorderLevel: 6, supplier: 'Mill & Grain Co.', initials: '🥣', tone: 'wheat' },
  { id: 'item-sugar', name: 'Cane sugar', sku: 'RAW-007', category: 'Baking essentials', type: 'Raw Material', quantity: 5, unit: 'kg', costPerUnit: 1.8, currencyCode: 'USD', reorderLevel: 8, supplier: 'Mill & Grain Co.', initials: '🍚', tone: 'honey' },
  { id: 'item-sourdough', name: 'Country sourdough loaf', sku: 'FIN-001', category: 'Fresh bread', type: 'Finished Product', quantity: 12, unit: 'pieces', costPerUnit: 3.5, currencyCode: 'USD', reorderLevel: 5, supplier: '', initials: '🍞', tone: 'wheat' },
  { id: 'item-brownie', name: 'Fudge brownie box', sku: 'FIN-002', category: 'Treat boxes', type: 'Finished Product', quantity: 8, unit: 'packets', costPerUnit: 6.25, currencyCode: 'USD', reorderLevel: 4, supplier: '', initials: '🍫', tone: 'chocolate' },
  { id: 'item-cupcake', name: 'Vanilla cupcake', sku: 'FIN-003', category: 'Cupcakes', type: 'Finished Product', quantity: 0, unit: 'pieces', costPerUnit: 2.1, currencyCode: 'USD', reorderLevel: 6, supplier: '', initials: '🧁', tone: 'honey' },
]

export function createOpeningTransactions(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items.map((item) => ({
    id: `opening-${item.id}`,
    date: today,
    createdAt: new Date().toISOString(),
    itemId: item.id,
    itemName: item.name,
    sku: item.sku,
    type: 'Opening stock',
    quantity: item.quantity,
    reason: 'Demo opening balance',
    balance: item.quantity,
    unit: item.unit,
    supplier: item.supplier,
    cost: item.costPerUnit,
    currencyCode: item.currencyCode ?? 'USD',
    notes: 'Initial demo inventory',
  })).reverse()
}

export function getInventoryValue(items) {
  return items.reduce((total, item) => total + item.quantity * item.costPerUnit, 0)
}
