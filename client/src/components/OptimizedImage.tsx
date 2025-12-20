import { useState, useEffect, useRef, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
// Use CDN path for optimized WebP delivery
const defaultPlaceholder = "/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";

interface ImageVersions {
  desktop: string;
  mobile: string;
  thumbnail: string;
}

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  fallbackSrc?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
  priority?: boolean;
  size?: "thumbnail" | "mobile" | "desktop" | "auto";
}

function getImageFilename(src: string): string | null {
  if (!src) return null;
  const parts = src.split("/");
  const filename = parts[parts.length - 1];
  if (filename.endsWith(".png") || filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
    return filename;
  }
  return null;
}

export function OptimizedImage({
  src,
  alt,
  className,
  skeletonClassName,
  fallbackSrc = defaultPlaceholder,
  onImageLoad,
  onImageError,
  priority = false,
  size = "auto",
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const imgRef = useRef<HTMLImageElement>(null);

  const { data: imageVersions } = useQuery<Record<string, ImageVersions>>({
    queryKey: ["/api/image-versions"],
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Check if image is already loaded from cache on mount/src change
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  });

  const handleLoad = () => {
    setIsLoaded(true);
    onImageLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onImageError?.();
  };

  const getOptimizedSrc = (): string => {
    if (hasError) return fallbackSrc;
    if (!src) return fallbackSrc;
    
    const filename = getImageFilename(src);
    if (!filename || !imageVersions || !imageVersions[filename]) {
      return src;
    }

    const versions = imageVersions[filename];
    
    switch (size) {
      case "thumbnail":
        return versions.thumbnail;
      case "mobile":
        return versions.mobile;
      case "desktop":
        return versions.desktop;
      case "auto":
      default:
        return isMobile ? versions.mobile : versions.desktop;
    }
  };

  const imageSrc = getOptimizedSrc();

  if (!src && !hasError) {
    return (
      <div className={cn("relative shrink-0 bg-muted flex items-center justify-center", className)}>
        <img src={fallbackSrc} alt={alt} className={cn("object-cover", className)} {...props} />
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden", className)}>
      {!isLoaded && (
        <Skeleton 
          className={cn("absolute inset-0 z-10 rounded-md", skeletonClassName)} 
          data-testid="img-skeleton"
        />
      )}
      <img
        ref={imgRef}
        key={imageSrc}
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full object-cover"
        {...props}
      />
    </div>
  );
}
