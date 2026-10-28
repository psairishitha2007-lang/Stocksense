import { BUSINESS_CATEGORIES } from './businessData.js'

export function CategoryIllustration({ category, className = '' }) {
  const selected = typeof category === 'string'
    ? BUSINESS_CATEGORIES.find((entry) => entry.id === category)
    : category

  if (!selected) return null

  return (
    <img
      className={`category-illustration ${className}`.trim()}
      src={selected.illustration}
      alt=""
      aria-hidden="true"
    />
  )
}

export function CategoryLogo({ category, className = '' }) {
  const selected = typeof category === 'string'
    ? BUSINESS_CATEGORIES.find((entry) => entry.id === category)
    : category

  if (!selected) return null

  return (
    <img
      className={`category-logo ${className}`.trim()}
      src={selected.logo}
      alt={`${selected.name} logo`}
    />
  )
}

export function CategoryBranding({ category, compact = false }) {
  const selected = typeof category === 'string'
    ? BUSINESS_CATEGORIES.find((entry) => entry.id === category)
    : category

  if (!selected) return null

  return (
    <div className={`category-branding ${selected.accent}${compact ? ' compact' : ''}`}>
      <div className="category-branding-copy">
        <CategoryLogo category={selected} />
        <div>
          <strong>{selected.name}</strong>
          <span>{selected.subtitle}</span>
        </div>
      </div>
      <CategoryIllustration category={selected} />
    </div>
  )
}
