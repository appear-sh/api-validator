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

function highlightLine(line: string): React.ReactNode {
  if (!line.trim()) return line

  // Simple tokenisation - find all matches and their positions
  const tokens: { start: number; end: number; className: string }[] = []
  
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

  // Sort by position and remove overlaps (first match wins)
  tokens.sort((a, b) => a.start - b.start)
  const filtered: typeof tokens = []
  let lastEnd = 0
  for (const token of tokens) {
    if (token.start >= lastEnd) {
      filtered.push(token)
      lastEnd = token.end
    }
  }

  // Build result
  if (filtered.length === 0) return line

  const result: React.ReactNode[] = []
  let pos = 0
  
  for (let i = 0; i < filtered.length; i++) {
    const token = filtered[i]
    // Add text before this token
    if (pos < token.start) {
      result.push(line.slice(pos, token.start))
    }
    // Add highlighted token
    result.push(
      <span key={i} className={token.className}>
        {line.slice(token.start, token.end)}
      </span>
    )
    pos = token.end
  }
  
  // Add remaining text
  if (pos < line.length) {
    result.push(line.slice(pos))
  }

  return result
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
          <TooltipProvider>
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
              <TooltipContent side="right" className="max-w-sm">
                <div className="space-y-2">
                  {data.issues.map((issue, i) => (
                    <div key={i} className="text-xs">
                      <span className={cn(
                        "font-medium",
                        issue.severity === 'error' ? 'text-red-400' :
                        issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      )}>
                        {issue.severity}:
                      </span>{' '}
                      <span className="text-zinc-300">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      {/* Code content */}
      <div className="flex-1 whitespace-pre overflow-hidden text-ellipsis pr-4">
        {highlightLine(data.content)}
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

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const clickedLine = Math.floor(clickY / scale)
    onNavigate(Math.max(1, Math.min(clickedLine, totalLines)))
  }, [scale, totalLines, onNavigate])

  return (
    <div 
      className="relative bg-zinc-900/50 cursor-pointer border-l border-zinc-800/50"
      style={{ width: MINIMAP_WIDTH, height }}
      onClick={handleClick}
      title={`${issuesByLine.size} lines with issues`}
    >
      {/* Viewport indicator */}
      <div
        className="absolute bg-zinc-600/30 pointer-events-none"
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
              "absolute rounded-[1px]",
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
  const { lines, issuesByLine } = useMemo(() => {
    const lineStrings = content.split('\n')
    const issueMap = new Map<number, ValidationResult[]>()
    
    for (const issue of issues) {
      if (issue.range?.start?.line !== undefined) {
        const lineNum = issue.range.start.line + 1 // 1-indexed
        const existing = issueMap.get(lineNum) || []
        issueMap.set(lineNum, [...existing, issue])
      }
    }

    const lineData: LineData[] = lineStrings.map((content, index) => ({
      number: index + 1,
      content,
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
      {/* Main scrollable area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
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
