"use client"

import React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import dynamic from 'next/dynamic'
import { Search, Download, Copy, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LottieLoader } from "@/components/ui/lottie-loader"
import { toast } from "sonner"
import { ScoreDisplay } from "@/components/score-display"
import type { ValidationResult } from '@/lib/types';

// Dynamically import virtualised code viewer to reduce initial bundle
const VirtualisedCodeViewer = dynamic(
  () => import('@/components/virtualised-code-viewer').then(m => m.VirtualisedCodeViewer),
  { ssr: false, loading: () => <div className="h-[600px] bg-zinc-950 animate-pulse rounded-lg" /> }
)

// Define component props
interface VisualValidatorProps {
  isLoading: boolean;
  results: ValidationResult[];
  specContent: string;
  error: string | null;
  score: number;
}

// Issue list item component
const IssueItem = React.memo(({ 
  issue,
  scrollToLine,
  getValidatorColor,
  getSeverityColor,
  onCopyIssue,
}: { 
  issue: ValidationResult,
  scrollToLine: (lineNumber: number) => void,
  getValidatorColor: (source: string) => string,
  getSeverityColor: (severity: string) => string,
  onCopyIssue: (issue: ValidationResult) => void,
}) => (
  <div
    style={{ maxWidth: '100%', width: '100%' }}
    className={cn(
      "relative p-3 rounded-lg cursor-pointer transition-colors duration-200 border box-border",
      issue.code.includes("SUCCESS") 
        ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/30" 
        : issue.severity === "error"
          ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30"
          : issue.severity === "warning"
            ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30"
            : "border-zinc-500/20 bg-zinc-500/5 hover:bg-zinc-500/10 hover:border-zinc-500/30",
    )}
    onClick={() => issue.range?.start?.line !== undefined && scrollToLine(issue.range.start.line + 1)}
  >
    {/* Copy button */}
    <button
      className="absolute top-2 right-2 p-1 rounded hover:bg-background/50 transition-colors z-10"
      onClick={(e) => {
        e.stopPropagation();
        onCopyIssue(issue);
      }}
      aria-label="Copy issue details"
    >
      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
    </button>
    
    {/* Content - use table layout to force width constraint */}
    <div style={{ display: 'table', tableLayout: 'fixed', width: '100%' }}>
      <div style={{ display: 'table-row' }}>
        <div style={{ display: 'table-cell', paddingRight: '1.5rem' }}>
          {/* Header badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium text-white",
                getValidatorColor(issue.source)
              )}
            >
              {issue.source}
            </span>
            <span
              className={cn(
                "text-xs font-medium capitalize",
                issue.code.includes("SUCCESS") ? "text-green-400" : getSeverityColor(issue.severity)
              )}
            >
              {issue.code.includes("SUCCESS") ? "Success" : issue.severity}
            </span>
            {issue.category && (
              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                {issue.category}
              </span>
            )}
          </div>
          
          {/* Message */}
          <p className="text-sm text-foreground/90 leading-relaxed mb-2" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {issue.message}
          </p>
          
          {/* Path */}
          {issue.path && issue.path.length > 0 && (
            <code 
              className="block px-1.5 py-1 bg-muted/50 rounded text-xs text-muted-foreground mb-2 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {issue.path.join('.')}
            </code>
          )}
          
          {/* Suggestion */}
          {issue.suggestion && (
            <div className="p-2 bg-muted/30 rounded border-l-2 border-blue-500/50 mb-2">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Suggestion</p>
              <p className="text-xs text-muted-foreground" style={{ wordBreak: 'break-word' }}>{issue.suggestion}</p>
            </div>
          )}
          
          {/* Footer actions */}
          <div className="flex items-center gap-2">
            {issue.range?.start?.line !== undefined && (
              <button
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToLine(issue.range!.start.line + 1);
                }}
              >
                Go to line {issue.range.start.line + 1}
              </button>
            )}
            {issue.specLink && (
              <a
                href={issue.specLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline ml-auto"
                onClick={(e) => e.stopPropagation()}
              >
                See spec reference
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
));
IssueItem.displayName = 'IssueItem';

export function VisualValidator({ isLoading, results, specContent, error, score }: VisualValidatorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(["error", "warning", "info"])
  const [enabledValidators, setEnabledValidators] = useState<string[]>([])
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(true) // Open by default on first load
  const codeRef = useRef<HTMLDivElement>(null)

  // Add a transition state to handle smooth animation between loading and results
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Set all validators as enabled by default when results load, using a layout effect
  // which runs synchronously before browser paint to reduce flicker
  useEffect(() => {
    if (results && results.length > 0 && !isLoading) {
      const sources = [...new Set(results.map(r => r.source))];
      setEnabledValidators(sources);
    } else if (results.length === 0 && !isLoading) {
      setEnabledValidators([]); // Clear if no results
    }
  }, [results, isLoading])

  // Detect loading state changes to trigger transition effects
  useEffect(() => {
    if (isLoading) {
      // When loading starts, clear transition state
      setIsTransitioning(false);
    } else if (results.length > 0 || error) {
      // When loading finishes and we have results or errors,
      // trigger a brief transition state for smooth UI
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, results.length, error]);

  // Memoize the unique sources to prevent recalculation on every render
  const uniqueSources = useMemo(() => 
    [...new Set(results.map(r => r.source))], 
    [results]
  );

  // Memoize the filtered issues to prevent recomputation on every render
  const filteredIssues = useMemo(() => {
    if (!results) return [];

    return results.filter(issue =>
        enabledValidators.includes(issue.source) &&
        selectedSeverities.includes(issue.severity) &&
        (
            searchQuery === "" ||
            issue.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (issue.path && issue.path.join('.').toLowerCase().includes(searchQuery.toLowerCase())) ||
            issue.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
            issue.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (issue.errorCode && issue.errorCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (issue.suggestion && issue.suggestion.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (issue.category && issue.category.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    );
  }, [results, enabledValidators, selectedSeverities, searchQuery]);

  // Convert state change handlers to useCallback to prevent recreation on each render
  const toggleValidator = useCallback((validatorSource: string) => {
    setEnabledValidators((prev) =>
      prev.includes(validatorSource) ? prev.filter((source) => source !== validatorSource) : [...prev, validatorSource],
    )
  }, []);

  const toggleSeverity = useCallback((severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    )
  }, []);

  const handleCopyResults = useCallback(() => {
    try {
      if (!results || results.length === 0) {
        toast.error("No results to copy");
        return;
      }
      
      // Copy either filtered results (if any are shown) or all results
      const dataToExport = filteredIssues.length > 0 ? filteredIssues : results;
      const jsonString = JSON.stringify(dataToExport, null, 2);
      
      navigator.clipboard.writeText(jsonString)
        .then(() => {
          toast.success("Results copied to clipboard");
        })
        .catch((err) => {
          console.error("Copy failed:", err);
          toast.error("Failed to copy: " + (err.message || "Unknown error"));
        });
    } catch (err) {
      console.error("Copy error:", err);
      toast.error("Copy failed. See console for details.");
    }
  }, [results, filteredIssues]);

  const handleDownloadResults = useCallback(() => {
    try {
      if (!results || results.length === 0) {
        toast.error("No results to download");
        return;
      }
      
      // Download either filtered results (if any are shown) or all results
      const dataToExport = filteredIssues.length > 0 ? filteredIssues : results;
      const jsonString = JSON.stringify(dataToExport, null, 2);
      
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "validation-results.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Results downloaded");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Download failed. See console for details.");
    }
  }, [results, filteredIssues]);

  const handleCopyIssue = useCallback((issue: ValidationResult) => {
    try {
      const issueJson = JSON.stringify(issue, null, 2);
      navigator.clipboard.writeText(issueJson)
        .then(() => {
          toast.success("Issue details copied to clipboard");
        })
        .catch((err) => {
          console.error("Copy failed:", err);
          toast.error("Failed to copy: " + (err.message || "Unknown error"));
        });
    } catch (err) {
      console.error("Copy error:", err);
      toast.error("Copy failed. See console for details.");
    }
  }, []);

  const scrollToLine = useCallback((lineNumber: number) => {
    console.log(`Attempting to scroll to line: ${lineNumber}`);
    setHighlightedLine(lineNumber)

    if (codeRef.current) {
      console.log('codeRef.current exists:', codeRef.current);
      const lineElements = codeRef.current.querySelectorAll('[data-line-number]');
      console.log(`Found ${lineElements.length} elements with data-line-number`);

      const lineElement = Array.from(lineElements).find(
        (el) => el.getAttribute("data-line-number") === String(lineNumber)
      );

      if (lineElement) {
        console.log(`Found line element for ${lineNumber}:`, lineElement);
        console.log('Scrolling element into view...');
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" })
      } else {
        console.warn(`Could not find line element for line number: ${lineNumber}`);
      }
    } else {
      console.warn('codeRef.current is null or undefined when trying to scroll.');
    }
  }, []);

  // Memoize utility functions
  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case "error":
        return "text-red-400"
      case "warning":
        return "text-amber-400"
      case "info":
        return "text-zinc-400"
      default:
        return "text-muted-foreground"
    }
  }, []);

  const getValidatorColor = useCallback((validatorSource: string) => {
    const colors: Record<string, string> = {
      Spectral: "bg-purple-600",
      SwaggerParser: "bg-blue-600",
      "OAS Zod Validator": "bg-green-600",
    }
    return colors[validatorSource] || "bg-zinc-500"
  }, []);

  if (isLoading) {
    return (
      <Card className={cn(
        "border-border/40 bg-card/30 backdrop-blur-sm transition-opacity duration-300",
        isTransitioning && "opacity-0"
      )}>
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <LottieLoader height={160} width={160} />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn(
        "border-destructive/40 bg-destructive/10 backdrop-blur-sm transition-all duration-300", 
        isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      )}>
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <div className="text-center max-w-md text-destructive">
            <h3 className="text-lg font-medium mb-2">Validation Error</h3>
            <p className="mb-4">
              An error occurred during validation:
            </p>
            <pre className="text-sm bg-destructive/10 p-2 rounded text-left whitespace-pre-wrap">
              <code>{error}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (results.length === 0 && !specContent) {
    return (
      <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-medium mb-2">No validation results yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload an API spec to see how different validators interpret and validate it.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn(
      "space-y-6 transition-all duration-300 max-w-[1800px] mx-auto", 
      isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
    )}>
      {/* Wrap header section */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Technical Validation</h2>
            <p className="text-muted-foreground">
              Structural validity checks that impact agent readiness
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Parsing errors and schema issues directly affect the <span className="text-primary">Foundational Compliance</span> dimension of your Agent-Ready Score.
            </p>
          </div>
          <div className="shrink-0">
            <ScoreDisplay score={score} />
          </div>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col gap-3">
          {/* Search row */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues by message or path..."
                className="pl-8 bg-background/50 border-border/50 focus-visible:border-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyResults}
                    className="bg-background/50 hover:bg-background/80 transition-all cursor-pointer"
                  >
                    <Copy className="h-4 w-4 transition-colors hover:text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy results to clipboard</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownloadResults}
                    className="bg-background/50 hover:bg-background/80 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4 transition-colors hover:text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download results as JSON</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersExpanded(v => !v)}
              className="gap-2 bg-background/50 hover:bg-background/80 hover:text-primary transition-all"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {(enabledValidators.length < uniqueSources.length || selectedSeverities.length < 3) && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </Button>
          </div>

          {/* Collapsible filter row */}
          {filtersExpanded && (
            <Card className="border-border/40 bg-card/30 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-6 items-start">
                  {/* Validators */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validators</h4>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSources.map((source) => (
                        <button
                          key={source}
                          onClick={() => toggleValidator(source)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer border",
                            enabledValidators.includes(source)
                              ? "bg-background/80 border-border"
                              : "bg-transparent border-transparent opacity-50 hover:opacity-80"
                          )}
                        >
                          <div className={cn("w-2.5 h-2.5 rounded-full", getValidatorColor(source))} />
                          <span>{source}</span>
                          {enabledValidators.includes(source) && (
                            <span className="text-xs text-muted-foreground">
                              ({results.filter(r => r.source === source).length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="w-px h-12 bg-border/40 hidden sm:block" />

                  {/* Severity */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleSeverity("error")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer border",
                          selectedSeverities.includes("error")
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-transparent border-transparent opacity-50 hover:opacity-80"
                        )}
                      >
                        <span>Errors</span>
                        <span className="text-xs opacity-70">
                          ({results.filter(r => r.severity === 'error' && !r.code.includes('SUCCESS')).length})
                        </span>
                      </button>
                      <button
                        onClick={() => toggleSeverity("warning")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer border",
                          selectedSeverities.includes("warning")
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-transparent border-transparent opacity-50 hover:opacity-80"
                        )}
                      >
                        <span>Warnings</span>
                        <span className="text-xs opacity-70">
                          ({results.filter(r => r.severity === 'warning').length})
                        </span>
                      </button>
                      <button
                        onClick={() => toggleSeverity("info")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all cursor-pointer border",
                          selectedSeverities.includes("info")
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            : "bg-transparent border-transparent opacity-50 hover:opacity-80"
                        )}
                      >
                        <span>Info</span>
                        <span className="text-xs opacity-70">
                          ({results.filter(r => r.severity === 'info').length})
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Close button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltersExpanded(false)}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Results grid - two column layout for more space */}
      <div className="flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto px-4 overflow-hidden">
        <div className="relative lg:w-[55%] min-w-0">
          <Card className="overflow-hidden border-border/40 bg-card/30 backdrop-blur-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>API Specification</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {specContent.split('\n').length.toLocaleString()} lines
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative p-0">
              {/* Virtualised code viewer with built-in minimap and error gutter */}
              <div className="h-[1000px]" ref={codeRef}>
                <VirtualisedCodeViewer
                  content={specContent || ""}
                  issues={filteredIssues}
                  highlightedLine={highlightedLine}
                  onLineClick={scrollToLine}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:w-[45%] min-w-0 border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Issues ({filteredIssues.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[1000px]">
              <div className="p-3 space-y-2">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue, index) => (
                    <IssueItem
                      key={index}
                      issue={issue}
                      scrollToLine={scrollToLine}
                      getValidatorColor={getValidatorColor}
                      getSeverityColor={getSeverityColor}
                      onCopyIssue={handleCopyIssue}
                    />
                  ))
                ) : (
                  <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No issues found matching your filters
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
