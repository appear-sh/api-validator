/**
 * Unicorn Studio SDK Loader
 * 
 * Singleton pattern to ensure the script only loads once,
 * even if multiple animation components are used on the page.
 * 
 * Based on appear.sh implementation.
 */

export interface UnicornScene {
  destroy: () => void
  resize: () => void
}

export interface UnicornStudio {
  addScene: (config: UnicornSceneConfig) => Promise<UnicornScene>
  init: () => Promise<UnicornScene[]>
  destroy: () => void
}

export interface UnicornSceneConfig {
  elementId: string
  projectId?: string
  filePath?: string
  fps?: number
  scale?: number
  dpi?: number
  lazyLoad?: boolean
  fixed?: boolean
  altText?: string
  ariaLabel?: string
  production?: boolean
  interactivity?: {
    mouse?: {
      disableMobile?: boolean
    }
  }
}

// Singleton promise - only one script load ever happens
let loadPromise: Promise<UnicornStudio> | null = null

// SDK CDN URL - v1.4.29 (matching appear.sh)
const SDK_URL = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js"

export function loadUnicornStudio(): Promise<UnicornStudio> {
  // Return cached promise if already loading/loaded
  if (loadPromise) {
    return loadPromise
  }

  // Check if already loaded (e.g., from a previous page visit)
  if (typeof window !== "undefined" && (window as any).UnicornStudio) {
    loadPromise = Promise.resolve((window as any).UnicornStudio as UnicornStudio)
    return loadPromise
  }

  // Create new load promise
  loadPromise = new Promise<UnicornStudio>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("UnicornStudio can only be loaded in browser"))
      return
    }

    const script = document.createElement("script")
    script.src = SDK_URL
    script.async = true

    script.onload = () => {
      if ((window as any).UnicornStudio) {
        resolve((window as any).UnicornStudio as UnicornStudio)
      } else {
        reject(new Error("UnicornStudio failed to initialize after script load"))
      }
    }

    script.onerror = () => {
      loadPromise = null
      reject(new Error("Failed to load UnicornStudio script from CDN"))
    }

    document.head.appendChild(script)
  })

  return loadPromise
}
