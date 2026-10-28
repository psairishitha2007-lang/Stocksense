import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOrderRequirements, getRecipeUnitIssues } from './orderData.js'

const product = {
  id: 'finished-1',
  name: 'Brownie box',
  type: 'Finished Product',
  unit: 'pieces',
}
const material = {
  id: 'material-1',
  name: 'Cocoa powder',
  type: 'Raw Material',
  unit: 'kg',
  quantity: 5,
}
const lines = [{ productId: product.id, quantity: 2 }]

test('production requirements flag recipe materials that are missing or no longer usable', () => {
  const recipes = {
    [product.id]: [
      { id: 'component-missing', materialId: 'deleted-material', quantity: 1, unit: 'kg' },
      { id: 'component-wrong-type', materialId: 'finished-2', quantity: 1, unit: 'pieces' },
    ],
  }
  const issues = getRecipeUnitIssues(lines, recipes, [
    product,
    material,
    { id: 'finished-2', name: 'Finished gift', type: 'Finished Product', unit: 'pieces' },
  ])

  assert.match(issues.join(' '), /no longer exists/)
  assert.match(issues.join(' '), /not a raw material or packaging supply/)
  assert.deepEqual(calculateOrderRequirements(lines, recipes, [product, material]), [])
})

test('production requirements report invalid recipe quantities and incompatible units', () => {
  const recipes = {
    [product.id]: [
      { id: 'component-invalid', materialId: material.id, quantity: 0, unit: 'kg' },
      { id: 'component-unit', materialId: material.id, quantity: 1, unit: 'pieces' },
    ],
  }
  const issues = getRecipeUnitIssues(lines, recipes, [product, material])

  assert.ok(issues.some((issue) => /quantity or unit.*invalid/.test(issue)))
  assert.ok(issues.some((issue) => /stocked in kg.*recipe uses pieces/.test(issue)))
})

test('valid recipe units continue to convert into the inventory unit', () => {
  const recipes = {
    [product.id]: [{ id: 'component-valid', materialId: material.id, quantity: 250, unit: 'g' }],
  }

  assert.deepEqual(getRecipeUnitIssues(lines, recipes, [product, material]), [])
  assert.deepEqual(calculateOrderRequirements(lines, recipes, [product, material]), [{
    materialId: material.id,
    materialName: material.name,
    sku: undefined,
    quantity: 0.5,
    unit: material.unit,
  }])
})
