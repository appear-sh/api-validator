'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { UploadArea } from "@/components/upload-area"
import { VisualValidator } from "@/components/visual-validator"
import { AgentReadinessDisplay } from "@/components/agent-readiness-display"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ValidationResult, AgentReadinessScore } from '@/lib/types';

export default function Home() {
  // State for managing validation results and interaction
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [specContent, setSpecContent] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Use React 18's useTransition to keep UI responsive during complex updates
  const [isPending] = useTransition();

  // Agent readiness score state
  const [agentReadinessScore, setAgentReadinessScore] = useState<AgentReadinessScore | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>("readiness");

  const handleValidationStart = () => {
    setIsLoading(true);
    setValidationResults([]);
    setSpecContent("");
    setValidationError(null);
    setAgentReadinessScore(null);
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
        const data = evt.data as { type: string; score?: AgentReadinessScore; error?: string }
        if (!data || (data.type !== 'score-response' && data.type !== 'score-error')) return;
        if (data.type === 'score-response' && data.score) {
          setAgentReadinessScore(data.score);
        } else if (data.type === 'score-error' && data.error) {
          setValidationError((prev) => prev ? `${prev}\nScore calculation failed: ${data.error}` : `Score calculation failed: ${data.error}`);
          setAgentReadinessScore(null);
        }
        worker.removeEventListener('message', onMessage);
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'score-request', results, specContent: content });
    } else {
      setAgentReadinessScore(null);
    }
  };

  // Combine loading state with transition state
  const showLoading = isLoading || isPending;

  const hasResults = validationResults.length > 0 || specContent || validationError;

  return (
    <div className="min-h-screen text-foreground">
      <Header />
      <div className="max-w-[1800px] mx-auto py-8 px-4 w-full">
        <header className="mb-8 text-center max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-zinc-100 to-zinc-50 text-transparent bg-clip-text">
            Get Your Agent-Ready Score
          </h1>
          <p className="text-md text-muted-foreground max-w-3xl mx-auto">
            Measure how ready your OpenAPI specification is for AI agent consumption. 
            Get actionable insights to make your API discoverable, usable, and reliable for autonomous systems. Powered by <a href="https://appear.sh" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">Appear</a>.
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

        {/* Results Tabs */}
        {hasResults && (
          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
                <TabsTrigger value="readiness" className="text-sm">
                  Readiness Score
                  {agentReadinessScore && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-primary/20">
                      {agentReadinessScore.overallScore}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="validation" className="text-sm">
                  Technical Validation
                  {validationResults.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-muted">
                      {validationResults.filter(r => r.severity === 'error' && !r.code.includes('SUCCESS')).length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="readiness" className="mt-0">
                <AgentReadinessDisplay 
                  score={agentReadinessScore} 
                  isLoading={showLoading && !agentReadinessScore}
                  validationResults={validationResults}
                />
              </TabsContent>

              <TabsContent value="validation" className="mt-0">
                <VisualValidator
                  isLoading={showLoading}
                  results={validationResults}
                  specContent={specContent}
                  error={validationError}
                  score={agentReadinessScore?.overallScore ?? 0}
                  onNavigateToReadiness={() => setActiveTab("readiness")}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Loading state - validation in progress, no results yet */}
        {!hasResults && showLoading && (
          <div className="max-w-6xl mx-auto">
            <AgentReadinessDisplay 
              score={null} 
              isLoading={true}
              validationResults={[]}
            />
          </div>
        )}

        {/* Initial state - no results yet */}
        {!hasResults && !showLoading && (
          <div className="max-w-6xl mx-auto">
            <VisualValidator
              isLoading={showLoading}
              results={validationResults}
              specContent={specContent}
              error={validationError}
              score={0}
            />
          </div>
        )}
      </div>
      <Toaster richColors closeButton />
    </div>
  )
}
