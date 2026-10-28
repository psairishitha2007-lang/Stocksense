export const ACTIVITY_CATEGORIES = [
  'inventory',
  'sales',
  'purchases',
  'production',
  'recipes',
  'planner',
  'settings',
  'backup',
]

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isValidActivityRecord(record) {
  return isRecord(record)
    && typeof record.id === 'string'
    && record.id.length > 0
    && ACTIVITY_CATEGORIES.includes(record.category)
    && typeof record.action === 'string'
    && record.action.length > 0
    && typeof record.description === 'string'
    && record.description.length > 0
    && typeof record.timestamp === 'string'
    && Number.isFinite(Date.parse(record.timestamp))
    && (record.itemName === undefined || typeof record.itemName === 'string')
    && (record.orderName === undefined || typeof record.orderName === 'string')
    && (record.quantity === undefined || Number.isFinite(record.quantity))
    && (record.unit === undefined || typeof record.unit === 'string')
}

export function normalizeActivityHistory(history) {
  if (!Array.isArray(history)) return []
  const seen = new Set()
  return history
    .filter(isValidActivityRecord)
    .filter((record) => {
      if (seen.has(record.id)) return false
      seen.add(record.id)
      return true
    })
    .sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp))
}

export function createActivityRecord(details, now = new Date()) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `activity-${now.getTime()}-${Math.random().toString(36).slice(2)}`
  return {
    id,
    category: details.category,
    action: details.action,
    description: details.description,
    timestamp: now.toISOString(),
    ...(details.itemName ? { itemName: details.itemName } : {}),
    ...(details.orderName ? { orderName: details.orderName } : {}),
    ...(Number.isFinite(details.quantity) ? { quantity: details.quantity } : {}),
    ...(details.unit ? { unit: details.unit } : {}),
  }
}

export function appendActivityRecord(history, record) {
  if (!isValidActivityRecord(record)) throw new TypeError('Activity record is invalid.')
  const current = normalizeActivityHistory(history)
  if (current.some((entry) => entry.id === record.id)) return current
  return normalizeActivityHistory([record, ...current])
}

function localDate(timestamp) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function filterActivityRecords(records, { query = '', category = 'all', from = '', to = '' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return normalizeActivityHistory(records).filter((record) => {
    if (category !== 'all' && record.category !== category) return false
    const date = localDate(record.timestamp)
    if (from && date < from) return false
    if (to && date > to) return false
    const searchableText = [record.description, record.itemName, record.orderName]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return !normalizedQuery || searchableText.includes(normalizedQuery)
  })
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function activityRecordsToCsv(records) {
  const headings = ['Timestamp', 'Category', 'Action', 'Description', 'Item', 'Order', 'Quantity', 'Unit']
  return [
    headings.map(csvCell).join(','),
    ...normalizeActivityHistory(records).map((record) => [
      record.timestamp,
      record.category,
      record.action,
      record.description,
      record.itemName,
      record.orderName,
      record.quantity,
      record.unit,
    ].map(csvCell).join(',')),
  ].join('\r\n')
}
