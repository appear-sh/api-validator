import { NextResponse } from 'next/server';
import { Spectral, RulesetDefinition } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { validateOpenAPIDocument, LocatedValidationResult, LocatedZodIssue } from '@appear.sh/oas-zod-validator';
import { ZodError } from 'zod';

// Define the shared result type (consistent with frontend)
type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
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

    console.log(`Fetching OpenAPI spec from URL: ${url}`);

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
      console.error('Error fetching from URL:', fetchError);
      return NextResponse.json({ 
        error: `Failed to fetch from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
      }, { status: 400 });
    }

    // Get the content type to determine if it's JSON or YAML
    const contentType = response.headers.get('Content-Type') || '';
    const fileContent = await response.text();
    
    // Format the content for display - prettify JSON or keep YAML as is
    let formattedContent = fileContent;
    try {
      if (contentType.includes('application/json') || url.endsWith('.json')) {
        // Parse and then stringify with pretty-printing (2 spaces indentation)
        const parsedJson = JSON.parse(fileContent);
        formattedContent = JSON.stringify(parsedJson, null, 2);
        console.log('Successfully formatted JSON content for display');
      }
    } catch (formatError) {
      console.warn('Failed to format content for display:', formatError);
      // Continue with original content if formatting fails
    }

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
      console.error('Parsing Error for Spectral:', parseError);
      allValidationResults.push({
        source: 'Spectral',
        code: 'SPECTRAL_PARSE_ERROR',
        message: parseError instanceof Error ? parseError.message : 'Failed to parse content for Spectral validation.',
        severity: 'error',
      });
      spectralParsedContent = {}; // Assign empty object to prevent further errors
    }

    if (Object.keys(spectralParsedContent).length > 0) { // Only run if parsing succeeded
      try {
        const spectral = new Spectral();
        spectral.setRuleset({
          extends: [[oas as RulesetDefinition, 'recommended']],
          rules: {}
        });
        console.log('Running Spectral validation...');
        const spectralIssues = await spectral.run(spectralParsedContent);
        console.log(`Spectral found ${spectralIssues.length} issues.`);
        const spectralMappedResults = spectralIssues.map(issue => ({
          source: 'Spectral',
          code: String(issue.code),
          message: issue.message,
          severity: mapSeverity(issue.severity),
          path: issue.path as string[],
          range: {
            start: { line: issue.range.start.line, character: issue.range.start.character },
            end: { line: issue.range.end.line, character: issue.range.end.character },
          }
        }));
        allValidationResults = allValidationResults.concat(spectralMappedResults);
        
        // Add a success message if there were no issues
        if (spectralIssues.length === 0) {
          allValidationResults.push({
            source: 'Spectral',
            code: 'SPECTRAL_VALIDATION_SUCCESS',
            message: 'No linting issues found. The specification is valid according to Spectral.',
            severity: 'info',
          });
        }
      } catch (spectralError) {
        console.error('Spectral Error:', spectralError);
        allValidationResults.push({
          source: 'Spectral',
          code: 'SPECTRAL_EXECUTION_ERROR',
          message: spectralError instanceof Error ? spectralError.message : 'Spectral failed to run.',
          severity: 'error',
        });
      }
    }

    // --- Swagger Parser Validation ---
    if (Object.keys(spectralParsedContent).length > 0) {
      try {
        console.log('Running Swagger Parser validation...');
        await SwaggerParser.validate(JSON.parse(JSON.stringify(spectralParsedContent))); // Deep clone needed
        console.log('Swagger Parser validation successful (no structural errors found).');
        allValidationResults.push({
          source: 'SwaggerParser',
          code: 'SWAGGER_VALIDATION_SUCCESS',
          message: 'No structural errors found. The specification is valid according to Swagger Parser.',
          severity: 'info',
        });
      } catch (error) {
        const swaggerError = error as SwaggerParserError;
        console.warn('Swagger Parser Validation Error:', swaggerError);
        if (swaggerError && Array.isArray(swaggerError.details)) {
          const swaggerParserMappedResults = swaggerError.details.map((detail: SwaggerErrorDetail) => ({
            source: 'SwaggerParser',
            code: detail.code ?? 'SWAGGER_VALIDATION_ERROR',
            message: detail.message ?? 'Swagger Parser validation failed.',
            severity: 'error' as ValidationResult['severity'],
            path: detail.path ?? undefined,
          }));
          allValidationResults = allValidationResults.concat(swaggerParserMappedResults);
        } else {
          allValidationResults.push({
            source: 'SwaggerParser',
            code: 'SWAGGER_VALIDATION_ERROR',
            message: swaggerError instanceof Error ? swaggerError.message : 'Swagger Parser validation failed.',
            severity: 'error',
          });
        }
      }
    }

    // --- OAS Zod Validator ---
    try {
      console.log('Running OAS Zod Validator with validateOpenAPIDocument...');
      const oasZodResult: LocatedValidationResult = await validateOpenAPIDocument(fileContent);
      console.log(`OAS Zod Validator valid: ${oasZodResult.valid}`);

      if (!oasZodResult.valid && oasZodResult.errors instanceof ZodError) {
        const oasZodMappedResults = oasZodResult.errors.issues.map((issue: LocatedZodIssue) => ({
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
        allValidationResults = allValidationResults.concat(oasZodMappedResults);
      } else if (!oasZodResult.valid) {
        allValidationResults.push({
          source: 'OAS Zod Validator',
          code: 'ZOD_UNKNOWN_ERROR',
          message: 'Validation failed with an unexpected error format.',
          severity: 'error',
        });
      } else {
        allValidationResults.push({
          source: 'OAS Zod Validator',
          code: 'ZOD_VALIDATION_SUCCESS',
          message: 'No schema validation issues found. The specification is valid according to OAS Zod Validator.',
          severity: 'info',
        });
      }
    } catch (oasZodError) {
      console.error('OAS Zod Validator Execution Error:', oasZodError);
      allValidationResults.push({
        source: 'OAS Zod Validator',
        code: 'ZOD_EXECUTION_ERROR',
        message: oasZodError instanceof Error ? oasZodError.message : 'OAS Zod Validator failed to run.',
        severity: 'error',
      });
    }

    // Return combined results along with the spec content
    return NextResponse.json({ 
      results: allValidationResults,
      specContent: formattedContent  // Return the formatted content
    });

  } catch (error) {
    console.error('Overall Validation Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to process URL: ${errorMessage}` }, { status: 500 });
  }
} 