import { useMemo } from 'react'
import { useCurrency } from './currencyContext.js'
import { BUSINESS_CATEGORIES } from './businessData.js'
import { convertQuantity, getReservations } from './orderData.js'
import { calculatePlannerScenario, createPlannerScenario } from './plannerData.js'

const EMPTY_ITEMS = []
const EMPTY_ORDERS = []

function formatEstimate(formatMoney, value, currency) {
  return value === null || !Number.isFinite(value) ? 'Add complete inputs' : formatMoney(value, currency)
}

function hasInvalidNumber(value, allowBlank = false) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return !allowBlank
  }
  return !Number.isFinite(Number(value)) || Number(value) < 0
}

function PlannerScenario({ scenario, workspaces, onChange, onRemove, scenarioCount }) {
  const { currency, formatMoney, formatNumber } = useCurrency()
  const category = BUSINESS_CATEGORIES.find((entry) => entry.id === scenario.category)
    ?? BUSINESS_CATEGORIES[0]
  const workspace = workspaces[scenario.category]
  const items = workspace?.items ?? EMPTY_ITEMS
  const reservations = useMemo(() => getReservations(workspace?.orders ?? EMPTY_ORDERS), [workspace?.orders])
  const results = useMemo(
    () => calculatePlannerScenario(scenario, items, reservations),
    [scenario, items, reservations],
  )
  const productCurrency = scenario.currencyCode ?? currency

  function patch(values) {
    onChange({ ...scenario, ...values })
  }

  function patchMaterial(materialId, values) {
    patch({
      materials: scenario.materials.map((material) => material.id === materialId
        ? { ...material, ...values }
        : material),
    })
  }

  function changeCategory(categoryId) {
    patch({
      category: categoryId,
      inventoryProductId: '',
      materials: scenario.materials.map((material) => ({ ...material, itemId: '' })),
    })
  }

  function linkMaterial(material, itemId) {
    const linkedItem = items.find((item) => item.id === itemId)
    const sameCurrency = linkedItem?.currencyCode === productCurrency
    patchMaterial(material.id, {
      itemId,
      ...(linkedItem ? {
        name: material.name || linkedItem.name,
        unit: linkedItem.unit,
        ...(sameCurrency && Number.isFinite(linkedItem.costPerUnit)
          ? { costPerUnit: String(linkedItem.costPerUnit) }
          : {}),
      } : {}),
    })
  }

  return (
    <article className="panel planner-scenario">
      <div className="planner-scenario-heading">
        <div>
          <span className="eyebrow">SCENARIO {scenarioCount}</span>
          <input
            className="planner-scenario-name"
            aria-label={`Scenario ${scenarioCount} name`}
            value={scenario.name}
            maxLength="40"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <button className="row-action planner-remove" type="button" onClick={onRemove}>
          Remove scenario
        </button>
      </div>

      <div className="planner-fields">
        <label className="form-field">
          <span>Business category *</span>
          <select value={scenario.category} onChange={(event) => changeCategory(event.target.value)}>
            {BUSINESS_CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Product or business idea *</span>
          <input
            value={scenario.productName}
            maxLength="90"
            onChange={(event) => patch({ productName: event.target.value })}
            placeholder={category.id === 'home-foods' ? 'e.g. Weekend brownie boxes' : 'e.g. Handmade gifts or accessories'}
            aria-invalid={!scenario.productName.trim()}
          />
          {!scenario.productName.trim() && <small className="field-error" role="alert">Enter a product or business idea.</small>}
        </label>
        <label className="form-field">
          <span>Planned products / orders *</span>
          <input type="number" min="1" step="any" value={scenario.productQuantity} onChange={(event) => patch({ productQuantity: event.target.value })} aria-invalid={!Number.isFinite(Number(scenario.productQuantity)) || Number(scenario.productQuantity) <= 0} />
          {(!Number.isFinite(Number(scenario.productQuantity)) || Number(scenario.productQuantity) <= 0) && <small className="field-error" role="alert">Enter a valid quantity greater than zero.</small>}
        </label>
        <label className="form-field">
          <span>Compare against product in stock (optional)</span>
          <select value={scenario.inventoryProductId} onChange={(event) => patch({ inventoryProductId: event.target.value })}>
            <option value="">Do not compare</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}</option>)}
          </select>
        </label>
      </div>

      <div className="planner-section-heading">
        <div><h3>Materials per product</h3><p>Add the materials used to make one product and their unit costs.</p></div>
        <button
          className="secondary-button planner-add-button"
          type="button"
          onClick={() => patch({ materials: [...scenario.materials, {
            id: `material-${crypto.randomUUID()}`,
            itemId: '',
            name: '',
            quantityPerProduct: '1',
            unit: 'pieces',
            costPerUnit: '',
          }] })}
        >＋ Add material</button>
      </div>
      {scenario.materials.length > 0 && <div className="planner-materials">
        {scenario.materials.map((material, index) => {
          const linkedItem = items.find((item) => item.id === material.itemId)
          const costCurrencyMismatch = linkedItem?.currencyCode && linkedItem.currencyCode !== productCurrency
          return <div className="planner-material-row" key={material.id}>
            <label className="form-field">
              <span>Material name *</span>
              <input value={material.name} onChange={(event) => patchMaterial(material.id, { name: event.target.value })} placeholder="e.g. flour, sketch paper, clay" aria-invalid={!material.name.trim()} />
              {!material.name.trim() && <small className="field-error" role="alert">Enter a material name.</small>}
            </label>
            <label className="form-field">
              <span>Link inventory item (optional)</span>
              <select value={material.itemId} onChange={(event) => linkMaterial(material, event.target.value)}>
                <option value="">Not linked</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Units per product *</span>
              <input type="number" min="0" step="any" value={material.quantityPerProduct} onChange={(event) => patchMaterial(material.id, { quantityPerProduct: event.target.value })} aria-invalid={hasInvalidNumber(material.quantityPerProduct)} />
              {hasInvalidNumber(material.quantityPerProduct) && <small className="field-error" role="alert">Enter a valid quantity of zero or more.</small>}
            </label>
            <label className="form-field">
              <span>Unit name *</span>
              <input value={material.unit} onChange={(event) => patchMaterial(material.id, { unit: event.target.value })} placeholder="pieces, g, kg, metres..." aria-invalid={!material.unit.trim()} />
              {!material.unit.trim() && <small className="field-error" role="alert">Enter a unit of measure.</small>}
            </label>
            <label className="form-field">
              <span>Cost per unit ({productCurrency}) *</span>
              <input type="number" min="0" step="any" value={material.costPerUnit} onChange={(event) => patchMaterial(material.id, { costPerUnit: event.target.value })} placeholder="Enter cost or 0 if none" aria-invalid={hasInvalidNumber(material.costPerUnit)} />
              {hasInvalidNumber(material.costPerUnit) && <small className="field-error" role="alert">Enter a valid cost of zero or more.</small>}
              {costCurrencyMismatch && <small className="planner-currency-note">Inventory cost is {linkedItem.currencyCode}; type this scenario cost in {productCurrency}. No conversion is applied.</small>}
            </label>
            <button
              className="row-action planner-remove-material"
              type="button"
              aria-label={`Remove material ${index + 1}`}
              onClick={() => patch({ materials: scenario.materials.filter((entry) => entry.id !== material.id) })}
            >Remove</button>
          </div>
        })}
      </div>}
      {!scenario.materials.length && <p className="planner-empty-materials">No materials added. The estimate will include packaging and other expenses only.</p>}

      <div className="planner-fields planner-cost-inputs">
        <label className="form-field">
          <span>Packaging cost per product ({productCurrency})</span>
          <input type="number" min="0" step="any" value={scenario.packagingCostPerProduct} onChange={(event) => patch({ packagingCostPerProduct: event.target.value })} placeholder="Enter cost or 0 if none" />
          {hasInvalidNumber(scenario.packagingCostPerProduct) && <small className="field-error">Enter a cost of zero or more.</small>}
        </label>
        <label className="form-field">
          <span>Other planned expenses total ({productCurrency})</span>
          <input type="number" min="0" step="any" value={scenario.otherExpenses} onChange={(event) => patch({ otherExpenses: event.target.value })} placeholder="Enter total or 0 if none" />
          {hasInvalidNumber(scenario.otherExpenses) && <small className="field-error">Enter expenses of zero or more.</small>}
        </label>
        <label className="form-field">
          <span>Selling price per product ({productCurrency})</span>
          <input type="number" min="0" step="any" value={scenario.sellingPrice} onChange={(event) => patch({ sellingPrice: event.target.value })} placeholder="Enter a proposed price" />
          {hasInvalidNumber(scenario.sellingPrice, true) && <small className="field-error">Enter a price of zero or more.</small>}
        </label>
      </div>

      <div className="planner-results">
        <h3>Estimate for {scenario.productName || 'your idea'}</h3>
        <p className="planner-estimate-note">Planning estimates only—not actual accounting results or guaranteed earnings.</p>
        <div className="planner-result-grid">
          <div><span>Total material requirements</span><strong>{results.materialRequirements === null ? 'Add a valid planned quantity' : results.materialRequirements === false ? 'Complete material details' : results.materialResults.length ? results.materialResults.map((entry) => `${formatNumber(entry.requiredQuantity, { maximumFractionDigits: 3 })} ${entry.unit} ${entry.name}`).join(' · ') : 'No materials listed'}</strong></div>
          <div><span>Total material cost</span><strong>{formatEstimate(formatMoney, results.materialCost, productCurrency)}</strong></div>
          <div><span>Total packaging cost</span><strong>{formatEstimate(formatMoney, results.packagingCost, productCurrency)}</strong></div>
          <div><span>Other planned expenses</span><strong>{formatEstimate(formatMoney, results.otherExpenses, productCurrency)}</strong></div>
          <div><span>Total estimated production cost</span><strong>{formatEstimate(formatMoney, results.totalCost, productCurrency)}</strong></div>
          <div><span>Estimated cost per product</span><strong>{formatEstimate(formatMoney, results.costPerProduct, productCurrency)}</strong></div>
          <div><span>Projected revenue</span><strong>{formatEstimate(formatMoney, results.projectedRevenue, productCurrency)}</strong></div>
          <div className="planner-highlight"><span>Estimated profit / loss</span><strong>{formatEstimate(formatMoney, results.profit, productCurrency)}</strong></div>
          <div><span>Profit margin</span><strong>{results.profitMargin === null ? 'Not available' : `${formatNumber(results.profitMargin, { maximumFractionDigits: 1 })}%`}</strong></div>
          <div><span>Break-even quantity</span><strong>{results.breakEvenQuantity === null ? 'Not meaningful with current inputs' : `${formatNumber(results.breakEvenQuantity)} products`}</strong></div>
        </div>
        {results.hasIncompleteMaterial && <p className="planner-warning" role="status">Complete every material name, quantity, unit, and unit cost. Incomplete rows are excluded from requirements and block material cost, total cost, profit, and break-even estimates.</p>}
        {(scenario.packagingCostPerProduct === '' || scenario.otherExpenses === '') && <p className="planner-warning">Enter packaging and other expenses, using 0 if you have none, to complete the cost estimate.</p>}
        {scenario.sellingPrice === '' && <p className="planner-warning">Enter a selling price to estimate revenue, profit, margin, or break-even quantity.</p>}
        {results.linkedProduct && <p className="planner-stock-note">
          Inventory check: {results.linkedProduct.name} has {formatNumber(results.linkedProduct.quantity, { maximumFractionDigits: 3 })} {results.linkedProduct.unit}; planning {formatNumber(results.plannedQuantity ?? 0, { maximumFractionDigits: 3 })} means {results.productShortage > 0 ? `${formatNumber(results.productShortage, { maximumFractionDigits: 3 })} additional units may be needed` : 'current stock is enough for this quantity'}. This is a comparison only.
        </p>}
        {results.materialResults.filter((entry) => entry.itemId).map((material) => {
          const linkedItem = items.find((item) => item.id === material.itemId)
          const convertible = linkedItem && convertQuantity(1, linkedItem.unit, material.unit) !== null
          return <p className="planner-stock-note" key={`availability-${material.id}`}>
            {material.name || linkedItem?.name}: {convertible
              ? material.requiredQuantity === null
                ? `Complete this material's quantity and unit details before comparing stock.`
                : `${formatNumber(material.availableQuantity, { maximumFractionDigits: 3 })} ${material.unit} available; ${formatNumber(material.requiredQuantity, { maximumFractionDigits: 3 })} required${material.shortage > 0 ? `; need ${formatNumber(material.shortage, { maximumFractionDigits: 3 })} more` : '; enough for this plan'}.`
              : `Stock is ${formatNumber(linkedItem?.quantity ?? 0, { maximumFractionDigits: 3 })} ${linkedItem?.unit ?? ''}, but cannot be compared with planner unit "${material.unit}".`}
          </p>
        })}
      </div>
      <p className="planner-formula">Formulas: materials = units per product × planned quantity × cost per material unit; packaging = cost per product × quantity; total cost = materials + packaging + other expenses; revenue = selling price × quantity; estimated profit = revenue − total cost.</p>
    </article>
  )
}

export default function PlannerPage({ category, currency, workspaces, scenarios = [], onScenariosChange }) {
  const { formatMoney, formatNumber } = useCurrency()
  const comparisons = scenarios.map((scenario) => {
    const workspace = workspaces[scenario.category]
    return {
      scenario,
      results: calculatePlannerScenario(
        scenario,
        workspace?.items ?? [],
        getReservations(workspace?.orders ?? []),
      ),
    }
  })

  function addScenario() {
    if (scenarios.length >= 3) return
    onScenariosChange([...scenarios, createPlannerScenario(category, currency, scenarios.length + 1)])
  }

  function updateScenario(updated) {
    onScenariosChange(scenarios.map((scenario) => scenario.id === updated.id ? updated : scenario))
  }

  function removeScenario(id) {
    onScenariosChange(scenarios.filter((scenario) => scenario.id !== id))
  }

  return (
    <section className="page-content management-page planner-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">A FRIENDLY WAY TO PLAN AHEAD</div>
          <h1>Part-Time Business Planner</h1>
          <p className="welcome-subtitle">Try a small business idea on paper before spending money or making stock.</p>
        </div>
        <button className="primary-button" type="button" onClick={addScenario} disabled={scenarios.length >= 3}>
          ＋ Add scenario {scenarios.length >= 3 ? '(3 maximum)' : ''}
        </button>
      </div>
      <div className="demo-banner"><span>BROWSER-LOCAL SCENARIOS</span> Scenarios are saved with this browser’s workspace when storage is available. Estimates are not guaranteed earnings, do not convert currencies, and never change inventory or orders.</div>
      {!scenarios.length && <div className="panel planner-empty">
        <strong>Start with one simple idea</strong>
        <span>Choose a category, enter a product quantity, add material and packaging costs, then compare the estimate with your current stock.</span>
        <button className="primary-button" type="button" onClick={addScenario}>＋ Create your first scenario</button>
      </div>}
      <div className="planner-scenarios">
        {scenarios.map((scenario, index) => <PlannerScenario
          key={scenario.id}
          scenario={scenario}
          workspaces={workspaces}
          scenarioCount={index + 1}
          onChange={updateScenario}
          onRemove={() => removeScenario(scenario.id)}
        />)}
      </div>
      {comparisons.length > 1 && <article className="panel planner-comparison">
        <div className="planner-section-heading">
          <div><h2>Compare scenarios</h2><p>Review the main estimates side by side. A missing estimate means some inputs still need attention.</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ESTIMATE</th>{comparisons.map(({ scenario }) => <th key={scenario.id}>{scenario.name || 'Unnamed scenario'}</th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Product idea</th>{comparisons.map(({ scenario }) => <td key={scenario.id}>{scenario.productName || 'Not entered'}</td>)}</tr>
              <tr><th scope="row">Planned quantity</th>{comparisons.map(({ scenario, results }) => <td key={scenario.id}>{results.plannedQuantity === null ? 'Not valid' : formatNumber(results.plannedQuantity, { maximumFractionDigits: 2 })}</td>)}</tr>
              <tr><th scope="row">Estimated total cost</th>{comparisons.map(({ scenario, results }) => <td key={scenario.id}>{formatEstimate(formatMoney, results.totalCost, scenario.currencyCode ?? currency)}</td>)}</tr>
              <tr><th scope="row">Projected revenue</th>{comparisons.map(({ scenario, results }) => <td key={scenario.id}>{formatEstimate(formatMoney, results.projectedRevenue, scenario.currencyCode ?? currency)}</td>)}</tr>
              <tr><th scope="row">Estimated profit / loss</th>{comparisons.map(({ scenario, results }) => <td key={scenario.id}><strong>{formatEstimate(formatMoney, results.profit, scenario.currencyCode ?? currency)}</strong></td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="planner-formula">Different scenario currencies are shown as entered. Their amounts are not converted and should not be compared as equivalent values.</p>
      </article>}
    </section>
  )
}
