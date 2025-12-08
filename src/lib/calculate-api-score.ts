import * as yaml from 'js-yaml';
import type { ValidationResult } from '@/lib/types';

// Minimal interface for the parts of the spec we check
interface OpenApiSpecSubset {
  info?: {
    description?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name?: string;
    };
    termsOfService?: string;
  };
  paths?: Record<string, Record<string, { summary?: string; description?: string }>>;
  components?: {
    securitySchemes?: Record<string, unknown>; // Use unknown instead of any
  };
  security?: unknown[]; // Use unknown[] instead of any[]
}

// Define the structure for the output score
interface ApiScore {
  overallScore: number;
  dimensionalScores: {
    structure: number;
    security: number;
    documentation: number;
    consistency: number;
    style: number;
  };
}

// Define category weights (adjust as needed)
const categoryWeights = {
  structure: 0.40,
  security: 0.25,
  documentation: 0.15,
  consistency: 0.10,
  style: 0.10,
};

// Define point deductions per severity (adjust as needed)
const severityDeductions = {
  error: 20,   // Increased penalty for errors
  warning: 5,
  info: 1,
};

// Define rules and their associated category + max penalty cap
// Placeholder - needs population based on actual validator rule codes
const ruleMappings: Record<string, { category: keyof ApiScore['dimensionalScores'], cap: number }> = {
  // Example Structure/Syntax Rules (assuming codes from validators)
  'oas3-schema': { category: 'structure', cap: 1 }, // Severe structural error - cap at 1 instance
  'parser-error': { category: 'structure', cap: 1 }, // Cap parsing errors
  'invalid-ref': { category: 'structure', cap: 3 }, // Allow multiple ref errors, but cap
  // Example Security Rules
  'security-defined-but-not-used': { category: 'security', cap: 1 },
  'no-unsafe-pattern': { category: 'security', cap: 3 },
  // Example Documentation Rules
  'operation-description': { category: 'documentation', cap: 5 }, // Penalize multiple missing descriptions up to a point
  'info-contact': { category: 'documentation', cap: 1 },
  'info-license': { category: 'documentation', cap: 1 },
  'tag-description': { category: 'documentation', cap: 3 },
  // Example Consistency/Style Rules
  'operation-tag-defined': { category: 'style', cap: 1 },
  'path-kebab-case': { category: 'style', cap: 3 },
  'operation-operationId-valid': { category: 'consistency', cap: 3 },
  // --- Add more specific rule mappings here based on your validators --- 
};

/**
 * Calculates an API quality score based on validation results and spec completeness.
 * @param results - Array of validation results from backend validators.
 * @param specContent - The raw OpenAPI spec content (YAML or JSON string).
 * @returns An ApiScore object with overall and dimensional scores.
 */
export function calculateApiScore(
  results: ValidationResult[],
  specContent: string
): ApiScore {
  const dimensionalScores: ApiScore['dimensionalScores'] = {
    structure: 100,
    security: 100,
    documentation: 100,
    consistency: 100,
    style: 100,
  };

  let spec: OpenApiSpecSubset | null = null;
  try {
    spec = yaml.load(specContent) as OpenApiSpecSubset;
    if (typeof spec !== 'object' || spec === null) {
      throw new Error('Parsed content is not an object.');
    }
  } catch (e) {
    console.error("Failed to parse spec content:", e);
    // Major penalty if spec is unparsable
    dimensionalScores.structure = 0;
    results.push({
      source: 'ScoringEngine',
      code: 'parsing-error',
      message: 'Specification content is not valid YAML or JSON.',
      severity: 'error'
    })
  }

  // --- 1. Score based on Validation Results (Errors/Warnings/Info) ---
  const ruleHitCounts: Record<string, number> = {};

  for (const result of results) {
    const mapping = ruleMappings[result.code] || { category: 'style', cap: 5 }; // Default to style/best practice if rule unknown
    const category = mapping.category;
    const cap = mapping.cap;
    const deduction = severityDeductions[result.severity] || 0;

    ruleHitCounts[result.code] = (ruleHitCounts[result.code] || 0) + 1;

    // Apply diminishing returns - only deduct if hit count is below cap
    if (ruleHitCounts[result.code] <= cap && deduction > 0) {
      dimensionalScores[category] = Math.max(0, dimensionalScores[category] - deduction);
    }
  }

  // --- 2. Score based on Documentation & Security Presence (if spec parsed) ---
  if (spec) {
    // Documentation Checks (access becomes type-safe)
    if (!spec.info?.description) dimensionalScores.documentation -= 5;
    if (!spec.info?.contact?.name && !spec.info?.contact?.url && !spec.info?.contact?.email) dimensionalScores.documentation -= 5;
    if (!spec.info?.license?.name) dimensionalScores.documentation -= 5;
    if (!spec.info?.termsOfService) dimensionalScores.documentation -= 3;
    
    let operationsChecked = 0;
    let operationsMissingSummary = 0;
    let operationsMissingDescription = 0;
    if (spec.paths) {
      for (const path in spec.paths) {
        for (const method in spec.paths[path]) {
          operationsChecked++;
          if (!spec.paths[path][method]?.summary) operationsMissingSummary++;
          if (!spec.paths[path][method]?.description) operationsMissingDescription++;
        }
      }
    }
    if (operationsChecked > 0) {
      // Penalize proportionally, but cap the total penalty
      dimensionalScores.documentation -= Math.min(15, Math.round((operationsMissingSummary / operationsChecked) * 30));
      dimensionalScores.documentation -= Math.min(15, Math.round((operationsMissingDescription / operationsChecked) * 30));
    }

    // Security Checks (deduct if missing)
    const hasSecuritySchemes = spec.components?.securitySchemes && Object.keys(spec.components.securitySchemes).length > 0;
    const hasTopLevelSecurity = spec.security && spec.security.length > 0;
    // Basic check: Penalize if schemes defined but no top-level security, or vice-versa (partially), heavy penalty if neither exist.
    if (!hasSecuritySchemes && !hasTopLevelSecurity) {
      dimensionalScores.security -= 40; 
    } else if (!hasTopLevelSecurity) {
      dimensionalScores.security -= 15; // Schemes exist, but aren't applied globally
    } else if (!hasSecuritySchemes) {
      dimensionalScores.security -= 25; // Applied security, but schemes aren't defined?
    }
    // Could add checks for security applied per-operation if top-level is missing

    // Ensure scores don't go below 0 from presence checks
    dimensionalScores.documentation = Math.max(0, dimensionalScores.documentation);
    dimensionalScores.security = Math.max(0, dimensionalScores.security);
  }

  // --- 3. Calculate Overall Score --- 
  let overallScore = 0;
  let totalWeight = 0;
  for (const category in categoryWeights) {
    const key = category as keyof ApiScore['dimensionalScores'];
    overallScore += dimensionalScores[key] * categoryWeights[key];
    totalWeight += categoryWeights[key];
  }
  // Normalize if totalWeight doesn't sum to 1 (though it should here)
  overallScore = totalWeight > 0 ? Math.round(overallScore / totalWeight) : 0;

  return {
    overallScore,
    dimensionalScores,
  };
} 