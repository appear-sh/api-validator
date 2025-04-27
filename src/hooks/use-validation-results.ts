"use client"

import { useState, useEffect } from "react"
import type { ValidationResult } from "@/lib/types"

// This is a mock implementation - in a real app, you'd fetch from an API endpoint
export function useValidationResults() {
  const [results, setResults] = useState<ValidationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading results
    const timer = setTimeout(() => {
      // Mock data for demonstration
      const mockResults: ValidationResult = {
        fileName: "api-spec.json",
        overallScore: 78,
        specContent: "{}", // This would be the actual spec content
        validators: [
          {
            id: "openapi",
            name: "OpenAPI Validator",
            score: 85,
            issues: [
              {
                severity: "warning",
                message: "Operation ID should use camelCase",
                path: "paths./users.get.operationId",
                suggestion: "Change 'GetUsers' to 'getUsers'",
                line: 8,
              },
              {
                severity: "error",
                message: "Required property 'responses' missing",
                path: "paths./users/{id}.put",
                line: 36,
              },
              {
                severity: "info",
                message: "Consider adding a description to this endpoint",
                path: "paths./users.post",
                suggestion: "Add a 'description' field",
                line: 18,
              },
            ],
          },
          {
            id: "spectral",
            name: "Spectral",
            score: 72,
            issues: [
              {
                severity: "error",
                message: "Operation must have at least one response",
                path: "paths./users/{id}.delete",
                line: 42,
              },
              {
                severity: "warning",
                message: "Path parameter 'id' is not defined in parameters list",
                path: "paths./users/{id}",
                line: 25,
              },
              {
                severity: "warning",
                message: "Schema should have a description",
                path: "components.schemas.User",
                line: 50,
              },
              {
                severity: "info",
                message: "Consider using more specific types than 'object'",
                path: "components.schemas.Error.properties.details",
                line: 70,
              },
            ],
          },
          {
            id: "swagger",
            name: "Swagger Validator",
            score: 90,
            issues: [
              {
                severity: "warning",
                message: "Unused schema: 'ErrorResponse'",
                path: "components.schemas.ErrorResponse",
                line: 75,
              },
              {
                severity: "info",
                message: "Consider adding examples to your schema",
                path: "components.schemas.User",
                suggestion: "Add an 'example' field with sample data",
                line: 50,
              },
            ],
          },
          {
            id: "postman",
            name: "Postman API Validator",
            score: 65,
            issues: [
              {
                severity: "error",
                message: "Security scheme 'oauth2' is defined but not used",
                path: "components.securitySchemes.oauth2",
                line: 85,
              },
              {
                severity: "error",
                message: "Response content type is not specified",
                path: "paths./users.get.responses.200",
                line: 12,
              },
              {
                severity: "warning",
                message: "API does not define any servers",
                path: "servers",
                suggestion: "Add a 'servers' array with at least one URL",
                line: 4,
              },
              {
                severity: "warning",
                message: "Path parameter should have a description",
                path: "paths./users/{id}.parameters.0",
                line: 28,
              },
              {
                severity: "info",
                message: "Consider adding a tag to this operation",
                path: "paths./users.post",
                line: 18,
              },
            ],
          },
        ],
      }

      setResults(mockResults)
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  return { results, isLoading }
}
