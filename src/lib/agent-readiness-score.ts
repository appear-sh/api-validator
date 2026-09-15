/**
 * Agent-Ready Score Calculator
 * 
 * Deterministic checklist of an OpenAPI document for tool-calling setups.
 * Not a runtime test of agents. Originally built at Appear. Appear has
 * wound down; the founders now build ctxpipe.ai.
 * 
 * Six dimensions evaluated:
 * 1. Foundational Compliance - Structural validity and standards conformance
 * 2. Semantic Richness - Natural language descriptions for AI understanding
 * 3. Agent Usability - Orchestration safety and predictability
 * 4. AI Discoverability - Examples and metadata for capability discovery
 * 5. Security - Authentication mechanisms agents can use programmatically
 * 6. Error Recoverability - Structured errors enabling self-correction
 * 
 * @see https://appear.sh/blog/why-your-api-docs-break-for-ai-agents
 * @see https://www.ctxpipe.ai
 * @see https://learn.openapis.org/best-practices.html
 */

import { load as loadYaml } from 'js-yaml';
import type { ValidationResult } from '@/lib/types';
import { assertSpecBudget } from '@/lib/spec-limits';

// Comprehensive OpenAPI spec interface for deep analysis
interface OpenApiSpec {
  openapi?: string;
  info?: {
    title?: string;
    description?: string;
    version?: string;
    summary?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name?: string;
      url?: string;
    };
    termsOfService?: string;
    'x-logo'?: unknown;
  };
  externalDocs?: {
    description?: string;
    url?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, unknown>;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: unknown;
  }>;
  paths?: Record<string, PathItem>;
  webhooks?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
    responses?: Record<string, ResponseObject>;
    parameters?: Record<string, ParameterObject>;
    examples?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    links?: Record<string, unknown>;
    callbacks?: Record<string, unknown>;
  };
  security?: SecurityRequirement[];
}

interface PathItem {
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  parameters?: ParameterObject[];
}

interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  externalDocs?: { description?: string; url?: string };
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  security?: SecurityRequirement[];
  'x-idempotent'?: boolean;
  'x-idempotency-key'?: boolean;
  'x-rate-limit'?: unknown;
}

interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, unknown>;
}

interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaTypeObject>;
}

interface ResponseObject {
  description?: string;
  headers?: Record<string, unknown>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, unknown>;
}

interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, unknown>;
  encoding?: Record<string, unknown>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  example?: unknown;
  examples?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
}

interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: unknown;
  openIdConnectUrl?: string;
}

interface SecurityRequirement {
  [name: string]: string[];
}

// Grade levels for human-readable assessment
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ReadinessLevel = 'Strong spec surface' | 'Partial coverage' | 'Many gaps' | 'Severe gaps';

export interface DimensionScore {
  score: number;
  grade: Grade;
  label: string;
  description: string;
  signals: Signal[];
  details: Record<string, number>;
  improvementTips: string[];
}

export interface Signal {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  count?: number;
}

export interface AgentReadinessScore {
  overallScore: number;
  grade: Grade;
  readinessLevel: ReadinessLevel;
  summary: string;
  dimensions: {
    foundationalCompliance: DimensionScore;
    semanticRichness: DimensionScore;
    agentUsability: DimensionScore;
    aiDiscoverability: DimensionScore;
    security: DimensionScore;
    errorRecoverability: DimensionScore;
  };
  stats: {
    operations: number;
    schemas: number;
    parameters: number;
    tags: number;
    securitySchemes: number;
  };
  recommendations: Recommendation[];
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  dimension: string;
  title: string;
  description: string;
  impact: string;
}

// ============================================================================
// SCORING CONSTANTS & CONFIGURATION
// Documented thresholds for transparency and maintainability
// ============================================================================

/**
 * Dimension weights for overall score calculation.
 * Foundational compliance weighted highest as it's a blocking issue for agents.
 */
export const WEIGHTS = {
  foundationalCompliance: 0.25,  // Highest: invalid specs block all agent interaction
  semanticRichness: 0.20,        // High: agents need descriptions to understand intent
  agentUsability: 0.20,          // High: operationIds and patterns enable tool calling
  aiDiscoverability: 0.15,       // Medium: examples accelerate agent learning
  security: 0.10,                // Lower: many agents work with pre-configured auth
  errorRecoverability: 0.10,     // Lower: nice-to-have for resilient agents
} as const;

/**
 * Score penalty multipliers - how much each issue type reduces the score.
 * Based on impact severity for AI agent interaction.
 */
const PENALTIES = {
  validationError: 12,      // Each validation error significantly impacts parseability
  warning: 2,               // Warnings are minor issues
  refIssue: 15,             // Broken references are critical
  schemaIssue: 8,           // Schema issues affect type inference
} as const;

/**
 * Minimum description lengths for quality assessment.
 * Based on research on what constitutes "meaningful" documentation.
 */
const MIN_LENGTHS = {
  operationDescription: 20,   // "Creates a new user account" = 26 chars
  summary: 10,                // "List users" = 10 chars
  parameterDescription: 10,   // "User's email" = 12 chars
  schemaDescription: 15,      // "User account data" = 17 chars
  apiDescription: 50,         // Enough for a meaningful overview
} as const;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const IDEMPOTENT_METHODS: readonly string[] = ['get', 'put', 'delete', 'head', 'options'];
const PAGINATION_PARAMS: readonly string[] = ['page', 'limit', 'offset', 'cursor', 'per_page', 'page_size', 'skip', 'take', 'after', 'before'];

// Pre-compiled regex patterns for performance (compiled once at module load)
const OPENAPI_VERSION_PATTERN = /^3\.[0-2]\.\d+$/;
const ACTION_VERBS_PATTERN = /\b(creates?|retrieves?|updates?|deletes?|lists?|gets?|fetches?|returns?|allows?|enables?|provides?|sends?|receives?|validates?|processes?|generates?|initiates?|cancels?|submits?)\b/i;
const BUSINESS_CONTEXT_PATTERN = /\b(user|customer|order|payment|account|product|invoice|subscription|transaction|request|response|data|resource)\b/i;
const OPERATION_ID_PATTERN = /^(get|list|create|update|delete|fetch|find|search|add|remove|set|upload|download|send|receive|validate|process|generate|initiate|cancel|submit)[A-Z]/;

/**
 * Calculate Agent-Ready Score for an OpenAPI specification
 */
export function calculateAgentReadinessScore(
  validationResults: ValidationResult[],
  specContent: string
): AgentReadinessScore {
  // Parse the spec
  let spec: OpenApiSpec | null = null;
  try {
    const budget = assertSpecBudget(specContent)
    if (budget) {
      return createErrorScore(budget.error)
    }
    spec = loadYaml(specContent) as OpenApiSpec;
    if (typeof spec !== 'object' || spec === null) {
      throw new Error('Parsed content is not an object.');
    }
  } catch {
    return createErrorScore('Failed to parse OpenAPI specification. Ensure the file is valid YAML or JSON.');
  }

  // Gather statistics
  const stats = gatherStats(spec);

  // Analyze each dimension
  const foundationalCompliance = analyzeFoundationalCompliance(validationResults, spec, stats);
  const semanticRichness = analyzeSemanticRichness(spec, stats);
  const agentUsability = analyzeAgentUsability(spec, stats);
  const aiDiscoverability = analyzeAIDiscoverability(spec, stats);
  const security = analyzeSecurity(spec, stats);
  const errorRecoverability = analyzeErrorRecoverability(spec, stats);

  // Calculate weighted overall score
  const overallScore = Math.round(
    foundationalCompliance.score * WEIGHTS.foundationalCompliance +
    semanticRichness.score * WEIGHTS.semanticRichness +
    agentUsability.score * WEIGHTS.agentUsability +
    aiDiscoverability.score * WEIGHTS.aiDiscoverability +
    security.score * WEIGHTS.security +
    errorRecoverability.score * WEIGHTS.errorRecoverability
  );

  const grade = scoreToGrade(overallScore);
  const readinessLevel = scoreToReadinessLevel(overallScore);

  // Generate prioritized recommendations
  const recommendations = generateRecommendations({
    foundationalCompliance,
    semanticRichness,
    agentUsability,
    aiDiscoverability,
    security,
    errorRecoverability,
  });

  // Generate summary
  const summary = generateSummary(overallScore, grade, readinessLevel, stats);

  return {
    overallScore,
    grade,
    readinessLevel,
    summary,
    dimensions: {
      foundationalCompliance,
      semanticRichness,
      agentUsability,
      aiDiscoverability,
      security,
      errorRecoverability,
    },
    stats,
    recommendations,
  };
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreToReadinessLevel(score: number): ReadinessLevel {
  if (score >= 80) return 'Strong spec surface';
  if (score >= 60) return 'Partial coverage';
  if (score >= 40) return 'Many gaps';
  return 'Severe gaps';
}

function gatherStats(spec: OpenApiSpec): AgentReadinessScore['stats'] {
  let operations = 0;
  let parameters = 0;

  if (spec.paths) {
    for (const path of Object.values(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (operation) {
          operations++;
          parameters += operation.parameters?.length || 0;
        }
      }
      parameters += path.parameters?.length || 0;
    }
  }

  return {
    operations,
    schemas: Object.keys(spec.components?.schemas || {}).length,
    parameters,
    tags: spec.tags?.length || 0,
    securitySchemes: Object.keys(spec.components?.securitySchemes || {}).length,
  };
}

function createErrorScore(message: string): AgentReadinessScore {
  const emptyDimension: DimensionScore = {
    score: 0,
    grade: 'F',
    label: 'Error',
    description: message,
    signals: [{ type: 'negative', message }],
    details: {},
    improvementTips: [],
  };

  return {
    overallScore: 0,
    grade: 'F',
    readinessLevel: 'Severe gaps',
    summary: message,
    dimensions: {
      foundationalCompliance: { ...emptyDimension, label: 'Foundational Compliance' },
      semanticRichness: { ...emptyDimension, label: 'Semantic Richness' },
      agentUsability: { ...emptyDimension, label: 'Agent Usability' },
      aiDiscoverability: { ...emptyDimension, label: 'AI Discoverability' },
      security: { ...emptyDimension, label: 'Security' },
      errorRecoverability: { ...emptyDimension, label: 'Error Recoverability' },
    },
    stats: { operations: 0, schemas: 0, parameters: 0, tags: 0, securitySchemes: 0 },
    recommendations: [{
      priority: 'critical',
      dimension: 'foundationalCompliance',
      title: 'Fix Specification Parsing',
      description: message,
      impact: 'Nothing that consumes this file as OpenAPI can trust it until it parses.',
    }],
  };
}

// ============================================================================
// DIMENSION ANALYZERS
// ============================================================================

function analyzeFoundationalCompliance(
  results: ValidationResult[],
  spec: OpenApiSpec,
  _stats: AgentReadinessScore['stats']  // Kept for API consistency, not used in this dimension
): DimensionScore {
  const signals: Signal[] = [];
  // eslint/no-unused-vars in some configs doesn't ignore leading underscores
  void _stats;
  
  // Count issues by severity
  const errors = results.filter(r => r.severity === 'error' && !r.code?.includes('SUCCESS'));
  const warnings = results.filter(r => r.severity === 'warning');
  
  // Check OpenAPI version
  const hasValidVersion = spec.openapi && OPENAPI_VERSION_PATTERN.test(spec.openapi);
  
  // Check for $ref resolution issues
  const refIssues = results.filter(r => 
    r.message?.toLowerCase().includes('ref') || 
    r.message?.toLowerCase().includes('reference') ||
    r.code?.toLowerCase().includes('ref')
  );
  
  // Check for schema issues
  const schemaIssues = results.filter(r => 
    r.category === 'schema' || 
    r.message?.toLowerCase().includes('schema') ||
    r.path?.some(p => p?.toString().toLowerCase().includes('schema'))
  );

  // Calculate sub-scores using documented penalty multipliers
  const specificationValidity = errors.length === 0 ? 100 : Math.max(0, 100 - (errors.length * PENALTIES.validationError));
  const lintResults = Math.max(0, 100 - (errors.length * PENALTIES.schemaIssue) - (warnings.length * PENALTIES.warning));
  const resolutionCompleteness = refIssues.length === 0 ? 100 : Math.max(0, 100 - (refIssues.length * PENALTIES.refIssue));
  const structuralIntegrity = schemaIssues.length === 0 ? 100 : 
    Math.max(0, 100 - Math.min(50, Math.log10(schemaIssues.length + 1) * 25));

  // Build signals
  if (hasValidVersion) {
    signals.push({ type: 'positive', message: `OpenAPI ${spec.openapi} specification` });
  } else {
    signals.push({ type: 'negative', message: 'Missing or invalid OpenAPI version' });
  }
  
  if (errors.length > 0) {
    signals.push({ type: 'negative', message: `${errors.length} validation error${errors.length > 1 ? 's' : ''}`, count: errors.length });
  } else {
    signals.push({ type: 'positive', message: 'No validation errors' });
  }
  
  if (refIssues.length > 0) {
    signals.push({ type: 'negative', message: `${refIssues.length} unresolved reference${refIssues.length > 1 ? 's' : ''}`, count: refIssues.length });
  }
  
  if (schemaIssues.length > 0) {
    signals.push({ type: 'negative', message: `${schemaIssues.length} schema issue${schemaIssues.length > 1 ? 's' : ''}`, count: schemaIssues.length });
  }

  const score = Math.round(
    specificationValidity * 0.35 +
    lintResults * 0.25 +
    resolutionCompleteness * 0.25 +
    structuralIntegrity * 0.15
  );

  const improvementTips: string[] = [];
  if (errors.length > 0) improvementTips.push('Resolve all validation errors to ensure agents can parse the specification');
  if (refIssues.length > 0) improvementTips.push('Fix broken $ref references — consumers of this document cannot resolve incomplete schemas');
  if (schemaIssues.length > 0) improvementTips.push('Correct schema definitions - type mismatches confuse AI reasoning');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Foundational Compliance',
    description: 'Structural validity from Swagger Parser, OAS Zod Validator, and Spectral. An invalid document cannot be consumed as a spec.',
    signals,
    details: {
      specificationValidity,
      lintResults,
      resolutionCompleteness,
      structuralIntegrity,
    },
    improvementTips,
  };
}

function analyzeSemanticRichness(spec: OpenApiSpec, stats: AgentReadinessScore['stats']): DimensionScore {
  const signals: Signal[] = [];
  
  let operationsWithDescription = 0;
  let operationsWithSummary = 0;
  let parametersWithDescription = 0;
  let schemasWithDescription = 0;
  let naturalLanguageQuality = 0;
  let totalParameters = 0;
  
  if (spec.paths) {
    for (const path of Object.values(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (!operation) continue;

        // Check descriptions using documented minimum lengths
        if (operation.description && operation.description.length >= MIN_LENGTHS.operationDescription) {
          operationsWithDescription++;
          
          // Evaluate natural language quality using pre-compiled patterns
          if (ACTION_VERBS_PATTERN.test(operation.description)) naturalLanguageQuality++;
          if (BUSINESS_CONTEXT_PATTERN.test(operation.description)) naturalLanguageQuality++;
        }
        
        if (operation.summary && operation.summary.length >= MIN_LENGTHS.summary) {
          operationsWithSummary++;
        }

        // Check parameters
        if (operation.parameters) {
          for (const param of operation.parameters) {
            totalParameters++;
            if (param.description && param.description.length >= MIN_LENGTHS.parameterDescription) {
              parametersWithDescription++;
            }
          }
        }
      }
    }
  }

  // Check schemas
  if (spec.components?.schemas) {
    for (const schema of Object.values(spec.components.schemas)) {
      if (schema.description && schema.description.length >= MIN_LENGTHS.schemaDescription) {
        schemasWithDescription++;
      }
    }
  }

  // Calculate percentages
  const descriptionCoverage = stats.operations > 0 
    ? Math.round((operationsWithDescription / stats.operations) * 100) : 0;
  const summaryCoverage = stats.operations > 0 
    ? Math.round((operationsWithSummary / stats.operations) * 100) : 0;
  const parameterDescriptions = totalParameters > 0 
    ? Math.round((parametersWithDescription / totalParameters) * 100) : 0;
  const schemaDescriptions = stats.schemas > 0 
    ? Math.round((schemasWithDescription / stats.schemas) * 100) : 0;
  const nlQuality = stats.operations > 0 
    ? Math.round((naturalLanguageQuality / (stats.operations * 2)) * 100) : 0;

  // Build signals
  if (descriptionCoverage >= 80) {
    signals.push({ type: 'positive', message: `${descriptionCoverage}% operations have descriptions` });
  } else {
    signals.push({ type: 'negative', message: `${100 - descriptionCoverage}% operations missing descriptions`, count: stats.operations - operationsWithDescription });
  }
  
  if (parameterDescriptions >= 70) {
    signals.push({ type: 'positive', message: `${parameterDescriptions}% parameters documented` });
  } else if (totalParameters > 0) {
    signals.push({ type: 'negative', message: `${100 - parameterDescriptions}% parameters undocumented`, count: totalParameters - parametersWithDescription });
  }
  
  if (nlQuality < 50 && stats.operations > 0) {
    signals.push({ type: 'negative', message: 'Descriptions lack natural language context for AI reasoning' });
  }

  const score = Math.round(
    descriptionCoverage * 0.30 +
    summaryCoverage * 0.15 +
    parameterDescriptions * 0.20 +
    schemaDescriptions * 0.15 +
    nlQuality * 0.20
  );

  const improvementTips: string[] = [];
  if (descriptionCoverage < 80) improvementTips.push('Add descriptions to operations explaining what they do and when to use them');
  if (parameterDescriptions < 70) improvementTips.push('Document parameters with their purpose, constraints, and valid values');
  if (nlQuality < 50) improvementTips.push('Write descriptions that say what the operation does and when to use it');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Semantic Richness',
    description: 'Natural language in the spec. Generated tools have little else to go on; this does not prove how a model will call the API.',
    signals,
    details: {
      descriptionCoverage,
      summaryCoverage,
      parameterDescriptions,
      schemaDescriptions,
      naturalLanguageQuality: nlQuality,
    },
    improvementTips,
  };
}

function analyzeAgentUsability(spec: OpenApiSpec, stats: AgentReadinessScore['stats']): DimensionScore {
  const signals: Signal[] = [];
  
  let operationsWithId = 0;
  let idempotentOperations = 0;
  let operationsWithPagination = 0;
  let listOperations = 0;
  let operationsWithErrorResponses = 0;
  let wellNamedOperationIds = 0;

  if (spec.paths) {
    for (const [pathKey, path] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (!operation) continue;

        // Check operationId using pre-compiled pattern
        if (operation.operationId) {
          operationsWithId++;
          if (OPERATION_ID_PATTERN.test(operation.operationId)) {
            wellNamedOperationIds++;
          }
        }

        // Check idempotency
        const isIdempotentMethod = IDEMPOTENT_METHODS.includes(method);
        const hasIdempotencyKey = operation['x-idempotent'] || operation['x-idempotency-key'];
        if (isIdempotentMethod || hasIdempotencyKey) {
          idempotentOperations++;
        }

        // Check pagination for list operations
        const isListOperation = method === 'get' && (pathKey.endsWith('s') || pathKey.includes('list') || pathKey.includes('search'));
        if (isListOperation && operation.parameters) {
          listOperations++;
          const hasPagination = operation.parameters.some(p => 
            p.name && PAGINATION_PARAMS.includes(p.name.toLowerCase())
          );
          if (hasPagination) operationsWithPagination++;
        }

        // Check error responses
        if (operation.responses) {
          const hasErrors = Object.keys(operation.responses).some(code => parseInt(code) >= 400);
          if (hasErrors) operationsWithErrorResponses++;
        }
      }
    }
  }

  // Calculate scores
  const operationIdCoverage = stats.operations > 0 
    ? Math.round((operationsWithId / stats.operations) * 100) : 0;
  const operationIdQuality = operationsWithId > 0 
    ? Math.round((wellNamedOperationIds / operationsWithId) * 100) : 0;
  const idempotencyScore = stats.operations > 0 
    ? Math.round((idempotentOperations / stats.operations) * 100) : 0;
  const errorResponseCoverage = stats.operations > 0 
    ? Math.round((operationsWithErrorResponses / stats.operations) * 100) : 0;
  const paginationCoverage = listOperations > 0
    ? Math.round((operationsWithPagination / listOperations) * 100)
    : 100;

  // Build signals
  if (operationIdCoverage === 100) {
    signals.push({ type: 'positive', message: 'All operations have operationId' });
  } else if (operationIdCoverage > 0) {
    signals.push({ type: 'negative', message: `${stats.operations - operationsWithId} operations missing operationId`, count: stats.operations - operationsWithId });
  } else {
    signals.push({ type: 'negative', message: 'No operationIds defined — tool generators have nothing to use as function names' });
  }
  
  if (operationIdQuality < 50 && operationsWithId > 0) {
    signals.push({ type: 'negative', message: 'OperationIds lack verb-noun naming (e.g., getUser, createOrder)' });
  }
  
  if (idempotencyScore >= 70) {
    signals.push({ type: 'positive', message: `${idempotencyScore}% operations are idempotent or safe` });
  }
  
  if (listOperations > 0) {
    if (paginationCoverage >= 70) {
      signals.push({ type: 'positive', message: `${paginationCoverage}% list operations support pagination` });
    } else {
      signals.push({ type: 'negative', message: 'Many list operations lack pagination parameters' });
    }
  }

  const score = Math.round(
    operationIdCoverage * 0.30 +
    operationIdQuality * 0.20 +
    idempotencyScore * 0.20 +
    errorResponseCoverage * 0.20 +
    paginationCoverage * 0.10
  );

  const improvementTips: string[] = [];
  if (operationIdCoverage < 100) improvementTips.push('Add unique operationId to every operation - agents use these as function names');
  if (operationIdQuality < 50) improvementTips.push('Use verb-noun format for operationIds (e.g., getUsers, createOrder, deleteInvoice)');
  if (idempotencyScore < 70) improvementTips.push('Mark non-GET operations as idempotent where safe for agent retry logic');
  if (listOperations > 0 && paginationCoverage < 70) improvementTips.push('Add standard pagination parameters (e.g., limit, offset, cursor) to list endpoints');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Agent Usability',
    description: 'operationIds, pagination hints, and idempotency as written in the spec — not observed at runtime.',
    signals,
    details: {
      operationIdCoverage,
      operationIdQuality,
      idempotencyScore,
      errorResponseCoverage,
      paginationCoverage,
    },
    improvementTips,
  };
}

function analyzeAIDiscoverability(spec: OpenApiSpec, stats: AgentReadinessScore['stats']): DimensionScore {
  const signals: Signal[] = [];
  
  let operationsWithExamples = 0;
  let operationsWithTags = 0;
  let schemasWithExamples = 0;
  let metadataScore = 0;
  
  // Check API-level metadata using documented minimum lengths
  if (spec.info?.description && spec.info.description.length >= MIN_LENGTHS.apiDescription) metadataScore += 20;
  if (spec.info?.contact) metadataScore += 15;
  if (spec.info?.license) metadataScore += 10;
  if (spec.externalDocs?.url) metadataScore += 15;
  if (spec.servers && spec.servers.length > 0) {
    metadataScore += 20;
    if (spec.servers.some(s => s.description)) metadataScore += 20;
  }
  
  // Check tag definitions
  const hasTagDescriptions = spec.tags?.every(t => t.description && t.description.length >= 10);
  if (hasTagDescriptions && spec.tags && spec.tags.length > 0) {
    signals.push({ type: 'positive', message: `${spec.tags.length} well-documented tags` });
  }

  if (spec.paths) {
    for (const path of Object.values(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (!operation) continue;

        // Check tags
        if (operation.tags && operation.tags.length > 0) {
          operationsWithTags++;
        }

        // Check examples
        let hasExample = false;
        
        // Request body examples
        if (operation.requestBody?.content) {
          for (const media of Object.values(operation.requestBody.content)) {
            if (media.example || media.examples) hasExample = true;
          }
        }
        
        // Response examples
        if (operation.responses) {
          for (const response of Object.values(operation.responses)) {
            if (response.content) {
              for (const media of Object.values(response.content)) {
                if (media.example || media.examples) hasExample = true;
              }
            }
          }
        }
        
        if (hasExample) operationsWithExamples++;
      }
    }
  }

  // Check schema examples
  if (spec.components?.schemas) {
    for (const schema of Object.values(spec.components.schemas)) {
      if (schema.example || schema.examples) {
        schemasWithExamples++;
      }
    }
  }

  // Calculate percentages
  const exampleCoverage = stats.operations > 0 
    ? Math.round((operationsWithExamples / stats.operations) * 100) : 0;
  const tagCoverage = stats.operations > 0 
    ? Math.round((operationsWithTags / stats.operations) * 100) : 0;
  const schemaExamples = stats.schemas > 0 
    ? Math.round((schemasWithExamples / stats.schemas) * 100) : 0;

  // Build signals
  if (exampleCoverage >= 50) {
    signals.push({ type: 'positive', message: `${exampleCoverage}% operations have examples` });
  } else {
    signals.push({ type: 'negative', message: `${100 - exampleCoverage}% operations missing examples`, count: stats.operations - operationsWithExamples });
  }
  
  if (tagCoverage >= 80) {
    signals.push({ type: 'positive', message: `${tagCoverage}% operations categorized with tags` });
  } else if (stats.operations > 0) {
    signals.push({ type: 'negative', message: `${100 - tagCoverage}% operations missing tags` });
  }
  
  if (metadataScore < 60) {
    signals.push({ type: 'negative', message: 'Incomplete API metadata (info, servers, contact)' });
  }

  const score = Math.round(
    exampleCoverage * 0.35 +
    schemaExamples * 0.20 +
    tagCoverage * 0.20 +
    metadataScore * 0.25
  );

  const improvementTips: string[] = [];
  if (exampleCoverage < 50) improvementTips.push('Add request/response examples - agents learn from examples, not just schemas');
  if (tagCoverage < 80) improvementTips.push('Organize operations with tags - helps agents discover related functionality');
  if (metadataScore < 60) improvementTips.push('Complete API info section with description, contact, and server details');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'AI Discoverability',
    description: 'Examples, tags, and info/servers metadata present in the document.',
    signals,
    details: {
      exampleCoverage,
      schemaExamples,
      tagCoverage,
      metadataCompleteness: metadataScore,
    },
    improvementTips,
  };
}

function analyzeSecurity(spec: OpenApiSpec, stats: AgentReadinessScore['stats']): DimensionScore {
  const signals: Signal[] = [];
  
  const securitySchemes = spec.components?.securitySchemes || {};
  const schemeCount = Object.keys(securitySchemes).length;
  const hasGlobalSecurity = spec.security && spec.security.length > 0;
  
  // Analyze security scheme types
  let hasOAuth = false;
  let hasApiKey = false;
  let hasBearerToken = false;
  
  for (const scheme of Object.values(securitySchemes)) {
    if (scheme.type === 'oauth2') hasOAuth = true;
    if (scheme.type === 'apiKey') hasApiKey = true;
    if (scheme.type === 'http' && scheme.scheme === 'bearer') hasBearerToken = true;
  }

  // Check HTTPS
  const hasSecureServers = spec.servers?.every(s => 
    s.url.startsWith('https://') || s.url.startsWith('{') || s.url.startsWith('/')
  ) ?? false;

  // Count operations with security
  let operationsWithSecurity = 0;
  if (spec.paths) {
    for (const path of Object.values(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (!operation) continue;
        
        if (hasGlobalSecurity || (operation.security && operation.security.length > 0)) {
          operationsWithSecurity++;
        }
      }
    }
  }

  // Calculate scores
  const schemeScore = schemeCount > 0 ? Math.min(100, schemeCount * 40) : 0;
  const coverageScore = stats.operations > 0 
    ? Math.round((operationsWithSecurity / stats.operations) * 100) : 0;
  const httpsScore = hasSecureServers ? 100 : 0;

  // Build signals
  if (schemeCount > 0) {
    signals.push({ type: 'positive', message: `${schemeCount} security scheme${schemeCount > 1 ? 's' : ''} defined` });
  } else {
    signals.push({ type: 'negative', message: 'No security schemes defined' });
  }
  
  if (hasGlobalSecurity) {
    signals.push({ type: 'positive', message: 'Global security applied' });
  } else if (coverageScore < 100 && stats.operations > 0) {
    signals.push({ type: 'negative', message: `${stats.operations - operationsWithSecurity} operations without security` });
  }
  
  if (hasOAuth) {
    signals.push({ type: 'positive', message: 'OAuth 2.0 supported' });
  }

  const score = Math.round(
    schemeScore * 0.40 +
    coverageScore * 0.40 +
    httpsScore * 0.20
  );

  const improvementTips: string[] = [];
  if (schemeCount === 0) improvementTips.push('Define security schemes so agents know how to authenticate');
  if (!hasGlobalSecurity && coverageScore < 100) improvementTips.push('Apply security globally or to all sensitive operations');
  if (hasApiKey && !hasOAuth && !hasBearerToken) improvementTips.push('Consider adding OAuth2 or Bearer token support for production agent use');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Security',
    description: 'Security schemes and coverage as documented. This does not test whether authentication works.',
    signals,
    details: {
      securitySchemes: schemeScore,
      securityCoverage: coverageScore,
      httpsSupport: httpsScore,
    },
    improvementTips,
  };
}

function analyzeErrorRecoverability(spec: OpenApiSpec, stats: AgentReadinessScore['stats']): DimensionScore {
  const signals: Signal[] = [];
  
  let operationsWithErrors = 0;
  let operationsWithErrorSchemas = 0;
  let operationsWithErrorCodes = 0;
  let operationsWithRetryInfo = 0;
  
  const errorCodeFields = ['code', 'error_code', 'errorcode', 'status', 'type'];
  const retryFields = ['retry_after', 'retryafter', 'retry_after_seconds', 'retryable'];

  if (spec.paths) {
    for (const path of Object.values(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = path[method];
        if (!operation?.responses) continue;

        const errorResponses = Object.entries(operation.responses).filter(([code]) => 
          parseInt(code) >= 400
        );

        if (errorResponses.length > 0) {
          operationsWithErrors++;
          
          for (const [, response] of errorResponses) {
            const schema = response.content?.['application/json']?.schema as SchemaObject | undefined;
            
            if (schema) {
              operationsWithErrorSchemas++;
              
              const props = schema.properties || {};
              const propNames = Object.keys(props).map(k => k.toLowerCase());
              
              if (propNames.some(p => errorCodeFields.includes(p))) {
                operationsWithErrorCodes++;
              }
              
              if (propNames.some(p => retryFields.includes(p))) {
                operationsWithRetryInfo++;
              }
            }
          }
        }
      }
    }
  }

  // Calculate scores
  const errorCoverage = stats.operations > 0 
    ? Math.round((operationsWithErrors / stats.operations) * 100) : 0;
  const structuredErrors = operationsWithErrors > 0 
    ? Math.round((operationsWithErrorSchemas / operationsWithErrors) * 100) : 0;
  const errorCodeSupport = operationsWithErrors > 0 
    ? Math.round((operationsWithErrorCodes / operationsWithErrors) * 100) : 0;
  const retrySupport = operationsWithErrors > 0 
    ? Math.round((operationsWithRetryInfo / operationsWithErrors) * 100) : 0;

  // Build signals
  if (errorCoverage >= 80) {
    signals.push({ type: 'positive', message: `${errorCoverage}% operations define error responses` });
  } else {
    signals.push({ type: 'negative', message: `${100 - errorCoverage}% operations missing error responses` });
  }
  
  if (structuredErrors >= 50) {
    signals.push({ type: 'positive', message: 'Error responses have structured schemas' });
  } else if (operationsWithErrors > 0) {
    signals.push({ type: 'negative', message: 'Error responses lack structured schemas' });
  }
  
  if (retrySupport > 0) {
    signals.push({ type: 'positive', message: 'Some errors include retry guidance' });
  } else if (operationsWithErrors > 0) {
    signals.push({ type: 'negative', message: 'No retry guidance in error responses' });
  }

  const score = Math.round(
    errorCoverage * 0.35 +
    structuredErrors * 0.30 +
    errorCodeSupport * 0.20 +
    retrySupport * 0.15
  );

  const improvementTips: string[] = [];
  if (errorCoverage < 80) improvementTips.push('Define error responses (4xx, 5xx) for all operations');
  if (structuredErrors < 50) improvementTips.push('Use structured error schemas with code, message, and details fields');
  if (retrySupport === 0) improvementTips.push('Add retry_after or retryable fields to help agents recover from rate limits');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Error Recoverability',
    description: 'Error responses and schemas as documented in the spec, not live retry behaviour.',
    signals,
    details: {
      errorCoverage,
      structuredErrors,
      errorCodeSupport,
      retrySupport,
    },
    improvementTips,
  };
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(
  dimensions: AgentReadinessScore['dimensions']
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Foundational Compliance
  if (dimensions.foundationalCompliance.score < 80) {
    recommendations.push({
      priority: dimensions.foundationalCompliance.score < 50 ? 'critical' : 'high',
      dimension: 'Foundational Compliance',
      title: 'Fix Structural Validity Issues',
      description: 'Resolve validation errors and broken references to ensure agents can parse and understand your API.',
      impact: 'Nothing that consumes this file as an OpenAPI document can trust it until it parses.',
    });
  }

  // Semantic Richness
  if (dimensions.semanticRichness.score < 70) {
    recommendations.push({
      priority: 'high',
      dimension: 'Semantic Richness',
      title: 'Enrich Descriptions for AI Understanding',
      description: 'Add natural language descriptions to operations, parameters, and schemas. Use action verbs and business context.',
      impact: 'Generated tools mostly see what you wrote. Thin descriptions leave them with less context; that is not the same as a failed live call.',
    });
  }

  // Agent Usability
  if (dimensions.agentUsability.score < 70) {
    recommendations.push({
      priority: dimensions.agentUsability.details.operationIdCoverage < 50 ? 'high' : 'medium',
      dimension: 'Agent Usability',
      title: 'Add OperationIds and Improve Naming',
      description: 'Every operation needs a unique operationId using verb-noun format (e.g., getUsers, createOrder).',
      impact: 'Many tool generators use operationId as the function name. Missing IDs make that mapping worse.',
    });
  }

  // AI Discoverability
  if (dimensions.aiDiscoverability.score < 60) {
    recommendations.push({
      priority: 'medium',
      dimension: 'AI Discoverability',
      title: 'Add Examples and Tags',
      description: 'Include request/response examples for all operations and organize endpoints with tags.',
      impact: 'Examples and tags are hints in the document. They help readers and generators; they do not replace an integration test.',
    });
  }

  // Security
  if (dimensions.security.score < 80) {
    recommendations.push({
      priority: dimensions.security.score < 40 ? 'high' : 'medium',
      dimension: 'Security',
      title: 'Document Authentication Methods',
      description: 'Define security schemes and apply them consistently. Agents need to know how to authenticate.',
      impact: 'Without documented security schemes, a generated client does not know what credentials to send.',
    });
  }

  // Error Recoverability
  if (dimensions.errorRecoverability.score < 60) {
    recommendations.push({
      priority: 'medium',
      dimension: 'Error Recoverability',
      title: 'Structure Error Responses',
      description: 'Define error responses with structured schemas including error codes and retry guidance.',
      impact: 'Documented error shapes help a caller interpret failures. This checklist does not observe live Retry-After headers.',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

function generateSummary(
  score: number,
  _grade: Grade,
  level: ReadinessLevel,
  stats: AgentReadinessScore['stats']
): string {
  void _grade
  const opText = stats.operations === 1 ? 'operation' : 'operations'

  if (score >= 80) {
    return `Checklist: ${level.toLowerCase()} (${score}/100) across ${stats.operations} ${opText}. The spec covers most of what this static analysis looks for. That is not a runtime test of agents.`
  }

  if (score >= 60) {
    return `Checklist: ${level.toLowerCase()} (${score}/100) across ${stats.operations} ${opText}. Several documentation gaps. Use the signals below as a punch-list, not a verdict.`
  }

  if (score >= 40) {
    return `Checklist: ${level.toLowerCase()} (${score}/100) across ${stats.operations} ${opText}. Large parts of the spec are thin. This is a documentation review, not proof agents will fail.`
  }

  return `Checklist: ${level.toLowerCase()} (${score}/100) across ${stats.operations} ${opText}. The spec is missing a lot of what tool-calling setups typically read, or it does not parse cleanly.`
}

// Re-export for backward compatibility
export { calculateAgentReadinessScore as calculateAIReadinessScore };

// ============================================================================
// METHODOLOGY EXPORT
// Provides transparency into how scores are calculated
// ============================================================================

/**
 * Scoring methodology for transparency and trust.
 * Exported so the UI can display how scores are calculated.
 */
export const METHODOLOGY = {
  name: 'Agent-Ready Score',
  version: '1.2.0',
  author: 'Appear',
  description: 'A deterministic checklist of an OpenAPI document: parseability and the documentation tool-calling setups typically read. Originally built at Appear. It is not a runtime test of agents and not a certification.',
  rationale: 'If something turns your spec into tools — a model, an MCP wrapper, a generated client — it mostly sees what is in the file. This score measures that surface. It does not call your API, run a model, or prove that agents will succeed.',
  dimensions: [
    {
      id: 'foundationalCompliance',
      name: 'Foundational Compliance',
      weight: WEIGHTS.foundationalCompliance,
      weightPercent: 25,
      icon: 'shield-check',
      description: 'Structural validity and OpenAPI standards conformance.',
      whyItMatters: 'An unparseable spec is useless to anything that consumes the document. That part is a hard stop. The rest of this dimension is lint coverage, not live behaviour.',
      factors: [
        'Specification validity (no parsing errors)',
        'Lint results (errors and warnings)',
        '$ref resolution completeness',
        'Schema structural integrity',
      ],
    },
    {
      id: 'semanticRichness',
      name: 'Semantic Richness',
      weight: WEIGHTS.semanticRichness,
      weightPercent: 20,
      icon: 'message-square-text',
      description: 'Natural language descriptions present in the spec.',
      whyItMatters: 'Generated tools have little except what you wrote. Vague descriptions are a documentation gap, not proof of incorrect calls.',
      factors: [
        'Operation description coverage and quality',
        'Summary field usage',
        'Parameter documentation',
        'Schema descriptions',
        'Natural language quality (action verbs, business context)',
      ],
    },
    {
      id: 'agentUsability',
      name: 'Agent Usability',
      weight: WEIGHTS.agentUsability,
      weightPercent: 20,
      icon: 'bot',
      description: 'operationIds and documented retry/list patterns.',
      whyItMatters: 'operationId is often the tool name. Idempotency and pagination are inferred from the document; this does not watch traffic.',
      factors: [
        'OperationId coverage and naming quality',
        'Idempotency support for safe retries',
        'Pagination on list operations',
        'Error response coverage',
      ],
    },
    {
      id: 'aiDiscoverability',
      name: 'AI Discoverability',
      weight: WEIGHTS.aiDiscoverability,
      weightPercent: 15,
      icon: 'search',
      description: 'Examples, tags, and API-level metadata in the file.',
      whyItMatters: 'Examples and tags are useful hints. They do not replace trying the API.',
      factors: [
        'Request/response example coverage',
        'Schema example coverage',
        'Tag organization',
        'API metadata completeness (info, servers, contact)',
      ],
    },
    {
      id: 'security',
      name: 'Security',
      weight: WEIGHTS.security,
      weightPercent: 10,
      icon: 'lock',
      description: 'Authentication as documented in the spec.',
      whyItMatters: 'A consumer can only send credentials you described. This does not verify that those schemes work.',
      factors: [
        'Security scheme definitions',
        'Security coverage across operations',
        'HTTPS support',
      ],
    },
    {
      id: 'errorRecoverability',
      name: 'Error Recoverability',
      weight: WEIGHTS.errorRecoverability,
      weightPercent: 10,
      icon: 'rotate-ccw',
      description: 'Error responses as written in the spec.',
      whyItMatters: 'Documented error schemas help a caller interpret failures. Live Retry-After headers are out of scope.',
      factors: [
        'Error response definition coverage',
        'Structured error schemas',
        'Error code support',
        'Retry guidance fields',
      ],
    },
  ],
  gradeThresholds: {
    A: { min: 90, label: 'Strong coverage', color: 'emerald' },
    B: { min: 80, label: 'Good coverage', color: 'green' },
    C: { min: 70, label: 'Fair coverage', color: 'yellow' },
    D: { min: 60, label: 'Thin coverage', color: 'orange' },
    F: { min: 0, label: 'Weak / may not parse', color: 'red' },
  },
  readinessLevels: {
    'Strong spec surface': { min: 80, description: 'This checklist is mostly filled in. Not a guarantee agents will succeed.' },
    'Partial coverage': { min: 60, description: 'Several checklist items are missing. Treat the signals as a punch-list.' },
    'Many gaps': { min: 40, description: 'Large parts of the spec are undocumented. A documentation review, not a runtime test.' },
    'Severe gaps': { min: 0, description: 'The spec is missing a lot of what this checklist looks for, or it does not parse.' },
  },
  references: [
    { 
      title: 'Why Your API Docs Break for AI Agents', 
      url: 'https://appear.sh/blog/why-your-api-docs-break-for-ai-agents',
      description: 'The reasoning behind this framework (Appear; wound down)'
    },
    { 
      title: 'ctxpipe.ai', 
      url: 'https://www.ctxpipe.ai',
      description: "The founders' new endeavour — a self-learning context layer for AI engineering agents"
    },
    { 
      title: 'OpenAPI Best Practices', 
      url: 'https://learn.openapis.org/best-practices.html',
      description: 'OpenAPI Initiative guidance'
    },
    { 
      title: 'Microsoft Copilot OpenAPI Guidance', 
      url: 'https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance',
      description: 'Microsoft\'s requirements for AI plugin APIs'
    },
  ],
} as const;
