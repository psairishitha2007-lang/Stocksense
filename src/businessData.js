import countryCurrencyData from './countryCurrencyData.json' with { type: 'json' }

export const BUSINESS_CATEGORIES = [
  {
    id: 'home-foods',
    name: 'Home Made Foods',
    subtitle: 'A warm little home for food makers.',
    illustration: '/assets/business-categories/home-foods.svg',
    logo: '/assets/business-logos/kosthagara-home-foods.png',
    accent: 'bakery',
  },
  {
    id: 'pencil-arts',
    name: 'Pencil Sketches & Arts',
    subtitle: 'Keep every creative tool in its place.',
    illustration: '/assets/business-categories/pencil-arts.svg',
    logo: '/assets/business-logos/kosthagara-arts.png',
    accent: 'arts',
  },
  {
    id: 'clays-handicrafts',
    name: 'Clays & Handicrafts',
    subtitle: 'Made by hand, managed with care.',
    illustration: '/assets/business-categories/clays-handicrafts.svg',
    logo: '/assets/business-logos/kosthagara-clay.png',
    accent: 'craft',
  },
  {
    id: 'kids-toys',
    name: 'Kids & Toys',
    subtitle: 'A playful place for little-big ideas.',
    illustration: '/assets/business-categories/kids-toys.svg',
    logo: '/assets/business-logos/kosthagara-kids-toys.png',
    accent: 'playful',
  },
  {
    id: 'supermarket',
    name: 'Supermarket',
    subtitle: 'Fresh stock, neatly accounted for.',
    illustration: '/assets/business-categories/supermarket.svg',
    logo: '/assets/business-logos/kosthagara-supermarket.png',
    accent: 'market',
  },
  {
    id: 'all-businesses',
    name: 'All Businesses',
    subtitle: 'One bright workspace for every kind of business.',
    illustration: '/assets/business-categories/all-businesses.svg',
    logo: '/assets/business-logos/kosthagara-all-businesses.png',
    accent: 'business',
  },
]

export const COUNTRIES = countryCurrencyData

const currencyNames = new Map()
for (const country of COUNTRIES) {
  for (const currency of country.currencies) {
    if (!currencyNames.has(currency.code)) currencyNames.set(currency.code, currency.name)
  }
}

export const CURRENCIES = [...currencyNames]
  .map(([code, name]) => ({ code, name }))
  .filter(({ code }) => {
    try {
      new Intl.NumberFormat('en', { style: 'currency', currency: code })
      return true
    } catch (error) {
      if (error instanceof RangeError) return false
      throw error
    }
  })
  .sort((first, second) => first.code.localeCompare(second.code))

export function getCountry(code) {
  return COUNTRIES.find((country) => country.code === code)
}

export function getSuggestedCurrency(countryCode) {
  return getCountry(countryCode)?.currencies[0]?.code ?? null
}

export function getSuggestedLocale(countryCode) {
  const country = getCountry(countryCode)
  if (!country) return 'en-US'
  try {
    const regionalLocale = new Intl.Locale('und', { region: country.iso2 }).maximize()
    return `${regionalLocale.language}-${country.iso2}`
  } catch {
    return `en-${country.iso2}`
  }
}
