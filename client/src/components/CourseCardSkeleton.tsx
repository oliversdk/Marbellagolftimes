import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GolfLoader } from "@/components/GolfLoader";

export function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden" data-testid="skeleton-course-card">
      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Left: Course Image Skeleton */}
        <div className="w-full md:w-48 flex-shrink-0">
          <Skeleton className="h-32 w-full rounded-md" />
        </div>

        {/* Right: Course Info + Tee Times Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Header: Name + Location + Price + Distance */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>

          {/* Tee Times Label */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            
            {/* Inline Tee Times - Horizontal Scroll */}
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton 
                  key={idx} 
                  className="h-14 w-20 flex-shrink-0 rounded-md" 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function CourseCardSkeletonGrid() {
  return (
    <div className="space-y-4" data-testid="skeleton-course-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TraditionalCourseCardSkeleton() {
  return (
    <Card className="overflow-hidden hover-elevate" data-testid="skeleton-traditional-course-card">
      <CardHeader className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </CardContent>

      <div className="p-4 pt-0 flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
    </Card>
  );
}

export function TraditionalCourseCardSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="skeleton-traditional-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <TraditionalCourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MapLoadingSkeleton() {
  return (
    <div className="h-[600px] rounded-lg border bg-muted/30 flex items-center justify-center" data-testid="skeleton-map">
      <GolfLoader size="lg" text="Loading map..." />
    </div>
  );
}
