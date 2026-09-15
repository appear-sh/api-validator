<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/appear-sh/api-validator">
   <img src="https://github.com/appear-sh/api-validator/blob/main/assets/Appear%20API%20validator.png" alt="Logo">
  </a>

  <h3 align="center">API Validator & Agent-Ready Score</h3>

  <p align="center">
    Validate your OpenAPI spec and run a documentation checklist aimed at tool-calling setups. Originally from Appear.
    <br />
    Appear has wound down. The founders are now building <a href="https://www.ctxpipe.ai">ctxpipe.ai</a>.
    <br />
    <a href="https://appear.sh/blog/why-your-api-docs-break-for-ai-agents"><strong>Learn why this matters »</strong></a>
    <br />
    <br />
    <a href="https://www.ctxpipe.ai">ctxpipe.ai</a>
    ·
    <a href="https://appear.sh">Appear (wound down)</a>
    ·
    <a href="https://github.com/appear-sh/api-validator/issues">Issues</a>
    ·
    <a href="https://github.com/appear-sh/OAS-Zod-Validator">OAS Zod Validator</a>
  </p>
</p>

# API Validator & Agent-Ready Score

An open-source tool that validates OpenAPI specifications and calculates an **Agent-Ready Score** — a deterministic checklist of documentation that tool-calling setups typically read. It is static analysis of the file, not a test of agents in production.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why Agent Readiness?

Generated tools mostly see what is in the spec. Humans infer the rest. An API that works fine for developers can still be a poor document to generate tools from when it has:

- Missing or vague descriptions
- Absent operationIds (which become function names)
- No request/response examples
- Undocumented error responses
- Broken schema references

The Agent-Ready Score lists those gaps. It does not prove how an agent will behave.

## Features

### Agent-Ready Score
- **Six weighted dimensions** covering documentation that generated tools typically read:
  - **Foundational Compliance (25%)** — Structural validity, parsing errors, broken $refs
  - **Semantic Richness (20%)** — Description coverage and natural language quality
  - **Agent Usability (20%)** — operationIds, idempotency, pagination patterns
  - **AI Discoverability (15%)** — Examples, tags, and API metadata
  - **Security (10%)** — Authentication scheme documentation
  - **Error Recoverability (10%)** — Structured error responses and retry guidance
- **Letter grades (A–F)** with coverage labels (strong spec surface, partial coverage, many gaps, severe gaps)
- **Prioritised recommendations** with impact assessment
- **Transparent methodology** — fully documented, deterministic scoring (no AI/ML black box)

### Technical Validation
- **Three validation engines** running in parallel:
  - [Spectral](https://github.com/stoplightio/spectral) — OpenAPI linting and best practices
  - [Swagger Parser](https://github.com/APIDevTools/swagger-parser) — Structural validation and $ref resolution
  - [OAS Zod Validator](https://github.com/appear-sh/OAS-Zod-Validator) — Schema type conformance
- **Grouped issues** — Similar errors collapsed into expandable groups
- **Accurate line markers** — Click any issue to jump to the exact line in your spec
- **Supports OpenAPI 3.0.x, 3.1, and 3.2** specifications (YAML or JSON). OpenAPI 3.2 is checked by OAS Zod Validator; Spectral and Swagger Parser are skipped until those engines support 3.2.

### User Experience
- **Drag-and-drop** or browse for file upload
- **Fetch from URL** — validate specs hosted online
- **Collapsible panels** — expand the code viewer when you need more space
- **Real-time feedback** during validation
- **Copy/download** validation results as JSON
- **No account required** — validate specs instantly

## How Scoring Works

The Agent-Ready Score is **entirely deterministic and rule-based**. There is no AI, no machine learning model, and no external API calls involved in calculating the score. It is a checklist of the OpenAPI file, not a test of agents in production.

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
3. **Review the checklist score** — Grade and dimension breakdown of what is written in the spec
4. **Explore recommendations** — Prioritised documentation gaps
5. **Check technical validation** — Detailed issues from all three validators
6. **Fix and re-validate** — Iterate on the punch-list. A high score is coverage, not a certificate.

## FAQ

### Is this using AI to calculate the score?
No. The scoring is entirely deterministic and rule-based. The number is coverage of documented checks on the file. It does not predict how an agent will behave.

### Why is my score low when my API works fine?
Working for humans ≠ working for agents. Agents can't infer intent from context like humans can. They need explicit operationIds, examples, and descriptions.

### What's the difference between Technical Validation and Agent-Ready Score?
Technical Validation catches structural errors (broken refs, invalid schemas). The checklist also flags documentation that is optional for humans but commonly used when a spec is turned into tools. A high score is not a certificate.

### Can I game the score?
Technically yes—but that would mean improving your spec in ways that genuinely help AI agents. The scoring criteria are based on real-world agent failure modes.

## Related Projects

- [OAS Zod Validator](https://github.com/appear-sh/OAS-Zod-Validator) — Runtime OpenAPI schema validation using Zod
- [ctxpipe.ai](https://www.ctxpipe.ai) — The founders' new endeavour: a self-learning context layer for AI engineering agents
- [Appear](https://appear.sh) — Wound down. Open tools from Appear remain available.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Originally built at [Appear](https://appear.sh). The founders are now building [ctxpipe.ai](https://www.ctxpipe.ai).
