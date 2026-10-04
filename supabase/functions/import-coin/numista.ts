// Numista v3 catalogue lookup. Credentials never leave this server module.
export function numistaTypeId(raw: string): number | null {
  const url = new URL(raw)
  if (!/^(?:[a-z]{2}\.)?numista\.com$/i.test(url.hostname)) return null
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('Enter a Numista catalogue URL.')
  const match = url.pathname.match(
    /^\/(?:catalogue\/(?:pieces|piece|exonumia|billets))?([1-9]\d{0,8})(?:\.html)?\/?$/,
  )
  if (!match) throw new Error('Enter a Numista catalogue URL.')
  return Number(match[1])
}
const text = (value: unknown) =>
  typeof value === 'string' ? value.slice(0, 4000) : ''
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
export function numistaPreview(raw: unknown, id: number) {
  const type = object(raw)
  if (type.id !== id || !text(type.title))
    throw new Error('Numista returned an invalid response.')
  const rows: [string, string | number | undefined][] = [
    ['Issuing authority', text(object(type.issuer).name)],
    [
      'Year range',
      [type.min_year, type.max_year]
        .filter((v) => typeof v === 'number')
        .join(' – '),
    ],
    ['Denomination', text(object(type.value).text)],
    ['Metal', text(object(type.composition).text)],
    ['Weight (g)', typeof type.weight === 'number' ? type.weight : undefined],
    ['Size (mm)', typeof type.size === 'number' ? type.size : undefined],
    ['Obverse description', text(object(type.obverse).description)],
    ['Reverse description', text(object(type.reverse).description)],
  ]
  return {
    fields: {},
    source_url: `https://en.numista.com/${id}`,
    warnings: [],
    numista: {
      id,
      title: text(type.title),
      details: rows
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([label, value]) => ({ label, value })),
    },
  }
}
export async function lookupNumista(
  id: number,
  key: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (!key?.trim())
    throw new Error(
      'Numista lookup is not configured. Set the server secret NUMISTA_API_KEY.',
    )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetcher(
      `https://api.numista.com/v3/types/${id}?lang=en`,
      {
        headers: { 'Numista-API-Key': key, Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      },
    )
    if (response.status === 429)
      throw new Error(
        'Numista quota or request limit reached. Try again later or check your Free Plan usage.',
      )
    if (response.status === 401 || response.status === 403)
      throw new Error(
        'Numista rejected the server API key. Check your API access settings.',
      )
    if (response.status === 404)
      throw new Error('This Numista N# was not found.')
    if (!response.ok)
      throw new Error('Numista is temporarily unavailable. Try again later.')
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Numista returned an invalid response.')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Numista returned an invalid response.')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024 * 1024) {
        await reader.cancel()
        throw new Error('Numista returned an oversized response.')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    let data: unknown
    try {
      data = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      throw new Error('Numista returned an invalid response.')
    }
    return numistaPreview(data, id)
  } catch (error) {
    // Never return upstream bodies, request headers, or transport error details.
    if (
      error instanceof Error &&
      /^(Numista |This Numista )/.test(error.message)
    )
      throw error
    // eslint-disable-next-line preserve-caught-error -- Do not retain credential-bearing transport errors.
    throw new Error('Numista could not be reached. Try again later.')
  } finally {
    clearTimeout(timer)
  }
}
