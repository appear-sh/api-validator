export const SITE_URL = 'https://validator.appear.sh'

export const SITE_NAME = 'Agent-Ready Score'

export const SITE_TITLE = 'OpenAPI Validator — Agent-Ready Score checklist'

export const SITE_DESCRIPTION =
  'Free OpenAPI lint with Spectral, Swagger Parser, and OAS Zod, plus a deterministic documentation checklist for specs used as agent tools. Static analysis of the file — not a runtime test of agents. No account required.'

export const DIMENSIONS = [
  { name: 'Foundational Compliance', weight: '25%', summary: 'The spec should parse. Broken $refs and invalid schemas stop anything that consumes the document, including generated tools.' },
  { name: 'Semantic Richness', weight: '20%', summary: 'Descriptions are what a generated tool has to go on. Missing prose is a documentation gap, not proof of a wrong call.' },
  { name: 'Agent Usability', weight: '20%', summary: 'operationIds are often used as tool names. This looks for them, plus pagination and idempotency hints in the document — not at runtime.' },
  { name: 'AI Discoverability', weight: '15%', summary: 'Examples and tags are useful hints in the spec. They are not a substitute for a working integration.' },
  { name: 'Security', weight: '10%', summary: 'Documented auth schemes tell a consumer what to send. This does not test whether authentication works.' },
  { name: 'Error Recoverability', weight: '10%', summary: 'Documented error schemas help a caller interpret failures. This checks the spec, not live Retry-After headers.' },
] as const

export const FAQS = [
  {
    question: 'What is an Agent-Ready Score?',
    answer:
      'A rule-based 0–100 checklist of an OpenAPI document: parseability, descriptions, operationIds, examples, documented auth, and documented errors. It is static analysis of the file, not a test of agents in production. Grade A/B (80+) means strong coverage of this checklist — not that the API is “agent ready”.',
  },
  {
    question: 'Does this tool use AI to calculate the score?',
    answer:
      'No. Same spec, same score, every time. The number is coverage of documented checks. It does not predict how an agent will behave.',
  },
  {
    question: 'Why is my score low when the API works for human developers?',
    answer:
      'Humans infer intent. Generated tools mostly cannot. Missing operationIds, examples, error schemas, or descriptions are easy for people and leave tool-calling setups with less to work with. That is a documentation gap, not proof the API is broken.',
  },
  {
    question: 'What is the difference between Technical Validation and the Agent-Ready Score?',
    answer:
      'Technical Validation (Spectral, Swagger Parser, OAS Zod Validator) catches structural errors. The checklist also flags documentation that is optional for humans but commonly used when a spec is turned into tools. A valid spec can still score poorly. A high score is not a certificate.',
  },
  {
    question: 'Which OpenAPI versions are supported?',
    answer:
      'OpenAPI 3.0.x, 3.1, and 3.2 in YAML or JSON. OpenAPI 3.2 is checked by OAS Zod Validator; Spectral and Swagger Parser are skipped until those engines support 3.2.',
  },
  {
    question: 'Who built this, and what happened to Appear?',
    answer:
      'This validator was built at Appear and remains free and open source. Appear has wound down. The founders now build ctxpipe.ai, a self-learning context layer for AI engineering agents.',
  },
] as const

export function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        creator: {
          '@type': 'Organization',
          name: 'Appear',
          url: 'https://appear.sh',
        },
        sameAs: ['https://github.com/appear-sh/api-validator'],
        license: 'https://opensource.org/licenses/MIT',
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: SITE_TITLE,
        description: SITE_DESCRIPTION,
        isPartOf: { '@id': `${SITE_URL}/#app` },
        mainEntity: { '@id': `${SITE_URL}/#faq` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }
}
