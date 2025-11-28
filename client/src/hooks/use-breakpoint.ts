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
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 1024
    }
    return window.innerWidth
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateWidth = () => {
      setWidth(window.innerWidth)
    }

    updateWidth()

    const mediaQueries = BREAKPOINTS.map((bp) => {
      const mql = window.matchMedia(`(min-width: ${bp.minWidth}px)`)
      const handler = () => updateWidth()
      mql.addEventListener("change", handler)
      return { mql, handler }
    })

    window.addEventListener("resize", updateWidth)

    return () => {
      window.removeEventListener("resize", updateWidth)
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
