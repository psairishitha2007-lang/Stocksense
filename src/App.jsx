import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CategoryBranding } from './CategoryBranding.jsx'
import { appendActivityRecord, createActivityRecord } from './activityHistory.js'
import BusinessSettings from './BusinessSettings.jsx'
import { useCurrency } from './currencyContext.js'
import { CurrencyProvider } from './CurrencyProvider.jsx'
import { BUSINESS_CATEGORIES } from './businessData.js'
import {
  InventoryPage,
  ItemDetailsModal,
  ItemFormModal,
  ItemsPage,
  SimulatorPage,
  StockMovementModal,
} from './Inventory.jsx'
import { getReservations } from './orderData.js'
import { PurchasesPage, ReportsPage, SalesOrdersPage } from './Commerce.jsx'
import {
  confirmProductionOrder,
  savePurchaseOrderTransaction,
  saveSalesOrderTransaction,
  transitionProductionOrder,
} from './businessTransactions.js'
import { createDemoWorkspaces } from './categoryInventoryData.js'
import {
  loadApplicationData,
  loadApplicationDataSnapshot,
  replaceApplicationData,
  restoreApplicationBackup,
  saveApplicationData,
  validateApplicationBackup,
  validateCurrencySettings,
} from './applicationStorage.js'
import PlannerPage from './Planner.jsx'
import AuthFlow from './AuthFlow.jsx'
import CloudApp from './CloudApp.jsx'
import { saveCloudWorkspace } from './cloudWorkspaceStorage.js'
import { supabase } from './supabaseClient.js'
import './App.css'

const ActivityHistory = lazy(() => import('./ActivityHistory.jsx'))
const BusinessInsights = lazy(() => import('./BusinessInsights.jsx'))
const OrdersPage = lazy(() => import('./Orders.jsx').then(({ OrdersPage: Page }) => ({ default: Page })))
const RecipesPage = lazy(() => import('./Orders.jsx').then(({ RecipesPage: Page }) => ({ default: Page })))

const navigation = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Activity History', icon: 'clock' },
  { label: 'Business Insights', icon: 'reports' },
  { label: 'Items', icon: 'items' },
  { label: 'Inventory', icon: 'inventory' },
  { label: 'Sales orders', icon: 'orders' },
  { label: 'Production orders', icon: 'orders' },
  { label: 'Recipes', icon: 'recipes' },
  { label: 'Purchases', icon: 'purchases' },
  { label: 'Reports', icon: 'reports' },
  { label: 'Business settings', icon: 'settings' },
]

const iconPaths = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
  items: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.2V21" /></>,
  orders: <><path d="M5 4h14v17l-7-4-7 4V4Z" /><path d="M9 8h6M9 12h6" /></>,
  recipes: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5M8 17h8" /><path d="M7 3v4M17 3v4" /></>,
  purchases: <><path d="M3 4h2l2.2 11h10.9L21 7H6" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  simulator: <><path d="M4 18V6M4 18h16" /><path d="m7 14 4-4 3 2 5-6" /><path d="M16 6h3v3" /></>,
  planner: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h7M8 15h5" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  trend: <><path d="m3 16 6-6 4 4 8-9" /><path d="M15 5h6v6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12v2" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a7.7 7.7 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a7.7 7.7 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a7.3 7.3 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a7.7 7.7 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a7.7 7.7 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a7.3 7.3 0 0 1-.1 1.8Z" /></>,
}

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  )
}

function NavItem({ item, active, onClick }) {
  return (
    <button className={`nav-item${active ? ' active' : ''}`} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon name={item.icon} /><span>{item.label}</span>
      {item.count && <span className="nav-count">{item.count}</span>}
    </button>
  )
}

function StatCard({ icon, label, value, change, note, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon name={icon} size={19} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot"><span className={`stat-change ${tone === 'amber' ? 'warning' : ''}`}>{tone !== 'amber' && <Icon name="trend" size={14} />}{change}</span><span>{note}</span></div>
    </article>
  )
}

function DashboardPage({ items, search, onNavigate, salesOrders, purchaseOrders, transactions, businessCategory, organization, cloudSession }) {
  const { formatMoney, formatNumber, locale } = useCurrency()
  const selectedCategory = BUSINESS_CATEGORIES.find((entry) => entry.id === businessCategory)
  const lowItems = items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel)
  const outOfStockCount = items.filter((item) => item.quantity <= 0).length
  const pendingOrders = salesOrders.filter((order) => order.status === 'Pending')
  const outstandingPurchases = purchaseOrders.filter((order) => ['Draft', 'Ordered', 'Partially Received'].includes(order.status))
  const completedSales = salesOrders.filter((order) => order.status === 'Completed')
  const salesTotals = completedSales.reduce((totals, order) => {
    totals[order.currencyCode] = (totals[order.currencyCode] ?? 0) + order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    return totals
  }, {})
  const missingInventoryCostCount = items.filter((item) => !Number.isFinite(item.costPerUnit) || !item.currencyCode).length
  const inventoryTotals = items.reduce((totals, item) => {
    if (Number.isFinite(item.costPerUnit) && item.currencyCode) {
      totals[item.currencyCode] = (totals[item.currencyCode] ?? 0) + item.quantity * item.costPerUnit
    }
    return totals
  }, {})
  const filteredLowItems = lowItems.filter((item) =>
    `${item.name} ${item.category} ${item.sku}`.toLowerCase().includes(search.toLowerCase()),
  )
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return (
    <div className="dashboard-content">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">KOSTHAGARA <span className="eyebrow-dot">·</span> {dateLabel.toUpperCase()} <span className="eyebrow-dot">·</span> YOUR DAILY OVERVIEW</div>
          <h1>Good morning, {organization?.organizationName ?? 'Amelia'} <span className="wave">✳</span></h1>
          <p className="welcome-subtitle">Here&apos;s what&apos;s happening with your {selectedCategory?.name ?? 'business'}{organization ? ` in ${organization.city}, ${organization.countryName}` : ''} today.</p>
        </div>
        <button className="date-button" type="button"><span>◷</span> Last 30 days <span className="date-chevron">⌄</span></button>
      </div>
      <CategoryBranding category={selectedCategory} compact />

      <section className="stats-grid" aria-label="Inventory overview">
        <StatCard icon="items" label="Tracked products" value={items.length} change="Current workspace" note="products tracked" tone="green" />
        <StatCard icon="inventory" label="Low / out of stock" value={`${lowItems.filter((item) => item.quantity > 0).length} / ${outOfStockCount}`} change="Needs attention" note="low / out of stock" tone="amber" />
        <StatCard icon="clock" label="Pending sales orders" value={pendingOrders.length} change="Recorded orders" note="awaiting confirmation" tone="blue" />
        <StatCard icon="purchases" label="Outstanding purchases" value={outstandingPurchases.length} change="Recorded orders" note="not fully received" tone="violet" />
      </section>

      <section className="content-grid">
        <article className="panel low-stock-panel">
          <div className="panel-heading">
            <div><div className="panel-title-row"><h2>Low stock items</h2><span className="alert-count">{lowItems.length}</span></div><p>These products need replenishing soon.</p></div>
            <button className="text-link" type="button" onClick={() => onNavigate('Inventory')}>View inventory <Icon name="arrow" size={16} /></button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ITEM</th><th>IN STOCK</th><th>MIN. LEVEL</th><th>STATUS</th></tr></thead>
              <tbody>
                {filteredLowItems.slice(0, 6).map((item) => {
                  const outOfStock = item.quantity <= 0
                  const critical = !outOfStock && item.quantity <= item.reorderLevel / 2
                  return (
                    <tr key={item.id}>
                      <td><div className="item-cell"><span className={`item-thumb ${item.tone}`}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.category}</small></span></div></td>
                      <td><strong className={critical ? 'quantity-critical' : ''}>{formatNumber(item.quantity, { maximumFractionDigits: 2 })} {item.unit}</strong></td>
                      <td>{formatNumber(item.reorderLevel, { maximumFractionDigits: 2 })} {item.unit}</td>
                      <td><span className={`status-pill ${critical || outOfStock ? 'critical' : 'low'}`}><span />{outOfStock ? 'Out of stock' : critical ? 'Critical' : 'Low stock'}</span></td>
                    </tr>
                  )
                })}
                {filteredLowItems.length === 0 && <tr><td className="empty-state" colSpan="4">No low-stock items match “{search}”.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="table-footer">Showing <strong>{Math.min(filteredLowItems.length, 6)}</strong> of {lowItems.length} low-stock items <span>Demo examples and user-entered data</span></div>
        </article>

        <article className="simulator-card">
          <div className="simulator-topline"><span className="simulator-badge">✦ &nbsp; YOUR SECRET WEAPON</span><span className="sparkle">✳</span></div>
          <div className="simulator-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun">✦</div><div className="art-card art-card-back"><span /><span /><span /></div><div className="art-card art-card-front"><span className="art-card-icon">↗</span><span className="art-card-line long" /><span className="art-card-line" /><span className="art-card-chart">⌁</span></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div>
          <h2>What if you could<br />see the future?</h2>
          <p>Play out the “what ifs” before they happen. Test price changes, plan for busy seasons, and make your next move with confidence.</p>
          <button className="simulator-button" type="button" onClick={() => onNavigate('What If? Simulator')}>Explore the simulator <Icon name="arrow" size={17} /></button>
          <div className="simulator-footnote"><span>✧</span> No spreadsheets. Just smart decisions.</div>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel orders-panel">
          <div className="panel-heading"><div><h2>Recent sales orders</h2><p>A quick look at recorded customer orders.</p></div><button className="text-link" type="button" onClick={() => onNavigate('Sales orders')}>All orders <Icon name="arrow" size={16} /></button></div>
          {salesOrders.slice(0, 2).map((order, index) => <div className="order-row" key={order.id}><span className={`order-avatar ${index === 0 ? 'pink' : 'peach'}`}>{order.customer.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="order-customer"><strong>{order.customer}</strong><small>#{order.id} · {order.orderDate}</small></span><span className="order-total">{formatMoney(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), order.currencyCode)}</span><span className={`order-status ${order.status === 'Completed' ? 'delivered' : ''}`}>{order.status}</span></div>)}
          {!salesOrders.length && <div className="order-row"><span className="order-customer"><strong>No sales orders yet</strong><small>New orders will appear here.</small></span></div>}
        </article>
        <article className="panel dashboard-insights"><div className="panel-heading"><div><h2>Business overview</h2><p>Recorded values stay grouped by their original currency.</p></div><button className="text-link" type="button" onClick={() => onNavigate('Reports')}>View reports <Icon name="arrow" size={16} /></button></div>
          <div className="dashboard-revenue"><span>Current inventory value</span><strong>{Object.keys(inventoryTotals).length ? Object.entries(inventoryTotals).map(([code, total]) => formatMoney(total, code)).join(' · ') : 'Cost data not available'}</strong></div>
          {missingInventoryCostCount > 0 && <p className="commerce-help">{missingInventoryCostCount} item{missingInventoryCostCount === 1 ? '' : 's'} without unit cost are excluded from this value.</p>}
          {Object.keys(salesTotals).length
            ? Object.entries(salesTotals).map(([code, total]) => <div className="dashboard-revenue" key={code}><span>{code} recorded revenue</span><strong>{formatMoney(total, code)}</strong></div>)
            : <p className="commerce-empty-note">No completed sales yet. Pending and confirmed orders are not revenue.</p>}
          <div className="dashboard-movement-heading"><strong>Recent inventory movements</strong><button className="text-link" type="button" onClick={() => onNavigate('Inventory')}>Inventory <Icon name="arrow" size={14} /></button></div>
          {transactions.slice(0, 3).map((entry) => <div className="dashboard-movement" key={entry.id}><span><strong>{entry.itemName}</strong><small>{entry.type} · {entry.date}</small></span><b>{formatNumber(entry.quantity, { maximumFractionDigits: 3 })} {entry.unit}</b></div>)}
          {!transactions.length && <p className="commerce-empty-note">No inventory movement has been recorded.</p>}
        </article>
      </section>
      <footer className="page-footer"><span>© 2026 Kosthagara</span><span>Made with care for the makers <span className="footer-heart">♥</span></span><span>{cloudSession ? 'Private Supabase workspace' : 'Browser-local demo data'}</span></footer>
    </div>
  )
}

function AppContent({ cloudWorkspace, cloudSession, cloudClient, onCloudSignOut }) {
  const [initialData] = useState(() => cloudWorkspace
    ? loadApplicationDataSnapshot(cloudWorkspace.application_data, createDemoWorkspaces())
    : loadApplicationData(createDemoWorkspaces()))
  const {
    currency,
    country,
    countryCode,
    locale,
    formatNumber,
    setCountryCode,
    setCurrency,
    setLocale,
    restoreCurrencySettings,
    setCurrencyPersistenceEnabled,
    storageNotice: currencyStorageNotice,
  } = useCurrency()
  const [entryFlowOpen, setEntryFlowOpen] = useState(!initialData.workspaceEntered)
  const [organization, setOrganization] = useState(initialData.organization)
  const [activePage, setActivePage] = useState('Dashboard')
  const [search, setSearch] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [businessCategory, setBusinessCategory] = useState(initialData.businessCategory)
  const [workspaces, setWorkspaces] = useState(initialData.workspaces)
  const [applicationExtras, setApplicationExtras] = useState(initialData.applicationExtras)
  const [storageMode, setStorageMode] = useState(initialData.storageMode)
  const [storageMessage, setStorageMessage] = useState(initialData.storageMessage)
  const initialSnapshot = useRef(JSON.stringify({
    ...initialData.applicationExtras,
    workspaces: initialData.workspaces,
    businessCategory: initialData.businessCategory,
    organization: initialData.organization,
    workspaceEntered: initialData.workspaceEntered,
  }))
  const cloudRevision = useRef(cloudWorkspace?.revision ?? 0)
  const cloudSaveQueue = useRef(Promise.resolve())
  const cloudSaveQueueError = useRef(null)
  const [cloudSaveError, setCloudSaveError] = useState('')
  const [cloudSaveRetry, setCloudSaveRetry] = useState(0)
  const { items, transactions, recipes, orders, salesOrders, suppliers, purchaseOrders, expenses = [], plannerScenarios = [] } = workspaces[businessCategory]
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setCurrencyPersistenceEnabled(!cloudSession)
  }, [cloudSession, setCurrencyPersistenceEnabled])

  useEffect(() => {
    if (!cloudSession) return
    const savedCurrencySettings = initialData.applicationExtras.currencySettings
    if (savedCurrencySettings && validateCurrencySettings(savedCurrencySettings)) {
      restoreCurrencySettings(savedCurrencySettings)
    } else if (organization) {
      restoreCurrencySettings({
        countryCode: organization.countryCode,
        currency: organization.currency,
        locale: organization.language,
      })
    }
  }, [cloudSession, initialData, organization, restoreCurrencySettings])

  function updateWorkspaceField(field, update) {
    setWorkspaces((current) => {
      const workspace = current[businessCategory]
      const value = typeof update === 'function' ? update(workspace[field]) : update
      return { ...current, [businessCategory]: { ...workspace, [field]: value } }
    })
  }
  const setItems = (update) => updateWorkspaceField('items', update)
  const setTransactions = (update) => updateWorkspaceField('transactions', update)
  const setRecipes = (update) => updateWorkspaceField('recipes', update)
  const setOrders = (update) => updateWorkspaceField('orders', update)
  const setSalesOrders = (update) => updateWorkspaceField('salesOrders', update)
  const setSuppliers = (update) => updateWorkspaceField('suppliers', update)
  const setPurchaseOrders = (update) => updateWorkspaceField('purchaseOrders', update)
  const setExpenses = (update) => updateWorkspaceField('expenses', update)
  const setPlannerScenarios = (update) => updateWorkspaceField('plannerScenarios', update)

  function updatePlannerScenarios(nextScenarios) {
    const previousScenarios = workspaces[businessCategory].plannerScenarios ?? []
    setPlannerScenarios(nextScenarios)
    const added = nextScenarios.filter((scenario) => !previousScenarios.some((entry) => entry.id === scenario.id))
    const removed = previousScenarios.filter((scenario) => !nextScenarios.some((entry) => entry.id === scenario.id))
    for (const scenario of added) {
      const targetCategory = scenario.category || businessCategory
      const categoryName = BUSINESS_CATEGORIES.find((entry) => entry.id === targetCategory)?.name ?? targetCategory
      recordActivity({
        category: 'planner',
        action: 'planner-scenario-created',
        description: `Created planner scenario ${scenario.name || 'Untitled'} for ${categoryName}`,
      })
    }
    for (const scenario of removed) {
      recordActivity({
        category: 'planner',
        action: 'planner-scenario-removed',
        description: `Removed planner scenario ${scenario.name || 'Untitled'}`,
      })
    }
  }

  function recordActivity(details, workspaceId = businessCategory) {
    const record = createActivityRecord(details)
    setWorkspaces((current) => {
      const workspace = current[workspaceId]
      if (!workspace) return current
      return {
        ...current,
        [workspaceId]: {
          ...workspace,
          activityHistory: appendActivityRecord(workspace.activityHistory, record),
        },
      }
    })
  }

  function recordActivities(entries, workspaceId = businessCategory) {
    entries.forEach((entry) => recordActivity(entry, workspaceId))
  }

  useEffect(() => {
    function handleStorageFailure(event) {
      setStorageMode('failed')
      setStorageMessage(event.detail)
    }
    window.addEventListener('kosthagara-storage-failure', handleStorageFailure)
    return () => window.removeEventListener('kosthagara-storage-failure', handleStorageFailure)
  }, [])

  useEffect(() => {
    const data = { ...applicationExtras, workspaces, businessCategory, organization, workspaceEntered: !entryFlowOpen }
    const snapshot = JSON.stringify(data)
    if (cloudSession || snapshot === initialSnapshot.current || storageMode !== 'ready') return
    const result = saveApplicationData(data)
    initialSnapshot.current = snapshot
    if (!result.saved) {
      window.dispatchEvent(new CustomEvent('kosthagara-storage-failure', { detail: result.message }))
    }
  }, [workspaces, businessCategory, organization, entryFlowOpen, storageMode, applicationExtras, cloudSession])

  useEffect(() => {
    if (!cloudSession || storageMode !== 'ready') return
    const data = {
      ...applicationExtras,
      currencySettings: { countryCode, currency, locale },
      workspaces,
      businessCategory,
      organization,
      workspaceEntered: !entryFlowOpen,
    }
    const snapshot = JSON.stringify(data)
    if (snapshot === initialSnapshot.current) return
    cloudSaveQueue.current = cloudSaveQueue.current.catch(() => {}).then(async () => {
      cloudRevision.current = await saveCloudWorkspace(cloudClient, { version: 1, ...data }, cloudRevision.current)
      initialSnapshot.current = snapshot
      cloudSaveQueueError.current = null
      setCloudSaveError('')
    }).catch((error) => {
      cloudSaveQueueError.current = error
      setCloudSaveError(error.message)
    })
  }, [workspaces, businessCategory, organization, entryFlowOpen, storageMode, applicationExtras, countryCode, currency, locale, cloudSession, cloudClient, cloudSaveRetry])

  const lowStockCount = useMemo(() => items.filter((item) => item.quantity <= item.reorderLevel).length, [items])
  const reservations = useMemo(() => getReservations(orders), [orders])

  useEffect(() => {
    if (!cloudSession || !organization) return
    if (countryCode === organization.countryCode
      && currency === organization.currency
      && locale === organization.language) return
    setCountryCode(organization.countryCode)
    setCurrency(organization.currency)
    setLocale(organization.language)
  }, [cloudSession, organization, countryCode, currency, locale, setCountryCode, setCurrency, setLocale])

  function applyOrganizationSettings(profile) {
    setOrganization(profile)
    setBusinessCategory(profile.category)
    setCountryCode(profile.countryCode)
    setCurrency(profile.currency)
    setLocale(profile.language)
    recordActivity({
      category: 'settings',
      action: 'organization-updated',
      description: `Updated business profile for ${profile.organizationName}`,
    }, profile.category)
  }

  function changeBusinessCategory(category) {
    if (category === businessCategory) return
    setBusinessCategory(category)
    const categoryName = BUSINESS_CATEGORIES.find((entry) => entry.id === category)?.name ?? category
    recordActivity({
      category: 'settings',
      action: 'business-category-changed',
      description: `Switched business category to ${categoryName}`,
    }, category)
  }

  function changeCurrencySetting(field, value) {
    const previous = { countryCode, currency, locale }[field]
    if (previous === value) return
    if (field === 'countryCode') setCountryCode(value)
    if (field === 'currency') setCurrency(value)
    if (field === 'locale') setLocale(value)
    const label = field === 'countryCode' ? 'country' : field
    recordActivity({
      category: 'settings',
      action: `${field}-changed`,
      description: `Changed ${label} setting from ${previous} to ${value}`,
    })
  }

  function recordBackupExport() {
    recordActivity({
      category: 'backup',
      action: 'backup-exported',
      description: 'Exported a Kosthagara business data backup',
    })
  }

  function enterWorkspace() {
    setActivePage('Dashboard')
    setEntryFlowOpen(false)
  }

  async function signOutOfCloudWorkspace() {
    await cloudSaveQueue.current
    if (cloudSaveQueueError.current || cloudSaveError) {
      setNotice('Your latest cloud save failed. Retry the save before signing out to avoid losing those changes.')
      return
    }
    await onCloudSignOut()
  }

  function replaceInvalidStorage() {
    const data = {
      ...applicationExtras,
      workspaces,
      businessCategory,
      organization,
      workspaceEntered: !entryFlowOpen,
    }
    const result = replaceApplicationData(data)
    if (result.saved) {
      setStorageMode('ready')
      setStorageMessage('')
      setCurrencyPersistenceEnabled(true)
      initialSnapshot.current = JSON.stringify({
        ...applicationExtras,
        workspaces,
        businessCategory,
        organization,
        workspaceEntered: !entryFlowOpen,
      })
    } else {
      setStorageMode('failed')
      setStorageMessage(result.message)
    }
  }

  function importBackup(backup) {
    const validation = cloudSession ? validateApplicationBackup(backup) : null
    const result = cloudSession
      ? validation.valid
        ? { saved: true, message: '', data: validation.data }
        : { saved: false, message: validation.message }
      : restoreApplicationBackup(backup)
    if (!result.saved) return result

    const { application, currencySettings } = result.data
    const restoredExtras = Object.fromEntries(Object.entries(application).filter(([key]) =>
      !['version', 'workspaces', 'businessCategory', 'organization', 'workspaceEntered'].includes(key)))
    const restoredApplicationData = {
      ...restoredExtras,
      workspaces: application.workspaces,
      businessCategory: application.businessCategory,
      organization: application.organization,
      workspaceEntered: application.workspaceEntered,
    }
    initialSnapshot.current = JSON.stringify(restoredApplicationData)
    setWorkspaces(application.workspaces)
    setApplicationExtras(restoredExtras)
    setBusinessCategory(application.businessCategory)
    setOrganization(application.organization)
    setEntryFlowOpen(!application.workspaceEntered)
    setActivePage('Dashboard')
    setStorageMode('ready')
    setStorageMessage('')
    setCurrencyPersistenceEnabled(true)
    restoreCurrencySettings(currencySettings)
    recordActivity({
      category: 'backup',
      action: 'backup-imported',
      description: 'Restored a validated Kosthagara backup',
    }, application.businessCategory)
    setNotice('Backup restored. Inventory, orders, planner scenarios, and currency settings were replaced with the validated backup.')
    return result
  }

  function saveItem(updatedItem) {
    const oldItem = items.find((item) => item.id === updatedItem.id)
    if (oldItem && oldItem.type !== updatedItem.type) {
      const usedByRecipe = Boolean(recipes[oldItem.id]) || Object.values(recipes).some((recipe) => recipe.some((component) => component.materialId === oldItem.id))
      const usedByOrder = orders.some((order) => order.lines.some((line) => line.productId === oldItem.id)
        || order.confirmed && (order.requirements ?? []).some((requirement) => requirement.materialId === oldItem.id))
      const usedByCommerce = salesOrders.some((order) => order.lines.some((line) => line.itemId === oldItem.id))
        || purchaseOrders.some((order) => order.lines.some((line) => line.itemId === oldItem.id))
      if (usedByRecipe || usedByOrder || usedByCommerce) {
        setNotice('This item type is used by a saved recipe or order and cannot be changed.')
        return
      }
    }
    if (oldItem && oldItem.unit !== updatedItem.unit
      && (salesOrders.some((order) => order.lines.some((line) => line.itemId === oldItem.id))
        || purchaseOrders.some((order) => order.lines.some((line) => line.itemId === oldItem.id)))) {
      setNotice('This unit is used by a saved sales or purchase order and cannot be changed.')
      return
    }
    if (oldItem && updatedItem.quantity < (reservations[oldItem.id] ?? 0)) {
      setNotice(`This item has ${formatNumber(reservations[oldItem.id], { maximumFractionDigits: 2 })} ${oldItem.unit} reserved and cannot be reduced below that balance.`)
      return
    }
    if (oldItem && oldItem.unit !== updatedItem.unit) {
      const usedByRecipe = Boolean(recipes[oldItem.id]) || Object.values(recipes).some((recipe) => recipe.some((component) => component.materialId === oldItem.id))
      const usedByOrder = orders.some((order) => order.lines.some((line) => line.productId === oldItem.id)
        || order.confirmed && (order.requirements ?? []).some((requirement) => requirement.materialId === oldItem.id))
      if (usedByRecipe || usedByOrder) {
        setNotice('This unit is used by a saved recipe or confirmed order and cannot be changed.')
        return
      }
    }
    setItems((currentItems) => oldItem
      ? currentItems.map((item) => item.id === updatedItem.id ? { ...updatedItem, dataSource: oldItem.dataSource ?? 'user' } : item)
      : [...currentItems, { ...updatedItem, dataSource: 'user' }])

    if (!oldItem || oldItem.quantity !== updatedItem.quantity) {
      const increase = !oldItem || updatedItem.quantity > oldItem.quantity
      const transaction = {
        id: `transaction-${crypto.randomUUID()}`,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        itemId: updatedItem.id,
        itemName: updatedItem.name,
        sku: updatedItem.sku,
        type: increase ? (oldItem ? 'Stock In' : 'Opening stock') : 'Stock Out',
        quantity: oldItem ? Math.abs(updatedItem.quantity - oldItem.quantity) : updatedItem.quantity,
        reason: oldItem ? 'Opening stock adjustment' : 'Opening balance',
        balance: updatedItem.quantity,
        unit: updatedItem.unit,
        currencyCode: updatedItem.currencyCode ?? currency,
        supplier: updatedItem.supplier,
        cost: updatedItem.costPerUnit,
        notes: oldItem ? 'Quantity adjusted while editing item' : 'Initial demo opening stock',
      }
      if (transaction.quantity > 0 || !oldItem) setTransactions((current) => [transaction, ...current])
    } else if (oldItem) {
      setTransactions((current) => current.map((transaction) => transaction.itemId === updatedItem.id
        ? { ...transaction, itemName: updatedItem.name, sku: updatedItem.sku, unit: updatedItem.unit }
        : transaction))
    }
    setModal(null)
    setNotice(oldItem ? `${updatedItem.name} updated.` : `${updatedItem.name} added to inventory.`)
    const changedQuantity = oldItem && oldItem.quantity !== updatedItem.quantity
    recordActivities([
      {
        category: 'inventory',
        action: oldItem ? 'item-edited' : 'item-created',
        description: oldItem ? `Updated inventory item ${updatedItem.name}` : `Created inventory item ${updatedItem.name}`,
        itemName: updatedItem.name,
        ...(!oldItem ? { quantity: updatedItem.quantity, unit: updatedItem.unit } : {}),
      },
      ...(changedQuantity ? [{
        category: 'inventory',
        action: 'stock-adjusted',
        description: `Adjusted opening stock for ${updatedItem.name} (${updatedItem.quantity > oldItem.quantity ? 'increased' : 'decreased'})`,
        itemName: updatedItem.name,
        quantity: Math.abs(updatedItem.quantity - oldItem.quantity),
        unit: updatedItem.unit,
      }] : []),
    ])
  }

  function handleItemAction(action, item) {
    if (action === 'view') setModal({ type: 'details', item })
    if (action === 'edit') setModal({ type: 'edit', item })
    if (action === 'delete' && window.confirm(`Delete ${item.name} from the demo item list? Existing history entries will remain.`)) {
      const usedByRecipe = Object.values(recipes).some((recipe) => recipe.some((component) => component.materialId === item.id))
      const usedByOrder = orders.some((order) => order.lines.some((line) => line.productId === item.id)
        || (order.requirements ?? []).some((requirement) => requirement.materialId === item.id))
      const usedByCommerce = salesOrders.some((order) => order.lines.some((line) => line.itemId === item.id))
        || purchaseOrders.some((order) => order.lines.some((line) => line.itemId === item.id))
      if (usedByRecipe || usedByOrder || usedByCommerce) {
        setNotice(`${item.name} is referenced by a saved recipe or order and cannot be deleted.`)
        return
      }
      setItems((current) => current.filter((candidate) => candidate.id !== item.id))
      setRecipes((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      setModal(null)
      setNotice(`${item.name} deleted. Existing inventory history was kept.`)
      recordActivity({
        category: 'inventory',
        action: 'item-deleted',
        description: `Deleted inventory item ${item.name}`,
        itemName: item.name,
      })
    }
  }

  function recordMovement(type, movement) {
    const item = items.find((candidate) => candidate.id === movement.item.id)
    if (!item) {
      setNotice('That item no longer exists. Refresh your item list and try again.')
      return
    }
    if (!Number.isFinite(movement.quantity) || movement.quantity <= 0 || (movement.unit && movement.unit !== item.unit)) {
      setNotice('Stock movement is invalid. Enter a positive quantity using the item’s current unit.')
      return
    }
    if (type === 'Stock In' && (!Number.isFinite(movement.cost) || movement.cost < 0 || !movement.currencyCode)) {
      setNotice('Stock-in cost is invalid. Enter a finite cost of zero or more and select a currency.')
      return
    }
    const available = Math.max(0, item.quantity - (reservations[item.id] ?? 0))
    if (type === 'Stock Out' && movement.quantity > available) {
      setNotice(`Not enough unreserved stock. ${formatNumber(available, { maximumFractionDigits: 2 })} ${item.unit} are available; ${formatNumber(reservations[item.id] ?? 0, { maximumFractionDigits: 2 })} ${item.unit} are reserved.`)
      return
    }
    const balance = type === 'Stock In' ? item.quantity + movement.quantity : item.quantity - movement.quantity
    if (!Number.isFinite(balance) || balance < 0) {
      setNotice(`This stock movement would create an invalid balance for ${item.name}.`)
      return
    }
    const updatedItem = {
      ...item,
      quantity: balance,
      ...(type === 'Stock In' && movement.supplier ? { supplier: movement.supplier } : {}),
      ...(type === 'Stock In' ? { costPerUnit: movement.cost, currencyCode: movement.currencyCode } : {}),
    }
    setItems((current) => current.map((candidate) => candidate.id === item.id ? updatedItem : candidate))
    setTransactions((current) => [{
      id: `transaction-${crypto.randomUUID()}`,
      date: movement.date,
      createdAt: new Date(`${movement.date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      type,
      quantity: movement.quantity,
      reason: movement.reason,
      balance,
      unit: item.unit,
      supplier: movement.supplier,
      cost: movement.cost,
      currencyCode: movement.currencyCode,
      notes: movement.notes,
    }, ...current])
    setModal(null)
    setNotice(`${type} recorded for ${item.name}. New balance: ${formatNumber(balance, { maximumFractionDigits: 2 })} ${item.unit}.`)
    recordActivity({
      category: 'inventory',
      action: 'stock-adjusted',
      description: `${type} recorded for ${item.name}`,
      itemName: item.name,
      quantity: movement.quantity,
      unit: item.unit,
    })
  }

  function createOrder(data) {
    const nextNumber = Math.max(1000, ...orders.map((order) => Number(order.id.replace(/\D/g, '')) || 0)) + 1
    const order = {
      ...data,
      id: `ORD-${nextNumber}`,
      status: 'Pending',
      confirmed: false,
      productionRecorded: false,
      dispatched: false,
      requirements: [],
    }
    setOrders((current) => [order, ...current])
    setNotice(`${order.id} saved as a proposal. No inventory has been reserved or deducted.`)
    recordActivity({
      category: 'production',
      action: 'production-order-created',
      description: `Created production order ${order.id}`,
      orderName: order.id,
    })
  }

  function saveSalesOrder(nextOrder) {
      const result = saveSalesOrderTransaction({
        items,
        transactions,
        orders: salesOrders,
        nextOrder,
        reservations,
      })
      if (!result.success) {
        setNotice(result.error)
        return false
      }
      const { order, existing } = result
      setItems(result.items)
      setTransactions(result.transactions)
      setSalesOrders(result.orders)
      setNotice(existing
        ? `${order.id} updated. Inventory was reconciled to its completed status.`
        : order.status === 'Completed'
          ? `${order.id} saved as completed. Stock was deducted once.`
          : `${order.id} saved. No stock changed until it is completed.`)
      const lineSummary = order.lines.map((line) => {
        const item = items.find((entry) => entry.id === line.itemId)
        return item ? `${line.quantity} ${item.unit} ${item.name}` : ''
      }).filter(Boolean).join(', ')
      const activity = []
      if (!existing || existing.status === order.status) {
        activity.push({
          category: 'sales',
          action: existing ? 'sales-order-edited' : 'sales-order-created',
          description: `${existing ? 'Updated' : 'Created'} sales order ${order.id}${lineSummary ? `: ${lineSummary}` : ''}`,
          orderName: order.id,
        })
      }
      if (existing?.status !== 'Completed' && order.status === 'Completed') {
        activity.push({
          category: 'sales',
          action: 'sales-order-completed',
          description: `Completed sales order ${order.id}${lineSummary ? `: ${lineSummary}` : ''}`,
          orderName: order.id,
        })
      }
      if (existing?.status !== 'Cancelled' && order.status === 'Cancelled') {
        activity.push({
          category: 'sales',
          action: 'sales-order-cancelled',
          description: `Cancelled sales order ${order.id}`,
          orderName: order.id,
        })
      }
      if (existing && existing.status !== order.status
        && order.status !== 'Completed' && order.status !== 'Cancelled') {
        activity.push({
          category: 'sales',
          action: 'sales-order-status-changed',
          description: `Changed sales order ${order.id} status to ${order.status}`,
          orderName: order.id,
        })
      }
      if (order.lines.length === 1 && activity.length) {
        const item = items.find((entry) => entry.id === order.lines[0].itemId)
        if (item) {
          activity[0].itemName = item.name
          activity[0].quantity = order.lines[0].quantity
          activity[0].unit = item.unit
        }
      }
      recordActivities(activity)
      return true
  }

  function deleteSalesOrder(order) {
      if (order.status !== 'Cancelled') {
        setNotice('Only cancelled sales orders can be deleted.')
        return
      }
      setSalesOrders((current) => current.filter((entry) => entry.id !== order.id))
      setNotice(`${order.id} deleted from this session.`)
      recordActivity({
        category: 'sales',
        action: 'sales-order-deleted',
        description: `Deleted cancelled sales order ${order.id}`,
        orderName: order.id,
      })
  }

  function saveSupplier(nextSupplier) {
      if (!nextSupplier.name?.trim() || suppliers.some((supplier) => supplier.name.trim().toLowerCase() === nextSupplier.name.trim().toLowerCase() && supplier.id !== nextSupplier.id)) return false
      const supplier = { ...nextSupplier, id: nextSupplier.id ?? `supplier-${crypto.randomUUID()}` }
      setSuppliers((current) => nextSupplier.id
        ? current.map((entry) => entry.id === supplier.id ? supplier : entry)
        : [supplier, ...current])
      setNotice(`${supplier.name} saved for this session.`)
      return true
  }

  function deleteSupplier(id) {
      setSuppliers((current) => current.filter((supplier) => supplier.id !== id))
      setNotice('Supplier removed from this session.')
  }

  function savePurchaseOrder(nextOrder) {
      const result = savePurchaseOrderTransaction({
        items,
        transactions,
        orders: purchaseOrders,
        suppliers,
        nextOrder,
        reservations,
      })
      if (!result.success) {
        setNotice(result.error)
        return false
      }
      const { order: normalized, existing } = result
      setItems(result.items)
      setTransactions(result.transactions)
      setPurchaseOrders(result.orders)
      setNotice(existing ? `${normalized.id} updated. Stock changed only by newly received or reversed quantities.` : `${normalized.id} saved as ${normalized.status}. No stock was added.`)
      const activity = []
      if (!existing || existing.status === normalized.status) {
        activity.push({
          category: 'purchases',
          action: existing ? 'purchase-order-edited' : 'purchase-order-created',
          description: `${existing ? 'Updated' : 'Created'} purchase order ${normalized.id}`,
          orderName: normalized.id,
        })
      }
      const newlyReceived = normalized.lines.reduce((total, line) => {
        const oldLine = existing?.lines.find((entry) => entry.itemId === line.itemId)
        return total + Math.max(0, Number(line.receivedQuantity ?? 0) - Number(oldLine?.receivedQuantity ?? 0))
      }, 0)
      if (newlyReceived > 0) {
        activity.push({
          category: 'purchases',
          action: 'purchase-order-received',
          description: `Recorded delivery for purchase order ${normalized.id}`,
          orderName: normalized.id,
          quantity: newlyReceived,
        })
      }
      if (existing?.status !== 'Cancelled' && normalized.status === 'Cancelled') {
        activity.push({
          category: 'purchases',
          action: 'purchase-order-cancelled',
          description: `Cancelled purchase order ${normalized.id}`,
          orderName: normalized.id,
        })
      }
      recordActivities(activity)
      return true
  }

  function deletePurchaseOrder(id) {
      const order = purchaseOrders.find((entry) => entry.id === id)
      if (!order || order.status !== 'Cancelled' || order.lines.some((line) => Number(line.receivedQuantity ?? 0) > 0)) {
        setNotice('Only cancelled purchase orders with no received quantities can be deleted.')
        return
      }
      setPurchaseOrders((current) => current.filter((entry) => entry.id !== id))
      setNotice(`${id} deleted from this session.`)
      recordActivity({
        category: 'purchases',
        action: 'purchase-order-deleted',
        description: `Deleted cancelled purchase order ${id}`,
        orderName: id,
      })
  }

  function saveExpense(expense) {
    if (!expense.description?.trim() || !expense.date || !Number.isFinite(expense.amount) || expense.amount <= 0 || !expense.currencyCode) {
      setNotice('Expense is invalid. Enter a description, date, positive amount, and currency.')
      return false
    }
    setExpenses((current) => [expense, ...current])
    setNotice(`${expense.description} saved as a manual business expense.`)
    return true
  }

  function deleteExpense(id) {
    setExpenses((current) => current.filter((expense) => expense.id !== id))
    setNotice('Expense removed from this browser.')
  }

  function updateOrder(oldOrder, data) {
    setOrders((current) => current.map((order) => order.id === oldOrder.id && !order.confirmed
      ? { ...order, ...data }
      : order))
    setNotice(`${oldOrder.id} proposal updated. No inventory has changed.`)
    recordActivity({
      category: 'production',
      action: 'production-order-edited',
      description: `Updated production order ${oldOrder.id}`,
      orderName: oldOrder.id,
    })
  }

  function confirmOrder(order) {
    const result = confirmProductionOrder({
      orders,
      orderId: order.id,
      items,
      recipes,
      reservations,
    })
    if (!result.success) {
      setNotice(result.error)
      return
    }
    setOrders(result.orders)
    setNotice(`${order.id} confirmed. Ingredient requirements are reserved, but no stock has been deducted.`)
    recordActivity({
      category: 'production',
      action: 'production-order-confirmed',
      description: `Confirmed production order ${order.id} and reserved materials`,
      orderName: order.id,
    })
  }

  function changeOrderStatus(order, action, actualUsage = []) {
    const result = transitionProductionOrder({
      orders,
      orderId: order.id,
      action,
      actualUsage,
      items,
      transactions,
      reservations,
    })
    if (!result.success) {
      if (result.error) setNotice(result.error)
      return
    }
    setOrders(result.orders)
    if (result.items) setItems(result.items)
    if (result.transactions) setTransactions(result.transactions)
    const actionDetails = {
      cancel: {
        notice: `${order.id} cancelled. Any reserved ingredients have been released.`,
        activity: {
          category: 'production',
          action: 'production-order-cancelled',
          description: `Cancelled production order ${order.id}`,
          orderName: order.id,
        },
      },
      start: { notice: `${order.id} is now in progress. Reserved stock has not been deducted yet.` },
      produce: {
        notice: `${order.id} production recorded. Materials were deducted and finished goods added once.`,
        activity: {
          category: 'production',
          action: 'production-recorded',
          description: `Recorded production for order ${order.id}`,
          orderName: order.id,
        },
      },
      complete: {
        notice: `${order.id} completed and dispatched. Finished-product stock was deducted once.`,
        activity: {
          category: 'production',
          action: 'production-order-completed',
          description: `Completed and dispatched production order ${order.id}`,
          orderName: order.id,
        },
      },
    }
    const details = actionDetails[action]
    if (details?.notice) setNotice(details.notice)
    if (details?.activity) recordActivity(details.activity)
  }

  function saveRecipe(productId, components) {
    const wasExisting = Object.hasOwn(recipes, productId)
    const productName = items.find((item) => item.id === productId)?.name ?? productId
    setRecipes((current) => ({ ...current, [productId]: components }))
    setNotice('Recipe saved. New order estimates and simulations use the updated material requirements.')
    recordActivity({
      category: 'recipes',
      action: wasExisting ? 'recipe-edited' : 'recipe-created',
      description: `${wasExisting ? 'Updated' : 'Created'} recipe for ${productName}`,
      itemName: productName,
    })
  }

  function deleteRecipe(productId) {
    if (!Object.hasOwn(recipes, productId)) return
    const productName = items.find((item) => item.id === productId)?.name ?? productId
    setRecipes((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
    setNotice(`Recipe for ${productName} deleted. Existing confirmed orders keep their saved material requirements.`)
    recordActivity({
      category: 'recipes',
      action: 'recipe-deleted',
      description: `Deleted recipe for ${productName}`,
      itemName: productName,
    })
  }

  const showDashboard = !['Items', 'Inventory', 'Activity History', 'Business Insights', 'Sales orders', 'Production orders', 'Purchases', 'Reports', 'Recipes', 'What If? Simulator', 'Part-Time Business Planner', 'Business settings'].includes(activePage)

  if (entryFlowOpen) {
    return <>
      {(storageMessage || currencyStorageNotice) && <div className="storage-notice" role="status">
        <span>{storageMessage || currencyStorageNotice}</span>
        {storageMode === 'blocked' && <button type="button" onClick={replaceInvalidStorage}>Start fresh and replace invalid saved data</button>}
        {storageMode === 'blocked' && <button type="button" onClick={() => { setStorageMode('failed'); setCurrencyPersistenceEnabled(false) }}>Continue without saving</button>}
      </div>}
      <AuthFlow onEnterWorkspace={enterWorkspace} onOrganizationReady={applyOrganizationSettings} cloudManaged={Boolean(cloudSession)} />
    </>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setActivePage('Dashboard')} aria-label="Kosthagara dashboard">
          <img src="/kosthagara-logo.png" alt="Kosthagara — Manage, Track, Grow" />
        </button>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => <NavItem key={item.label} item={item} active={activePage === item.label} onClick={() => setActivePage(item.label)} />)}
          <div className="nav-divider" /><div className="workspace-label tools-label">YOUR TOOLS</div>
          <NavItem item={{ label: 'What If? Simulator', icon: 'simulator' }} active={activePage === 'What If? Simulator'} onClick={() => setActivePage('What If? Simulator')} />
          <NavItem item={{ label: 'Part-Time Business Planner', icon: 'planner' }} active={activePage === 'Part-Time Business Planner'} onClick={() => setActivePage('Part-Time Business Planner')} />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-spark">✳</div><strong>A little help?</strong><p>Our friendly guides make stock-taking simple for your business.</p><button type="button" onClick={() => setActivePage('Help center')}>Visit help center <Icon name="arrow" size={15} /></button></div>
          <div className="sidebar-version">{country?.name ?? 'Global'} <span>•</span> {currency}</div>
        </div>
      </aside>

      <main className="main-area" id="dashboard">
        <header className="topbar">
          <button className="topbar-brand" type="button" onClick={() => setActivePage('Dashboard')} aria-label="Kosthagara home"><img src="/kosthagara-logo.png" alt="Kosthagara" /></button>
          <label className="search-box"><Icon name="search" size={18} /><input type="search" placeholder="Search products, orders..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products and orders" /><kbd>⌘ K</kbd></label>
          <div className="topbar-actions">
            <button className="icon-button notification-button" type="button" aria-label={`${lowStockCount} low-stock alerts`} onClick={() => setActivePage('Inventory')}><Icon name="bell" /><span className="notification-dot" /></button>
            <div className="topbar-divider" />
            <div className="profile-wrap">
              <button className="profile-button" type="button" aria-expanded={showProfileMenu} onClick={() => setShowProfileMenu((visible) => !visible)}><span className="avatar">{(organization?.ownerName ?? 'Amelia Morgan').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="profile-copy"><strong>{organization?.ownerName ?? 'Amelia Morgan'}</strong><small>{organization?.organizationName ?? 'Demo business'}</small></span><span className="profile-chevron">⌄</span></button>
              {showProfileMenu && <div className="profile-menu"><strong>{organization?.organizationName ?? 'Amelia Morgan'}</strong><span>{cloudSession ? 'Private account workspace · saved to Supabase' : 'Demo business · saved in this browser only'}</span><button type="button" onClick={() => { setActivePage('Business settings'); setShowProfileMenu(false) }}>Business settings</button>{!cloudSession && <button type="button" onClick={() => { setEntryFlowOpen(true); setShowProfileMenu(false) }}>Welcome &amp; demo onboarding</button>}{cloudSession && <button type="button" onClick={() => signOutOfCloudWorkspace().catch((error) => setNotice(`Sign out failed: ${error.message}`))}>Sign out</button>}<button type="button" onClick={() => setShowProfileMenu(false)}>Close menu</button></div>}
            </div>
          </div>
        </header>

        {(storageMessage || currencyStorageNotice) && <div className="storage-notice" role="status"><span>{storageMessage || currencyStorageNotice}</span>{storageMode === 'blocked' && <><button type="button" onClick={replaceInvalidStorage}>Start fresh and replace invalid saved data</button><button type="button" onClick={() => { setStorageMode('failed'); setCurrencyPersistenceEnabled(false) }}>Continue without saving</button></>}</div>}
        {cloudSaveError && <div className="storage-notice" role="alert"><span>Cloud save failed: {cloudSaveError}</span>{cloudSaveError.includes('changed in another session')
          ? <button type="button" onClick={() => { if (window.confirm('Reloading will discard unsaved changes in this tab. Export a backup first if you need to preserve them. Continue?')) window.location.reload() }}>Reload latest workspace</button>
          : <button type="button" onClick={() => setCloudSaveRetry((current) => current + 1)}>Retry save</button>}</div>}
        {notice && <div className="action-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
        {showDashboard && <DashboardPage items={items} search={search} onNavigate={setActivePage} salesOrders={salesOrders} purchaseOrders={purchaseOrders} transactions={transactions} businessCategory={businessCategory} organization={organization} cloudSession={cloudSession} />}
        {activePage === 'Activity History' && <Suspense fallback={<div className="page-content"><p>Loading activity history…</p></div>}><ActivityHistory records={workspaces[businessCategory].activityHistory} cloudSession={Boolean(cloudSession)} /></Suspense>}
        {activePage === 'Business Insights' && <Suspense fallback={<div className="page-content"><p>Loading business insights…</p></div>}><BusinessInsights items={items} salesOrders={salesOrders} purchaseOrders={purchaseOrders} onNavigate={setActivePage} /></Suspense>}
        {activePage === 'Items' && <ItemsPage key={businessCategory} items={items} search={search} onSearchChange={setSearch} onAction={handleItemAction} onAdd={() => setModal({ type: 'add' })} businessCategory={businessCategory} />}
        {activePage === 'Inventory' && <InventoryPage key={businessCategory} items={items} transactions={transactions} reservations={reservations} onMovement={recordMovement} businessCategory={businessCategory} />}
        {activePage === 'Sales orders' && <SalesOrdersPage key={businessCategory} orders={salesOrders} items={items} currency={currency} onSave={saveSalesOrder} onDelete={deleteSalesOrder} />}
        {activePage === 'Production orders' && <Suspense fallback={<div className="page-content"><p>Loading production orders…</p></div>}><OrdersPage key={businessCategory} orders={orders} items={items} recipes={recipes} reservations={reservations} onCreate={createOrder} onUpdate={updateOrder} onConfirm={confirmOrder} onCancel={(order) => changeOrderStatus(order, 'cancel')} onStart={(order) => changeOrderStatus(order, 'start')} onProduce={(order, actualUsage) => changeOrderStatus(order, 'produce', actualUsage)} onComplete={(order) => changeOrderStatus(order, 'complete')} businessCategory={businessCategory} /></Suspense>}
        {activePage === 'Purchases' && <PurchasesPage key={businessCategory} suppliers={suppliers} orders={purchaseOrders} items={items} currency={currency} onSaveSupplier={saveSupplier} onDeleteSupplier={deleteSupplier} onSaveOrder={savePurchaseOrder} onDeleteOrder={deletePurchaseOrder} />}
        {activePage === 'Reports' && <ReportsPage key={businessCategory} items={items} orders={salesOrders} purchaseOrders={purchaseOrders} transactions={transactions} expenses={expenses} onAddExpense={saveExpense} onDeleteExpense={deleteExpense} />}
        {activePage === 'Recipes' && <Suspense fallback={<div className="page-content"><p>Loading recipes…</p></div>}><RecipesPage key={businessCategory} items={items} recipes={recipes} onSave={saveRecipe} onDelete={deleteRecipe} /></Suspense>}
        {activePage === 'What If? Simulator' && <SimulatorPage key={businessCategory} items={items} recipes={recipes} reservations={reservations} businessCategory={businessCategory} />}
        {activePage === 'Part-Time Business Planner' && <PlannerPage key={businessCategory} category={businessCategory} currency={currency} workspaces={workspaces} scenarios={plannerScenarios} onScenariosChange={updatePlannerScenarios} />}
        {activePage === 'Business settings' && <BusinessSettings
          category={businessCategory}
          onCategoryChange={changeBusinessCategory}
          applicationData={{ ...applicationExtras, workspaces, businessCategory, organization, workspaceEntered: !entryFlowOpen }}
          currencySettings={{ countryCode, currency, locale }}
          onRestoreBackup={importBackup}
          onBackupExport={recordBackupExport}
          onCountryChange={(value) => changeCurrencySetting('countryCode', value)}
          onCurrencyChange={(value) => changeCurrencySetting('currency', value)}
          onLocaleChange={(value) => changeCurrencySetting('locale', value)}
        />}
      </main>

      {modal?.type === 'add' && <ItemFormModal items={items} businessCategory={businessCategory} onSave={saveItem} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <ItemFormModal item={modal.item} items={items} businessCategory={businessCategory} onSave={saveItem} onClose={() => setModal(null)} />}
      {modal?.type === 'details' && <ItemDetailsModal item={modal.item} onClose={() => setModal(null)} onEdit={() => setModal({ type: 'edit', item: modal.item })} onMovement={(type) => setModal({ type: 'movement', movementType: type, item: modal.item })} />}
      {modal?.type === 'movement' && <StockMovementModal type={modal.movementType} items={items} reservations={reservations} initialItemId={modal.item.id} onSave={(movement) => recordMovement(modal.movementType, movement)} onClose={() => setModal(null)} />}
    </div>
  )
}

function App() {
  return <CurrencyProvider>{supabase ? <CloudApp client={supabase} AppContent={AppContent} /> : <AppContent />}</CurrencyProvider>
}

export default App
