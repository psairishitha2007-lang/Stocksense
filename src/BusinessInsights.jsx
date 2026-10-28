import { useMemo, useState } from 'react'
import { useCurrency } from './currencyContext.js'
import {
  calculateBusinessInsights,
  filterInsightItems,
  insightsToCsv,
} from './businessInsightsData.js'

function formatCurrencyTotals(totals, formatMoney) {
  const entries = Object.entries(totals)
  return entries.length
    ? entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
    : 'No recorded value'
}

function formatSalesTotals(sales, formatMoney) {
  return sales.orders
    ? formatCurrencyTotals(sales.revenueByCurrency, formatMoney)
    : 'No completed sales orders'
}

function MetricCard({ title, value, explanation, tone = '' }) {
  return (
    <article className={`panel insight-metric ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{explanation}</small>
    </article>
  )
}

function InsightRecommendation({ recommendation, onNavigate, formatNumber }) {
  return (
    <article className="panel insight-recommendation">
      <div className="insight-recommendation-heading">
        <span className={`insight-severity severity-${recommendation.severity}`}>{recommendation.severity}</span>
        <h3>{recommendation.title}</h3>
      </div>
      <dl>
        <div><dt>Detected</dt><dd>{recommendation.detected}</dd></div>
        <div><dt>Records checked</dt><dd>{recommendation.support}</dd></div>
        <div><dt>Why it matters</dt><dd>{recommendation.why}</dd></div>
        <div><dt>Suggested next action</dt><dd>{recommendation.nextAction}</dd></div>
        <div><dt>Assumptions / missing information</dt><dd>{recommendation.assumptions}</dd></div>
      </dl>
      {recommendation.product && Number.isFinite(recommendation.product.quantity) && (
        <p className="insight-current-stock">
          Current stock: {formatNumber(recommendation.product.quantity, { maximumFractionDigits: 3 })} {recommendation.product.unit}
        </p>
      )}
      <button className="text-link insight-link" type="button" onClick={() => onNavigate(recommendation.page)}>
        Open {recommendation.page}
      </button>
    </article>
  )
}

export default function BusinessInsights({
  items = [],
  salesOrders = [],
  purchaseOrders = [],
  onNavigate,
}) {
  const { formatMoney, formatNumber } = useCurrency()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [periodDays, setPeriodDays] = useState(90)
  const [exportError, setExportError] = useState('')
  const categories = useMemo(() => [...new Set(items.map((item) => item?.category).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second)), [items])
  const scopedItems = useMemo(() => filterInsightItems(items, { search, category }), [items, search, category])
  const scopedItemIds = useMemo(() => new Set(scopedItems.map((item) => item.id)), [scopedItems])
  const scopedSales = useMemo(() => salesOrders.map((order) => ({
    ...order,
    lines: Array.isArray(order?.lines) ? order.lines.filter((line) => scopedItemIds.has(line.itemId)) : [],
  })).filter((order) => order.lines.length), [salesOrders, scopedItemIds])
  const scopedPurchases = useMemo(() => purchaseOrders.map((order) => ({
    ...order,
    lines: Array.isArray(order?.lines) ? order.lines.filter((line) => scopedItemIds.has(line.itemId)) : [],
  })).filter((order) => order.lines.length), [purchaseOrders, scopedItemIds])
  const insights = useMemo(() => calculateBusinessInsights({
    items: scopedItems,
    salesOrders: scopedSales,
    purchaseOrders: scopedPurchases,
    periodDays,
  }), [scopedItems, scopedSales, scopedPurchases, periodDays])

  function exportCsv() {
    if (!scopedItems.length) {
      setExportError('There are no matching items to include in the insights export.')
      return
    }
    try {
      const blob = new Blob([`\uFEFF${insightsToCsv(insights)}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kosthagara-business-insights-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportError('')
    } catch (error) {
      setExportError(`Insights CSV could not be exported (${error.message}).`)
    }
  }

  const trend = insights.salesTrend
  const comparableTrendText = Object.entries(trend.changePercentByCurrency)
    .map(([currency, change]) => `${currency} ${change > 0 ? '+' : ''}${change.toFixed(1)}%`)
    .join(' · ')
  const trendText = !trend.comparisonAvailable
    ? 'Insufficient dated history for a comparable previous period.'
    : comparableTrendText
      ? `Revenue change by recorded currency versus the previous ${periodDays} days: ${comparableTrendText}.`
      : `No currency has non-zero previous-period revenue for a meaningful percentage comparison. Current period: ${formatCurrencyTotals(trend.current.revenueByCurrency, formatMoney)}.`
  const grossProfitText = insights.grossProfitAvailable
    ? formatCurrencyTotals(insights.estimatedGrossProfitByCurrency, formatMoney)
    : 'Not available'

  return (
    <section className="page-content management-page business-insights-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">BUSINESS INSIGHTS</div>
          <h1>Smart Business Insights</h1>
          <p className="welcome-subtitle">Transparent calculations from your recorded workspace data—not AI-generated advice.</p>
        </div>
        <button className="primary-button" type="button" onClick={exportCsv} disabled={!scopedItems.length}>Export insights CSV</button>
      </div>
      <div className="demo-banner"><span>READ-ONLY ANALYSIS</span> Insights never create purchase orders or change stock. No exchange rates are applied. Recommendations are suggestions to review.</div>
      <article className="panel insight-filter-panel">
        <div className="insight-filter-grid">
          <label className="form-field"><span>Search items</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name or SKU" /></label>
          <label className="form-field"><span>Product category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label className="form-field"><span>Observation period</span><select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option><option value="365">Last 365 days</option></select></label>
          <button className="secondary-button" type="button" onClick={() => { setSearch(''); setCategory('all'); setPeriodDays(90) }}>Reset filters</button>
        </div>
        <p className="insight-filter-summary">Analyzing {scopedItems.length} of {items.length} inventory items · sales window {insights.periodStart} through {insights.today}.</p>
      </article>
      {exportError && <p className="form-error-message" role="alert">{exportError}</p>}

      {!scopedItems.length ? (
        <div className="panel insight-empty"><strong>No inventory items match these filters.</strong><span>Adjust your search or category to see insights.</span></div>
      ) : (
        <>
          <div className="insight-metric-grid">
            <MetricCard
              title="Total inventory value"
              value={formatCurrencyTotals(insights.inventoryValueByCurrency, formatMoney)}
              explanation={`${insights.valuedItemCount} of ${insights.totalItemCount} items have valid quantity, cost, and currency. Missing costs are excluded, never treated as zero.`}
            />
            <MetricCard
              title="At / below reorder level"
              value={insights.reorderItems.length}
              explanation="Includes items at zero stock and those at or below their configured minimum."
              tone={insights.reorderItems.length ? 'metric-warning' : ''}
            />
            <MetricCard
              title="Above configured stock target"
              value={insights.excessItems.length}
              explanation={`${insights.itemsWithoutTarget.length} items have no explicit maximum/target quantity, so excess cannot be inferred for them.`}
            />
            <MetricCard
              title="Estimated gross profit"
              value={grossProfitText}
              explanation={insights.grossProfitAvailable
                ? 'Completed sales revenue minus current item unit costs, by order currency; not a historical cost ledger.'
                : 'Unavailable unless every valid completed sale in the period has a current item cost in the same currency.'}
            />
          </div>
          <div className="insight-two-column">
            <article className="panel insight-data-panel">
              <div className="panel-heading"><div><h2>Sales trend</h2><p>Completed, dated sales orders only · current period vs the preceding equal-length period.</p></div></div>
              <div className="insight-period-values">
                <div><span>Current period · {trend.current.orders} orders</span><strong>{formatSalesTotals(trend.current, formatMoney)}</strong></div>
                <div><span>Previous period · {trend.previous.orders} orders</span><strong>{formatSalesTotals(trend.previous, formatMoney)}</strong></div>
              </div>
              <p className="insight-explanation">{trendText}</p>
              <p className="insight-explanation">Cancelled, pending, and confirmed orders are excluded. Orders with invalid dates or invalid lines are excluded and listed in data quality.</p>
            </article>
            <article className="panel insight-data-panel">
              <div className="panel-heading"><div><h2>Demand estimate</h2><p>Simple historical average over the selected observation period.</p></div></div>
              {insights.demandHistory.sufficient ? (
                <>
                  <p className="insight-explanation">History covers {insights.demandHistory.days} days from {insights.demandHistory.firstSalesDate}. Estimate = completed units sold in the last {periodDays} days; this is not a guaranteed prediction.</p>
                  <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>OBSERVED SALES</th><th>DAILY AVERAGE</th></tr></thead><tbody>
                    {insights.demandEstimates.filter(({ soldQuantity }) => soldQuantity > 0).slice(0, 8).map(({ item, soldQuantity, dailyAverage }) => <tr key={item.id}><td>{item.name}</td><td>{formatNumber(soldQuantity, { maximumFractionDigits: 3 })} {item.unit}</td><td>{formatNumber(dailyAverage, { maximumFractionDigits: 3 })} {item.unit}/day</td></tr>)}
                    {!insights.demandEstimates.some(({ soldQuantity }) => soldQuantity > 0) && <tr><td className="empty-state" colSpan="3">No valid completed sales in this period.</td></tr>}
                  </tbody></table></div>
                </>
              ) : <div className="insight-empty-inline"><strong>Not enough history yet</strong><span>Valid completed sales data covers {insights.demandHistory.days} days. At least 28 days of dated history are required before a demand estimate or no-sales conclusion is shown.</span></div>}
            </article>
          </div>
          <article className="panel insight-data-panel">
            <div className="panel-heading"><div><h2>Data quality &amp; coverage</h2><p>Check these record issues before relying on estimates.</p></div></div>
            <div className="insight-quality-list">
              <span>{insights.dataQuality.missingSalesDateCount} completed orders with missing or invalid dates excluded.</span>
              <span>{insights.dataQuality.invalidSalesOrderCount} completed orders with invalid or unusable line data.</span>
              <span>{insights.dataQuality.invalidSalesLineCount} invalid sales lines or lines referencing missing items excluded.</span>
              {insights.dataQuality.incompleteCurrentSales && <span>Incomplete current-period sales records were found; estimated gross profit is withheld where they may affect totals.</span>}
              <span>{insights.missingCostItems.length} items with missing cost/currency · {insights.invalidCostItems.length} with invalid costs · {insights.invalidQuantityItems.length} with invalid quantities · {insights.invalidThresholdItems.length} with invalid thresholds.</span>
              <span>{insights.dataQuality.unitIssues.length} purchase lines with units differing from current inventory units.</span>
              {!insights.demandHistory.sufficient && <span>Not enough dated completed sales history for reliable demand classification or no-sales conclusions.</span>}
            </div>
          </article>
          <div className="insight-recommendations-heading"><div><div className="eyebrow">REVIEWABLE NEXT STEPS</div><h2>Stock recommendations</h2></div><span>{insights.recommendations.length} findings</span></div>
          {!insights.recommendations.length ? (
            <div className="panel insight-empty"><strong>No recommendations for the current filters.</strong><span>Current stock levels and available data did not trigger a recommendation. This does not guarantee that no action is needed.</span></div>
          ) : (
            <div className="insight-recommendation-grid">
              {insights.recommendations.map((recommendation) => <InsightRecommendation key={recommendation.id} recommendation={recommendation} onNavigate={onNavigate} formatNumber={formatNumber} />)}
            </div>
          )}
        </>
      )}
      <p className="insight-assumptions-note">Assumptions: only dated, valid Completed sales orders count as sales; purchase receipts are not counted as sales; stock movements are not double-counted. Gross profit uses current item cost, not cost at sale time. All financial values are grouped by their stored currency with no conversion.</p>
    </section>
  )
}
