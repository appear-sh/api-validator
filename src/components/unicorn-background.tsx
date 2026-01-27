"use client"

import { useEffect, useRef, useState, useId } from "react"
import { cn } from "@/lib/utils"
import { loadUnicornStudio, type UnicornScene } from "@/lib/unicorn-studio"
import type { Grade } from "@/lib/types"

interface UnicornBackgroundProps {
  score: number
  grade: Grade
  className?: string
  fps?: number
  scale?: number
  dpi?: number
  disableMobile?: boolean
}

// Score thresholds for animation selection
// Aligned with grade thresholds for consistent visual feedback
const SCORE_THRESHOLDS = {
  good: 80,   // Grade A/B - genuinely good APIs
  medium: 60, // Grade C/D - needs improvement
  // bad: < 60 - Grade F, failing
} as const

// Get animation path based on score
function getAnimationPath(score: number): string {
  if (score >= SCORE_THRESHOLDS.good) {
    return '/animations/good-score.json'  // Green - A/B grades
  } else if (score >= SCORE_THRESHOLDS.medium) {
    return '/animations/medium-score.json' // Amber - C/D grades
  } else {
    return '/animations/bad-score.json'    // Red - F grade
  }
}

/**
 * UnicornBackground - Renders Unicorn Studio animations as background layer
 * 
 * Based on appear.sh homepage implementation.
 * Uses the official Unicorn Studio SDK with addScene() API.
 * 
 * Animation Files in /public/animations/:
 * - good-score.json (scores 70+)
 * - medium-score.json (scores 40-69)  
 * - bad-score.json (scores < 40)
 * 
 * Performance notes:
 * - FPS: 20 is plenty for subtle gradient animations (saves ~33% GPU vs 30fps)
 * - DPI: 1 is sufficient for blurry gradients (saves ~50% pixels vs 1.5)
 * - Mobile: Disabled by default to preserve battery
 */
export function UnicornBackground({ 
  score, 
  className,
  fps = 20,    // Low FPS for subtle background - saves GPU cycles
  scale = 1,
  dpi = 1,     // Lower DPI - blurry gradients don't need retina resolution
  disableMobile = true,
}: UnicornBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<UnicornScene | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shouldInit, setShouldInit] = useState(false)
  
  // Generate unique ID for this instance
  const uniqueId = useId()
  const elementId = `unicorn-bg-${uniqueId.replace(/:/g, '-')}`
  
  const filePath = getAnimationPath(score)

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      return
    }

    // Fallback for browsers without IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      setShouldInit(true)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          setShouldInit(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px', threshold: 0 }
    )
    
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Initialize scene when shouldInit becomes true
  useEffect(() => {
    if (!shouldInit || !containerRef.current || !filePath) {
      return
    }

    let mounted = true

    const initializeScene = async () => {
      try {
        // Use singleton loader - script only loads once across all instances
        const UnicornStudio = await loadUnicornStudio()
        
        if (!mounted) return

        const sceneConfig = {
          elementId,
          filePath,
          fps,
          scale,
          dpi,
          lazyLoad: false, // We handle lazy loading ourselves
          fixed: false, // Use absolute positioning
          altText: 'Score background animation',
          ariaLabel: 'Score background animation',
          production: false,
          interactivity: {
            mouse: {
              disableMobile,
            },
          },
        }

        const scene = await UnicornStudio.addScene(sceneConfig)

        if (mounted) {
          sceneRef.current = scene
          setIsLoaded(true)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize scene")
          console.error("UnicornStudio initialization error:", err)
        }
      }
    }

    initializeScene()

    // Cleanup on unmount
    return () => {
      mounted = false
      if (sceneRef.current) {
        try {
          sceneRef.current.destroy()
        } catch (err) {
          console.error("Error destroying UnicornStudio scene:", err)
        }
        sceneRef.current = null
      }
    }
  }, [shouldInit, filePath, elementId, fps, scale, dpi, disableMobile])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (sceneRef.current) {
        try {
          sceneRef.current.resize()
        } catch (err) {
          console.error("Error resizing UnicornStudio scene:", err)
        }
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Don't render if there's an error
  if (error) {
    return null
  }

  return (
    <div
      ref={containerRef}
      id={elementId}
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500",
        isLoaded ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  )
}
