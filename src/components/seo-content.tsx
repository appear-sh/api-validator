import { DIMENSIONS, FAQS, buildJsonLd } from '@/lib/seo'

export function SeoContent() {
  const jsonLd = buildJsonLd()

  return (
    <section className="border-t border-white/5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-14">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3">
            What the Agent-Ready Score measures
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This is static analysis of the OpenAPI document. Invalid specs fail anything that
            consumes the file. Everything else is a checklist of documentation that generated
            tools typically need — not a prediction that agents will succeed. Spectral, Swagger
            Parser, and OAS Zod run first. Same file, same score.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-zinc-100 mb-4">
            Six scoring dimensions
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DIMENSIONS.map((dimension) => (
              <div key={dimension.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <dt className="text-sm font-medium text-zinc-100">
                  {dimension.name}
                  <span className="ml-2 text-xs text-[#40E0D0]">{dimension.weight}</span>
                </dt>
                <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {dimension.summary}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-zinc-100 mb-4">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-zinc-100">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
