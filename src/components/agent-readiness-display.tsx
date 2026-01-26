"use client"

import { useState, useEffect, memo, useCallback, useMemo } from "react"
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Sparkles,
  Shield,
  FileText,
  Zap,
  Search,
  AlertTriangle,
  ArrowRight,
  Info,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import type { AgentReadinessScore, DimensionScore, Grade, Signal, ValidationResult } from "@/lib/types"
import { MethodologyModal } from "@/components/methodology-modal"

interface AgentReadinessDisplayProps {
  score: AgentReadinessScore | null
  isLoading?: boolean
  validationResults?: ValidationResult[]
}

const GRADE_COLORS: Record<Grade, { bg: string; text: string; hex: string; border: string }> = {
  'A': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', hex: '#34d399', border: 'border-emerald-500/30' },
  'B': { bg: 'bg-blue-500/10', text: 'text-blue-400', hex: '#60a5fa', border: 'border-blue-500/30' },
  'C': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', hex: '#facc15', border: 'border-yellow-500/30' },
  'D': { bg: 'bg-orange-500/10', text: 'text-orange-400', hex: '#fb923c', border: 'border-orange-500/30' },
  'F': { bg: 'bg-red-500/10', text: 'text-red-400', hex: '#f87171', border: 'border-red-500/30' },
}

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  foundationalCompliance: <FileText className="h-4 w-4" />,
  semanticRichness: <Sparkles className="h-4 w-4" />,
  agentUsability: <Zap className="h-4 w-4" />,
  aiDiscoverability: <Search className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  errorRecoverability: <AlertTriangle className="h-4 w-4" />,
}

/**
 * Loading skeleton for score display while calculation is in progress
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading score">
      {/* Overall Score Skeleton */}
      <Card className="border-2 border-muted">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-32 h-32 mx-auto md:mx-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-muted rounded w-64 mx-auto md:mx-0" />
              <div className="h-5 bg-muted rounded w-32 mx-auto md:mx-0" />
              <div className="h-4 bg-muted rounded w-full max-w-md mx-auto md:mx-0" />
            </div>
            <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="text-center md:text-right">
                  <div className="h-8 bg-muted rounded w-12 mx-auto md:ml-auto md:mr-0" />
                  <div className="h-3 bg-muted rounded w-16 mt-1 mx-auto md:ml-auto md:mr-0" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimension Cards Skeleton */}
      <div>
        <div className="h-6 bg-muted rounded w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="border border-muted">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div>
                      <div className="h-5 bg-muted rounded w-32 mb-1" />
                      <div className="h-3 bg-muted rounded w-48" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-8 bg-muted rounded w-12 ml-auto" />
                    <div className="h-3 bg-muted rounded w-16 mt-1 ml-auto" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Signal badge component - memoised to prevent unnecessary re-renders
 */
const SignalBadge = memo(function SignalBadge({ signal }: { signal: Signal }) {
  const Icon = signal.type === 'positive' ? CheckCircle2 : 
               signal.type === 'negative' ? XCircle : AlertCircle
  const colorClass = signal.type === 'positive' ? 'text-emerald-400' :
                     signal.type === 'negative' ? 'text-red-400' : 'text-yellow-400'
  
  return (
    <div className="flex items-start gap-2 text-sm" role="listitem">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", colorClass)} aria-hidden="true" />
      <span className="text-muted-foreground">{signal.message}</span>
    </div>
  )
})

/**
 * Dimension card component - memoised with proper accessibility
 * Expansion state is controlled by parent for single-accordion behaviour
 */
const DimensionCard = memo(function DimensionCard({ 
  dimension, 
  dimensionKey,
  isExpanded,
  onToggle,
}: { 
  dimension: DimensionScore
  dimensionKey: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const colors = GRADE_COLORS[dimension.grade]
  const icon = DIMENSION_ICONS[dimensionKey]
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }, [onToggle])

  const cardId = `dimension-${dimensionKey}`
  const contentId = `${cardId}-content`

  return (
    <Card className={cn("border transition-all duration-200", colors.border, colors.bg)}>
      <CardHeader 
        className="px-6 pt-4 pb-3 cursor-pointer select-none" 
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={`${dimension.label}: Score ${dimension.score}, Grade ${dimension.grade}. ${isExpanded ? 'Collapse' : 'Expand'} for details.`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", colors.bg)} aria-hidden="true">
              <span className={colors.text}>{icon}</span>
            </div>
            <div>
              <CardTitle className="text-base font-medium">{dimension.label}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {dimension.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className={cn("text-2xl font-bold leading-none", colors.text)} aria-label={`Score: ${dimension.score}`}>
                {dimension.score}
              </div>
              <div className={cn("text-xs font-medium whitespace-nowrap", colors.text)}>
                Grade {dimension.grade}
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent id={contentId} className="px-6 pt-3 pb-4 space-y-4">
          {/* Signals */}
          {dimension.signals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Signals</h4>
              <div className="space-y-1.5" role="list" aria-label="Score signals">
                {dimension.signals.map((signal, i) => (
                  <SignalBadge key={`${dimensionKey}-signal-${signal.type}-${i}`} signal={signal} />
                ))}
              </div>
            </div>
          )}

          {/* Improvement Tips */}
          {dimension.improvementTips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">How to Improve</h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground" aria-label="Improvement suggestions">
                {dimension.improvementTips.map((tip, i) => (
                  <li key={`${dimensionKey}-tip-${i}`} className="flex items-start gap-2">
                    <ArrowRight className="h-3 w-3 mt-1.5 shrink-0 text-primary" aria-hidden="true" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Appear Help */}
          {dimension.appearCanHelp && dimension.appearHelpText && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm text-primary font-medium">Appear can help</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{dimension.appearHelpText}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
})

/**
 * Appear CTA card - memoised
 */
const AppearCTACard = memo(function AppearCTACard({ cta }: { cta: AgentReadinessScore['appearCTA'] }) {
  return (
    <Card className="border-border/50 bg-card/50" role="region" aria-label="Appear.sh promotion">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left side - content */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-muted" aria-hidden="true">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                Powered by Appear
              </span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{cta.headline}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{cta.subheadline}</p>
            </div>
            
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2" aria-label="Features">
              {cta.features.map((feature, i) => (
                <li key={`cta-feature-${i}`} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Right side - actions */}
          <div className="flex flex-col gap-2.5 lg:justify-center shrink-0">
            <Button asChild size="default" className="w-full lg:w-auto">
              <a 
                href={cta.primaryAction.url} 
                target="_blank" 
                rel="noopener noreferrer"
                data-cta="primary"
                data-cta-label={cta.primaryAction.label}
              >
                {cta.primaryAction.label}
                <ExternalLink className="h-3.5 w-3.5 ml-2" aria-hidden="true" />
              </a>
            </Button>
            {cta.secondaryAction && (
              <Button asChild variant="outline" size="default" className="w-full lg:w-auto">
                <a 
                  href={cta.secondaryAction.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-cta="secondary"
                  data-cta-label={cta.secondaryAction.label}
                >
                  {cta.secondaryAction.label}
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

/**
 * Methodology link - opens the methodology modal
 */
const MethodologyLink = memo(function MethodologyLink() {
  return (
    <MethodologyModal 
      trigger={
        <button 
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Learn how the score is calculated"
        >
          <Info className="h-3.5 w-3.5" />
          <span>How is this calculated?</span>
        </button>
      }
    />
  )
})

export function AgentReadinessDisplay({ score, isLoading = false, validationResults = [] }: AgentReadinessDisplayProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)

  // Get relevant validation errors for a dimension
  const getRelevantErrors = useCallback((dimension: string): ValidationResult[] => {
    if (dimension === 'Foundational Compliance') {
      // Return all validation errors (excluding success messages)
      return validationResults.filter(r => 
        r.severity === 'error' && !r.code.includes('SUCCESS')
      )
    }
    // For other dimensions, return empty for now (can be extended later)
    return []
  }, [validationResults])

  // Copy relevant errors to clipboard
  const handleCopyErrors = useCallback((dimension: string) => {
    const errors = getRelevantErrors(dimension)
    if (errors.length === 0) return

    const errorText = errors
      .map(err => `${err.severity.toUpperCase()}: ${err.message}${err.path ? `\nPath: ${err.path.join('.')}` : ''}`)
      .join('\n\n')

    navigator.clipboard.writeText(errorText)
    toast.success(`Copied ${errors.length} error${errors.length > 1 ? 's' : ''} to clipboard`)
  }, [getRelevantErrors])

  // Memoised dimension entries to prevent recalculation on every render
  // Must be called before any conditional returns to satisfy React hooks rules
  const dimensionEntries = useMemo(
    () => score ? Object.entries(score.dimensions) as [string, DimensionScore][] : [],
    [score]
  )
  
  // Handler for toggling dimension expansion (single accordion behaviour)
  const handleDimensionToggle = useCallback((key: string) => {
    setExpandedDimension(prev => prev === key ? null : key)
  }, [])

  useEffect(() => {
    if (score) {
      const timer = setTimeout(() => {
        setAnimatedScore(score.overallScore)
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setAnimatedScore(0)
    }
  }, [score])

  // Show loading skeleton while calculating
  if (isLoading || (!score && isLoading)) {
    return <LoadingSkeleton />
  }

  if (!score) {
    return null
  }

  const colors = GRADE_COLORS[score.grade]

  return (
    <div className="space-y-6" role="region" aria-label="Agent Readiness Score Results">
      {/* Overall Score Header */}
      <Card className={cn("border-2", colors.border)}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Score Circle */}
            <div className="w-32 h-32 mx-auto md:mx-0" role="img" aria-label={`Score: ${score.overallScore} out of 100`}>
              <CircularProgressbar
                value={animatedScore}
                text={`${Math.round(animatedScore)}`}
                strokeWidth={8}
                styles={buildStyles({
                  textSize: "28px",
                  pathColor: colors.hex,
                  textColor: colors.hex,
                  trailColor: "rgba(255, 255, 255, 0.1)",
                  pathTransition: "stroke-dashoffset 0.8s ease 0s",
                })}
              />
            </div>

            {/* Score Details */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">Readiness Score</h2>
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-semibold",
                  colors.bg, colors.text
                )} aria-label={`Grade: ${score.grade}`}>
                  Grade {score.grade}
                </span>
              </div>
              <div className={cn("text-lg font-medium", colors.text)}>
                {score.readinessLevel}
              </div>
              <p className="text-muted-foreground text-sm max-w-xl">
                {score.summary}
              </p>
              <MethodologyLink />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-1 gap-3 text-center md:text-right" aria-label="API Statistics">
              <div>
                <div className="text-2xl font-bold">{score.stats.operations}</div>
                <div className="text-xs text-muted-foreground">Operations</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{score.stats.schemas}</div>
                <div className="text-xs text-muted-foreground">Schemas</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{score.stats.securitySchemes}</div>
                <div className="text-xs text-muted-foreground">Security</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimension Breakdown */}
      <section aria-labelledby="breakdown-heading">
        <h3 id="breakdown-heading" className="text-lg font-semibold mb-4">Score Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {dimensionEntries.map(([key, dimension]) => (
            <DimensionCard 
              key={key} 
              dimension={dimension} 
              dimensionKey={key}
              isExpanded={expandedDimension === key}
              onToggle={() => handleDimensionToggle(key)}
            />
          ))}
        </div>
      </section>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <section aria-labelledby="recommendations-heading">
          <h3 id="recommendations-heading" className="text-lg font-semibold mb-4">Priority Improvements</h3>
          <div className="space-y-2" role="list" aria-label="Improvement recommendations">
            {score.recommendations.slice(0, 4).map((rec, i) => {
              const relevantErrors = getRelevantErrors(rec.dimension)
              const errorCount = relevantErrors.length
              
              return (
                <Card 
                  key={`rec-${rec.dimension}-${i}`} 
                  className={cn(
                    "border",
                    rec.priority === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    rec.priority === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                    'border-border/50'
                  )}
                  role="listitem"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Fixed-width badge column */}
                      <div className="w-[72px] shrink-0">
                        <div className={cn(
                          "inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                          rec.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-muted text-muted-foreground'
                        )} aria-label={`Priority: ${rec.priority}`}>
                          {rec.priority}
                        </div>
                      </div>
                      
                      {/* Content column */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-medium text-sm">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        <p className="text-xs text-muted-foreground/60 italic">{rec.impact}</p>
                      </div>
                      
                      {/* Copy button - fixed width column */}
                      <div className="w-[40px] shrink-0 flex justify-end">
                        {errorCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyErrors(rec.dimension)
                            }}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label={`Copy ${errorCount} related error${errorCount > 1 ? 's' : ''}`}
                            title={`Copy ${errorCount} related error${errorCount > 1 ? 's' : ''}`}
                          >
                            <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Appear CTA */}
      <AppearCTACard cta={score.appearCTA} />
    </div>
  )
}
