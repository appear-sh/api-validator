import { NextResponse } from 'next/server';
import { Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets'; // Using the OpenAPI ruleset
import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser'; // Import Swagger Parser
import { validateOpenAPIDocument, LocatedValidationResult, LocatedZodIssue } from '@appear.sh/oas-zod-validator'; // Import BOTH validation functions and necessary types
import { ZodError } from 'zod'; // Keep Zod types

// Increase the body size limit for this route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust size as needed
    },
  },
};

// Define the shared result type (consistent with frontend)
type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
};

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
    // case 3: return 'hint'; // Ignoring hint level for now
    default: return 'info'; // Default to info for unexpected levels
  }
};

// Define interfaces for Swagger Parser error details
interface SwaggerErrorDetail {
  code?: string;
  message?: string;
  path?: string[];
  // Add other potential properties if known, otherwise keep it minimal
}

interface SwaggerParserError extends Error {
  details?: SwaggerErrorDetail[];
  // Potentially add other properties if the error structure is known
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const fileContent = await file.text();
    // Remove the manual parsing logic - validateOpenAPIDocument takes the raw string
    // let parsedContent: Record<string, unknown>;
    // try { ... } catch (parseError) { ... }

    console.log(`Received file: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);

    // Initialize results array
    let allValidationResults: ValidationResult[] = [];

    // --- Spectral Validation ---
    // Spectral still needs the parsed object. Parse it here temporarily.
    // Consider if Spectral can also run on the raw string to avoid double parsing.
    // For now, keep parsing for Spectral.
    let spectralParsedContent: Record<string, unknown>;
    try {
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
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
        console.error('Parsing Error for Spectral:', parseError);
        // Add a specific error for Spectral if parsing fails
        allValidationResults.push({
            source: 'Spectral',
            code: 'SPECTRAL_PARSE_ERROR',
            message: parseError instanceof Error ? parseError.message : 'Failed to parse content for Spectral validation.',
            severity: 'error',
        });
        // Skip Spectral validation if parsing failed
        spectralParsedContent = {}; // Assign empty object to prevent further errors, though validation won't run properly
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

    if (Object.keys(spectralParsedContent).length > 0) { // Only run if parsing succeeded
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
            console.log('Running Spectral validation...');
            const spectralIssues = await spectral.run(spectralParsedContent);
            console.log(`Spectral found ${spectralIssues.length} issues.`);
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
            console.error('Spectral Error:', spectralError);
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
            console.log('Running Swagger Parser validation...');
            await SwaggerParser.validate(JSON.parse(JSON.stringify(spectralParsedContent))); // Deep clone needed
            console.log('Swagger Parser validation successful (no structural errors found).');
            return [{
              source: 'SwaggerParser',
              code: 'SWAGGER_VALIDATION_SUCCESS',
              message: 'No structural errors found. The specification is valid according to Swagger Parser.',
              severity: 'info',
            }];
          } catch (error) {
            const swaggerError = error as SwaggerParserError;
            console.warn('Swagger Parser Validation Error:', swaggerError);
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
        console.log('Running OAS Zod Validator with validateOpenAPIDocument...');
        const oasZodResult: LocatedValidationResult = await validateOpenAPIDocument(fileContent);
        console.log(`OAS Zod Validator valid: ${oasZodResult.valid}`);
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
        console.error('OAS Zod Validator Execution Error:', oasZodError);
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

    // Return combined results
    return NextResponse.json({ results: allValidationResults });

  } catch (error) {
    console.error('Overall Validation Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to process file: ${errorMessage}` }, { status: 500 });
  }
} 
