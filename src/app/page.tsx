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
    // First, update the content immediately - it's less complex
    setSpecContent(content);
    
    // Then, use startTransition to handle the more complex validation results
    // This ensures the spinner continues to animate while React prepares the results
    startTransition(() => {
      setValidationResults(results);
      setValidationError(error || null);
      // Only stop loading after the transition is complete
      setIsLoading(false);
    });
  };

  // Combine loading state with transition state
  const showLoading = isLoading || isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
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
          isLoading={showLoading}
        />

        <VisualValidator
          isLoading={showLoading}
          results={validationResults}
          specContent={specContent}
          error={validationError}
        />
      </div>
      <Toaster richColors closeButton />
    </div>
  )
}
