'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { UploadArea } from "@/components/upload-area"
import { VisualValidator } from "@/components/visual-validator"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"
import type { ValidationResult } from '@/lib/types';

export default function Home() {
  // State for managing validation results and interaction
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [specContent, setSpecContent] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Use React 18's useTransition to keep UI responsive during complex updates
  const [isPending] = useTransition();

  // Keep score state
  const [apiScore, setApiScore] = useState<number>(0);

  const handleValidationStart = () => {
    setIsLoading(true);
    setValidationResults([]);
    setSpecContent("");
    setValidationError(null);
    setApiScore(0); // Reset score
  };

  // Lazy init worker once
  const scoreWorkerRef = useRef<Worker | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!scoreWorkerRef.current) {
      // Dynamic import with new Worker via URL to ensure bundler handles it
      const worker = new Worker(new URL('@/workers/score.worker.ts', import.meta.url), { type: 'module' });
      scoreWorkerRef.current = worker;
    }
    return () => {
      scoreWorkerRef.current?.terminate();
      scoreWorkerRef.current = null;
    }
  }, []);

  const handleValidationComplete = (
    results: ValidationResult[],
    content: string,
    error?: string
  ) => {
    // Apply minimal state first to unblock UI
    setSpecContent(content);
    setValidationResults(results);
    setValidationError(error || null);

    // End loading immediately so animations don't freeze
    setIsLoading(false);

    // Offload scoring to worker if we have content and no fatal error
    if (content && !error && scoreWorkerRef.current) {
      const worker = scoreWorkerRef.current;
      const onMessage = (evt: MessageEvent) => {
        const data = evt.data as { type: string; overallScore?: number; error?: string }
        if (!data || (data.type !== 'score-response' && data.type !== 'score-error')) return;
        if (data.type === 'score-response' && typeof data.overallScore === 'number') {
          setApiScore(data.overallScore);
        } else if (data.type === 'score-error' && data.error) {
          setValidationError((prev) => prev ? `${prev}\nScore calculation failed: ${data.error}` : `Score calculation failed: ${data.error}`);
          setApiScore(0);
        }
        worker.removeEventListener('message', onMessage);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'score-request', results, specContent: content });
    } else {
      // No content or error: default score
      setApiScore(0);
    }
  };

  // Combine loading state with transition state
  const showLoading = isLoading || isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-[1800px] mx-auto py-8 px-4 w-full">
        <header className="mb-8 text-center max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-zinc-100 to-zinc-50 text-transparent bg-clip-text">
            OSS API Validator
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
