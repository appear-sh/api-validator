'use client'; // Need this for state and handlers

import { useState } from 'react';
import { UploadArea } from "@/components/upload-area"
import { VisualValidator } from "@/components/visual-validator"
import { Toaster } from "@/components/ui/sonner"

// Re-define the shared result type (or import from a shared types file if preferred)
type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
};

export default function Home() {
  // State for managing validation results and interaction
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [specContent, setSpecContent] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleValidationStart = () => {
    setIsLoading(true);
    setValidationResults([]);
    setSpecContent("");
    setValidationError(null);
  };

  const handleValidationComplete = (
    results: ValidationResult[],
    content: string,
    error?: string
  ) => {
    setValidationResults(results);
    setSpecContent(content);
    setValidationError(error || null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1800px] mx-auto py-8 px-4 w-full">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-zinc-400 to-zinc-200 text-transparent bg-clip-text">
            API Spec Validator
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your API spec and see validation errors directly mapped to your code.
          </p>
        </header>

        <UploadArea
          onValidationStart={handleValidationStart}
          onValidationComplete={handleValidationComplete}
        />

        <VisualValidator
          isLoading={isLoading}
          results={validationResults}
          specContent={specContent}
          error={validationError}
        />
      </div>
      <Toaster richColors closeButton />
    </div>
  )
}
