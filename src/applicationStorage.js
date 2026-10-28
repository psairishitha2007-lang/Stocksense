import { BUSINESS_CATEGORIES, CURRENCIES, getCountry } from './businessData.js'
import { isValidActivityRecord, normalizeActivityHistory } from './activityHistory.js'

const STORAGE_KEY = 'kosthagara-application-v1'
const STORAGE_VERSION = 1
const BACKUP_FORMAT = 'kosthagara-backup'
const BACKUP_VERSION = 1
const CURRENCY_STORAGE_KEY = 'kosthagara-currency-v1'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSupportedCurrencyCode(value) {
  return typeof value === 'string' && CURRENCIES.some(({ code }) => code === value)
}

function hasValidOptionalCurrencyCode(value) {
  return value === undefined || isSupportedCurrencyCode(value)
}

function isSensitiveField(key) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/)
  return words.some((word) => ['auth', 'authentication', 'authorization', 'credential', 'password', 'passwd', 'passphrase', 'secret', 'token', 'otp'].includes(word))
    || words.join('') === 'onetimecode'
    || words.join('') === 'verificationcode'
}

function removeSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(removeSensitiveFields)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isSensitiveField(key))
    .map(([key, entry]) => [key, removeSensitiveFields(entry)]))
}

function containsSensitiveFields(value) {
  if (Array.isArray(value)) return value.some(containsSensitiveFields)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, entry]) =>
    isSensitiveField(key) || containsSensitiveFields(entry))
}

export function validateCurrencySettings(settings) {
  if (!isRecord(settings)
    || typeof settings.countryCode !== 'string'
    || typeof settings.locale !== 'string'
    || typeof settings.currency !== 'string'
    || !getCountry(settings.countryCode)
    || !CURRENCIES.some(({ code }) => code === settings.currency)) return false
  try {
    new Intl.Locale(settings.locale)
    new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency })
    return true
  } catch {
    return false
  }
}

function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateOrganization(organization) {
  if (organization === null) return true
  if (!isRecord(organization)
    || typeof organization.organizationName !== 'string'
    || !organization.organizationName.trim()
    || typeof organization.countryCode !== 'string'
    || !getCountry(organization.countryCode)
    || typeof organization.countryName !== 'string'
    || typeof organization.region !== 'string'
    || !organization.region.trim()
    || typeof organization.city !== 'string'
    || !organization.city.trim()
    || !BUSINESS_CATEGORIES.some(({ id }) => id === organization.category)
    || !isDateString(organization.startDate)
    || typeof organization.language !== 'string'
    || !CURRENCIES.some(({ code }) => code === organization.currency)
    || (organization.ownerName !== undefined && typeof organization.ownerName !== 'string')) return false
  try {
    new Intl.Locale(organization.language)
    return true
  } catch {
    return false
  }
}

function validateWorkspace(workspace) {
  return isRecord(workspace)
    && Array.isArray(workspace.items)
    && workspace.items.every((item) => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && Number.isFinite(item.quantity)
      && Number.isFinite(item.reorderLevel)
      && hasValidOptionalCurrencyCode(item.currencyCode)
      && hasValidOptionalCurrencyCode(item.sellingPriceCurrencyCode))
    && Array.isArray(workspace.transactions)
    && workspace.transactions.every((transaction) => isRecord(transaction)
      && hasValidOptionalCurrencyCode(transaction.currencyCode))
    && isRecord(workspace.recipes)
    && Object.values(workspace.recipes).every((recipe) => Array.isArray(recipe)
      && recipe.every((component) => isRecord(component)))
    && Array.isArray(workspace.orders)
    && workspace.orders.every(isRecord)
    && Array.isArray(workspace.salesOrders)
    && workspace.salesOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && isSupportedCurrencyCode(order.currencyCode)
      && Array.isArray(order.lines)
      && order.lines.every((line) => isRecord(line)))
    && Array.isArray(workspace.suppliers)
    && workspace.suppliers.every(isRecord)
    && Array.isArray(workspace.purchaseOrders)
    && workspace.purchaseOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && isSupportedCurrencyCode(order.currencyCode)
      && Array.isArray(order.lines)
      && order.lines.every((line) => isRecord(line)))
    && (workspace.plannerScenarios === undefined || (Array.isArray(workspace.plannerScenarios)
      && workspace.plannerScenarios.length <= 3
      && workspace.plannerScenarios.every((scenario) => isRecord(scenario)
        && typeof scenario.id === 'string'
        && typeof scenario.name === 'string'
        && typeof scenario.category === 'string'
        && isSupportedCurrencyCode(scenario.currencyCode)
        && typeof scenario.productName === 'string'
        && typeof scenario.productQuantity === 'string'
        && typeof scenario.packagingCostPerProduct === 'string'
        && typeof scenario.otherExpenses === 'string'
        && typeof scenario.sellingPrice === 'string'
        && typeof scenario.inventoryProductId === 'string'
        && Array.isArray(scenario.materials)
        && scenario.materials.every((material) => isRecord(material)
          && typeof material.id === 'string'
          && typeof material.itemId === 'string'
          && typeof material.name === 'string'
          && typeof material.quantityPerProduct === 'string'
          && typeof material.unit === 'string'
          && typeof material.costPerUnit === 'string'))))
    && (workspace.expenses === undefined || (Array.isArray(workspace.expenses)
      && workspace.expenses.every((expense) => isRecord(expense)
        && typeof expense.id === 'string'
        && typeof expense.description === 'string'
        && typeof expense.date === 'string'
        && Number.isFinite(expense.amount)
        && expense.amount > 0
        && isSupportedCurrencyCode(expense.currencyCode))))
}

function validateBackupWorkspace(workspace) {
  return isRecord(workspace)
    && Array.isArray(workspace.items)
    && workspace.items.every((item) => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && typeof item.sku === 'string'
      && typeof item.category === 'string'
      && typeof item.type === 'string'
      && typeof item.unit === 'string'
      && Number.isFinite(item.quantity)
      && item.quantity >= 0
      && Number.isFinite(item.reorderLevel)
      && item.reorderLevel >= 0
      && (item.costPerUnit === undefined || (Number.isFinite(item.costPerUnit) && item.costPerUnit >= 0))
      && (item.sellingPrice === undefined || (Number.isFinite(item.sellingPrice) && item.sellingPrice >= 0))
      && hasValidOptionalCurrencyCode(item.currencyCode)
      && hasValidOptionalCurrencyCode(item.sellingPriceCurrencyCode))
    && Array.isArray(workspace.transactions)
    && workspace.transactions.every((transaction) => isRecord(transaction)
      && typeof transaction.id === 'string'
      && typeof transaction.type === 'string'
      && isDateString(transaction.date)
      && Number.isFinite(transaction.quantity)
      && transaction.quantity >= 0
      && Number.isFinite(transaction.balance)
      && transaction.balance >= 0
      && (transaction.cost === undefined || (Number.isFinite(transaction.cost) && transaction.cost >= 0))
      && hasValidOptionalCurrencyCode(transaction.currencyCode))
    && isRecord(workspace.recipes)
    && Object.values(workspace.recipes).every((recipe) => Array.isArray(recipe)
      && recipe.every((component) => isRecord(component)
        && typeof component.id === 'string'
        && typeof component.materialId === 'string'
        && Number.isFinite(component.quantity)
        && component.quantity > 0
        && typeof component.unit === 'string'))
    && Array.isArray(workspace.orders)
    && workspace.orders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && typeof order.status === 'string'
      && isDateString(order.orderDate)
      && isDateString(order.deliveryDate)
      && Array.isArray(order.lines)
      && order.lines.every((line) => isRecord(line)
        && typeof line.productId === 'string'
        && Number.isFinite(line.quantity)
        && line.quantity > 0)
      && (order.requirements === undefined || (Array.isArray(order.requirements)
        && order.requirements.every((requirement) => isRecord(requirement)
          && typeof requirement.materialId === 'string'
          && Number.isFinite(requirement.quantity)
          && requirement.quantity >= 0))))
    && Array.isArray(workspace.salesOrders)
    && workspace.salesOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && typeof order.customer === 'string'
      && isDateString(order.orderDate)
      && isSupportedCurrencyCode(order.currencyCode)
      && ['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(order.status)
      && Array.isArray(order.lines)
      && order.lines.every((line) => isRecord(line)
        && typeof line.itemId === 'string'
        && Number.isFinite(line.quantity)
        && line.quantity > 0
        && Number.isFinite(line.unitPrice)
        && line.unitPrice >= 0
        && Number.isFinite(line.quantity * line.unitPrice)))
    && Array.isArray(workspace.suppliers)
    && workspace.suppliers.every((supplier) => isRecord(supplier)
      && typeof supplier.id === 'string'
      && typeof supplier.name === 'string')
    && Array.isArray(workspace.purchaseOrders)
    && workspace.purchaseOrders.every((order) => isRecord(order)
      && typeof order.id === 'string'
      && typeof order.supplierId === 'string'
      && isDateString(order.orderDate)
      && (order.expectedDate === undefined || order.expectedDate === '' || isDateString(order.expectedDate))
      && isSupportedCurrencyCode(order.currencyCode)
      && ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'].includes(order.status)
      && Array.isArray(order.lines)
      && order.lines.every((line) => isRecord(line)
        && typeof line.itemId === 'string'
        && typeof line.unit === 'string'
        && Number.isFinite(line.quantity)
        && line.quantity > 0
        && Number.isFinite(line.unitCost)
        && line.unitCost >= 0
        && Number.isFinite(line.receivedQuantity ?? 0)
        && (line.receivedQuantity ?? 0) >= 0
        && (line.receivedQuantity ?? 0) <= line.quantity
        && Number.isFinite(line.quantity * line.unitCost)))
    && Array.isArray(workspace.plannerScenarios)
    && workspace.plannerScenarios.length <= 3
    && workspace.plannerScenarios.every((scenario) => isRecord(scenario)
      && typeof scenario.id === 'string'
      && typeof scenario.name === 'string'
      && typeof scenario.category === 'string'
      && isSupportedCurrencyCode(scenario.currencyCode)
      && typeof scenario.productName === 'string'
      && typeof scenario.productQuantity === 'string'
      && typeof scenario.packagingCostPerProduct === 'string'
      && typeof scenario.otherExpenses === 'string'
      && typeof scenario.sellingPrice === 'string'
      && typeof scenario.inventoryProductId === 'string'
      && Array.isArray(scenario.materials)
      && scenario.materials.every((material) => isRecord(material)
        && typeof material.id === 'string'
        && typeof material.itemId === 'string'
        && typeof material.name === 'string'
        && typeof material.quantityPerProduct === 'string'
        && typeof material.unit === 'string'
        && typeof material.costPerUnit === 'string'))
    && Array.isArray(workspace.expenses)
    && workspace.expenses.every((expense) => isRecord(expense)
      && typeof expense.id === 'string'
      && typeof expense.description === 'string'
      && isDateString(expense.date)
      && Number.isFinite(expense.amount)
      && expense.amount > 0
      && isSupportedCurrencyCode(expense.currencyCode))
    && (workspace.activityHistory === undefined || (Array.isArray(workspace.activityHistory)
      && workspace.activityHistory.every(isValidActivityRecord)))
}

export function createApplicationBackup(applicationData, currencySettings, exportedAt = new Date().toISOString()) {
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt,
    description: 'Kosthagara browser-local data: all category workspaces, inventory, stock movements, production and sales orders, suppliers, purchase orders, recipes, expenses, planner scenarios, activity history, organisation profile, and currency settings. Passwords, authentication secrets, tokens, credentials, and OTP values are excluded.',
    data: {
      application: removeSensitiveFields({ version: STORAGE_VERSION, ...applicationData }),
      currencySettings: { ...currencySettings },
    },
  }
}

export function validateApplicationBackup(backup) {
  if (!isRecord(backup)) return { valid: false, message: 'The selected file must contain a JSON backup object.' }
  if (backup.format !== BACKUP_FORMAT) return { valid: false, message: 'This file is not a Kosthagara backup.' }
  if (backup.backupVersion !== BACKUP_VERSION) {
    return { valid: false, message: `Unsupported backup version "${String(backup.backupVersion)}". This app supports version ${BACKUP_VERSION}.` }
  }
  if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) {
    return { valid: false, message: 'The backup is missing a valid export timestamp.' }
  }
  if (typeof backup.description !== 'string' || !isRecord(backup.data)) {
    return { valid: false, message: 'The backup is missing its description or data object.' }
  }
  if (containsSensitiveFields(backup.data)) {
    return { valid: false, message: 'This backup contains password, authentication, credential, token, or OTP fields. Remove those fields before importing. Existing data was not changed.' }
  }

  const { application, currencySettings } = backup.data
  const hasValidApplication = isRecord(application)
    && application.version === STORAGE_VERSION
    && isRecord(application.workspaces)
    && BUSINESS_CATEGORIES.every(({ id }) => Object.hasOwn(application.workspaces, id)
      && validateBackupWorkspace(application.workspaces[id]))
    && BUSINESS_CATEGORIES.some(({ id }) => id === application.businessCategory)
    && typeof application.workspaceEntered === 'boolean'
    && validateOrganization(application.organization)
  if (!hasValidApplication) {
    return { valid: false, message: 'Required application or workspace fields are missing, or the backup contains invalid inventory, order, recipe, supplier, expense, or planner data. Existing data was not changed.' }
  }
  if (!validateCurrencySettings(currencySettings)) {
    return { valid: false, message: 'The backup has missing or unsupported country, currency, or locale settings. Existing data was not changed.' }
  }

  return { valid: true, message: '', exportedAt: backup.exportedAt, data: { application, currencySettings } }
}

export function restoreApplicationBackup(backup) {
  const validation = validateApplicationBackup(backup)
  if (!validation.valid) return { saved: false, message: validation.message }
  const { data } = validation
  let previousApplication
  let previousCurrency
  try {
    previousApplication = window.localStorage.getItem(STORAGE_KEY)
    previousCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY)
  } catch (error) {
    return { saved: false, message: `Browser storage could not be read (${error.message}). No backup data was imported.` }
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.application))
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(data.currencySettings))
    return { saved: true, message: '', data }
  } catch (error) {
    try {
      if (previousApplication === null) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, previousApplication)
      if (previousCurrency === null) window.localStorage.removeItem(CURRENCY_STORAGE_KEY)
      else window.localStorage.setItem(CURRENCY_STORAGE_KEY, previousCurrency)
    } catch (rollbackError) {
      return {
        saved: false,
        message: `Restore failed (${error.message}) and the previous browser data could not be fully restored (${rollbackError.message}). Stop using this session and recover from another backup.`,
      }
    }
    return { saved: false, message: `Restore failed (${error.message}). Existing browser data was restored.` }
  }
}

export function loadApplicationData(defaultWorkspaces) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {
        workspaces: defaultWorkspaces,
        businessCategory: 'home-foods',
        organization: null,
        workspaceEntered: false,
        applicationExtras: {},
        storageMode: 'ready',
        storageMessage: '',
      }
    }

    const parsed = JSON.parse(stored)
    return loadApplicationDataSnapshot(parsed, defaultWorkspaces)
  } catch (error) {
    const invalidSnapshot = error.message.includes('workspace is incomplete or invalid')
    return {
      workspaces: defaultWorkspaces,
      businessCategory: 'home-foods',
      organization: null,
      workspaceEntered: false,
      applicationExtras: {},
      storageMode: 'blocked',
      storageMessage: invalidSnapshot
        ? 'Saved browser data is incomplete or invalid. It has not been replaced. Choose to start fresh and replace it, or continue without saving.'
        : `Saved browser data could not be read (${error.message}). It has not been replaced.`,
    }
  }
}

export function loadApplicationDataSnapshot(parsed, defaultWorkspaces) {
  const hasValidWorkspaces = parsed?.version === STORAGE_VERSION
    && isRecord(parsed.workspaces)
    && BUSINESS_CATEGORIES.every(({ id }) => validateWorkspace(parsed.workspaces[id]))
  const hasValidCategory = BUSINESS_CATEGORIES.some(({ id }) => id === parsed?.businessCategory)
  if (!hasValidWorkspaces || !hasValidCategory || !validateOrganization(parsed.organization)
    || typeof parsed.workspaceEntered !== 'boolean') {
    throw new Error('The saved workspace is incomplete or invalid. Existing data has not been changed.')
  }
  if (parsed.currencySettings !== undefined && !validateCurrencySettings(parsed.currencySettings)) {
    throw new Error('The saved workspace has invalid currency settings. Existing data has not been changed.')
  }

  const workspaces = Object.fromEntries(BUSINESS_CATEGORIES.map(({ id }) => [id, {
    ...defaultWorkspaces[id],
    ...parsed.workspaces[id],
    expenses: parsed.workspaces[id].expenses ?? [],
    plannerScenarios: parsed.workspaces[id].plannerScenarios ?? [],
    activityHistory: normalizeActivityHistory(parsed.workspaces[id].activityHistory),
  }]))
  return {
    workspaces,
    businessCategory: parsed.businessCategory,
    organization: parsed.organization,
    workspaceEntered: parsed.workspaceEntered,
    applicationExtras: Object.fromEntries(Object.entries(parsed).filter(([key]) =>
      !['version', 'workspaces', 'businessCategory', 'organization', 'workspaceEntered'].includes(key))),
    storageMode: 'ready',
    storageMessage: '',
  }
}

export function saveApplicationData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      ...data,
    }))
    return { saved: true, message: '' }
  } catch (error) {
    return {
      saved: false,
      message: `Changes are not being saved in this browser (${error.message}).`,
    }
  }
}

export function replaceApplicationData(data) {
  return saveApplicationData(data)
}

export function getCurrencySettings() {
  try {
    const stored = window.localStorage.getItem('kosthagara-currency-v1')
    if (!stored) return { settings: null, warning: '' }
    const settings = JSON.parse(stored)
    if (!validateCurrencySettings(settings)) {
      return { settings: null, warning: 'Saved country, currency, or locale settings are invalid or unsupported. They have not been replaced.' }
    }
    return { settings, warning: '' }
  } catch (error) {
    return { settings: null, warning: `Saved currency settings could not be read (${error.message}). They have not been replaced.` }
  }
}

export function saveCurrencySettings(settings) {
  try {
    window.localStorage.setItem('kosthagara-currency-v1', JSON.stringify(settings))
    return { saved: true, message: '' }
  } catch (error) {
    return { saved: false, message: `Currency settings are not being saved in this browser (${error.message}).` }
  }
}
