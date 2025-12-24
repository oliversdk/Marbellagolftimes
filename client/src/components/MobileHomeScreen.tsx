import { useState, useMemo } from "react";
import { MobileLayout } from "./MobileLayout";
import { MobileHeader } from "./MobileHeader";
import { MobileCourseCard } from "./MobileCourseCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { ChevronDown, Clock, MapPin, TrendingUp, Flame } from "lucide-react";
import type { CourseWithSlots, TeeTimeSlot, GolfCourse } from "@shared/schema";

interface MobileHomeScreenProps {
  courses: CourseWithSlots[] | undefined;
  isLoading: boolean;
  userLocation: { lat: number; lng: number } | null;
  onLocationClick: () => void;
  onFiltersClick: () => void;
  onBookCourse: (course: CourseWithSlots, slot?: TeeTimeSlot) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFiltersCount: number;
}

type SortOption = "distance" | "price" | "availability";

export function MobileHomeScreen({
  courses,
  isLoading,
  userLocation,
  onLocationClick,
  onFiltersClick,
  onBookCourse,
  searchValue,
  onSearchChange,
  activeFiltersCount,
}: MobileHomeScreenProps) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<SortOption>("availability");
  const [visibleCount, setVisibleCount] = useState(6);

  const locationName = userLocation 
    ? (userLocation.lat === 36.5101 ? "Marbella" : t('mobile.yourLocation'))
    : "Costa del Sol";

  const sortedCourses = useMemo(() => {
    if (!courses) return [];
    
    const filtered = searchValue 
      ? courses.filter(c => c.courseName.toLowerCase().includes(searchValue.toLowerCase()))
      : courses;
    
    return [...filtered].sort((a, b) => {
      if (sortBy === "availability") {
        if (a.slots.length > 0 && b.slots.length === 0) return -1;
        if (a.slots.length === 0 && b.slots.length > 0) return 1;
        return b.slots.length - a.slots.length;
      }
      if (sortBy === "distance") {
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
      }
      if (sortBy === "price") {
        const priceA = a.slots.length > 0 ? Math.min(...a.slots.map(s => s.greenFee)) : 999;
        const priceB = b.slots.length > 0 ? Math.min(...b.slots.map(s => s.greenFee)) : 999;
        return priceA - priceB;
      }
      return 0;
    });
  }, [courses, searchValue, sortBy]);

  const visibleCourses = sortedCourses.slice(0, visibleCount);
  const hasMore = visibleCount < sortedCourses.length;

  const coursesWithSlots = sortedCourses.filter(c => c.slots.length > 0);
  const totalSlots = coursesWithSlots.reduce((sum, c) => sum + c.slots.length, 0);

  const sortOptions: { id: SortOption; label: string; icon: typeof Clock }[] = [
    { id: "availability", label: t('mobile.availableTimes'), icon: Clock },
    { id: "distance", label: t('mobile.distance'), icon: MapPin },
    { id: "price", label: t('mobile.price'), icon: TrendingUp },
  ];

  return (
    <MobileLayout activeTab="home">
      <MobileHeader
        title="Marbella Golf Times"
        subtitle={`${coursesWithSlots.length} ${t('mobile.coursesWithAvailableTimes')}`}
        locationName={locationName}
        onLocationClick={onLocationClick}
        onSearchChange={onSearchChange}
        onFiltersClick={onFiltersClick}
        searchValue={searchValue}
        showSearch={true}
        activeFiltersCount={activeFiltersCount}
      />
      
      <div className="px-4 -mt-2">
        {isLoading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-sm">
                <Skeleton className="w-full h-40" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {totalSlots > 0 && (
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-4 mb-4 flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-xl">
                  <Flame className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {totalSlots} {t('mobile.availableTimesToday')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {coursesWithSlots.length} {t('mobile.differentCourses')}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide" data-testid="mobile-sort-options">
              {sortOptions.map((option) => {
                const Icon = option.icon;
                const isActive = sortBy === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSortBy(option.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "bg-card text-muted-foreground border border-border"
                    }`}
                    data-testid={`mobile-sort-${option.id}`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            
            {visibleCourses.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('mobile.noCoursesFound')}</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {t('mobile.tryChangingFilters')}
                </p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="mobile-courses-list">
                {visibleCourses.map((course, index) => (
                  <MobileCourseCard
                    key={course.courseId}
                    course={course}
                    onBook={onBookCourse}
                    priority={index < 2}
                  />
                ))}
              </div>
            )}
            
            {hasMore && (
              <div className="mt-6 mb-4">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                  onClick={() => setVisibleCount(prev => prev + 6)}
                  data-testid="mobile-load-more"
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  {t('mobile.showMore')} ({sortedCourses.length - visibleCount} {t('mobile.more')})
                </Button>
              </div>
            )}
            
            <p className="text-center text-xs text-muted-foreground py-4">
              {t('mobile.showing')} {Math.min(visibleCount, sortedCourses.length)} {t('mobile.of')} {sortedCourses.length} {t('mobile.courses')}
            </p>
          </>
        )}
      </div>
    </MobileLayout>
  );
}
