import { NextResponse } from 'next/server'
import { readHttpsUrl } from '@/lib/https-url'
import { fetchPublicHttps } from '@/lib/safe-fetch'
import { SPEC_TOO_LARGE, assertSpecBudget } from '@/lib/spec-limits'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Request body must be JSON with a url field.' },
        { status: 400 },
      )
    }

    const parsedUrl = readHttpsUrl(body)
    if ('error' in parsedUrl) {
      return NextResponse.json({ error: parsedUrl.error }, { status: 400 })
    }
    const { url } = parsedUrl

    const fetched = await fetchPublicHttps(url, {
      accept: 'application/json, application/yaml, text/yaml, text/*;q=0.9, */*;q=0.1',
    })
    if ('error' in fetched) {
      return NextResponse.json({ error: fetched.error }, { status: 400 })
    }
    const { text: fetchedText, contentType, finalUrl } = fetched
    const budget = assertSpecBudget(fetchedText)
    if (budget) {
      return NextResponse.json({ error: budget.error }, { status: budget.error === SPEC_TOO_LARGE ? 413 : 400 })
    }
    let text = fetchedText

    // Pretty-print JSON if it appears to be minified (no newlines)
    // This ensures the code viewer can display it with proper line breaks
    const isJson = contentType.includes('json') || finalUrl.endsWith('.json')
    if (isJson && !text.includes('\n')) {
      try {
        const parsed = JSON.parse(text)
        text = JSON.stringify(parsed, null, 2)
      } catch {
        // If parsing fails, keep the original text
      }
    }

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


