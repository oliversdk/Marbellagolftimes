import { useState, useCallback, memo, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Mail, Heart, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { useFavorites } from "@/hooks/useFavorites";
import { motion, PanInfo } from "framer-motion";
import type { GolfCourse } from "@shared/schema";
import { OptimizedImage } from "./OptimizedImage";
// Use CDN path for optimized WebP delivery
const placeholderImage = "/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface CourseCardProps {
  course: GolfCourse;
  distance?: number;
  price?: number;
  priceRange?: { min: number; max: number };
  isBestDeal?: boolean;
  providerName?: "golfmanager" | "teeone" | "zest" | null;
  onBook?: () => void;
  onViewDetails?: () => void;
  priority?: boolean;
}

export const CourseCard = memo(function CourseCard({ course, distance, price, priceRange, isBestDeal, providerName, onBook, onViewDetails, priority = false }: CourseCardProps) {
  const { t } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isMobile } = useBreakpoint();
  const [swipePosition, setSwipePosition] = useState(0);
  
  useEffect(() => {
    if (isMobile) {
      setSwipePosition(0);
    }
  }, [isMobile]);
  
  const isFav = isFavorite(course.id.toString());

  const handleDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 100;
    
    if (Math.abs(info.offset.x) > swipeThreshold) {
      toggleFavorite(course.id.toString());
    }
    
    setSwipePosition(0);
  }, [course.id, toggleFavorite]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    toggleFavorite(course.id.toString());
  }, [course.id, toggleFavorite]);

  const cardContent = (
      <Card className="overflow-visible hover-elevate relative" data-testid={`card-course-${course.id}`}>
        {swipePosition !== 0 && (
          <div
            className={`absolute inset-y-0 ${swipePosition > 0 ? 'left-0' : 'right-0'} w-16 flex items-center justify-center z-0 ${
              isFav ? 'bg-destructive' : 'bg-primary'
            } transition-colors`}
            style={{
              opacity: Math.min(Math.abs(swipePosition) / 100, 1),
            }}
          >
            <Heart className={`h-6 w-6 ${isFav ? 'fill-white text-white' : 'text-white'}`} />
          </div>
        )}
        <OptimizedImage
          src={course.imageUrl || placeholderImage}
          alt={course.name}
          className="w-full h-40 sm:h-48 object-cover rounded-t-lg"
          priority={priority}
          data-testid={`img-course-${course.id}`}
        />
      <CardHeader className="p-3 sm:p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-sm sm:text-base md:text-lg leading-tight mb-1" data-testid={`text-course-name-${course.id}`}>
              {course.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {providerName === "golfmanager" && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400" data-testid={`badge-gm-${course.id}`}>
                  GM
                </Badge>
              )}
              {providerName === "zest" && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 shrink-0 bg-green-500/10 text-green-600 border-green-500/30 dark:bg-green-500/20 dark:text-green-400" data-testid={`badge-zest-${course.id}`}>
                  LIVE
                </Badge>
              )}
              {isBestDeal && (
                <Badge variant="default" className="shrink-0" data-testid={`badge-best-deal-${course.id}`}>
                  {t('course.bestDeal')}
                </Badge>
              )}
              {(course as any).averageRating >= 4.5 && (course as any).reviewCount > 0 && (
                <Badge variant="secondary" className="gap-1 shrink-0" data-testid={`badge-top-rated-${course.id}`}>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  Top Rated
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate" data-testid={`text-course-location-${course.id}`}>
                {course.city}, {course.province}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleFavoriteClick}
              className="h-11 w-11 min-h-[44px] min-w-[44px] p-0"
              data-testid={`button-favorite-${course.id}`}
              aria-label={isFav ? t('course.removeFromFavorites') : t('course.addToFavorites')}
            >
              <Heart
                className={`h-6 w-6 ${isFav ? 'fill-current text-red-500' : 'text-muted-foreground'}`}
              />
            </Button>
            {distance !== undefined && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-distance-${course.id}`}>
                {t('course.distance', { distance: distance.toFixed(1) })}
              </Badge>
            )}
            {(price !== undefined || priceRange) && (
              <div className="text-right" data-testid={`text-price-${course.id}`}>
                {priceRange ? (
                  <div className="text-lg sm:text-xl font-bold">
                    {t('course.priceRange', { min: priceRange.min, max: priceRange.max })}
                  </div>
                ) : price !== undefined ? (
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">{t('course.from')}</div>
                    <div className="text-lg sm:text-xl font-bold">€{price}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
        <div className="flex flex-col gap-2 text-xs sm:text-sm">
          {course.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate" data-testid={`text-course-email-${course.id}`}>{course.email}</span>
            </div>
          )}
          {course.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span data-testid={`text-course-phone-${course.id}`}>{course.phone}</span>
            </div>
          )}
          {course.websiteUrl && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4 flex-shrink-0" />
              <a
                href={course.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-primary transition-colors"
                data-testid={`link-course-website-${course.id}`}
              >
                {t('course.viewDetails')}
              </a>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-3 sm:p-4 pt-0 flex flex-col sm:flex-row gap-2">
        <Button
          variant="default"
          className="flex-1 w-full sm:w-auto min-h-12"
          asChild
          data-testid={`button-view-details-${course.id}`}
        >
          <Link href={`/course/${course.id}`}>
            {t('course.viewDetails')}
          </Link>
        </Button>
        {course.bookingUrl && (
          <Button
            variant="outline"
            className="w-full sm:w-auto min-h-12"
            onClick={() => window.open(course.bookingUrl || course.websiteUrl || "", "_blank")}
            data-testid={`button-club-site-${course.id}`}
          >
            {t('course.bookNow')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  if (isMobile) {
    return (
      <div data-testid={`card-course-wrapper-${course.id}`}>
        {cardContent}
      </div>
    );
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDrag={(_event, info) => setSwipePosition(info.offset.x)}
      onDragEnd={handleDragEnd}
      data-testid={`card-course-wrapper-${course.id}`}
    >
      {cardContent}
    </motion.div>
  );
});
