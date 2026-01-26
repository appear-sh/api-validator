"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Info, 
  ShieldCheck, 
  MessageSquareText, 
  Bot, 
  Search, 
  Lock, 
  RotateCcw,
  ExternalLink,
  ChevronRight
} from "lucide-react"
import { METHODOLOGY } from "@/lib/agent-readiness-score"
import { cn } from "@/lib/utils"

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  'shield-check': <ShieldCheck className="w-5 h-5" />,
  'message-square-text': <MessageSquareText className="w-5 h-5" />,
  'bot': <Bot className="w-5 h-5" />,
  'search': <Search className="w-5 h-5" />,
  'lock': <Lock className="w-5 h-5" />,
  'rotate-ccw': <RotateCcw className="w-5 h-5" />,
}

// Muted colours using primary with opacity gradation for clear visual hierarchy
const DIMENSION_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'foundationalCompliance': { bg: 'bg-primary', text: 'text-primary-foreground', dot: 'bg-primary' },
  'semanticRichness': { bg: 'bg-primary/80', text: 'text-primary-foreground', dot: 'bg-primary/80' },
  'agentUsability': { bg: 'bg-primary/65', text: 'text-primary-foreground', dot: 'bg-primary/65' },
  'aiDiscoverability': { bg: 'bg-primary/50', text: 'text-primary-foreground', dot: 'bg-primary/50' },
  'security': { bg: 'bg-primary/40', text: 'text-primary-foreground', dot: 'bg-primary/40' },
  'errorRecoverability': { bg: 'bg-primary/30', text: 'text-primary-foreground', dot: 'bg-primary/30' },
}

interface MethodologyModalProps {
  trigger?: React.ReactNode
  className?: string
}

export function MethodologyModal({ trigger, className }: MethodologyModalProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground hover:text-foreground", className)}>
            <Info className="w-4 h-4" />
            <span>How is this calculated?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{METHODOLOGY.name}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {METHODOLOGY.author}&apos;s framework for AI agent readiness
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-180px)]">
          <div className="px-6 py-4 space-y-6">
            {/* Introduction */}
            <section>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {METHODOLOGY.description}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                {METHODOLOGY.rationale}
              </p>
            </section>

            {/* Weight visualisation */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Score Composition</h3>
              <div className="flex h-9 rounded-lg overflow-hidden border border-border/50">
                {METHODOLOGY.dimensions.map((dim) => {
                  const colors = DIMENSION_COLORS[dim.id] || { bg: 'bg-primary', text: 'text-white' }
                  return (
                    <div
                      key={dim.id}
                      className={cn(
                        "flex items-center justify-center text-xs font-semibold transition-all",
                        colors.bg,
                        colors.text,
                        "hover:brightness-110 cursor-default"
                      )}
                      style={{ width: `${dim.weightPercent}%` }}
                      title={`${dim.name}: ${dim.weightPercent}%`}
                    >
                      {dim.weightPercent}%
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {METHODOLOGY.dimensions.map((dim) => {
                  const colors = DIMENSION_COLORS[dim.id] || { dot: 'bg-primary' }
                  return (
                    <div key={dim.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className={cn("w-2.5 h-2.5 rounded-sm", colors.dot)} />
                      <span>{dim.name}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Dimensions */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Scoring Dimensions</h3>
              <div className="space-y-2">
                {METHODOLOGY.dimensions.map((dim) => {
                  const isExpanded = expandedDimension === dim.id
                  return (
                    <div
                      key={dim.id}
                      className={cn(
                        "border border-border/50 rounded-lg transition-all",
                        isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                      )}
                    >
                      <button
                        onClick={() => setExpandedDimension(isExpanded ? null : dim.id)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                      >
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          isExpanded ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {DIMENSION_ICONS[dim.icon]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{dim.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {dim.weightPercent}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {dim.description}
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </button>
                      
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 ml-[52px] space-y-3">
                          <div>
                            <p className="text-xs font-medium text-primary mb-1">Why it matters</p>
                            <p className="text-xs text-muted-foreground">
                              {dim.whyItMatters}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Factors assessed</p>
                            <ul className="space-y-1">
                              {dim.factors.map((factor, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-primary mt-1">•</span>
                                  {factor}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Grade scale */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Grade Scale</h3>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(METHODOLOGY.gradeThresholds).map(([grade, info]) => (
                  <div 
                    key={grade}
                    className="text-center p-2 rounded-lg border border-border/50 bg-muted/20"
                  >
                    <div className={cn(
                      "text-lg font-bold",
                      grade === 'A' && "text-emerald-500",
                      grade === 'B' && "text-green-500",
                      grade === 'C' && "text-yellow-500",
                      grade === 'D' && "text-orange-500",
                      grade === 'F' && "text-red-500",
                    )}>
                      {grade}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {info.min}+
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Readiness levels */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Readiness Levels</h3>
              <div className="space-y-2">
                {Object.entries(METHODOLOGY.readinessLevels).map(([level, info]) => (
                  <div 
                    key={level}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border/50"
                  >
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {info.min}+
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{level}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* References */}
            <section className="pb-2">
              <h3 className="text-sm font-semibold mb-3">References</h3>
              <div className="space-y-2">
                {METHODOLOGY.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                    <div>
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">
                        {ref.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{ref.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Version {METHODOLOGY.version} · Built by{' '}
            <a 
              href="https://appear.sh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Appear
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
