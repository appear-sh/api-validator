"use client"

import React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import dynamic from 'next/dynamic'
import { Search, Download, Copy, Filter, PanelRightClose, PanelRightOpen, ChevronDown, ChevronRight, EyeOff, Eye } from "lucide-react"
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
  onNavigateToReadiness?: () => void;
}

// Generate unique key for an issue
const getIssueKey = (issue: ValidationResult): string => {
  return `${issue.source}|${issue.code}|${issue.message}|${JSON.stringify(issue.path ?? [])}`;
};

// Utility to escape regex special characters
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Find line number from JSON/YAML path when range is not available
const findLineFromPath = (content: string, path: string[]): number | null => {
  if (!path || path.length === 0 || !content) return null;
  
  const lines = content.split('\n');
  
  // Search from the deepest path segment backwards
  for (let depth = path.length; depth > 0; depth--) {
    const lastSegment = path[depth - 1];
    
    // Create search patterns
    const jsonPattern = new RegExp(`"${escapeRegex(lastSegment)}"\\s*:`);
    const yamlPattern = new RegExp(`^\\s*${escapeRegex(lastSegment)}\\s*:`, 'm');
    
    for (let i = 0; i < lines.length; i++) {
      if (jsonPattern.test(lines[i]) || yamlPattern.test(lines[i])) {
        return i + 1; // 1-indexed
      }
    }
  }
  
  return null;
};

// Get line number for an issue (from range or derived from path)
const getIssueLine = (issue: ValidationResult, specContent: string): number | null => {
  if (issue.range?.start?.line !== undefined) {
    return issue.range.start.line + 1; // Convert 0-indexed to 1-indexed
  }
  if (issue.path && issue.path.length > 0) {
    return findLineFromPath(specContent, issue.path);
  }
  return null;
};

// Issue list item component
const IssueItem = React.memo(({ 
  issue,
  scrollToLine,
  getValidatorColor,
  getSeverityColor,
  onCopyIssue,
  onHide,
  isHidden,
  specContent,
}: { 
  issue: ValidationResult,
  scrollToLine: (lineNumber: number) => void,
  getValidatorColor: (source: string) => string,
  getSeverityColor: (severity: string) => string,
  onCopyIssue: (issue: ValidationResult) => void,
  onHide?: (key: string) => void,
  isHidden?: boolean,
  specContent?: string,
}) => {
  // Get line number (from range or derived from path)
  const lineNumber = specContent ? getIssueLine(issue, specContent) : 
    (issue.range?.start?.line !== undefined ? issue.range.start.line + 1 : null);
  const isDerivedLine = lineNumber !== null && issue.range?.start?.line === undefined;
  
  return (
  <div
    style={{ maxWidth: '100%', width: '100%' }}
    className={cn(
      "relative p-3 rounded-lg transition-colors duration-200 border box-border",
      lineNumber !== null && "cursor-pointer",
      issue.code.includes("SUCCESS") 
        ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/30" 
        : issue.severity === "error"
          ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30"
          : issue.severity === "warning"
            ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30"
            : "border-zinc-500/20 bg-zinc-500/5 hover:bg-zinc-500/10 hover:border-zinc-500/30",
    )}
    onClick={() => lineNumber !== null && scrollToLine(lineNumber)}
  >
    {/* Action buttons */}
    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
      {onHide && (
        <button
          className="p-1 rounded hover:bg-background/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onHide(getIssueKey(issue));
          }}
          aria-label={isHidden ? "Unhide issue" : "Hide issue"}
          title={isHidden ? "Unhide" : "Hide"}
        >
          {isHidden ? (
            <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          )}
        </button>
      )}
      <button
        className="p-1 rounded hover:bg-background/50 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onCopyIssue(issue);
        }}
        aria-label="Copy issue details"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
    
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
            {lineNumber !== null && (
              <button
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToLine(lineNumber);
                }}
              >
                Go to line {lineNumber}{isDerivedLine && ' (approx)'}
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
)});
IssueItem.displayName = 'IssueItem';

// Grouped issue component for collapsing similar errors
interface IssueGroup {
  key: string;
  source: string;
  code: string;
  message: string;
  severity: string;
  issues: ValidationResult[];
}

const IssueGroupItem = React.memo(({ 
  group,
  scrollToLine,
  getValidatorColor,
  getSeverityColor,
  onCopyIssue,
  onHideGroup,
  isHidden,
  specContent,
}: { 
  group: IssueGroup,
  scrollToLine: (lineNumber: number) => void,
  getValidatorColor: (source: string) => string,
  getSeverityColor: (severity: string) => string,
  onCopyIssue: (issue: ValidationResult) => void,
  onHideGroup?: (groupKey: string) => void,
  isHidden?: boolean,
  specContent?: string,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSuccess = group.code.includes("SUCCESS");
  
  // If only one issue in group, render it directly without grouping UI
  if (group.issues.length === 1) {
    return (
      <IssueItem
        issue={group.issues[0]}
        scrollToLine={scrollToLine}
        getValidatorColor={getValidatorColor}
        getSeverityColor={getSeverityColor}
        onCopyIssue={onCopyIssue}
        onHide={onHideGroup ? () => onHideGroup(group.key) : undefined}
        isHidden={isHidden}
        specContent={specContent}
      />
    );
  }
  
  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className="relative">
        {/* Hide button for group */}
        {onHideGroup && (
          <button
            className="absolute top-2 right-2 p-1 rounded hover:bg-background/50 transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              onHideGroup(group.key);
            }}
            aria-label={isHidden ? "Unhide group" : "Hide group"}
            title={isHidden ? "Unhide" : "Hide"}
          >
            {isHidden ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full text-left p-3 pr-10 rounded-lg transition-colors duration-200 border",
            isSuccess 
              ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/30" 
              : group.severity === "error"
                ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30"
                : group.severity === "warning"
                  ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30"
                  : "border-zinc-500/20 bg-zinc-500/5 hover:bg-zinc-500/10 hover:border-zinc-500/30",
          )}
        >
          <div className="flex items-start gap-2">
            {/* Expand/collapse icon */}
            <div className="mt-0.5 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Header badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium text-white",
                    getValidatorColor(group.source)
                  )}
                >
                  {group.source}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    isSuccess ? "text-green-400" : getSeverityColor(group.severity)
                  )}
                >
                  {isSuccess ? "Success" : group.severity}
                </span>
                {/* Occurrence count badge */}
                <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary font-medium">
                  {group.issues.length} occurrences
                </span>
              </div>
              
              {/* Message */}
              <p className="text-sm text-foreground/90 leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {group.message}
              </p>
              
              {/* Collapsed hint */}
            {!isExpanded && (
              <p className="text-xs text-muted-foreground mt-2">
                Click to expand and see all {group.issues.length} affected paths
              </p>
            )}
          </div>
        </div>
        </button>
      </div>
      
      {/* Expanded issues */}
      {isExpanded && (
        <div className="pl-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {group.issues.map((issue, index) => (
            <IssueItem
              key={index}
              issue={issue}
              scrollToLine={scrollToLine}
              getValidatorColor={getValidatorColor}
              getSeverityColor={getSeverityColor}
              onCopyIssue={onCopyIssue}
              specContent={specContent}
            />
          ))}
        </div>
      )}
    </div>
  );
});
IssueGroupItem.displayName = 'IssueGroupItem';

export function VisualValidator({ isLoading, results, specContent, error, score, onNavigateToReadiness }: VisualValidatorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(["error", "warning", "info"])
  const [enabledValidators, setEnabledValidators] = useState<string[]>([])
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(true) // Open by default on first load
  const [issuesPanelCollapsed, setIssuesPanelCollapsed] = useState(false)
  const [hiddenGroupKeys, setHiddenGroupKeys] = useState<Set<string>>(new Set())
  const [showHiddenIssues, setShowHiddenIssues] = useState(false)
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

  // Group filtered issues by source + code + message for collapsible display
  const { visibleGroups, hiddenGroups } = useMemo(() => {
    if (!filteredIssues || filteredIssues.length === 0) {
      return { visibleGroups: [], hiddenGroups: [] };
    }
    
    const groupMap = new Map<string, IssueGroup>();
    
    for (const issue of filteredIssues) {
      // Create group key from source + code + message
      const key = `${issue.source}|${issue.code}|${issue.message}`;
      
      if (groupMap.has(key)) {
        groupMap.get(key)!.issues.push(issue);
      } else {
        groupMap.set(key, {
          key,
          source: issue.source,
          code: issue.code,
          message: issue.message,
          severity: issue.severity,
          issues: [issue],
        });
      }
    }
    
    // Convert to array and sort by severity (errors first), then by count (larger groups first)
    const sorted = Array.from(groupMap.values()).sort((a, b) => {
      // Severity order: error > warning > info
      const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
      const severityDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      if (severityDiff !== 0) return severityDiff;
      // Then by count (descending)
      return b.issues.length - a.issues.length;
    });
    
    // Split into visible and hidden
    const visible = sorted.filter(g => !hiddenGroupKeys.has(g.key));
    const hidden = sorted.filter(g => hiddenGroupKeys.has(g.key));
    
    return { visibleGroups: visible, hiddenGroups: hidden };
  }, [filteredIssues, hiddenGroupKeys]);
  
  // For backwards compatibility - use visibleGroups as the default
  const groupedIssues = visibleGroups;
  
  // Issues to show in the code viewer (excludes hidden)
  const visibleIssuesForViewer = useMemo(() => {
    return filteredIssues.filter(issue => {
      const key = `${issue.source}|${issue.code}|${issue.message}`;
      return !hiddenGroupKeys.has(key);
    });
  }, [filteredIssues, hiddenGroupKeys]);

  // Convert state change handlers to useCallback to prevent recreation on each render
  const toggleValidator = useCallback((validatorSource: string) => {
    setEnabledValidators((prev) =>
      prev.includes(validatorSource) ? prev.filter((source) => source !== validatorSource) : [...prev, validatorSource],
    )
  }, []);

  // Toggle group visibility (hide/unhide)
  const toggleGroupHidden = useCallback((groupKey: string) => {
    setHiddenGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
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
            <ScoreDisplay score={score} onClick={onNavigateToReadiness} />
          </div>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="max-w-6xl mx-auto px-4">
        <div className={cn(
          "border border-border/40 bg-card/30 backdrop-blur-sm rounded-lg transition-all duration-200",
          filtersExpanded && "rounded-b-lg"
        )}>
          {/* Search row */}
          <div className="flex gap-2 items-center p-3">
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
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyResults}
                    className="hover:bg-background/50 transition-all cursor-pointer"
                  >
                    <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
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
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadResults}
                    className="hover:bg-background/50 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download results as JSON</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="w-px h-6 bg-border/40" />

            <button
              onClick={() => setFiltersExpanded(v => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer",
                filtersExpanded 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-background/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {(enabledValidators.length < uniqueSources.length || selectedSeverities.length < 3) && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                filtersExpanded && "rotate-180"
              )} />
            </button>
          </div>

          {/* Collapsible filter panel - accordion style */}
          <div className={cn(
            "overflow-hidden transition-all duration-200",
            filtersExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
          )}>
            <div className="px-3 pb-3 pt-0 border-t border-border/30">
              <div className="flex flex-wrap gap-6 items-start pt-3">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results grid - two column layout with collapsible issues panel */}
      <div className="flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto px-4 overflow-hidden">
        {/* Code viewer - expands when issues panel is collapsed */}
        <div className={cn(
          "relative min-w-0 transition-all duration-300",
          issuesPanelCollapsed ? "lg:w-[calc(100%-60px)]" : "lg:w-[55%]"
        )}>
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
                  issues={visibleIssuesForViewer}
                  highlightedLine={highlightedLine}
                  onLineClick={scrollToLine}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues panel - collapsible */}
        <div className={cn(
          "min-w-0 transition-all duration-300",
          issuesPanelCollapsed ? "lg:w-[60px]" : "lg:w-[45%]"
        )}>
          <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden h-full">
            {issuesPanelCollapsed ? (
              /* Collapsed state - thin strip */
              <div className="h-[1000px] flex flex-col items-center py-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIssuesPanelCollapsed(false)}
                        className="mb-4 hover:bg-background/50"
                      >
                        <PanelRightOpen className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Expand issues panel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Rotated label with count */}
                <div className="flex-1 flex items-center justify-center">
                  <span 
                    className="text-sm font-medium text-muted-foreground whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    Issues ({visibleIssuesForViewer.length}{hiddenGroups.length > 0 ? ` • ${hiddenGroups.reduce((a, g) => a + g.issues.length, 0)} hidden` : ''})
                  </span>
                </div>
                
                {/* Error/warning count indicators */}
                <div className="flex flex-col gap-2 mt-4">
                  {results.filter(r => r.severity === 'error').length > 0 && (
                    <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                      <span className="text-[10px] text-red-400 font-medium">
                        {results.filter(r => r.severity === 'error').length}
                      </span>
                    </div>
                  )}
                  {results.filter(r => r.severity === 'warning').length > 0 && (
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                      <span className="text-[10px] text-amber-400 font-medium">
                        {results.filter(r => r.severity === 'warning').length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Expanded state - full issues list */
              <>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>
                      Issues ({visibleIssuesForViewer.length})
                      {visibleGroups.length !== visibleIssuesForViewer.length && (
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                          {visibleGroups.length} groups
                        </span>
                      )}
                      {hiddenGroups.length > 0 && (
                        <span className="text-xs text-muted-foreground/60 font-normal ml-2">
                          • {hiddenGroups.reduce((a, g) => a + g.issues.length, 0)} hidden
                        </span>
                      )}
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIssuesPanelCollapsed(true)}
                            className="h-8 w-8 hover:bg-background/50"
                          >
                            <PanelRightClose className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Collapse issues panel</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[1000px]">
                    <div className="p-3 space-y-2">
                      {groupedIssues.length > 0 ? (
                        groupedIssues.map((group) => (
                          <IssueGroupItem
                            key={group.key}
                            group={group}
                            scrollToLine={scrollToLine}
                            getValidatorColor={getValidatorColor}
                            getSeverityColor={getSeverityColor}
                            onCopyIssue={handleCopyIssue}
                            onHideGroup={toggleGroupHidden}
                            isHidden={false}
                            specContent={specContent}
                          />
                        ))
                      ) : hiddenGroups.length === 0 ? (
                        <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                          No issues found matching your filters
                        </div>
                      ) : null}
                      
                      {/* Hidden issues section */}
                      {hiddenGroups.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/40">
                          <button
                            onClick={() => setShowHiddenIssues(v => !v)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                          >
                            {showHiddenIssues ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Eye className="h-4 w-4" />
                            <span>
                              Hidden Issues ({hiddenGroups.reduce((acc, g) => acc + g.issues.length, 0)} in {hiddenGroups.length} groups)
                            </span>
                          </button>
                          
                          {showHiddenIssues && (
                            <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                              {hiddenGroups.map((group) => (
                                <div key={group.key} className="opacity-60">
                                  <IssueGroupItem
                                    group={group}
                                    scrollToLine={scrollToLine}
                                    getValidatorColor={getValidatorColor}
                                    getSeverityColor={getSeverityColor}
                                    onCopyIssue={handleCopyIssue}
                                    onHideGroup={toggleGroupHidden}
                                    isHidden={true}
                                    specContent={specContent}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
