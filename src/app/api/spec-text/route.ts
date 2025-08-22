import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided.' }, { status: 400 })
    }

    // Basic protocol hardening
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS URLs are allowed.' }, { status: 400 })
    }

    let upstream
    try {
      upstream = await fetch(url, {
        // Prefer textual content types
        headers: {
          Accept: 'application/json, application/yaml, text/yaml, text/*;q=0.9, */*;q=0.1',
        },
        cache: 'no-store',
      })
    } catch (e) {
      return NextResponse.json({ error: `Failed to fetch URL: ${e instanceof Error ? e.message : 'Unknown error'}` }, { status: 400 })
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream error: ${upstream.status} ${upstream.statusText}` }, { status: 400 })
    }

    const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
    const text = await upstream.text()

    return new Response(text, {
      status: 200,
      headers: {
        'content-type': contentType.includes('json') || contentType.includes('yaml') ? 'text/plain; charset=utf-8' : contentType,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to proxy spec text: ${message}` }, { status: 500 })
  }
}


