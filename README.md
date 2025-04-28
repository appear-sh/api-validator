<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/appear-sh/api-validator">
   <img src="https://github.com/appear-sh/api-validator/blob/main/assets/Appear%20API%20validator.png" alt="Logo">
  </a>

  <h3 align="center">OAS Zod Validator</h3>

  <p align="center">
    An OpenAPI Spec Validator and Linting tool using opensource tools, including our OAS Zod Validator . From Appear.
    <br />
    <a href="https://docs.appear.sh/resources/open-source"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://www.appear.sh">Appear Website</a>
    ·
    <a href="https://github.com/appear-sh/api-validator/issues">Issues</a>
    ·
    <a href="https://www.appear.sh/productmap">Appear Product Map</a>
  </p>
</p>

# API Validator

An API Validator tool which exists to showcase our OAS Zod Validator tool in concert with third-party validators and linters to offer a blended report on the quality of your spec, supporting both OAS 3.0.x and 3.1 specifications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- ABOUT THE PROJECT -->

## Features

- Validates OpenAPI 3.0.x and 3.1 specs (YAML or JSON)
- Runs multiple open source validators (including OAS Zod Validator, Spectral, SwaggerParser) for a blended, comparative report
- Maps validation and linting errors directly to your uploaded spec, with clear path and message details
- Provides an interactive web UI for uploading, viewing, and exploring results—no CLI required
- Calculates an overall API quality score based on combined validator results
- Supports drag-and-drop or file browsing for spec upload
- Displays real-time feedback and progress during validation
- Highlights issues by severity (error, warning, info) and by source validator
- No external runtime dependencies required for the web app (all validation runs server-side)

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see single page app.


## Usage

Drag an OpenAPI 3.x spec into the upload panel or browse for the spec on your machine. Once uploaded the tool will assess the spec against several linters and validators to provide a report.

## Project Status / Planned Work

- Adding more linting/validation tools
- UI tweaks
- Performance improvements
- Better hooks into Appear
