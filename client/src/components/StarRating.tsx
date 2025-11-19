import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

interface StarRatingProps extends React.HTMLAttributes<HTMLDivElement> {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onRatingChange,
  className,
  ...rest
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const stars = Array.from({ length: maxRating }, (_, i) => i + 1);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleClick = (starRating: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentStar: number) => {
    if (!interactive || !onRatingChange) return;
    
    let nextFocus: number | null = null;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRatingChange(currentStar);
      return;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextFocus = currentStar < maxRating ? currentStar + 1 : currentStar;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextFocus = currentStar > 1 ? currentStar - 1 : currentStar;
    }
    
    if (nextFocus !== null) {
      const nextButton = buttonRefs.current[nextFocus - 1];
      if (nextButton) {
        nextButton.focus();
      }
    }
  };

  return (
    <div 
      className={cn("flex gap-0.5", className)} 
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Rating" : undefined}
      {...rest}
    >
      {stars.map((star) => {
        const isFilled = star <= rating;
        const isHalf = star - 0.5 === rating;
        const isChecked = star === rating;

        const StarContent = (
          <Star
            className={cn(
              sizeClasses[size],
              isFilled || isHalf
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-muted-foreground/30"
            )}
          />
        );

        if (interactive) {
          // Roving tabindex: only the currently selected star (or first star if none selected) is tabbable
          const tabIndex = rating === 0 ? (star === 1 ? 0 : -1) : (isChecked ? 0 : -1);
          
          return (
            <button
              key={star}
              ref={(el) => (buttonRefs.current[star - 1] = el)}
              type="button"
              role="radio"
              aria-checked={isChecked}
              onClick={() => handleClick(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              tabIndex={tabIndex}
              className="relative hover-elevate active-elevate-2 cursor-pointer transition-transform"
              data-testid={`button-star-${star}`}
              aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            >
              {StarContent}
            </button>
          );
        }

        return (
          <span
            key={star}
            className="relative"
            data-testid={`text-star-${star}`}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          >
            {StarContent}
          </span>
        );
      })}
    </div>
  );
}
