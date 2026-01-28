<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/appear-sh/api-validator">
   <img src="https://github.com/appear-sh/api-validator/blob/main/assets/Appear%20API%20validator.png" alt="Logo">
  </a>

  <h3 align="center">API Validator & Agent-Ready Score</h3>

  <p align="center">
    Validate your OpenAPI spec and measure how ready it is for AI agent consumption. From Appear.
    <br />
    <a href="https://appear.sh/blog/why-your-api-docs-break-for-ai-agents"><strong>Learn why this matters »</strong></a>
    <br />
    <br />
    <a href="https://www.appear.sh">Appear Website</a>
    ·
    <a href="https://github.com/appear-sh/api-validator/issues">Issues</a>
    ·
    <a href="https://github.com/appear-sh/OAS-Zod-Validator">OAS Zod Validator</a>
  </p>
</p>

# API Validator & Agent-Ready Score

An open-source tool that validates OpenAPI specifications and calculates an **Agent-Ready Score**—a measure of how well your API documentation is prepared for consumption by AI agents, LLM-powered tools, and automated systems.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Agent Readiness?

AI agents interact with APIs differently than humans. They can't infer intent from context, guess parameter meanings, or improvise when documentation is incomplete. An API that works fine for human developers may fail completely for AI agents due to:

- Missing or vague descriptions
- Absent operationIds (which become function names)
- No request/response examples
- Undocumented error responses
- Broken schema references

The Agent-Ready Score quantifies these gaps and provides actionable recommendations.

## Features

### Agent-Ready Score
- **Six weighted dimensions** evaluating AI agent compatibility:
  - **Foundational Compliance (25%)** — Structural validity, parsing errors, broken $refs
  - **Semantic Richness (20%)** — Description coverage and natural language quality
  - **Agent Usability (20%)** — operationIds, idempotency, pagination patterns
  - **AI Discoverability (15%)** — Examples, tags, and API metadata
  - **Security (10%)** — Authentication scheme documentation
  - **Error Recoverability (10%)** — Structured error responses and retry guidance
- **Letter grades (A–F)** with readiness levels (Agent Ready, Partially Ready, Needs Work, Not Ready)
- **Prioritised recommendations** with impact assessment
- **Transparent methodology** — fully documented, deterministic scoring (no AI/ML black box)

### Technical Validation
- **Three validation engines** running in parallel:
  - [Spectral](https://github.com/stoplightio/spectral) — OpenAPI linting and best practices
  - [Swagger Parser](https://github.com/APIDevTools/swagger-parser) — Structural validation and $ref resolution
  - [OAS Zod Validator](https://github.com/appear-sh/OAS-Zod-Validator) — Schema type conformance
- **Grouped issues** — Similar errors collapsed into expandable groups
- **Accurate line markers** — Click any issue to jump to the exact line in your spec
- **Supports OpenAPI 3.0.x, 3.1, and 3.2** specifications (YAML or JSON)

### User Experience
- **Drag-and-drop** or browse for file upload
- **Fetch from URL** — validate specs hosted online
- **Collapsible panels** — expand the code viewer when you need more space
- **Real-time feedback** during validation
- **Copy/download** validation results as JSON
- **No account required** — validate specs instantly

## How Scoring Works

The Agent-Ready Score is **entirely deterministic and rule-based**. There is no AI, no machine learning model, and no external API calls involved in calculating the score.

The scoring algorithm:
1. Parses your OpenAPI specification
2. Runs three validation engines to detect structural issues
3. Analyses the spec against documented criteria for each dimension
4. Calculates sub-scores using transparent penalty multipliers
5. Combines dimension scores using the documented weights

**Same spec = same score, every time.**

For full methodology details, click "How is this calculated?" in the app.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/appear-sh/api-validator.git
cd api-validator

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the validator.

### Production Build

```bash
pnpm build
pnpm start
```

## Usage

1. **Upload a spec** — Drag an OpenAPI 3.x spec (YAML or JSON) into the upload area, or click to browse
2. **Or fetch from URL** — Enter a URL to a hosted spec and click "Fetch & Validate"
3. **Review your Agent-Ready Score** — See your overall grade and dimension breakdown
4. **Explore recommendations** — Prioritised improvements with impact assessment
5. **Check technical validation** — Detailed issues from all three validators
6. **Fix and re-validate** — Iterate until you reach Agent Ready status

## FAQ

### Is this using AI to calculate the score?
No. The scoring is entirely deterministic and rule-based. The score measures how well your API will work *with* AI agents, but the measurement itself is traditional static analysis.

### Why is my score low when my API works fine?
Working for humans ≠ working for agents. Agents can't infer intent from context like humans can. They need explicit operationIds, examples, and descriptions.

### What's the difference between Technical Validation and Agent-Ready Score?
Technical Validation catches structural errors (broken refs, invalid schemas). Agent-Ready Score goes further—a spec can be technically valid but still unusable by AI agents due to missing descriptions, examples, or poor naming.

### Can I game the score?
Technically yes—but that would mean improving your spec in ways that genuinely help AI agents. The scoring criteria are based on real-world agent failure modes.

## Related Projects

- [OAS Zod Validator](https://github.com/appear-sh/OAS-Zod-Validator) — Runtime OpenAPI schema validation using Zod
- [Appear](https://appear.sh) — API observability and documentation platform

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built by [Appear](https://appear.sh) — Making APIs work better for humans and AI agents.
