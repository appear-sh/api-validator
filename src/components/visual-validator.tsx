"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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

export function VisualValidator({ isLoading, results, specContent, error }: VisualValidatorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(["error", "warning", "info"])
  const [enabledValidators, setEnabledValidators] = useState<string[]>([])
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const codeRef = useRef<HTMLDivElement>(null)

  // Set all validators as enabled by default when results load
  useEffect(() => {
    if (results && results.length > 0) {
      const sources = [...new Set(results.map(r => r.source))];
      setEnabledValidators(sources);
    } else {
      setEnabledValidators([]); // Clear if no results
    }
  }, [results])

  const toggleValidator = (validatorSource: string) => {
    setEnabledValidators((prev) =>
      prev.includes(validatorSource) ? prev.filter((source) => source !== validatorSource) : [...prev, validatorSource],
    )
  }

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity],
    )
  }

  const handleCopyResults = () => {
    if (!results) return
    const jsonString = JSON.stringify(results, null, 2)
    navigator.clipboard.writeText(jsonString)
  }

  const handleDownloadResults = () => {
    if (!results) return
    const jsonString = JSON.stringify(results, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "validation-results.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const scrollToLine = (lineNumber: number) => {
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
  }

  const getFilteredIssues = (): ValidationResult[] => {
    if (!results) return []

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
  }

  const getSeverityColor = (severity: string) => {
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
  }

  const getValidatorColor = (validatorSource: string) => {
    const colors: Record<string, string> = {
      Spectral: "bg-purple-600",
      SwaggerParser: "bg-blue-600",
      "OAS Zod Validator": "bg-green-600",
    }
    return colors[validatorSource] || "bg-zinc-500"
  }

  const getValidatorBorderColor = (validatorSource: string) => {
    const colors: Record<string, string> = {
        Spectral: "border-purple-600",
        SwaggerParser: "border-blue-600",
        "OAS Zod Validator": "border-green-600",
      }
    return colors[validatorSource] || "border-zinc-500"
  }

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <LottieLoader />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
        <Card className="border-destructive/40 bg-destructive/10 backdrop-blur-sm">
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

  const filteredIssues = getFilteredIssues()
  const uniqueSources = [...new Set(results.map(r => r.source))];

  return (
    <div className="space-y-6">
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
                  className="bg-background/50 hover:bg-background/80"
                >
                  <Copy className="h-4 w-4" />
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
                  className="bg-background/50 hover:bg-background/80"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download results as JSON</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden bg-background/50 hover:bg-background/80">
                <Filter className="h-4 w-4" />
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
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`mobile-validator-${source}`}
                        checked={enabledValidators.includes(source)}
                        onCheckedChange={() => toggleValidator(source)}
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getValidatorColor(source)}`}></div>
                        <label
                          htmlFor={`mobile-validator-${source}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mobile-severity-error"
                        checked={selectedSeverities.includes("error")}
                        onCheckedChange={() => toggleSeverity("error")}
                      />
                      <label
                        htmlFor="mobile-severity-error"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-400"
                      >
                        Errors
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mobile-severity-warning"
                        checked={selectedSeverities.includes("warning")}
                        onCheckedChange={() => toggleSeverity("warning")}
                      />
                      <label
                        htmlFor="mobile-severity-warning"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-400"
                      >
                        Warnings
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mobile-severity-info"
                        checked={selectedSeverities.includes("info")}
                        onCheckedChange={() => toggleSeverity("info")}
                      />
                      <label
                        htmlFor="mobile-severity-info"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-400"
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
                  <div key={source} className="flex items-center space-x-2">
                    <Checkbox
                      id={`validator-${source}`}
                      checked={enabledValidators.includes(source)}
                      onCheckedChange={() => toggleValidator(source)}
                    />
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getValidatorColor(source)}`}></div>
                      <label
                        htmlFor={`validator-${source}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="severity-error"
                      checked={selectedSeverities.includes("error")}
                      onCheckedChange={() => toggleSeverity("error")}
                    />
                    <label
                      htmlFor="severity-error"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-400"
                    >
                      Errors
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="severity-warning"
                      checked={selectedSeverities.includes("warning")}
                      onCheckedChange={() => toggleSeverity("warning")}
                    />
                    <label
                      htmlFor="severity-warning"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-400"
                    >
                      Warnings
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="severity-info"
                      checked={selectedSeverities.includes("info")}
                      onCheckedChange={() => toggleSeverity("info")}
                    />
                    <label
                      htmlFor="severity-info"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-400"
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
                    <SyntaxHighlighter
                      language="json"
                      style={vscDarkPlus}
                      showLineNumbers={true}
                      wrapLines={true}
                      lineNumberStyle={{ 
                        marginRight: '1.5em', 
                        minWidth: '2em', 
                        paddingLeft: '0.5em', 
                        textAlign: 'left',
                        opacity: 0.6
                      }}
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
                      {specContent || ""}
                    </SyntaxHighlighter>
                  </div>

                  {/* Right gutter - fixed width, will stay in place */}
                  <div className="sticky right-0 w-10 shrink-0 z-10 pt-4 border-l border-border/10">
                    <div className="relative h-full">
                      <TooltipProvider>
                        {filteredIssues
                          .filter((issue) => issue.range?.start?.line !== undefined)
                          .map((issue, index) => {
                            const lineNumber = issue.range!.start.line + 1;
                            return (
                              <IssueMarker
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
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-md border border-border/50 hover:bg-card/50 transition-colors",
                        issue.range?.start?.line !== undefined && "cursor-pointer"
                      )}
                      onClick={
                        issue.range?.start?.line !== undefined
                          ? () => scrollToLine(issue.range!.start.line + 1)
                          : undefined
                      }
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            "mt-1 rounded-full h-2 w-2 flex-shrink-0 border",
                            issue.severity === "error"
                              ? "bg-red-500"
                              : issue.severity === "warning"
                                ? "bg-amber-500"
                                : "bg-zinc-500",
                            getValidatorBorderColor(issue.source),
                          )}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full ${getValidatorColor(
                                issue.source,
                              )} text-white`}
                            >
                              {issue.source}
                            </span>
                            <span className={`text-xs font-medium ${getSeverityColor(issue.severity)} capitalize`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="font-medium mt-1">{issue.message}</p>
                          {issue.path && issue.path.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                              <code className="px-1 py-0.5 bg-background/50 rounded text-xs">{issue.path.join('.')}</code>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
