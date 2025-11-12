import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Globe, Mail } from "lucide-react";
import type { GolfCourse } from "@shared/schema";

interface CourseCardProps {
  course: GolfCourse;
  distance?: number;
  onBook?: () => void;
  onViewDetails?: () => void;
}

export function CourseCard({ course, distance, onBook, onViewDetails }: CourseCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-course-${course.id}`}>
      <CardHeader className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-serif font-semibold text-lg leading-tight" data-testid={`text-course-name-${course.id}`}>
              {course.name}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span data-testid={`text-course-location-${course.id}`}>
                {course.city}, {course.province}
              </span>
            </div>
          </div>
          {distance !== undefined && (
            <Badge variant="secondary" data-testid={`badge-distance-${course.id}`}>
              {distance.toFixed(1)} km
            </Badge>
          )}
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
                Visit Website
              </a>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        {onBook && (
          <Button
            variant="default"
            className="flex-1"
            onClick={onBook}
            data-testid={`button-book-course-${course.id}`}
          >
            Book Tee Time
          </Button>
        )}
        {course.bookingUrl && (
          <Button
            variant="outline"
            onClick={() => window.open(course.bookingUrl || course.websiteUrl || "", "_blank")}
            data-testid={`button-club-site-${course.id}`}
          >
            Club Site
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
