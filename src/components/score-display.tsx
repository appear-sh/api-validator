"use client"

import { useState, useEffect } from "react"
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"

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

  const getColor = (score: number) => {
    if (score >= 90) return "#a1a1aa" // zinc-400
    if (score >= 70) return "#71717a" // zinc-500
    if (score >= 50) return "#eab308" // yellow-500
    return "#ef4444" // red-500
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-background/30 backdrop-blur-sm border border-border/30">
      <div className="w-16 h-16">
        <CircularProgressbar
          value={animatedScore}
          text={`${Math.round(animatedScore)}`}
          strokeWidth={10}
          styles={buildStyles({
            textSize: "32px",
            pathColor: getColor(animatedScore),
            textColor: getColor(animatedScore),
            trailColor: "rgba(255, 255, 255, 0.1)",
            pathTransition: "stroke-dashoffset 0.5s ease 0s",
          })}
        />
      </div>
      <div>
        <p className="font-semibold">API Score</p>
        <p className="text-sm text-muted-foreground">Overall quality</p>
      </div>
    </div>
  )
}
