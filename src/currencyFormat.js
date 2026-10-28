const formatterCache = new Map()

export function formatCurrency(amount, currency, locale) {
  if (!Number.isFinite(amount)) throw new TypeError('Currency formatting requires a finite numeric amount.')
  const safeCurrency = currency || 'USD'
  const safeLocale = locale || 'en-US'
  const cacheKey = `${safeLocale}:${safeCurrency}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(safeLocale, { style: 'currency', currency: safeCurrency })
    formatterCache.set(cacheKey, formatter)
  }
  return formatter.format(amount)
}
