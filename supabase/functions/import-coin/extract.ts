export type Extracted = {
  fields: Record<string, string | number>
  source_url: string
  warnings: string[]
}
function text(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code = n.startsWith('x') ? parseInt(n.slice(1), 16) : Number(n)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000)
}
const labels: Record<string, string> = {
  name: 'name',
  title: 'name',
  'coin name': 'name',
  titel: 'name',
  όνομα: 'name',
  country: 'issuing_authority',
  issuer: 'issuing_authority',
  'issuing authority': 'issuing_authority',
  land: 'issuing_authority',
  ausgabeland: 'issuing_authority',
  χώρα: 'issuing_authority',
  year: 'year',
  date: 'year',
  jahr: 'year',
  έτος: 'year',
  denomination: 'denomination',
  value: 'denomination',
  facevalue: 'denomination',
  nennwert: 'denomination',
  wert: 'denomination',
  αξία: 'denomination',
  composition: 'metal',
  metal: 'metal',
  material: 'metal',
  metall: 'metal',
  zusammensetzung: 'metal',
  μέταλλο: 'metal',
  weight: 'weight_g',
  'weight (g)': 'weight_g',
  gewicht: 'weight_g',
  βάρος: 'weight_g',
  diameter: 'diameter_mm',
  'diameter (mm)': 'diameter_mm',
  durchmesser: 'diameter_mm',
  διάμετρος: 'diameter_mm',
  mint: 'mint',
  prägestätte: 'mint',
  νομισματοκοπείο: 'mint',
  'mint mark': 'mint_mark',
  mintmark: 'mint_mark',
  münzzeichen: 'mint_mark',
  ruler: 'ruler',
  herrscher: 'ruler',
  'historical period': 'historical_period',
  epoche: 'historical_period',
  obverse: 'obverse_description',
  vorderseite: 'obverse_description',
  εμπροσθότυπος: 'obverse_description',
  reverse: 'reverse_description',
  rückseite: 'reverse_description',
  οπισθότυπος: 'reverse_description',
}
export function extractCoin(html: string, source_url: string): Extracted {
  const fields: Extracted['fields'] = {},
    warnings: string[] = []
  const put = (key: string, raw: unknown) => {
    if (typeof raw !== 'string' && typeof raw !== 'number') return
    const value = text(String(raw))
    if (!value || fields[key] !== undefined) return
    if (key === 'year') {
      if (/^\d{1,4}$/.test(value) && Number(value) > 0)
        fields[key] = Number(value)
      return
    }
    if (key === 'weight_g' || key === 'diameter_mm') {
      const match = value.match(
        key === 'weight_g'
          ? /^(\d+(?:[.,]\d+)?)\s*(?:g|grams?|gramm)?$/i
          : /^(\d+(?:[.,]\d+)?)\s*(?:mm|millimet(?:er|re)s?)?$/i,
      )
      if (match && Number(match[1].replace(',', '.')) > 0)
        fields[key] = Number(match[1].replace(',', '.'))
      return
    }
    fields[key] = value.slice(
      0,
      ['name', 'issuing_authority'].includes(key) ? 200 : 4000,
    )
  }
  const attribute = (tag: string, key: string) =>
    tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]
  for (const script of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const scan = (node: unknown, depth = 0) => {
        if (depth > 8 || !node || typeof node !== 'object') return
        if (Array.isArray(node)) {
          node.slice(0, 100).forEach((item) => scan(item, depth + 1))
          return
        }
        const item = node as Record<string, unknown>
        const type = String(item['@type'] ?? '')
        if (/Product|IndividualProduct|Coin/i.test(type)) {
          put('name', item.name)
          if (Array.isArray(item.additionalProperty))
            for (const property of item.additionalProperty.slice(0, 100)) {
              if (property && typeof property === 'object') {
                const prop = property as Record<string, unknown>,
                  key =
                    labels[
                      String(prop.name ?? '')
                        .trim()
                        .toLowerCase()
                    ]
                if (key) put(key, prop.value)
              }
            }
        }
        if (item['@graph']) scan(item['@graph'], depth + 1)
      }
      scan(JSON.parse(script[1]))
    } catch {
      /* Malformed metadata is ignored; visible labels remain available. */
    }
  }
  const safe = html.replace(
    /<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  )
  for (const row of safe.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((cell) => text(cell[1]))
    const key = labels[(cells[0] ?? '').replace(/:$/, '').trim().toLowerCase()]
    if (key && cells.length >= 2) put(key, cells[1])
  }
  for (const pair of safe.matchAll(
    /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi,
  )) {
    const key = labels[text(pair[1]).replace(/:$/, '').trim().toLowerCase()]
    if (key) put(key, pair[2])
  }
  for (const tag of safe.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(tag[0], 'property') === 'og:title')
      put('name', attribute(tag[0], 'content'))
  }
  if (!fields.name) put('name', safe.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  if ('weight_g' in fields || 'diameter_mm' in fields)
    fields.measurement_source = `Catalogue specifications: ${source_url}; specimen not measured`
  warnings.push(
    'Review imported information before saving. Unknown details can be entered manually.',
  )
  if (!Object.keys(fields).length)
    warnings.push(
      'No recognisable coin details were found. Enter the details manually.',
    )
  else if (!fields.issuing_authority || !fields.year)
    warnings.push(
      'Only partial information was found. Complete missing fields manually.',
    )
  return { fields, source_url, warnings }
}
