"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ValidationResult } from '@/lib/types'

// ============================================================================
// CONFIGURATION
// ============================================================================

const LINE_HEIGHT = 20 // pixels per line
const OVERSCAN_COUNT = 10 // extra lines to render above/below viewport
const GUTTER_WIDTH = 52 // width of line number gutter
const MARKER_GUTTER_WIDTH = 28 // width of error marker gutter (needs room for dot + padding)
const MINIMAP_WIDTH = 16 // width of minimap
const MINIMAP_MARKER_INSET = 3 // inset from edges for markers
const CORNER_RADIUS_PADDING = 12 // padding to avoid rounded corner clipping

// ============================================================================
// TYPES
// ============================================================================

interface VirtualisedCodeViewerProps {
  content: string
  issues: ValidationResult[]
  highlightedLine: number | null
  onLineClick?: (lineNumber: number) => void
  className?: string
}

interface LineData {
  number: number
  content: string
  issues: ValidationResult[]
}

// ============================================================================
// PATH TO LINE NUMBER UTILITY
// Derives line numbers from JSON path when range is not available
// ============================================================================

function findLineFromPath(content: string, path: string[]): number | null {
  if (!path || path.length === 0) return null
  
  const lines = content.split('\n')
  
  // Build search patterns for each path segment
  // We're looking for the deepest path segment we can find
  for (let depth = path.length; depth > 0; depth--) {
    const searchPath = path.slice(0, depth)
    const lastSegment = searchPath[searchPath.length - 1]
    
    // Create search patterns for this segment
    // JSON style: "key": or "key" :
    const jsonPattern = new RegExp(`"${escapeRegex(lastSegment)}"\\s*:`)
    // YAML style: key: (at appropriate indentation)
    const yamlPattern = new RegExp(`^\\s*${escapeRegex(lastSegment)}\\s*:`, 'm')
    // Array index: we look for the parent and count
    const isArrayIndex = /^\d+$/.test(lastSegment)
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (isArrayIndex) {
        // For array indices, look for array markers or parent key
        if (searchPath.length > 1) {
          const parentKey = searchPath[searchPath.length - 2]
          if (line.includes(`"${parentKey}"`) || line.match(new RegExp(`^\\s*${escapeRegex(parentKey)}\\s*:`))) {
            // Found parent, now count array items
            const index = parseInt(lastSegment, 10)
            let arrayItemCount = -1
            for (let j = i + 1; j < lines.length && arrayItemCount < index; j++) {
              if (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('{')) {
                arrayItemCount++
                if (arrayItemCount === index) {
                  return j + 1 // 1-indexed
                }
              }
              // Stop if we hit another top-level key
              if (lines[j].match(/^[a-zA-Z"]/)) break
            }
          }
        }
      } else {
        // For regular keys
        if (jsonPattern.test(line) || yamlPattern.test(line)) {
          return i + 1 // 1-indexed
        }
      }
    }
  }
  
  return null
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// SYNTAX HIGHLIGHTING (lightweight, no external deps)
// ============================================================================

const TOKEN_PATTERNS: [RegExp, string][] = [
  // Strings (double-quoted)
  [/"(?:[^"\\]|\\.)*"/g, 'text-emerald-400'],
  // Numbers
  [/\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, 'text-purple-400'],
  // Booleans and null
  [/\b(?:true|false|null)\b/g, 'text-orange-400'],
  // Property keys (before colon)
  [/"[^"]+"\s*(?=:)/g, 'text-sky-400'],
]

interface ErrorRange {
  start: number
  end: number
  severity: 'error' | 'warning' | 'info'
}

function highlightLine(line: string, errorRanges?: ErrorRange[]): React.ReactNode {
  if (!line.trim()) return line

  // Simple tokenisation - find all matches and their positions
  const tokens: { start: number; end: number; className: string; isError?: boolean; severity?: string }[] = []
  
  // Add error ranges first (they take priority for underline styling)
  if (errorRanges && errorRanges.length > 0) {
    for (const range of errorRanges) {
      tokens.push({
        start: range.start,
        end: Math.min(range.end, line.length),
        className: '', // Will be handled separately
        isError: true,
        severity: range.severity,
      })
    }
  }
  
  for (const [pattern, className] of TOKEN_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(line)) !== null) {
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        className,
      })
    }
  }

  // Sort by position
  tokens.sort((a, b) => a.start - b.start)
  
  // Build result with both syntax highlighting and error underlines
  // We need to handle overlapping tokens (error ranges can overlap syntax tokens)
  const result: React.ReactNode[] = []
  let keyIdx = 0
  
  // Find all positions where something changes
  const breakpoints = new Set<number>()
  breakpoints.add(0)
  breakpoints.add(line.length)
  for (const token of tokens) {
    breakpoints.add(token.start)
    breakpoints.add(token.end)
  }
  const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b)
  
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const segStart = sortedBreakpoints[i]
    const segEnd = sortedBreakpoints[i + 1]
    if (segStart >= segEnd) continue
    
    const segment = line.slice(segStart, segEnd)
    if (!segment) continue
    
    // Find which tokens apply to this segment
    const activeTokens = tokens.filter(t => t.start <= segStart && t.end >= segEnd)
    const syntaxToken = activeTokens.find(t => !t.isError && t.className)
    const errorToken = activeTokens.find(t => t.isError)
    
    const className = syntaxToken?.className || ''
    let style: React.CSSProperties | undefined
    
    if (errorToken) {
      // Add wavy underline for errors
      const underlineColor = errorToken.severity === 'error' 
        ? 'rgba(239, 68, 68, 0.8)' 
        : errorToken.severity === 'warning'
          ? 'rgba(245, 158, 11, 0.8)'
          : 'rgba(59, 130, 246, 0.6)'
      style = {
        textDecoration: 'underline wavy',
        textDecorationColor: underlineColor,
        textUnderlineOffset: '2px',
      }
    }
    
    if (className || style) {
      result.push(
        <span key={keyIdx++} className={className} style={style}>
          {segment}
        </span>
      )
    } else {
      result.push(segment)
    }
  }

  return result.length > 0 ? result : line
}

// ============================================================================
// LINE COMPONENT (memoised)
// ============================================================================

interface CodeLineProps {
  data: LineData
  style: React.CSSProperties
  isHighlighted: boolean
  onClick?: () => void
}

const CodeLine = memo(function CodeLine({ data, style, isHighlighted, onClick }: CodeLineProps) {
  const hasError = data.issues.some(i => i.severity === 'error')
  const hasWarning = data.issues.some(i => i.severity === 'warning')
  const hasInfo = data.issues.some(i => i.severity === 'info')
  
  // Build error ranges for character-level highlighting
  const errorRanges: ErrorRange[] = useMemo(() => {
    return data.issues
      .filter(issue => issue.range?.start?.character !== undefined)
      .map(issue => ({
        start: issue.range!.start.character,
        end: issue.range!.end?.character ?? data.content.length,
        severity: issue.severity,
      }))
  }, [data.issues, data.content.length])

  return (
    <div
      style={style}
      className={cn(
        "flex items-stretch font-mono text-sm leading-5 group",
        isHighlighted && "bg-primary/10",
        hasError && "bg-red-500/5",
        hasWarning && !hasError && "bg-amber-500/5",
      )}
      onClick={onClick}
      data-line-number={data.number}
    >
      {/* Line number gutter */}
      <div 
        className={cn(
          "shrink-0 text-right pr-3 select-none text-muted-foreground/50",
          "group-hover:text-muted-foreground transition-colors"
        )}
        style={{ width: GUTTER_WIDTH }}
      >
        {data.number}
      </div>

      {/* Error marker gutter */}
      <div 
        className="shrink-0 flex items-center justify-center border-r border-zinc-800/30"
        style={{ width: MARKER_GUTTER_WIDTH }}
      >
        {data.issues.length > 0 ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full cursor-pointer transition-all hover:scale-125",
                    hasError ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : 
                    hasWarning ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" : 
                    hasInfo ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" : 
                    "bg-zinc-500"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                className="max-w-sm bg-zinc-900 border-zinc-700 shadow-xl"
              >
                <div className="space-y-2">
                  {data.issues.map((issue, i) => (
                    <div key={i} className="text-xs">
                      <span className={cn(
                        "font-semibold uppercase text-[10px]",
                        issue.severity === 'error' ? 'text-red-400' :
                        issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      )}>
                        {issue.severity}:
                      </span>{' '}
                      <span className="text-zinc-200">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      {/* Code content with syntax highlighting and error underlines */}
      <div className="flex-1 whitespace-pre overflow-hidden text-ellipsis pr-4">
        {highlightLine(data.content, errorRanges.length > 0 ? errorRanges : undefined)}
      </div>
    </div>
  )
})

// ============================================================================
// MINIMAP COMPONENT (Clean Monaco-style with fixed-width markers)
// ============================================================================

interface MinimapProps {
  totalLines: number
  issuesByLine: Map<number, ValidationResult[]>
  viewportStart: number
  viewportEnd: number
  onNavigate: (line: number) => void
  height: number
}

const Minimap = memo(function Minimap({ 
  totalLines, 
  issuesByLine, 
  viewportStart, 
  viewportEnd, 
  onNavigate,
  height 
}: MinimapProps) {
  const scale = height / Math.max(totalLines, 1)
  const viewportHeight = Math.max((viewportEnd - viewportStart) * scale, 20)
  const viewportTop = viewportStart * scale
  const isDraggingRef = useRef(false)
  const minimapRef = useRef<HTMLDivElement>(null)

  // Group nearby lines into segments for cleaner rendering
  const segments = useMemo(() => {
    const entries = Array.from(issuesByLine.entries()).sort((a, b) => a[0] - b[0])
    if (entries.length === 0) return []

    // Minimum gap (in pixels) before starting a new segment
    const minGap = 4
    const minGapLines = Math.ceil(minGap / scale)

    const result: Array<{
      startLine: number
      endLine: number
      hasError: boolean
      hasWarning: boolean
      issueCount: number
    }> = []

    let currentSegment = {
      startLine: entries[0][0],
      endLine: entries[0][0],
      hasError: entries[0][1].some(i => i.severity === 'error'),
      hasWarning: entries[0][1].some(i => i.severity === 'warning'),
      issueCount: entries[0][1].length,
    }

    for (let i = 1; i < entries.length; i++) {
      const [line, issues] = entries[i]
      const gap = line - currentSegment.endLine

      if (gap <= minGapLines) {
        // Extend current segment
        currentSegment.endLine = line
        currentSegment.hasError = currentSegment.hasError || issues.some(i => i.severity === 'error')
        currentSegment.hasWarning = currentSegment.hasWarning || issues.some(i => i.severity === 'warning')
        currentSegment.issueCount += issues.length
      } else {
        // Start new segment
        result.push(currentSegment)
        currentSegment = {
          startLine: line,
          endLine: line,
          hasError: issues.some(i => i.severity === 'error'),
          hasWarning: issues.some(i => i.severity === 'warning'),
          issueCount: issues.length,
        }
      }
    }
    result.push(currentSegment)

    return result
  }, [issuesByLine, scale])

  // Calculate line from Y position
  const getLineFromY = useCallback((clientY: number) => {
    if (!minimapRef.current) return 1
    const rect = minimapRef.current.getBoundingClientRect()
    const clickY = clientY - rect.top
    return Math.max(1, Math.min(Math.floor(clickY / scale), totalLines))
  }, [scale, totalLines])

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return // Ignore if we just finished dragging
    const line = getLineFromY(e.clientY)
    onNavigate(line)
  }, [getLineFromY, onNavigate])

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const line = getLineFromY(moveEvent.clientY)
      onNavigate(line)
    }
    
    const handleMouseUp = () => {
      // Small delay to prevent click handler from firing
      setTimeout(() => { isDraggingRef.current = false }, 50)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [getLineFromY, onNavigate])

  return (
    <div 
      ref={minimapRef}
      className="relative bg-zinc-900/50 cursor-pointer border-l border-zinc-800/50 select-none"
      style={{ width: MINIMAP_WIDTH, height }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      title={`${issuesByLine.size} lines with issues`}
    >
      {/* Viewport indicator - draggable handle */}
      <div
        className="absolute bg-zinc-600/40 hover:bg-zinc-500/50 transition-colors cursor-grab active:cursor-grabbing"
        style={{ 
          top: viewportTop, 
          height: viewportHeight,
          left: 0,
          right: 0,
        }}
      />
      
      {/* Issue segments - clean fixed-width bars */}
      {segments.map((segment, i) => {
        const top = (segment.startLine - 1) * scale
        const segmentHeight = Math.max(2, (segment.endLine - segment.startLine + 1) * scale)
        
        return (
          <div
            key={i}
            className={cn(
              "absolute rounded-[1px] pointer-events-none",
              segment.hasError 
                ? "bg-red-500" 
                : segment.hasWarning 
                  ? "bg-amber-500" 
                  : "bg-blue-400"
            )}
            style={{ 
              top,
              height: segmentHeight,
              left: MINIMAP_MARKER_INSET,
              right: MINIMAP_MARKER_INSET,
            }}
          />
        )
      })}
    </div>
  )
})

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VirtualisedCodeViewer({
  content,
  issues,
  highlightedLine,
  onLineClick,
  className,
}: VirtualisedCodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Parse lines and build issue map
  // For issues without range, attempt to derive line from path
  const { lines, issuesByLine } = useMemo(() => {
    const lineStrings = content.split('\n')
    const issueMap = new Map<number, ValidationResult[]>()
    
    for (const issue of issues) {
      let lineNum: number | null = null
      
      // First, try to use the range if available
      if (issue.range?.start?.line !== undefined) {
        lineNum = issue.range.start.line + 1 // 1-indexed
      } 
      // Fallback: derive line from path
      else if (issue.path && issue.path.length > 0) {
        lineNum = findLineFromPath(content, issue.path)
      }
      
      if (lineNum !== null) {
        const existing = issueMap.get(lineNum) || []
        issueMap.set(lineNum, [...existing, issue])
      }
    }

    const lineData: LineData[] = lineStrings.map((lineContent, index) => ({
      number: index + 1,
      content: lineContent,
      issues: issueMap.get(index + 1) || [],
    }))

    return { lines: lineData, issuesByLine: issueMap }
  }, [content, issues])

  const totalLines = lines.length
  const totalHeight = totalLines * LINE_HEIGHT

  // Calculate visible range
  const visibleStartIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN_COUNT)
  const visibleEndIndex = Math.min(
    totalLines,
    Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + OVERSCAN_COUNT
  )

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightedLine && containerRef.current) {
      const targetScroll = (highlightedLine - 1) * LINE_HEIGHT - containerHeight / 2
      containerRef.current.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })
    }
  }, [highlightedLine, containerHeight])

  // Handle line click
  const handleLineClick = useCallback((lineNumber: number) => {
    onLineClick?.(lineNumber)
  }, [onLineClick])

  // Navigate from minimap
  const handleMinimapNavigate = useCallback((line: number) => {
    if (containerRef.current) {
      const targetScroll = (line - 1) * LINE_HEIGHT - containerHeight / 2
      containerRef.current.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      })
    }
  }, [containerHeight])

  // Visible lines to render
  const visibleLines = useMemo(() => {
    return lines.slice(visibleStartIndex, visibleEndIndex)
  }, [lines, visibleStartIndex, visibleEndIndex])

  return (
    <div className={cn("flex h-full bg-zinc-950 rounded-b-lg overflow-hidden", className)}>
      {/* Main scrollable area - hide native scrollbar, use minimap for scrolling */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none', /* IE/Edge */
        }}
        onScroll={handleScroll}
      >
        {/* Spacer for virtual scrolling */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleLines.map((line) => (
            <CodeLine
              key={line.number}
              data={line}
              style={{
                position: 'absolute',
                top: (line.number - 1) * LINE_HEIGHT,
                left: 0,
                right: 0,
                height: LINE_HEIGHT,
              }}
              isHighlighted={line.number === highlightedLine}
              onClick={() => handleLineClick(line.number)}
            />
          ))}
        </div>
      </div>

      {/* Minimap with padding for rounded corners */}
      <div 
        className="flex flex-col shrink-0" 
        style={{ width: MINIMAP_WIDTH }}
      >
        {/* Top padding for rounded corner */}
        <div style={{ height: CORNER_RADIUS_PADDING }} className="bg-zinc-900/50" />
        <Minimap
          totalLines={totalLines}
          issuesByLine={issuesByLine}
          viewportStart={Math.floor(scrollTop / LINE_HEIGHT)}
          viewportEnd={Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT)}
          onNavigate={handleMinimapNavigate}
          height={Math.max(0, containerHeight - CORNER_RADIUS_PADDING * 2)}
        />
        {/* Bottom padding for rounded corner */}
        <div style={{ height: CORNER_RADIUS_PADDING }} className="bg-zinc-900/50" />
      </div>
    </div>
  )
}
