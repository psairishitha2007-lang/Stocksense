import { useMemo, useState } from 'react'
import {
  ACTIVITY_CATEGORIES,
  activityRecordsToCsv,
  filterActivityRecords,
} from './activityHistory.js'
import { useCurrency } from './currencyContext.js'

const PAGE_SIZE = 100

const CATEGORY_LABELS = {
  inventory: 'Inventory',
  sales: 'Sales',
  purchases: 'Purchases',
  production: 'Production',
  recipes: 'Recipes',
  planner: 'Planner',
  settings: 'Settings',
  backup: 'Backup & recovery',
}

function localDateTime(timestamp, locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export default function ActivityHistory({ records = [], cloudSession = false }) {
  const { locale } = useCurrency()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [downloadError, setDownloadError] = useState('')
  const filteredRecords = useMemo(() => filterActivityRecords(records, {
    query,
    category,
    from,
    to,
  }), [records, query, category, from, to])
  const visibleRecords = filteredRecords.slice(0, visibleCount)

  function resetFilters() {
    setQuery('')
    setCategory('all')
    setFrom('')
    setTo('')
    setVisibleCount(PAGE_SIZE)
  }

  function exportCsv() {
    if (!filteredRecords.length) {
      setDownloadError('There are no matching activity records to export.')
      return
    }
    try {
      const blob = new Blob([`\uFEFF${activityRecordsToCsv(filteredRecords)}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kosthagara-activity-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloadError('')
    } catch (error) {
      setDownloadError(`Activity CSV could not be exported (${error.message}).`)
    }
  }

  function updateFilter(setter, value) {
    setter(value)
    setVisibleCount(PAGE_SIZE)
    setDownloadError('')
  }

  return (
    <section className="page-content management-page activity-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">YOUR BUSINESS AT A GLANCE</div>
          <h1>Activity History</h1>
          <p className="welcome-subtitle">A local record of changes in this business-category workspace.</p>
        </div>
        <button className="primary-button" type="button" onClick={exportCsv} disabled={!filteredRecords.length}>
          Export CSV
        </button>
      </div>
      <div className="demo-banner"><span>WORKSPACE HISTORY</span> {cloudSession ? 'Records are saved with this account workspace' : 'Records are saved in this browser'} for the selected business category and included in data backups.</div>
      <article className="panel activity-panel">
        <div className="activity-filter-grid">
          <label className="form-field">
            <span>Search activity</span>
            <input type="search" value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Description, item, or order" />
          </label>
          <label className="form-field">
            <span>Category</span>
            <select value={category} onChange={(event) => updateFilter(setCategory, event.target.value)}>
              <option value="all">All categories</option>
              {ACTIVITY_CATEGORIES.map((entry) => <option key={entry} value={entry}>{CATEGORY_LABELS[entry]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>From date</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => updateFilter(setFrom, event.target.value)} />
          </label>
          <label className="form-field">
            <span>To date</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => updateFilter(setTo, event.target.value)} />
          </label>
          <button className="secondary-button activity-reset" type="button" onClick={resetFilters}>Reset filters</button>
        </div>
        <div className="activity-results-heading">
          <strong>{filteredRecords.length} {filteredRecords.length === 1 ? 'activity' : 'activities'}</strong>
          <span>Newest first · times shown in your local time zone</span>
        </div>
        {downloadError && <p className="form-error-message" role="alert">{downloadError}</p>}
        {!records.length ? (
          <div className="activity-empty"><strong>No activity yet</strong><span>Successful changes to inventory, orders, recipes, settings, and backups will appear here.</span></div>
        ) : !filteredRecords.length ? (
          <div className="activity-empty"><strong>No matching activity</strong><span>Try a different search or date range, or reset the filters.</span></div>
        ) : (
          <>
            <ol className="activity-timeline">
              {visibleRecords.map((record) => (
                <li className="activity-card" key={record.id}>
                  <span className={`activity-marker activity-${record.category}`} aria-hidden="true" />
                  <div className="activity-card-content">
                    <div className="activity-card-heading">
                      <span className={`activity-category activity-${record.category}`}>{CATEGORY_LABELS[record.category]}</span>
                      <time dateTime={record.timestamp}>{localDateTime(record.timestamp, locale)}</time>
                    </div>
                    <strong>{record.description}</strong>
                    {(record.itemName || record.orderName || Number.isFinite(record.quantity)) && (
                      <div className="activity-detail">
                        {record.itemName && <span>Item: {record.itemName}</span>}
                        {record.orderName && <span>Order: {record.orderName}</span>}
                        {Number.isFinite(record.quantity) && <span>Quantity: {record.quantity}{record.unit ? ` ${record.unit}` : ''}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {visibleRecords.length < filteredRecords.length && (
              <button className="secondary-button activity-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show more ({filteredRecords.length - visibleRecords.length} remaining)
              </button>
            )}
          </>
        )}
      </article>
    </section>
  )
}
