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

export interface ValidationResult {
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
