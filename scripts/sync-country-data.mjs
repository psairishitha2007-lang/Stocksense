import { writeFile } from 'node:fs/promises'
import countries from 'world-countries'

const countryCurrencyData = countries
  .filter((country) => country.cca2)
  .map((country) => ({
    code: country.cca3,
    iso2: country.cca2,
    name: country.name.common,
    callingCode: country.idd?.root
      ? `${country.idd.root}${country.idd.suffixes?.length === 1 ? country.idd.suffixes[0] : ''}`
      : '',
    currencies: Object.entries(country.currencies ?? {}).map(([code, currency]) => ({
      code,
      name: currency.name,
      symbol: currency.symbol,
    })),
  }))
  .sort((first, second) => first.name.localeCompare(second.name))

await writeFile(
  new URL('../src/countryCurrencyData.json', import.meta.url),
  `${JSON.stringify(countryCurrencyData)}\n`,
)

console.log(`Updated ${countryCurrencyData.length} country records.`)
