'use client'; // Need this for state and handlers

import { useState, useTransition } from 'react';
import { UploadArea } from "@/components/upload-area"
import { VisualValidator } from "@/components/visual-validator"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"

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
  
  // Use React 18's useTransition to keep UI responsive during complex updates
  const [isPending, startTransition] = useTransition();

  // Add score state if needed, or calculate it based on results
  const [apiScore, setApiScore] = useState<number>(0); // Placeholder state

  const handleValidationStart = () => {
    setIsLoading(true);
    setValidationResults([]);
    setSpecContent("");
    setValidationError(null);
    setApiScore(0); // Reset score
  };

  const handleValidationComplete = (
    results: ValidationResult[],
    content: string,
    error?: string
  ) => {
    setSpecContent(content);
    
    startTransition(() => {
      setValidationResults(results);
      setValidationError(error || null);
      
      // Placeholder: Calculate score based on results
      // Example: Simple calculation based on number of errors
      const errorCount = results.filter(r => r.severity === 'error').length;
      const calculatedScore = Math.max(0, 100 - (errorCount * 10)); // Simple example
      setApiScore(calculatedScore); 

      setIsLoading(false);
    });
  };

  // Combine loading state with transition state
  const showLoading = isLoading || isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-[1800px] mx-auto py-8 px-4 w-full">
        <header className="mb-8 text-center max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-zinc-100 to-zinc-50 text-transparent bg-clip-text">
            API Validator
          </h1>
          <p className="text-md text-muted-foreground max-w-3xl mx-auto">
            Upload your OpenAPI 3.x spec to see validation & linting errors directly mapped to your code.
          </p>
        </header>

        {/* Wrap UploadArea to apply max-width */}
        <div className="max-w-6xl mx-auto mb-8">
          <UploadArea
            onValidationStart={handleValidationStart}
            onValidationComplete={handleValidationComplete}
            isLoading={showLoading}
          />
        </div>

        <VisualValidator
          isLoading={showLoading}
          results={validationResults}
          specContent={specContent}
          error={validationError}
          score={apiScore}
        />
      </div>
      <Toaster richColors closeButton />
    </div>
  )
}
