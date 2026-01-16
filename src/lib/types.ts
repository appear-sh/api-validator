/**
 * Core validation result type used across API routes, workers, and UI components.
 * Represents a single issue from any validator (Spectral, SwaggerParser, OAS Zod).
 */
export interface ValidationResult {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  // Enhanced error properties from OAS Zod Validator v1.8.1+
  errorCode?: string;      // e.g., "ERR_006"
  suggestion?: string;     // Actionable fix suggestion
  specLink?: string;        // Link to OpenAPI spec section
  category?: string;        // e.g., "schema", "format", etc.
}

// Legacy types below (kept for backward compatibility with unused components)

export interface ValidationIssue {
  severity: "error" | "warning" | "info"
  message: string
  path?: string
  suggestion?: string
  line?: number
  column?: number
}

export interface ValidatorResult {
  id: string
  name: string
  score: number
  issues: ValidationIssue[]
}

/** @deprecated Use ValidationResult[] instead */
export interface LegacyValidationResult {
  fileName: string
  overallScore: number
  validators: ValidatorResult[]
  specContent: string
}

export interface ValidationResponse {
  success: boolean
  validatorCount?: number
  error?: string
}
