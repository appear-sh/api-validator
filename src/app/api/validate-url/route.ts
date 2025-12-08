import { NextResponse } from 'next/server';
import { Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { validateOpenAPIDocument, LocatedValidationResult, LocatedZodIssue } from '@appear.sh/oas-zod-validator';
import { ZodError } from 'zod';
import type { ValidationResult } from '@/lib/types';

const isDev = process.env.NODE_ENV === 'development';

// Best-effort detector for OpenAPI version from raw text
const detectOpenApiVersionFromText = (text: string): string | null => {
  try {
    const match = text.match(/\bopenapi\s*:\s*['"]?([0-9]+\.[0-9]+\.[0-9]+)['"]?/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// Helper to map Spectral severity levels
const mapSeverity = (spectralSeverity: number): ValidationResult['severity'] => {
  switch (spectralSeverity) {
    case 0: return 'error';
    case 1: return 'warning';
    case 2: return 'info';
    default: return 'info'; // Default to info for unexpected levels
  }
};

// Define interfaces for Swagger Parser error details
interface SwaggerErrorDetail {
  code?: string;
  message?: string;
  path?: string[];
}

interface SwaggerParserError extends Error {
  details?: SwaggerErrorDetail[];
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided.' }, { status: 400 });
    }

    if (isDev) console.log(`Fetching OpenAPI spec from URL: ${url}`);

    // Fetch the specification from the provided URL
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml, */*',
        },
      });

      if (!response.ok) {
        return NextResponse.json({ 
          error: `Failed to fetch from URL: ${response.status} ${response.statusText}` 
        }, { status: 400 });
      }
    } catch (fetchError) {
      if (isDev) console.error('Error fetching from URL:', fetchError);
      return NextResponse.json({ 
        error: `Failed to fetch from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
      }, { status: 400 });
    }

    // Get the content type to determine if it's JSON or YAML
    const contentType = response.headers.get('Content-Type') || '';
    const fileContent = await response.text();

    // Initialize results array
    let allValidationResults: ValidationResult[] = [];

    // --- Spectral Validation ---
    let spectralParsedContent: Record<string, unknown>;
    try {
      if (contentType.includes('application/json') || url.endsWith('.json')) {
        const result = JSON.parse(fileContent);
        if (typeof result === 'object' && result !== null) {
          spectralParsedContent = result as Record<string, unknown>;
        } else { throw new Error('Parsed JSON for Spectral is not an object.'); }
      } else { // Assume YAML otherwise or if type is unknown/generic
        const result = yaml.load(fileContent);
        if (typeof result === 'object' && result !== null) {
          spectralParsedContent = result as Record<string, unknown>;
        } else { throw new Error('Parsed YAML for Spectral is not an object.'); }
      }
    } catch(parseError) {
      if (isDev) console.error('Parsing Error for Spectral:', parseError);
      allValidationResults.push({
        source: 'Spectral',
        code: 'SPECTRAL_PARSE_ERROR',
        message: parseError instanceof Error ? parseError.message : 'Failed to parse content for Spectral validation.',
        severity: 'error',
      });
      spectralParsedContent = {}; // Assign empty object to prevent further errors
    }

    // --- Spectral + Swagger Parser + OAS Zod Validator (run in parallel) ---
    const validatorTasks: Array<Promise<ValidationResult[]>> = [];

    // Determine OpenAPI version (from parsed object if available; otherwise, from raw text)
    const parsedForVersion = spectralParsedContent as { openapi?: unknown };
    const openApiVersion: string | null =
      typeof parsedForVersion.openapi === 'string'
        ? (parsedForVersion.openapi as string)
        : detectOpenApiVersionFromText(fileContent);
    const isOpenApi31Plus = Boolean(openApiVersion && (openApiVersion.startsWith('3.1') || openApiVersion.startsWith('3.2')));
    const isOpenApi32 = Boolean(openApiVersion && openApiVersion.startsWith('3.2'));

    if (Object.keys(spectralParsedContent).length > 0) {
      // Spectral task (skip entirely for 3.2 until upstream supports it)
      if (isOpenApi32) {
        validatorTasks.push(Promise.resolve([{ 
          source: 'Spectral', 
          code: 'SPECTRAL_SKIPPED_UNSUPPORTED_VERSION', 
          message: 'Spectral skipped: OpenAPI 3.2 not yet supported by the default ruleset.', 
          severity: 'info' as ValidationResult['severity'],
        }]));
      } else {
        validatorTasks.push((async () => {
          try {
            const spectral = new Spectral();
            const rs = {
              extends: [[oas, 'recommended']],
              ...(isOpenApi31Plus ? { rules: { 'oas3-schema': 'off' } } : {}),
            };
            spectral.setRuleset(rs as Parameters<typeof spectral.setRuleset>[0]);
            if (isDev) console.log('Running Spectral validation...');
            const spectralIssues = await spectral.run(spectralParsedContent);
            if (isDev) console.log(`Spectral found ${spectralIssues.length} issues.`);
            const results = spectralIssues.map(issue => ({
              source: 'Spectral',
              code: String(issue.code),
              message: issue.message,
              severity: mapSeverity(issue.severity),
              path: issue.path as string[],
              range: {
                start: { line: issue.range.start.line, character: issue.range.start.character },
                end: { line: issue.range.end.line, character: issue.range.end.character },
              }
            })) as ValidationResult[];

            if (spectralIssues.length === 0) {
              results.push({
                source: 'Spectral',
                code: 'SPECTRAL_VALIDATION_SUCCESS',
                message: 'No linting issues found. The specification is valid according to Spectral.',
                severity: 'info',
              });
            }
            return results;
          } catch (spectralError) {
            if (isDev) console.error('Spectral Error:', spectralError);
            return [{
              source: 'Spectral',
              code: 'SPECTRAL_EXECUTION_ERROR',
              message: spectralError instanceof Error ? spectralError.message : 'Spectral failed to run.',
              severity: 'error',
            }];
          }
        })());
      }

      // Swagger Parser task (skip for OpenAPI 3.2 which is not supported by swagger-parser yet)
      if (isOpenApi32) {
        validatorTasks.push(Promise.resolve([{ 
          source: 'SwaggerParser', 
          code: 'SWAGGER_SKIPPED_UNSUPPORTED_VERSION', 
          message: 'Swagger Parser skipped: OpenAPI 3.2 is not supported by swagger-parser.', 
          severity: 'info' as ValidationResult['severity'],
        }]));
      } else {
        validatorTasks.push((async () => {
          try {
            if (isDev) console.log('Running Swagger Parser validation...');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await SwaggerParser.validate(structuredClone(spectralParsedContent) as any);
            if (isDev) console.log('Swagger Parser validation successful (no structural errors found).');
            return [{
              source: 'SwaggerParser',
              code: 'SWAGGER_VALIDATION_SUCCESS',
              message: 'No structural errors found. The specification is valid according to Swagger Parser.',
              severity: 'info',
            }];
          } catch (error) {
            const swaggerError = error as SwaggerParserError;
            if (isDev) console.warn('Swagger Parser Validation Error:', swaggerError);
            if (swaggerError && Array.isArray(swaggerError.details)) {
              return swaggerError.details.map((detail: SwaggerErrorDetail) => ({
                source: 'SwaggerParser',
                code: detail.code ?? 'SWAGGER_VALIDATION_ERROR',
                message: detail.message ?? 'Swagger Parser validation failed.',
                severity: 'error' as ValidationResult['severity'],
                path: detail.path ?? undefined,
              }));
            }
            return [{
              source: 'SwaggerParser',
              code: 'SWAGGER_VALIDATION_ERROR',
              message: swaggerError instanceof Error ? swaggerError.message : 'Swagger Parser validation failed.',
              severity: 'error',
            }];
          }
        })());
      }
    }

    // OAS Zod task
    validatorTasks.push((async () => {
      try {
        if (isDev) console.log('Running OAS Zod Validator with validateOpenAPIDocument...');
        const oasZodResult: LocatedValidationResult = await validateOpenAPIDocument(fileContent);
        if (isDev) console.log(`OAS Zod Validator valid: ${oasZodResult.valid}`);
        if (!oasZodResult.valid && oasZodResult.errors instanceof ZodError) {
          const mapped = oasZodResult.errors.issues.map((issue: LocatedZodIssue) => ({
            source: 'OAS Zod Validator',
            code: issue.code,
            message: issue.message,
            severity: 'error' as ValidationResult['severity'],
            path: issue.path.map(String),
            range: issue.range ? {
              start: { line: issue.range.start.line, character: issue.range.start.column },
              end: { line: issue.range.end.line, character: issue.range.end.column },
            } : undefined,
          }));
          return mapped;
        } else if (!oasZodResult.valid) {
          return [{
            source: 'OAS Zod Validator',
            code: 'ZOD_UNKNOWN_ERROR',
            message: 'Validation failed with an unexpected error format.',
            severity: 'error',
          }];
        }
        return [{
          source: 'OAS Zod Validator',
          code: 'ZOD_VALIDATION_SUCCESS',
          message: 'No schema validation issues found. The specification is valid according to OAS Zod Validator.',
          severity: 'info',
        }];
      } catch (oasZodError) {
        if (isDev) console.error('OAS Zod Validator Execution Error:', oasZodError);
        return [{
          source: 'OAS Zod Validator',
          code: 'ZOD_EXECUTION_ERROR',
          message: oasZodError instanceof Error ? oasZodError.message : 'OAS Zod Validator failed to run.',
          severity: 'error',
        }];
      }
    })());

    const resultsArrays = await Promise.all(validatorTasks);
    for (const results of resultsArrays) {
      allValidationResults = allValidationResults.concat(results);
    }

    // Return combined results only (spec content is fetched separately to avoid large JSON parse on client)
    return NextResponse.json({ 
      results: allValidationResults
    });

  } catch (error) {
    if (isDev) console.error('Overall Validation Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to process URL: ${errorMessage}` }, { status: 500 });
  }
} 