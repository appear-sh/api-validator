import { BlockList, isIP } from 'node:net'

const ALLOWED_MESSAGE = 'This URL is not allowed.'

const blockedExactHosts = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata.goog',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local',
])

const blockedSuffixes = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
  '.lan',
  '.home',
  '.corp',
]

const v4Block = new BlockList()
v4Block.addSubnet('0.0.0.0', 8, 'ipv4')
v4Block.addSubnet('10.0.0.0', 8, 'ipv4')
v4Block.addSubnet('100.64.0.0', 10, 'ipv4')
v4Block.addSubnet('127.0.0.0', 8, 'ipv4')
v4Block.addSubnet('169.254.0.0', 16, 'ipv4')
v4Block.addSubnet('172.16.0.0', 12, 'ipv4')
v4Block.addSubnet('192.168.0.0', 16, 'ipv4')
v4Block.addSubnet('198.18.0.0', 15, 'ipv4')
v4Block.addSubnet('224.0.0.0', 4, 'ipv4')
v4Block.addSubnet('240.0.0.0', 4, 'ipv4')

const v6Block = new BlockList()
v6Block.addAddress('::', 'ipv6')
v6Block.addAddress('::1', 'ipv6')
v6Block.addSubnet('fc00::', 7, 'ipv6')
v6Block.addSubnet('fe80::', 10, 'ipv6')
v6Block.addSubnet('ff00::', 8, 'ipv6')

function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function ipv4FromInteger(host: string): string | null {
  if (!/^\d+$/.test(host)) return null
  const n = Number(host)
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return null
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

function unwrapIp(address: string): { ip: string; type: 'ipv4' | 'ipv6' } | null {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mapped) return { ip: mapped[1], type: 'ipv4' }
  const version = isIP(address)
  if (version === 4) return { ip: address, type: 'ipv4' }
  if (version === 6) return { ip: address, type: 'ipv6' }
  const dotted = ipv4FromInteger(address)
  if (dotted) return { ip: dotted, type: 'ipv4' }
  return null
}

export function isDisallowedIp(address: string): boolean {
  const parsed = unwrapIp(address)
  if (!parsed) return false
  return parsed.type === 'ipv4'
    ? v4Block.check(parsed.ip, 'ipv4')
    : v6Block.check(parsed.ip, 'ipv6')
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (blockedExactHosts.has(host)) return true
  if (blockedSuffixes.some((suffix) => host.endsWith(suffix))) return true
  const ip = unwrapIp(host)
  return ip ? isDisallowedIp(ip.ip) : false
}

export function inspectPublicHttpsUrl(url: string): { parsed: URL } | { error: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { error: 'Invalid URL.' }
  }
  if (parsed.protocol !== 'https:') {
    return { error: 'Only HTTPS URLs are allowed.' }
  }
  if (parsed.username || parsed.password) {
    return { error: 'URL must not include credentials.' }
  }
  if (parsed.port && parsed.port !== '443') {
    return { error: 'Only HTTPS port 443 is allowed.' }
  }
  if (isBlockedHostname(hostnameOf(parsed))) {
    return { error: ALLOWED_MESSAGE }
  }
  return { parsed }
}

export function readHttpsUrl(body: unknown): { url: string } | { error: string } {
  if (typeof body !== 'object' || body === null || !('url' in body)) {
    return { error: 'No URL provided.' }
  }
  const url = (body as { url: unknown }).url
  if (!url || typeof url !== 'string') {
    return { error: 'No URL provided.' }
  }
  const inspected = inspectPublicHttpsUrl(url)
  if ('error' in inspected) return inspected
  return { url: inspected.parsed.href }
}
