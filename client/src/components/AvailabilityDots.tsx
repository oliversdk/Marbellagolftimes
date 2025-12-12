import { cn } from "@/lib/utils";

interface AvailabilityDotsProps {
  slotsAvailable?: number;
  maxSlots?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

/**
 * AvailabilityDots - Shows remaining player slots as filled/empty dots (ontee.com style)
 * 
 * ●●●● = 4 slots available (fully open)
 * ●●●○ = 3 slots available
 * ●●○○ = 2 slots available
 * ●○○○ = 1 slot available
 * ○○○○ = 0 slots available (fully booked - typically not shown)
 */
export function AvailabilityDots({
  slotsAvailable = 4,
  maxSlots = 4,
  size = "sm",
  className,
  showLabel = false
}: AvailabilityDotsProps) {
  // Clamp values to valid range
  const available = Math.max(0, Math.min(slotsAvailable, maxSlots));
  const total = Math.max(1, Math.min(maxSlots, 4));
  
  // Size configurations
  const sizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5"
  };
  
  const gapClasses = {
    sm: "gap-0.5",
    md: "gap-1",
    lg: "gap-1"
  };
  
  // Color based on availability
  const getFilledColor = () => {
    if (available === 1) return "bg-orange-500"; // Last spot - urgent
    if (available === 2) return "bg-yellow-500"; // Limited
    return "bg-emerald-500"; // Good availability
  };
  
  return (
    <div 
      className={cn("flex items-center", gapClasses[size], className)}
      title={`${available} ${available === 1 ? 'spot' : 'spots'} available`}
      data-testid="availability-dots"
    >
      {Array.from({ length: total }).map((_, index) => {
        const isFilled = index < available;
        return (
          <div
            key={index}
            className={cn(
              "rounded-full transition-colors",
              sizeClasses[size],
              isFilled ? getFilledColor() : "bg-muted-foreground/30"
            )}
            data-testid={`dot-${index}-${isFilled ? 'filled' : 'empty'}`}
          />
        );
      })}
      {showLabel && (
        <span className="ml-1 text-[10px] text-muted-foreground">
          {available}/{total}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for use inside buttons/badges
 */
export function AvailabilityDotsCompact({
  slotsAvailable = 4,
  className
}: {
  slotsAvailable?: number;
  className?: string;
}) {
  const available = Math.max(0, Math.min(slotsAvailable, 4));
  
  // For very compact display, use colored bar segments
  const getColor = () => {
    if (available === 1) return "bg-orange-400";
    if (available === 2) return "bg-yellow-400";
    if (available === 3) return "bg-emerald-400";
    return "bg-emerald-500";
  };
  
  return (
    <div 
      className={cn("flex items-center gap-px", className)}
      title={`${available} ${available === 1 ? 'spot' : 'spots'} available`}
      data-testid="availability-dots"
    >
      {Array.from({ length: 4 }).map((_, index) => {
        const isFilled = index < available;
        return (
          <div
            key={index}
            className={cn(
              "w-1 h-2 rounded-[1px]",
              isFilled ? getColor() : "bg-current opacity-20"
            )}
          />
        );
      })}
    </div>
  );
}
