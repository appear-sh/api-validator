"use client"

import React, { useEffect, useState, useSyncExternalStore } from "react"
import dynamic from 'next/dynamic'
import { cn } from "@/lib/utils"

// Dynamically import Lottie with SSR disabled
const Lottie = dynamic(() => import('lottie-react').then((mod) => mod.Lottie), { ssr: false })

// Define a type for Lottie animation data
type LottieAnimationData = Record<string, unknown>;

interface LottieLoaderProps {
  className?: string
  height?: number | string
  width?: number | string
  text?: string
  textClassName?: string
}

export function LottieLoader({ 
  className, 
  height = 80, 
  width = 80, 
  text = "Loading validation results...",
  textClassName
}: LottieLoaderProps) {
  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!isMounted) return

    let cancelled = false
    fetch('/Loader Lottie.json')
      .then(response => response.json())
      .then(data => {
        if (!cancelled) setAnimationData(data)
      })
      .catch(error => console.error('Error loading animation:', error));
    return () => {
      cancelled = true
    }
  }, [isMounted]);

  // Server-side or initial mount, use fallback spinner
  if (!isMounted || !animationData) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p className={cn("text-muted-foreground", textClassName)}>
          {text}
        </p>
      </div>
    );
  }

  // Client-side with loaded animation data
  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ height, width }} className={cn("relative", className)}>
        <Lottie
          src={animationData}
          loop
          autoplay
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      {text && (
        <p className={cn("text-muted-foreground", textClassName)}>
          {text}
        </p>
      )}
    </div>
  )
} 