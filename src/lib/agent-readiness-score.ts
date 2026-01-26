/**
 * Agent-Ready Score Calculator
 * 
 * Appear's framework for evaluating how well an OpenAPI specification is prepared
 * for consumption by AI agents. This methodology assesses six dimensions that
 * determine whether agents can reliably discover, understand, and interact with
 * your API.
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
 * @see https://learn.openapis.org/best-practices.html
 */

import * as yaml from 'js-yaml';
import type { ValidationResult } from '@/lib/types';

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
export type ReadinessLevel = 'Agent Ready' | 'Partially Ready' | 'Needs Work' | 'Not Ready';

export interface DimensionScore {
  score: number;
  grade: Grade;
  label: string;
  description: string;
  signals: Signal[];
  details: Record<string, number>;
  improvementTips: string[];
  appearCanHelp: boolean;
  appearHelpText?: string;
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
  appearCTA: AppearCTA;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  dimension: string;
  title: string;
  description: string;
  impact: string;
  automatable: boolean;
}

export interface AppearCTA {
  headline: string;
  subheadline: string;
  primaryAction: {
    label: string;
    url: string;
  };
  secondaryAction?: {
    label: string;
    url: string;
  };
  features: string[];
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
    spec = yaml.load(specContent) as OpenApiSpec;
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

  // Generate Appear CTA based on score and gaps
  const appearCTA = generateAppearCTA(overallScore, recommendations);

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
    appearCTA,
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
  if (score >= 80) return 'Agent Ready';
  if (score >= 60) return 'Partially Ready';
  if (score >= 40) return 'Needs Work';
  return 'Not Ready';
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
    appearCanHelp: true,
    appearHelpText: 'Appear can automatically generate accurate schemas from your live API traffic.',
  };

  return {
    overallScore: 0,
    grade: 'F',
    readinessLevel: 'Not Ready',
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
      impact: 'AI agents cannot interact with an unparseable specification.',
      automatable: true,
    }],
    appearCTA: generateAppearCTA(0, []),
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
  const errors = results.filter(r => r.severity === 'error' && !r.code.includes('SUCCESS'));
  const warnings = results.filter(r => r.severity === 'warning');
  
  // Check OpenAPI version
  const hasValidVersion = spec.openapi && OPENAPI_VERSION_PATTERN.test(spec.openapi);
  
  // Check for $ref resolution issues
  const refIssues = results.filter(r => 
    r.message.toLowerCase().includes('ref') || 
    r.message.toLowerCase().includes('reference') ||
    r.code.toLowerCase().includes('ref')
  );
  
  // Check for schema issues
  const schemaIssues = results.filter(r => 
    r.category === 'schema' || 
    r.message.toLowerCase().includes('schema') ||
    r.path?.some(p => p.toString().toLowerCase().includes('schema'))
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
  if (refIssues.length > 0) improvementTips.push('Fix broken $ref references - agents cannot resolve incomplete schemas');
  if (schemaIssues.length > 0) improvementTips.push('Correct schema definitions - type mismatches confuse AI reasoning');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Foundational Compliance',
    description: 'Structural validity from SwaggerParser, OAS Zod Validator, and Spectral. Agents cannot parse invalid specs.',
    signals,
    details: {
      specificationValidity,
      lintResults,
      resolutionCompleteness,
      structuralIntegrity,
    },
    improvementTips,
    appearCanHelp: errors.length > 0 || schemaIssues.length > 0,
    appearHelpText: 'Appear automatically generates schemas from real API traffic, eliminating documentation drift and schema errors.',
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
  if (nlQuality < 50) improvementTips.push('Use action verbs and business context in descriptions (e.g., "Creates a new customer order")');

  return {
    score,
    grade: scoreToGrade(score),
    label: 'Semantic Richness',
    description: 'Natural language descriptions that help AI agents understand intent, context, and when to use each endpoint.',
    signals,
    details: {
      descriptionCoverage,
      summaryCoverage,
      parameterDescriptions,
      schemaDescriptions,
      naturalLanguageQuality: nlQuality,
    },
    improvementTips,
    appearCanHelp: true,
    appearHelpText: 'Appear enriches specifications with AI-generated descriptions based on actual API usage patterns.',
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
            PAGINATION_PARAMS.includes(p.name.toLowerCase())
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
    signals.push({ type: 'negative', message: 'No operationIds defined - agents cannot identify operations' });
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
    description: 'Features enabling agents to safely orchestrate multi-step workflows: operationIds, idempotency, and predictable patterns.',
    signals,
    details: {
      operationIdCoverage,
      operationIdQuality,
      idempotencyScore,
      errorResponseCoverage,
      paginationCoverage,
    },
    improvementTips,
    appearCanHelp: true,
    appearHelpText: 'Appear automatically generates meaningful operationIds and identifies idempotent endpoints from traffic analysis.',
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
    description: 'Examples, tags, and metadata that help AI agents discover and understand API capabilities without trial and error.',
    signals,
    details: {
      exampleCoverage,
      schemaExamples,
      tagCoverage,
      metadataCompleteness: metadataScore,
    },
    improvementTips,
    appearCanHelp: true,
    appearHelpText: 'Appear captures real request/response examples from production traffic and auto-generates comprehensive examples.',
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
    description: 'Authentication and authorization mechanisms that agents can discover and use programmatically.',
    signals,
    details: {
      securitySchemes: schemeScore,
      securityCoverage: coverageScore,
      httpsSupport: httpsScore,
    },
    improvementTips,
    appearCanHelp: schemeCount === 0,
    appearHelpText: 'Appear detects authentication patterns from traffic and documents security schemes automatically.',
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
    description: 'Structured error responses with codes and retry guidance that enable agents to self-correct and recover from failures.',
    signals,
    details: {
      errorCoverage,
      structuredErrors,
      errorCodeSupport,
      retrySupport,
    },
    improvementTips,
    appearCanHelp: errorCoverage < 80 || structuredErrors < 50,
    appearHelpText: 'Appear captures error responses from real traffic and documents error schemas automatically.',
  };
}

// ============================================================================
// RECOMMENDATIONS & CTA GENERATION
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
      impact: 'Agents cannot interact with invalid specifications. This is a blocking issue.',
      automatable: true,
    });
  }

  // Semantic Richness
  if (dimensions.semanticRichness.score < 70) {
    recommendations.push({
      priority: 'high',
      dimension: 'Semantic Richness',
      title: 'Enrich Descriptions for AI Understanding',
      description: 'Add natural language descriptions to operations, parameters, and schemas. Use action verbs and business context.',
      impact: 'AI agents use descriptions to understand when and how to use each endpoint. Poor descriptions lead to incorrect API calls.',
      automatable: true,
    });
  }

  // Agent Usability
  if (dimensions.agentUsability.score < 70) {
    recommendations.push({
      priority: dimensions.agentUsability.details.operationIdCoverage < 50 ? 'high' : 'medium',
      dimension: 'Agent Usability',
      title: 'Add OperationIds and Improve Naming',
      description: 'Every operation needs a unique operationId using verb-noun format (e.g., getUsers, createOrder).',
      impact: 'Agents convert operationIds to function names. Missing or poor IDs break agent tool calling.',
      automatable: true,
    });
  }

  // AI Discoverability
  if (dimensions.aiDiscoverability.score < 60) {
    recommendations.push({
      priority: 'medium',
      dimension: 'AI Discoverability',
      title: 'Add Examples and Tags',
      description: 'Include request/response examples for all operations and organize endpoints with tags.',
      impact: 'Agents learn from examples faster than schemas. Tags help agents discover related functionality.',
      automatable: true,
    });
  }

  // Security
  if (dimensions.security.score < 80) {
    recommendations.push({
      priority: dimensions.security.score < 40 ? 'high' : 'medium',
      dimension: 'Security',
      title: 'Document Authentication Methods',
      description: 'Define security schemes and apply them consistently. Agents need to know how to authenticate.',
      impact: 'Without documented security, agents cannot make authenticated requests.',
      automatable: true,
    });
  }

  // Error Recoverability
  if (dimensions.errorRecoverability.score < 60) {
    recommendations.push({
      priority: 'medium',
      dimension: 'Error Recoverability',
      title: 'Structure Error Responses',
      description: 'Define error responses with structured schemas including error codes and retry guidance.',
      impact: 'Structured errors enable agents to understand failures and retry intelligently.',
      automatable: true,
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

function generateAppearCTA(overallScore: number, recommendations: Recommendation[]): AppearCTA {
  const automatableCount = recommendations.filter(r => r.automatable).length;
  const hasCritical = recommendations.some(r => r.priority === 'critical');

  // Common secondary action - always offer a demo
  const demoAction = {
    label: 'Book a Demo',
    url: 'https://www.appear.sh/demo?utm_source=validator&utm_campaign=agent-ready',
  };

  if (overallScore >= 80) {
    return {
      headline: 'Keep Your API Agent-Ready',
      subheadline: 'Your API scores well for AI agents. Appear helps maintain this quality by detecting documentation drift in real-time.',
      primaryAction: {
        label: 'Get Started Free',
        url: 'https://app.appear.sh/signup?utm_source=validator&utm_campaign=agent-ready-high',
      },
      secondaryAction: demoAction,
      features: [
        'Real-time schema validation against live traffic',
        'Automatic drift detection and alerts',
        'Continuous AI readiness monitoring',
      ],
    };
  }

  if (hasCritical || overallScore < 40) {
    return {
      headline: 'Automate Your Path to Agent-Ready',
      subheadline: `Your API has ${automatableCount} issues that Appear can fix automatically by analysing your real API traffic.`,
      primaryAction: {
        label: 'Get Started Free',
        url: 'https://app.appear.sh/signup?utm_source=validator&utm_campaign=agent-ready-critical',
      },
      secondaryAction: demoAction,
      features: [
        'Auto-generate accurate schemas from traffic',
        'Capture real request/response examples',
        'Detect and fix documentation drift',
        'AI-powered description enrichment',
      ],
    };
  }

  return {
    headline: 'Make Your API Agent-Ready Faster',
    subheadline: `Appear can automatically resolve ${automatableCount} of your improvement opportunities by learning from real API traffic.`,
    primaryAction: {
      label: 'Get Started Free',
      url: 'https://app.appear.sh/signup?utm_source=validator&utm_campaign=agent-ready',
    },
    secondaryAction: demoAction,
    features: [
      'Generate schemas from live traffic',
      'Auto-document security schemes',
      'Create examples from real requests',
      'Enrich descriptions with AI',
    ],
  };
}

function generateSummary(
  score: number, 
  grade: Grade, 
  level: ReadinessLevel, 
  stats: AgentReadinessScore['stats']
): string {
  const opText = stats.operations === 1 ? 'operation' : 'operations';
  
  if (score >= 80) {
    return `Your API is ${level.toLowerCase()} for AI agents. With ${stats.operations} ${opText} and strong documentation, agents can effectively discover and use your API.`;
  }
  
  if (score >= 60) {
    return `Your API is ${level.toLowerCase()} for AI agents. There are opportunities to improve discoverability and usability for ${stats.operations} ${opText}.`;
  }
  
  if (score >= 40) {
    return `Your API ${level.toLowerCase().replace('needs work', 'needs work')} before AI agents can reliably interact with it. Focus on the critical improvements below.`;
  }
  
  return `Your API is ${level.toLowerCase()} for AI agent consumption. Significant improvements are needed for agents to understand and use your ${stats.operations} ${opText}.`;
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
  version: '1.0.0',
  author: 'Appear',
  description: "Appear's framework for evaluating OpenAPI specifications for AI agent consumption. Based on practical analysis of what causes AI agents to fail when interacting with APIs.",
  rationale: 'AI agents need more than human-readable documentation. They require precise types, complete schemas, unambiguous context, and structured error handling to operate reliably.',
  dimensions: [
    {
      id: 'foundationalCompliance',
      name: 'Foundational Compliance',
      weight: WEIGHTS.foundationalCompliance,
      weightPercent: 25,
      icon: 'shield-check',
      description: 'Structural validity and OpenAPI standards conformance. The baseline for any agent interaction.',
      whyItMatters: 'Agents cannot parse invalid specifications. Broken references and schema errors cause immediate failures.',
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
      description: 'Natural language descriptions that help AI agents understand intent and context.',
      whyItMatters: 'Agents use descriptions to decide when and how to call endpoints. Vague descriptions lead to incorrect API usage.',
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
      description: 'Features enabling agents to safely orchestrate multi-step workflows.',
      whyItMatters: 'Agents convert operationIds to function names and need idempotency guarantees for safe retries.',
      factors: [
        'OperationId coverage and naming quality',
        'Idempotency support for safe retries',
        'Error response coverage',
      ],
    },
    {
      id: 'aiDiscoverability',
      name: 'AI Discoverability',
      weight: WEIGHTS.aiDiscoverability,
      weightPercent: 15,
      icon: 'search',
      description: 'Examples and metadata that help AI agents discover capabilities without trial and error.',
      whyItMatters: 'Agents learn from examples faster than schemas. Tags help agents find related functionality.',
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
      description: 'Authentication mechanisms that agents can discover and use programmatically.',
      whyItMatters: 'Without documented security schemes, agents cannot make authenticated requests.',
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
      description: 'Structured error responses enabling agents to self-correct and recover from failures.',
      whyItMatters: 'Structured errors with codes and retry guidance enable agents to recover intelligently instead of failing.',
      factors: [
        'Error response definition coverage',
        'Structured error schemas',
        'Error code support',
        'Retry guidance fields',
      ],
    },
  ],
  gradeThresholds: {
    A: { min: 90, label: 'Excellent', color: 'emerald' },
    B: { min: 80, label: 'Good', color: 'green' },
    C: { min: 70, label: 'Fair', color: 'yellow' },
    D: { min: 60, label: 'Poor', color: 'orange' },
    F: { min: 0, label: 'Failing', color: 'red' },
  },
  readinessLevels: {
    'Agent Ready': { min: 80, description: 'AI agents can reliably interact with this API' },
    'Partially Ready': { min: 60, description: 'Agents may encounter issues with some operations' },
    'Needs Work': { min: 40, description: 'Significant gaps will cause agent failures' },
    'Not Ready': { min: 0, description: 'Agents cannot reliably use this API' },
  },
  references: [
    { 
      title: 'Why Your API Docs Break for AI Agents', 
      url: 'https://appear.sh/blog/why-your-api-docs-break-for-ai-agents',
      description: 'The reasoning behind this framework'
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
