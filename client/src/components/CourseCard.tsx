import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Mail, Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { useFavorites } from "@/hooks/useFavorites";
import type { GolfCourse } from "@shared/schema";

interface CourseCardProps {
  course: GolfCourse;
  distance?: number;
  price?: number;
  priceRange?: { min: number; max: number };
  isBestDeal?: boolean;
  onBook?: () => void;
  onViewDetails?: () => void;
}

export function CourseCard({ course, distance, price, priceRange, isBestDeal, onBook, onViewDetails }: CourseCardProps) {
  const { t } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const isFav = isFavorite(course.id.toString());
  
  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-course-${course.id}`}>
      <CardHeader className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-serif font-semibold text-lg leading-tight" data-testid={`text-course-name-${course.id}`}>
                {course.name}
              </h3>
              {isBestDeal && (
                <Badge variant="default" data-testid={`badge-best-deal-${course.id}`}>
                  {t('course.bestDeal')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span data-testid={`text-course-location-${course.id}`}>
                {course.city}, {course.province}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(course.id.toString());
              }}
              className="h-8 w-8"
              data-testid={`button-favorite-${course.id}`}
              aria-label={isFav ? t('course.removeFromFavorites') : t('course.addToFavorites')}
            >
              <Heart
                className={`h-5 w-5 ${isFav ? 'fill-current text-red-500' : 'text-muted-foreground'}`}
              />
            </Button>
            {distance !== undefined && (
              <Badge variant="secondary" data-testid={`badge-distance-${course.id}`}>
                {t('course.distance', { distance: distance.toFixed(1) })}
              </Badge>
            )}
            {(price !== undefined || priceRange) && (
              <div className="text-right" data-testid={`text-price-${course.id}`}>
                {priceRange ? (
                  <div className="text-xl font-bold">
                    {t('course.priceRange', { min: priceRange.min, max: priceRange.max })}
                  </div>
                ) : price !== undefined ? (
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">{t('course.from')}</div>
                    <div className="text-xl font-bold">€{price}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex flex-col gap-2 text-sm">
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

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant="default"
          className="flex-1"
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
            onClick={() => window.open(course.bookingUrl || course.websiteUrl || "", "_blank")}
            data-testid={`button-club-site-${course.id}`}
          >
            {t('course.bookNow')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
