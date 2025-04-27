"use client"

import React from "react"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Search, Download, Copy, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { LottieLoader } from "@/components/ui/lottie-loader"
import { toast } from "sonner"

// Define the shared result type (matching page.tsx and backend)
type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
};

// Define component props
interface VisualValidatorProps {
  isLoading: boolean;
  results: ValidationResult[];
  specContent: string;
  error: string | null;
}

// Marker component for validation issues
interface MarkerProps {
  issue: ValidationResult;
  lineNumber: number;
  codeRef: React.RefObject<HTMLDivElement | null> | React.RefObject<HTMLDivElement>;
  scrollToLine: (lineNumber: number) => void;
  getValidatorColor: (source: string) => string;
  getValidatorBorderColor: (source: string) => string;
  getSeverityColor: (severity: string) => string;
}

function IssueMarker({ 
  issue, 
  lineNumber, 
  codeRef, 
  scrollToLine, 
  getValidatorColor, 
  getValidatorBorderColor, 
  getSeverityColor 
}: MarkerProps) {
  const [markerTop, setMarkerTop] = useState<number>(0);
  
  useEffect(() => {
    const updateMarkerPosition = () => {
      if (!codeRef.current) return;
      
      const lineElement = codeRef.current.querySelector(
        `.line-number[data-line-number="${lineNumber}"]`
      ) as HTMLElement | null;
      
      if (lineElement) {
        // Get the actual position of the line element within the scrollable container
        const lineRect = lineElement.getBoundingClientRect();
        const codeRect = codeRef.current.getBoundingClientRect();
        
        // Calculate the vertical position relative to the code container
        // This is the distance from the top of the visible code section to the line
        const relativeTop = lineRect.top - codeRect.top + codeRef.current.scrollTop;
        setMarkerTop(relativeTop);
      }
    };
    
    // Initial position update
    updateMarkerPosition();
    
    // Set up resize observer to handle any size changes
    const resizeObserver = new ResizeObserver(updateMarkerPosition);
    if (codeRef.current) {
      resizeObserver.observe(codeRef.current);
    }
    
    // Add scroll event listener to update marker positions during scrolling
    const scrollElement = codeRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', updateMarkerPosition);
      
      // We also need to handle scroll in the parent ScrollArea component
      const scrollAreaViewport = scrollElement.closest('[data-radix-scroll-area-viewport]');
      if (scrollAreaViewport) {
        scrollAreaViewport.addEventListener('scroll', updateMarkerPosition);
      }
      
      return () => {
        scrollElement.removeEventListener('scroll', updateMarkerPosition);
        if (scrollAreaViewport) {
          scrollAreaViewport.removeEventListener('scroll', updateMarkerPosition);
        }
        resizeObserver.disconnect();
      };
    }
  }, [lineNumber, codeRef]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2",
            "w-3 h-3 rounded-full cursor-pointer transition-all duration-200 hover:scale-125 border-2 pointer-events-auto",
            issue.severity === "error"
              ? "bg-red-500"
              : issue.severity === "warning"
                ? "bg-amber-500"
                : "bg-zinc-500",
            getValidatorBorderColor(issue.source),
          )}
          style={{
            top: markerTop ? markerTop + 5 : 0,
            opacity: markerTop ? 1 : 0, // Hide until positioned correctly
          }}
          onClick={() => scrollToLine(lineNumber)}
        ></div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${getValidatorColor(
                issue.source,
              )} text-white`}
            >
              {issue.source}
            </span>
            <span
              className={`text-xs font-medium ${getSeverityColor(issue.severity)} capitalize`}
            >
              {issue.severity}
            </span>
          </div>
          <p className="font-medium text-sm">{issue.message}</p>
          {issue.path && issue.path.length > 0 && (
            <code className="px-1 py-0.5 bg-muted rounded text-xs block mt-1 opacity-80">
              {issue.path.join('.')}
            </code>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Create a memoized syntax highlighter component to prevent unnecessary re-renders
const MemoizedSyntaxHighlighter = React.memo(
  ({ 
    code, 
    language, 
    highlightedLine, 
    lineNumberStyle 
  }: { 
    code: string; 
    language: string; 
    highlightedLine: number | null;
    lineNumberStyle: React.CSSProperties;
  }) => {
    // Don't even try to render if there's no code
    if (!code) return null;
    
    return (
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        showLineNumbers={true}
        wrapLines={true}
        lineNumberStyle={lineNumberStyle}
        lineProps={(lineNumber: number) => {
          const style: React.CSSProperties = { display: "block", position: "relative" }
          if (lineNumber === highlightedLine) {
            style.backgroundColor = "rgba(161, 161, 170, 0.15)"
            style.borderRadius = "4px"
          }
          return {
            style,
            className: `line-number relative`,
            "data-line-number": lineNumber,
          }
        }}
        customStyle={{
          background: "transparent",
          margin: 0,
          fontSize: "14px",
          paddingTop: '1rem',
          paddingBottom: '1rem',
          paddingLeft: '0',
          minWidth: '100%',
        }}
        codeTagProps={{ style: { display: 'block', width: 'fit-content', minWidth: '100%' } }}
      >
        {code}
      </SyntaxHighlighter>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to avoid unnecessary re-renders
    return (
      prevProps.code === nextProps.code &&
      prevProps.language === nextProps.language &&
      prevProps.highlightedLine === nextProps.highlightedLine
    );
  }
);
MemoizedSyntaxHighlighter.displayName = 'MemoizedSyntaxHighlighter';

// Memoized IssueMarker to prevent unnecessary re-renders
const MemoizedIssueMarker = React.memo(IssueMarker);
MemoizedIssueMarker.displayName = 'MemoizedIssueMarker';

// Add this ItemRenderer component for virtualized rendering of issues
const IssueItem = React.memo(({ 
  issue,
  scrollToLine,
  getValidatorColor,
  getSeverityColor,
}: { 
  issue: ValidationResult,
  scrollToLine: (lineNumber: number) => void,
  getValidatorColor: (source: string) => string,
  getSeverityColor: (severity: string) => string,
}) => (
  <div
    className={cn(
      "p-3 rounded-md cursor-pointer transition-all duration-200 border",
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded-full text-white",
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
      </div>
      <p className="text-sm">
        {issue.message}
      </p>
      {issue.path && issue.path.length > 0 && (
        <code className="px-1 py-0.5 bg-muted rounded text-xs block mt-1 opacity-80">
          {issue.path.join('.')}
        </code>
      )}
      {issue.range?.start?.line !== undefined && (
        <div className="flex justify-end mt-1">
          <button
            className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              scrollToLine(issue.range!.start.line + 1);
            }}
          >
            Go to line {issue.range.start.line + 1}
          </button>
        </div>
      )}
    </div>
  </div>
));
IssueItem.displayName = 'IssueItem';

export function VisualValidator({ isLoading, results, specContent, error }: VisualValidatorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(["error", "warning", "info"])
  const [enabledValidators, setEnabledValidators] = useState<string[]>([])
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
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
            issue.code.toLowerCase().includes(searchQuery.toLowerCase())
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

  const getValidatorBorderColor = useCallback((validatorSource: string) => {
    const colors: Record<string, string> = {
        Spectral: "border-purple-600",
        SwaggerParser: "border-blue-600",
        "OAS Zod Validator": "border-green-600",
      }
    return colors[validatorSource] || "border-zinc-500"
  }, []);

  if (isLoading) {
    return (
      <Card className={cn(
        "border-border/40 bg-card/30 backdrop-blur-sm transition-opacity duration-300",
        isTransitioning && "opacity-0"
      )}>
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <LottieLoader />
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
      "space-y-6 transition-all duration-300", 
      isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
    )}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Validation Results</h2>
          <p className="text-muted-foreground">
            Comparing results for the uploaded spec
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues by message or path..."
            className="pl-8 bg-background/50 border-border/50 focus-visible:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyResults}
                  className="bg-background/50 hover:bg-background/80 transition-all"
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
                  className="bg-background/50 hover:bg-background/80 transition-all"
                >
                  <Download className="h-4 w-4 transition-colors hover:text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download results as JSON</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden bg-background/50 hover:bg-background/80 cursor-pointer transition-colors">
                <Filter className="h-4 w-4 hover:text-primary" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Configure which validators and issue types to display</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold mb-2">Validators</h4>
                  {uniqueSources.map((source) => (
                    <div key={source} className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleValidator(source)}>
                      <Checkbox
                        id={`mobile-validator-${source}`}
                        checked={enabledValidators.includes(source)}
                        onCheckedChange={() => toggleValidator(source)}
                        className="cursor-pointer"
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getValidatorColor(source)}`}></div>
                        <label
                          htmlFor={`mobile-validator-${source}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-primary/90 transition-colors"
                        >
                          {source}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-border/40">
                  <h4 className="text-sm font-semibold mb-2">Severity</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("error")}>
                      <Checkbox
                        id="mobile-severity-error"
                        checked={selectedSeverities.includes("error")}
                        onCheckedChange={() => toggleSeverity("error")}
                        className="cursor-pointer"
                      />
                      <label
                        htmlFor="mobile-severity-error"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-400 cursor-pointer group-hover:text-red-500 transition-colors"
                      >
                        Errors
                      </label>
                    </div>
                    <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("warning")}>
                      <Checkbox
                        id="mobile-severity-warning"
                        checked={selectedSeverities.includes("warning")}
                        onCheckedChange={() => toggleSeverity("warning")}
                        className="cursor-pointer"
                      />
                      <label
                        htmlFor="mobile-severity-warning"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-400 cursor-pointer group-hover:text-amber-500 transition-colors"
                      >
                        Warnings
                      </label>
                    </div>
                    <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("info")}>
                      <Checkbox
                        id="mobile-severity-info"
                        checked={selectedSeverities.includes("info")}
                        onCheckedChange={() => toggleSeverity("info")}
                        className="cursor-pointer"
                      />
                      <label
                        htmlFor="mobile-severity-info"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-400 cursor-pointer group-hover:text-zinc-300 transition-colors"
                      >
                        Info
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="lg:w-1/4 hidden lg:block border-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Validators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                {uniqueSources.map((source) => (
                  <div key={source} className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleValidator(source)}>
                    <Checkbox
                      id={`validator-${source}`}
                      checked={enabledValidators.includes(source)}
                      onCheckedChange={() => toggleValidator(source)}
                      className="cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getValidatorColor(source)}`}></div>
                      <label
                        htmlFor={`validator-${source}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-primary/90 transition-colors"
                      >
                        {source}
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border/40">
                <h4 className="text-sm font-semibold mb-2">Severity</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("error")}>
                    <Checkbox
                      id="severity-error"
                      checked={selectedSeverities.includes("error")}
                      onCheckedChange={() => toggleSeverity("error")}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="severity-error"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-400 cursor-pointer group-hover:text-red-500 transition-colors"
                    >
                      Errors
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("warning")}>
                    <Checkbox
                      id="severity-warning"
                      checked={selectedSeverities.includes("warning")}
                      onCheckedChange={() => toggleSeverity("warning")}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="severity-warning"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-400 cursor-pointer group-hover:text-amber-500 transition-colors"
                    >
                      Warnings
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 group hover:bg-primary/5 rounded p-1 cursor-pointer transition-colors" onClick={() => toggleSeverity("info")}>
                    <Checkbox
                      id="severity-info"
                      checked={selectedSeverities.includes("info")}
                      onCheckedChange={() => toggleSeverity("info")}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="severity-info"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-400 cursor-pointer group-hover:text-zinc-300 transition-colors"
                    >
                      Info
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative lg:max-w-4xl lg:flex-grow lg:flex-shrink">
          <Card className="overflow-hidden border-border/40 bg-card/30 backdrop-blur-sm h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">API Specification</CardTitle>
            </CardHeader>
            <CardContent className="relative p-0">
              <ScrollArea className="h-[600px] w-full">
                <div className="relative flex">
                  {/* Left gutter - for potential future line mapping elements, no background now */}
                  <div className="sticky left-0 w-0 shrink-0 z-10 pt-4">
                    {/* Line mapping content could go here */}
                  </div>

                  {/* Main content area - scrollable */}
                  <div className="flex-grow overflow-x-auto min-w-0" ref={codeRef}>
                    <MemoizedSyntaxHighlighter
                      code={specContent || ""}
                      language="json"
                      highlightedLine={highlightedLine}
                      lineNumberStyle={{ 
                        marginRight: '1.5em', 
                        minWidth: '2em', 
                        paddingLeft: '0.5em', 
                        textAlign: 'left',
                        opacity: 0.6
                      }}
                    />
                  </div>

                  {/* Right gutter - fixed width, will stay in place */}
                  <div className="sticky right-0 w-10 shrink-0 z-10 pt-4 border-l border-border/10">
                    <div className="relative h-full">
                      <TooltipProvider>
                        {!isLoading && filteredIssues
                          .filter((issue) => issue.range?.start?.line !== undefined)
                          .map((issue, index) => {
                            const lineNumber = issue.range!.start.line + 1;
                            return (
                              <MemoizedIssueMarker
                                key={`marker-${index}`}
                                issue={issue}
                                lineNumber={lineNumber}
                                codeRef={codeRef as React.RefObject<HTMLDivElement>}
                                scrollToLine={scrollToLine}
                                getValidatorColor={getValidatorColor}
                                getValidatorBorderColor={getValidatorBorderColor}
                                getSeverityColor={getSeverityColor}
                              />
                            );
                          })}
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:flex-1 border-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Issues ({filteredIssues.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-3">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue, index) => (
                    <IssueItem
                      key={index}
                      issue={issue}
                      scrollToLine={scrollToLine}
                      getValidatorColor={getValidatorColor}
                      getSeverityColor={getSeverityColor}
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
