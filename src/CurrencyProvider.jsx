import { useEffect, useMemo, useRef, useState } from 'react'
import { getCountry, getSuggestedCurrency, getSuggestedLocale } from './businessData.js'
import { CurrencyContext } from './currencyContext.js'
import { formatCurrency } from './currencyFormat.js'
import { getCurrencySettings, saveCurrencySettings } from './applicationStorage.js'

export function CurrencyProvider({ children }) {
  const [initial] = useState(getCurrencySettings)
  const [settings, setSettings] = useState(() => initial.settings ?? {
    countryCode: 'USA',
    locale: getSuggestedLocale('USA'),
    currency: 'USD',
  })
  const [storageNotice, setStorageNotice] = useState(initial.warning)
  const [currencyPersistenceEnabled, setCurrencyPersistenceEnabled] = useState(true)
  const previousSettings = useRef(JSON.stringify(settings))

  useEffect(() => {
    const snapshot = JSON.stringify(settings)
    if (snapshot === previousSettings.current || !currencyPersistenceEnabled) return
    const result = saveCurrencySettings(settings)
    previousSettings.current = snapshot
    setStorageNotice(result.message)
  }, [settings, currencyPersistenceEnabled])

  const value = useMemo(() => ({
    ...settings,
    storageNotice,
    setCurrencyPersistenceEnabled,
    country: getCountry(settings.countryCode),
    setCountryCode(countryCode) {
      setSettings((current) => ({
        ...current,
        countryCode,
        locale: getSuggestedLocale(countryCode),
        currency: getSuggestedCurrency(countryCode) ?? current.currency,
      }))
    },
    setCurrency(currency) {
      setSettings((current) => ({ ...current, currency }))
    },
    restoreCurrencySettings(restoredSettings) {
      setSettings(restoredSettings)
    },
    setLocale(locale) {
      setSettings((current) => ({ ...current, locale }))
    },
    formatMoney(amount, currency = settings.currency) {
      return formatCurrency(amount, currency, settings.locale)
    },
    formatNumber(amount, options = {}) {
      return new Intl.NumberFormat(settings.locale, options).format(amount)
    },
    formatDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
      return new Intl.DateTimeFormat(settings.locale, options).format(date)
    },
  }), [settings, storageNotice])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}
