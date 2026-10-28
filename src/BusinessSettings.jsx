import { useState } from 'react'
import { CategoryBranding, CategoryLogo } from './CategoryBranding.jsx'
import { BUSINESS_CATEGORIES, COUNTRIES, CURRENCIES } from './businessData.js'
import { useCurrency } from './currencyContext.js'
import BackupRecovery from './BackupRecovery.jsx'

export default function BusinessSettings({
  category,
  onCategoryChange,
  applicationData,
  currencySettings,
  onRestoreBackup,
  onBackupExport,
  onCountryChange,
  onCurrencyChange,
  onLocaleChange,
}) {
  const {
    country,
    currency,
    locale,
    formatMoney,
  } = useCurrency()
  const [countrySearch, setCountrySearch] = useState(country ? `${country.name} (${country.iso2})` : '')
  const [localeError, setLocaleError] = useState('')
  const selectedCategory = BUSINESS_CATEGORIES.find((entry) => entry.id === category)

  function selectCountry(event) {
    const value = event.target.value.trim()
    const matchingCountry = COUNTRIES.find((entry) => value === `${entry.name} (${entry.iso2})`)
    setCountrySearch(value)
    if (matchingCountry) onCountryChange(matchingCountry.code)
  }

  function changeLocale(event) {
    const value = event.target.value.trim()
    try {
      const normalized = new Intl.Locale(value).toString()
      onLocaleChange(normalized)
      setLocaleError('')
    } catch {
      setLocaleError('Enter a valid locale such as en-GB, hi-IN, or ja-JP.')
    }
  }

  return (
    <section className="page-content management-page business-settings-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">YOUR BUSINESS PROFILE</div>
          <h1>Business settings</h1>
          <p className="welcome-subtitle">Shape your workspace for the business you run and the region you work in.</p>
        </div>
      </div>
      <div className="demo-banner"><span>LOCAL SETTINGS</span> Settings are saved in this browser when available. They are not linked to a secure account, database, or cross-device sync.</div>

      <CategoryBranding category={selectedCategory} />
      <article className="panel business-settings-panel">
        <div className="management-toolbar">
          <div><h2>Choose your business category</h2><p>Each category has its own workspace inventory, recipes, orders, and stock history. Switching categories never transfers stock; edits stay with that workspace in this browser.</p></div>
        </div>
        <div className="category-grid">
          {BUSINESS_CATEGORIES.map((entry) => (
            <button
              className={`category-choice ${entry.accent}${category === entry.id ? ' selected' : ''}`}
              type="button"
              key={entry.id}
              onClick={() => onCategoryChange(entry.id)}
              aria-pressed={category === entry.id}
            >
              <CategoryLogo category={entry} />
              <span className="category-choice-title">{entry.name}</span>
              <span className="category-choice-subtitle">{entry.subtitle}</span>
            </button>
          ))}
        </div>
      </article>

      <article className="panel business-settings-panel regional-settings-panel">
        <div className="management-toolbar">
          <div><h2>Country, locale & currency</h2><p>Country selection suggests regional settings. You can choose another currency manually.</p></div>
        </div>
        <div className="regional-settings-grid">
          <label className="form-field">
            <span>Country or region</span>
            <input
              list="kosthagara-country-options"
              value={countrySearch}
              onChange={selectCountry}
              placeholder="Search countries..."
              autoComplete="country-name"
            />
            <datalist id="kosthagara-country-options">
              {COUNTRIES.map((entry) => <option key={entry.code} value={`${entry.name} (${entry.iso2})`} />)}
            </datalist>
          </label>
          <label className="form-field">
            <span>Default currency</span>
            <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
              {CURRENCIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.code} — {entry.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Number and date locale</span>
            <input value={locale} onChange={changeLocale} placeholder="e.g. en-IN" aria-invalid={Boolean(localeError)} />
            {localeError && <small className="field-error" role="alert">{localeError}</small>}
          </label>
          <div className="currency-preview">
            <span>Formatting preview</span>
            <strong>{formatMoney(123456.78)}</strong>
            <small>{country?.name ?? 'Country'} · {currency} · {locale}</small>
          </div>
        </div>
        <div className="currency-safety-note" role="note">
          <strong>Currency safety</strong>
          <p>Changing the display currency does not convert, recalculate, or change any stored amount or stock quantity. No exchange rates are applied. Existing financial records should keep their original currency; this demo does not keep permanent multi-currency financial history.</p>
        </div>
        <p className="country-data-credit">Country and currency suggestions use the world-countries dataset. Verify local accounting and currency requirements before relying on demo values.</p>
      </article>

      <BackupRecovery
        applicationData={applicationData}
        currencySettings={currencySettings}
        onRestore={onRestoreBackup}
        onExportSuccess={onBackupExport}
      />
    </section>
  )
}
