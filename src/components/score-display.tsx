"use client"

import { useState, useEffect } from "react"
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"
import { cn } from "@/lib/utils"

interface ScoreDisplayProps {
  score: number
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score)
    }, 100)

    return () => clearTimeout(timer)
  }, [score])

  const getTextColorClass = (score: number): string => {
    if (score >= 90) return "text-zinc-400"
    if (score >= 70) return "text-blue-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getBorderColorClass = (score: number): string => {
    if (score >= 90) return "border-zinc-400/50"
    if (score >= 70) return "border-blue-500/50"
    if (score >= 50) return "border-yellow-500/50"
    return "border-red-500/50"
  }
  
  const getHexColor = (score: number): string => {
    if (score >= 90) return "#a1a1aa" // zinc-400
    if (score >= 70) return "#3b82f6" // blue-500
    if (score >= 50) return "#eab308" // yellow-500
    return "#ef4444" // red-500
  }

  const currentTextColorClass = getTextColorClass(animatedScore);
  const currentBorderColorClass = getBorderColorClass(animatedScore);
  const currentHexColor = getHexColor(animatedScore);

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg bg-background/30 backdrop-blur-sm border transition-colors duration-300",
      currentBorderColorClass
    )}>
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
          API Score
        </p>
        <p className="text-sm text-muted-foreground">Overall quality</p>
      </div>
    </div>
  )
}
