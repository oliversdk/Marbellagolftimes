import { useState, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import placeholderImage from "@assets/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  className,
  skeletonClassName,
  fallbackSrc = placeholderImage,
  onImageLoad,
  onImageError,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onImageLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onImageError?.();
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Failed to load image: ${src}`);
    }
  };

  const imageSrc = hasError ? fallbackSrc : (src || fallbackSrc);

  return (
    <div className="relative">
      {!isLoaded && (
        <Skeleton 
          className={cn("absolute inset-0", skeletonClassName || className)} 
          data-testid="img-skeleton"
        />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </div>
  );
}
