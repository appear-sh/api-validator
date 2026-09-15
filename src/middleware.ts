import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const WINDOW_MS = 60_000
const MAX_POSTS = 20
const hits = new Map<string, { count: number; resetAt: number }>()

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  )
}

function prune(now: number) {
  if (hits.size < 2000) return
  for (const [key, value] of hits) {
    if (now >= value.resetAt) hits.delete(key)
  }
}

export function middleware(request: NextRequest) {
  if (request.method !== 'POST') {
    return NextResponse.next()
  }

  const now = Date.now()
  prune(now)

  const ip = clientIp(request)
  const current = hits.get(ip)
  if (!current || now >= current.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return NextResponse.next()
  }

  current.count += 1
  if (current.count > MAX_POSTS) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
