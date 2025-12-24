import { Link } from "wouter";
import { MapPin, Clock, Heart, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useFavorites } from "@/hooks/useFavorites";
import { useI18n } from "@/lib/i18n";
import type { CourseWithSlots, TeeTimeSlot } from "@shared/schema";

const placeholderImage = "/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";

interface MobileCourseCardProps {
  course: CourseWithSlots;
  onBook?: (course: CourseWithSlots, slot?: TeeTimeSlot) => void;
  priority?: boolean;
}

function getMinPrice(slots: TeeTimeSlot[]): number | null {
  if (slots.length === 0) return null;
  return Math.min(...slots.map(s => s.greenFee));
}

function getTimeRange(slots: TeeTimeSlot[]): string | null {
  if (slots.length === 0) return null;
  const times = slots.map(s => new Date(s.teeTime)).sort((a, b) => a.getTime() - b.getTime());
  const formatTime = (d: Date) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  return `${formatTime(times[0])} - ${formatTime(times[times.length - 1])}`;
}

export function MobileCourseCard({ course, onBook, priority = false }: MobileCourseCardProps) {
  const { t } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const courseId = course.courseId.toString();
  const isFav = isFavorite(courseId);
  
  const minPrice = getMinPrice(course.slots);
  const timeRange = getTimeRange(course.slots);
  const hasSlots = course.slots.length > 0;
  const imageUrl = course.course?.imageUrl || placeholderImage;

  return (
    <div 
      className="bg-white dark:bg-card rounded-2xl shadow-sm overflow-hidden border border-border/50"
      data-testid={`mobile-course-card-${course.courseId}`}
    >
      <div className="relative">
        <Link href={`/course/${course.courseId}`}>
          <OptimizedImage
            src={imageUrl}
            alt={course.courseName}
            size="mobile"
            priority={priority}
            className="w-full h-40 object-cover"
            data-testid={`mobile-course-image-${course.courseId}`}
          />
        </Link>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(courseId);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all ${
            isFav 
              ? "bg-red-500 text-white" 
              : "bg-black/30 text-white hover:bg-black/50"
          }`}
          data-testid={`mobile-favorite-button-${course.courseId}`}
        >
          <Heart className={`h-5 w-5 ${isFav ? "fill-current" : ""}`} />
        </button>
        
        {hasSlots && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-primary text-white shadow-lg">
              {course.slots.length} {t('mobile.times')}
            </Badge>
          </div>
        )}
        
        {course.distanceKm && (
          <div className="absolute bottom-3 right-3">
            <Badge variant="secondary" className="bg-white/90 text-foreground shadow-sm">
              <MapPin className="h-3 w-3 mr-1" />
              {course.distanceKm.toFixed(1)} {t('mobile.km')}
            </Badge>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <Link href={`/course/${course.courseId}`}>
              <h3 
                className="font-semibold text-lg leading-tight mb-1 hover:text-primary transition-colors"
                data-testid={`mobile-course-name-${course.courseId}`}
              >
                {course.courseName}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {course.course?.city || "Costa del Sol"}
            </p>
          </div>
          
          {minPrice !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">{t('mobile.from')}</p>
              <p className="text-2xl font-bold text-primary" data-testid={`mobile-course-price-${course.courseId}`}>
                €{minPrice}
              </p>
            </div>
          )}
        </div>
        
        {hasSlots && (
          <>
            {/* Quick View - First 4 available tee times */}
            <div className="mb-3" data-testid={`quick-view-times-${course.courseId}`}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('mobile.nextTimes')}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {course.slots.slice(0, 4).map((slot, idx) => {
                  const time = new Date(slot.teeTime);
                  const timeStr = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onBook?.(course, slot);
                      }}
                      className="gap-1"
                      data-testid={`quick-time-${course.courseId}-${idx}`}
                    >
                      {timeStr}
                      <span className="text-xs text-muted-foreground">€{slot.greenFee}</span>
                    </Button>
                  );
                })}
                {course.slots.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBook?.(course);
                    }}
                    data-testid={`quick-more-${course.courseId}`}
                  >
                    +{course.slots.length - 4}
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                className="flex-1 h-12 rounded-xl text-base font-medium"
                onClick={() => onBook?.(course)}
                data-testid={`mobile-book-button-${course.courseId}`}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                {t('mobile.viewTimes')}
              </Button>
              <Button 
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl"
                asChild
              >
                <Link href={`/course/${course.courseId}`}>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </>
        )}
        
        {!hasSlots && (
          <Button 
            variant="outline"
            className="w-full h-12 rounded-xl text-base"
            asChild
          >
            <Link href={`/course/${course.courseId}`}>
              {t('home.viewDetails')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
