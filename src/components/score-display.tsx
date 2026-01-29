"use client"

import { useState, useEffect } from "react"
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"
import { cn } from "@/lib/utils"

interface ScoreDisplayProps {
  score: number
  onClick?: () => void
}

export function ScoreDisplay({ score, onClick }: ScoreDisplayProps) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score)
    }, 100)

    return () => clearTimeout(timer)
  }, [score])

  // Aligned with Agent Ready Score thresholds for visual consistency:
  // - 80+ (Grade A/B): emerald/green
  // - 60-79 (Grade C/D): yellow/amber  
  // - <60 (Grade F): red
  const getTextColorClass = (score: number): string => {
    if (score >= 80) return "text-emerald-400"
    if (score >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  const getBorderColorClass = (score: number): string => {
    if (score >= 80) return "border-emerald-500/30"
    if (score >= 60) return "border-yellow-500/30"
    return "border-red-500/30"
  }
  
  const getHexColor = (score: number): string => {
    if (score >= 80) return "#34d399" // emerald-400
    if (score >= 60) return "#facc15" // yellow-400
    return "#f87171" // red-400
  }

  const currentTextColorClass = getTextColorClass(animatedScore);
  const currentBorderColorClass = getBorderColorClass(animatedScore);
  const currentHexColor = getHexColor(animatedScore);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-background/30 backdrop-blur-sm border transition-all duration-300",
        currentBorderColorClass,
        onClick && "cursor-pointer hover:bg-background/50 hover:scale-[1.02] active:scale-[0.98]"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="w-16 h-16">
        <CircularProgressbar
          value={animatedScore}
          text={`${Math.round(animatedScore)}`}
          strokeWidth={10}
          styles={buildStyles({
            textSize: "32px",
            pathColor: currentHexColor,
            textColor: currentHexColor,
            trailColor: "rgba(255, 255, 255, 0.1)",
            pathTransition: "stroke-dashoffset 0.5s ease 0s",
          })}
        />
      </div>
      <div>
        <p className={cn("font-semibold transition-colors duration-300", currentTextColorClass)}>
          Readiness Score
        </p>
        <p className="text-sm text-muted-foreground">
          {onClick ? "Click to view details" : "Agent-ready"}
        </p>
      </div>
    </div>
  )
}
