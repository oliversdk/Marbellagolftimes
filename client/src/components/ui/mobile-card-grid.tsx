import { cn } from "@/lib/utils"

interface MobileCardGridProps {
  children: React.ReactNode
  className?: string
  gap?: "sm" | "md" | "lg"
  columns?: {
    mobile?: 1 | 2
    tablet?: 2 | 3
    desktop?: 3 | 4 | 5 | 6
  }
}

const gapClasses = {
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
}

function MobileCardGrid({
  children,
  className,
  gap = "md",
  columns = { mobile: 1, tablet: 2, desktop: 3 },
}: MobileCardGridProps) {
  const mobileCol = columns.mobile ?? 1
  const tabletCol = columns.tablet ?? 2
  const desktopCol = columns.desktop ?? 3

  const mobileClass = mobileCol === 1 ? "grid-cols-1" : "grid-cols-2"
  const tabletClass =
    tabletCol === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
  const desktopClass = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }[desktopCol]

  return (
    <div
      className={cn(
        "grid",
        mobileClass,
        tabletClass,
        desktopClass,
        gapClasses[gap],
        className
      )}
      data-testid="mobile-card-grid"
    >
      {children}
    </div>
  )
}

export { MobileCardGrid }
export type { MobileCardGridProps }
