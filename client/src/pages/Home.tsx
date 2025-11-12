import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { LocationSearch } from "@/components/LocationSearch";
import { SearchFilters } from "@/components/SearchFilters";
import { CourseCard } from "@/components/CourseCard";
import { BookingModal } from "@/components/BookingModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { calculateDistance } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GolfCourse, InsertBookingRequest } from "@shared/schema";
import heroImage from "@assets/generated_images/Costa_del_Sol_golf_course_sunrise_89864b9c.png";

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch all courses
  const { data: courses, isLoading } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
    enabled: userLocation !== null,
  });

  // Calculate distances and sort courses
  const sortedCourses = courses
    ?.map((course) => {
      if (!userLocation || !course.lat || !course.lng) {
        return { course, distance: undefined };
      }
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        parseFloat(course.lat),
        parseFloat(course.lng)
      );
      return { course, distance };
    })
    .sort((a, b) => {
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });

  // Create booking request mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: InsertBookingRequest) => {
      return await apiRequest("POST", "/api/bookings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setBookingModalOpen(false);
      toast({
        title: "Booking Request Submitted!",
        description: "Your tee time request has been sent. You will receive a confirmation email shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Booking Failed",
        description: "Could not submit your booking request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLocationSelected = (lat: number, lng: number) => {
    setUserLocation({ lat, lng });
  };

  const handleBookCourse = (course: GolfCourse) => {
    setSelectedCourse(course);
    setBookingModalOpen(true);
  };

  const handleBookingSubmit = (data: Omit<InsertBookingRequest, "status">) => {
    createBookingMutation.mutate({ ...data, status: "PENDING" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Costa del Sol Golf Course"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative h-full flex items-center justify-center px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Find Your Perfect Tee Time
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              Discover the best golf courses on Costa del Sol, from Sotogrande to Málaga.
              Book your next round at premium courses near you.
            </p>

            <Card className="bg-white/95 backdrop-blur-md border-0 shadow-xl max-w-xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center">Start Your Search</CardTitle>
              </CardHeader>
              <CardContent>
                <LocationSearch onLocationSelected={handleLocationSelected} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Filters */}
      {userLocation && (
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <SearchFilters onSearch={() => {}} />
          </div>
        </div>
      )}

      {/* Course Results */}
      {userLocation && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold mb-2">Nearby Golf Courses</h2>
            <p className="text-muted-foreground">
              {courses?.length || 0} courses found in Costa del Sol
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedCourses && sortedCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="courses-list">
              {sortedCourses.map(({ course, distance }) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  distance={distance}
                  onBook={() => handleBookCourse(course)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No courses found. Try selecting a different location.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        course={selectedCourse}
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSubmit={handleBookingSubmit}
        isPending={createBookingMutation.isPending}
      />
    </div>
  );
}
