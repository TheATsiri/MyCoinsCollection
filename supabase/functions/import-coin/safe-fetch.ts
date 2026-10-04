import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    )
  }
  // Only global unicast IPv6; exclude transition/tunnelling and special-purpose space.
  if (isIP(address) === 6) {
    const [first, second] = address
      .split(':')
      .map((part) => parseInt(part || '0', 16))
    return (
      first >= 0x2000 &&
      first <= 0x3fff &&
      first !== 0x2002 &&
      first !== 0x3fff &&
      !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
    )
  }
  return false
}
export function validateUrl(raw: string): URL {
  const url = new URL(raw)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))
  )
    throw new Error('Enter a public HTTP or HTTPS reference URL.')
  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
  if (
    !hostname ||
    hostname === 'localhost' ||
    /\.(localhost|local|internal|test|invalid)$/.test(hostname) ||
    (isIP(hostname) && !publicAddress(hostname))
  )
    throw new Error('Private or local network URLs are not allowed.')
  url.hash = ''
  return url
}
export async function fetchPublicPage(
  raw: string,
): Promise<{ html: string; url: string }> {
  let url = validateUrl(raw)
  const deadline = Date.now() + 12_000
  for (let hop = 0; hop <= 3; hop++) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await new Promise<{ address: string; family: number }[]>(
          (resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('The reference website timed out.')),
              Math.max(1, deadline - Date.now()),
            )
            lookup(hostname, { all: true })
              .then(resolve, reject)
              .finally(() => clearTimeout(timer))
          },
        )
    if (
      !addresses.length ||
      addresses.some((item) => !publicAddress(item.address))
    )
      throw new Error('Private or local network URLs are not allowed.')
    const address = addresses[0],
      remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('The reference website timed out.')
    // Pin the vetted address in the actual connection; a second DNS resolution cannot bypass validation.
    const response = await new Promise<{
      html: string
      status: number
      location?: string
    }>((resolve, reject) => {
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
      const request = transport(
        url,
        {
          agent: false,
          lookup: (_host, options, callback) => {
            if (options.all)
              callback(null, [
                { address: address.address, family: address.family },
              ])
            else callback(null, address.address, address.family)
          },
          headers: {
            'User-Agent':
              'MyCoinsCollection/1.0 (catalogue reference retrieval)',
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Encoding': 'identity',
          },
        },
        (response) => {
          const status = response.statusCode ?? 500
          if ([301, 302, 303, 307, 308].includes(status)) {
            response.destroy()
            resolve({ html: '', status, location: response.headers.location })
            return
          }
          if (status !== 200) {
            response.destroy()
            reject(
              new Error(
                'The reference website is unavailable or blocked. Enter the details manually.',
              ),
            )
            return
          }
          if (
            !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(
              response.headers['content-type'] ?? '',
            ) ||
            (response.headers['content-encoding'] &&
              response.headers['content-encoding'] !== 'identity')
          ) {
            response.destroy()
            reject(
              new Error(
                'The reference URL did not return a supported HTML page.',
              ),
            )
            return
          }
          let size = 0
          const chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > 2 * 1024 * 1024) {
              request.destroy(new Error('The reference page is too large.'))
              return
            }
            chunks.push(chunk)
          })
          response.on('error', reject)
          response.on('end', () =>
            resolve({ html: Buffer.concat(chunks).toString('utf8'), status }),
          )
        },
      )
      const timer = setTimeout(
        () => request.destroy(new Error('The reference website timed out.')),
        remaining,
      )
      request.on('close', () => clearTimeout(timer))
      request.on('error', reject)
      request.end()
    })
    if (response.status === 200) return { html: response.html, url: url.href }
    if (!response.location || hop === 3)
      throw new Error('Too many redirects from the reference website.')
    url = validateUrl(new URL(response.location, url).href)
  }
  throw new Error('Information could not be retrieved.')
}
