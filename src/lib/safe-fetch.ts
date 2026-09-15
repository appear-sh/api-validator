import { lookup } from 'node:dns/promises'
import { inspectPublicHttpsUrl, isDisallowedIp } from '@/lib/https-url'
import { SPEC_MAX_BYTES, SPEC_TOO_LARGE } from '@/lib/spec-limits'
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'Agent-Ready-Score/0.1 (+https://validator.appear.sh)'
const ALLOWED_MESSAGE = 'This URL is not allowed.'

export async function assertResolvedPublic(url: URL): Promise<{ error: string } | undefined> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  try {
    // Residual DNS-rebinding TOCTOU remains between lookup and connect.
    const records = await lookup(hostname, { all: true, verbatim: true })
    if (records.length === 0) {
      return { error: 'Failed to fetch from URL: DNS lookup failed.' }
    }
    if (records.some((record) => isDisallowedIp(record.address))) {
      return { error: ALLOWED_MESSAGE }
    }
  } catch {
    return { error: 'Failed to fetch from URL: DNS lookup failed.' }
  }
}

async function readCapped(response: Response): Promise<{ text: string } | { error: string }> {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > SPEC_MAX_BYTES) {
    return { error: SPEC_TOO_LARGE }
  }

  if (!response.body) return { text: '' }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > SPEC_MAX_BYTES) {
      await reader.cancel()
      return { error: SPEC_TOO_LARGE }
    }
    chunks.push(Buffer.from(value))
  }
  return { text: Buffer.concat(chunks).toString('utf8') }
}

export async function fetchPublicHttps(
  inputUrl: string,
  options?: { accept?: string },
): Promise<{ text: string; contentType: string; finalUrl: string } | { error: string }> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  let current = inputUrl

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const inspected = inspectPublicHttpsUrl(current)
      if ('error' in inspected) return inspected

      const resolved = await assertResolvedPublic(inspected.parsed)
      if (resolved) return resolved

      const response = await fetch(inspected.parsed.href, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        credentials: 'omit',
        signal,
        headers: {
          Accept: options?.accept ?? 'application/json, application/yaml, text/yaml, */*',
          'User-Agent': USER_AGENT,
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          return { error: 'Failed to fetch from URL: redirect without Location.' }
        }
        current = new URL(location, inspected.parsed).href
        continue
      }

      if (!response.ok) {
        return { error: `Failed to fetch from URL: ${response.status} ${response.statusText}` }
      }

      const body = await readCapped(response)
      if ('error' in body) return body

      return {
        text: body.text,
        contentType: response.headers.get('content-type') || '',
        finalUrl: inspected.parsed.href,
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { error: 'Request timed out.' }
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Request timed out.' }
    }
    return {
      error: `Failed to fetch from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  return { error: 'Failed to fetch from URL: too many redirects.' }
}
