import { BUSINESS_CATEGORIES } from './businessData.js'
import { createOpeningTransactions, DEMO_ITEMS } from './inventoryData.js'
import { createDemoOrders, getDemoRecipes } from './orderData.js'

const makeItem = (id, name, sku, category, type, quantity, unit, costPerUnit, reorderLevel, sellingPrice, initials, tone, supplier = '') => ({
  id,
  name,
  sku,
  category,
  type,
  quantity,
  unit,
  costPerUnit,
  currencyCode: 'USD',
  ...(sellingPrice === null ? {} : { sellingPrice }),
  reorderLevel,
  supplier,
  initials,
  tone,
})

const HOME_FOODS = [
  ...DEMO_ITEMS,
  makeItem('food-cookie', 'Chocolate chip cookie', 'FIN-004', 'Cookies', 'Finished Product', 18, 'pieces', 0.65, 8, 1.75, '🍪', 'honey'),
  makeItem('food-box', 'Kraft bakery box', 'SUP-001', 'Packaging', 'Packaging & Supplies', 14, 'pieces', 0.28, 20, null, '📦', 'wheat', 'Pack & Parcel'),
]

const PENCIL_ARTS = [
  makeItem('art-sketch', 'Pencil sketch portrait', 'ART-FIN-001', 'Original artwork', 'Finished Product', 3, 'pieces', 12, 2, 35, '🖼️', 'wheat'),
  makeItem('art-pencils', 'Graphite drawing pencil', 'ART-RAW-001', 'Drawing tools', 'Raw Material', 24, 'pieces', 0.8, 12, null, '✏️', 'honey', 'Studio Supply Co.'),
  makeItem('art-sketchbook', 'A4 sketchbook', 'ART-RAW-002', 'Paper & books', 'Raw Material', 8, 'books', 4.5, 5, null, '📒', 'wheat', 'Studio Supply Co.'),
  makeItem('art-eraser', 'Soft art eraser', 'ART-SUP-001', 'Drawing tools', 'Packaging & Supplies', 3, 'pieces', 0.65, 5, null, '▰', 'egg', 'Studio Supply Co.'),
  makeItem('art-brush', 'Detail paintbrush set', 'ART-RES-001', 'Brushes', 'Resale Product', 7, 'sets', 6, 4, 12.5, '🖌️', 'chocolate', 'Colour Corner'),
  makeItem('art-frame', 'Natural wood frame', 'ART-RES-002', 'Frames', 'Resale Product', 4, 'pieces', 8, 3, 18, '🖼️', 'honey', 'Frame House'),
]

const CLAY_CRAFTS = [
  makeItem('clay-pot', 'Handmade terracotta pot', 'CLAY-FIN-001', 'Pottery', 'Finished Product', 5, 'pieces', 7, 3, 19, '🏺', 'chocolate'),
  makeItem('clay-material', 'Air-dry sculpting clay', 'CLAY-RAW-001', 'Clay & modelling', 'Raw Material', 2.5, 'kg', 5, 1, null, '🟤', 'wheat', 'Earth & Form'),
  makeItem('clay-figure', 'Hand-painted clay fox', 'CLAY-FIN-002', 'Figurines', 'Finished Product', 2, 'pieces', 9, 2, 24, '🦊', 'egg'),
  makeItem('clay-paint', 'Water-based craft paint', 'CLAY-RAW-002', 'Finishes', 'Raw Material', 450, 'ml', 0.025, 150, null, '🎨', 'honey', 'Colour Corner'),
  makeItem('clay-varnish', 'Clear matte varnish', 'CLAY-RAW-003', 'Finishes', 'Raw Material', 120, 'ml', 0.04, 100, null, '🫙', 'wheat', 'Earth & Form'),
  makeItem('clay-tools', 'Sculpting tool set', 'CLAY-RES-001', 'Craft tools', 'Resale Product', 6, 'sets', 5, 3, 13, '🛠️', 'chocolate', 'Earth & Form'),
]

const KIDS_TOYS = [
  makeItem('toy-teddy', 'Soft teddy bear', 'TOY-RES-001', 'Plush toys', 'Resale Product', 6, 'pieces', 8, 4, 18, '🧸', 'honey', 'Playful Goods'),
  makeItem('toy-blocks', 'Colour block set', 'TOY-RES-002', 'Building toys', 'Resale Product', 9, 'packs', 7, 5, 16, '🧱', 'arts', 'Playful Goods'),
  makeItem('toy-block-parts', 'Loose wooden building blocks', 'TOY-RAW-001', 'Building toys', 'Raw Material', 240, 'pieces', 0.18, 48, null, '🧱', 'arts', 'Playful Goods'),
  makeItem('toy-kit', 'Build-your-own block kit', 'TOY-FIN-001', 'Creative kits', 'Finished Product', 4, 'pieces', 5, 3, 14, '🧩', 'craft'),
  makeItem('toy-car', 'Wooden toy car', 'TOY-RES-003', 'Vehicles', 'Resale Product', 14, 'pieces', 3.5, 6, 9, '🚗', 'craft', 'Little Wheels'),
  makeItem('toy-doll', 'Garden story doll', 'TOY-RES-004', 'Dolls', 'Resale Product', 3, 'pieces', 11, 4, 25, '🎎', 'pink', 'Playful Goods'),
  makeItem('toy-puzzle', 'Animal shapes puzzle', 'TOY-RES-005', 'Puzzles', 'Resale Product', 8, 'pieces', 5, 4, 12, '🧩', 'egg', 'Little Wheels'),
  makeItem('toy-box', 'Toy gift box', 'TOY-SUP-001', 'Packaging', 'Packaging & Supplies', 18, 'pieces', 0.55, 12, null, '🎁', 'wheat', 'Pack & Parcel'),
]

const SUPERMARKET = [
  makeItem('market-rice', 'Basmati rice', 'MKT-RES-001', 'Grains', 'Resale Product', 34, 'kg', 2.1, 15, 3.4, '🍚', 'wheat', 'Harvest Wholesale'),
  makeItem('market-oil', 'Sunflower cooking oil', 'MKT-RES-002', 'Cooking essentials', 'Resale Product', 12, 'litre', 2.7, 8, 4.2, '🫙', 'honey', 'Daily Goods'),
  makeItem('market-milk', 'Fresh whole milk', 'MKT-RES-003', 'Dairy', 'Resale Product', 6, 'litre', 1.2, 10, 1.8, '🥛', 'egg', 'Green Pastures'),
  makeItem('market-soap', 'Gentle hand soap', 'MKT-RES-004', 'Household care', 'Resale Product', 18, 'pieces', 1.1, 8, 2.2, '🧼', 'arts', 'Daily Goods'),
  makeItem('market-tomato', 'Fresh tomatoes', 'MKT-RAW-001', 'Vegetables', 'Raw Material', 4, 'kg', 1.8, 5, null, '🍅', 'pink', 'Market Garden'),
  makeItem('market-lentils', 'Red lentils pack', 'MKT-RES-006', 'Packaged groceries', 'Resale Product', 3, 'packs', 1.4, 6, 2.5, '🫘', 'chocolate', 'Harvest Wholesale'),
  makeItem('market-bag', 'Produce paper bag', 'MKT-SUP-001', 'Packaging', 'Packaging & Supplies', 40, 'pieces', 0.08, 15, null, '🛍️', 'wheat', 'Daily Goods'),
  makeItem('market-bundle', 'Fresh vegetable bundle', 'MKT-FIN-001', 'Vegetables', 'Finished Product', 3, 'packs', 1.15, 4, 2.5, '🥕', 'craft'),
]

const ALL_BUSINESSES = [
  makeItem('mix-clay', 'Modelling clay tub', 'MIX-RAW-001', 'Creative materials', 'Raw Material', 2.4, 'kg', 5, 0.5, null, '🟤', 'craft', 'Maker Supply'),
  makeItem('mix-notebook', 'Pocket notebook', 'MIX-RES-001', 'Stationery', 'Resale Product', 20, 'pieces', 1.25, 8, 3, '📓', 'wheat', 'Maker Supply'),
  makeItem('mix-candle', 'Hand-poured candle', 'MIX-FIN-001', 'Home goods', 'Finished Product', 7, 'pieces', 4.5, 3, 12, '🕯️', 'honey'),
  makeItem('mix-box', 'Shipping carton', 'MIX-SUP-001', 'Packaging', 'Packaging & Supplies', 15, 'pieces', 0.7, 8, null, '📦', 'egg', 'Parcel Works'),
  makeItem('mix-paint', 'Primary colour paint set', 'MIX-RES-002', 'Creative materials', 'Resale Product', 4, 'sets', 6.5, 3, 14, '🎨', 'arts', 'Maker Supply'),
  makeItem('mix-mug', 'Ceramic maker mug', 'MIX-RES-003', 'Home goods', 'Resale Product', 9, 'pieces', 5, 4, 13, '☕', 'chocolate', 'Parcel Works'),
]

export const CATEGORY_INVENTORIES = {
  'home-foods': HOME_FOODS,
  'pencil-arts': PENCIL_ARTS,
  'clays-handicrafts': CLAY_CRAFTS,
  'kids-toys': KIDS_TOYS,
  supermarket: SUPERMARKET,
  'all-businesses': ALL_BUSINESSES,
}

export function getCategoryDemoItems(categoryId) {
  const items = CATEGORY_INVENTORIES[categoryId]
  if (!items) throw new Error(`Unknown business category "${categoryId}".`)
  return items.map((item) => ({ ...item }))
}

export function createDemoWorkspaces() {
  return Object.fromEntries(BUSINESS_CATEGORIES.map(({ id }) => {
    const items = getCategoryDemoItems(id).map((item) => ({ ...item, dataSource: 'demo' }))
    const recipes = getDemoRecipes(items, id)
    const supplierNames = [...new Set(items.map((item) => item.supplier).filter(Boolean))]
    return [id, {
      items,
      transactions: createOpeningTransactions(items),
      recipes,
      orders: createDemoOrders(items, recipes),
      salesOrders: [],
      suppliers: supplierNames.map((name, index) => ({
        id: `supplier-demo-${index + 1}`,
        name,
        phone: '',
        email: '',
        notes: 'Demo supplier listed on opening inventory.',
      })),
      purchaseOrders: [],
      expenses: [],
      plannerScenarios: [],
    }]
  }))
}
