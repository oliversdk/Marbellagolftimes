import { useState, useEffect, useMemo } from "react"

type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl"

interface BreakpointConfig {
  name: Breakpoint
  minWidth: number
}

const BREAKPOINTS: BreakpointConfig[] = [
  { name: "sm", minWidth: 640 },
  { name: "md", minWidth: 768 },
  { name: "lg", minWidth: 1024 },
  { name: "xl", minWidth: 1280 },
  { name: "2xl", minWidth: 1536 },
]

function getBreakpoint(width: number): Breakpoint {
  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    if (width >= BREAKPOINTS[i].minWidth) {
      return BREAKPOINTS[i].name
    }
  }
  return "sm"
}

export interface UseBreakpointReturn {
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
}

export function useBreakpoint(): UseBreakpointReturn {
  // Use matchMedia for initial value to avoid forced reflow from reading innerWidth
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1024
    // Determine width from matchMedia without triggering layout
    for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
      if (window.matchMedia(`(min-width: ${BREAKPOINTS[i].minWidth}px)`).matches) {
        return BREAKPOINTS[i].minWidth
      }
    }
    return 320 // Mobile fallback
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    // Create media query listeners for each breakpoint
    const mediaQueries = BREAKPOINTS.map((bp) => {
      const mql = window.matchMedia(`(min-width: ${bp.minWidth}px)`)
      const handler = () => {
        // Find current breakpoint from matchMedia (avoids innerWidth reflow)
        for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
          if (window.matchMedia(`(min-width: ${BREAKPOINTS[i].minWidth}px)`).matches) {
            setWidth(BREAKPOINTS[i].minWidth)
            return
          }
        }
        setWidth(320)
      }
      mql.addEventListener("change", handler)
      return { mql, handler }
    })

    return () => {
      mediaQueries.forEach(({ mql, handler }) => {
        mql.removeEventListener("change", handler)
      })
    }
  }, [])

  const breakpoint = useMemo(() => getBreakpoint(width), [width])

  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024
  const isDesktop = width >= 1024

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    width,
  }
}

export { type Breakpoint }
