import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { LocationSearch } from "@/components/LocationSearch";
import { SearchFilters } from "@/components/SearchFilters";
import { CourseCard } from "@/components/CourseCard";
import { BookingModal } from "@/components/BookingModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateDistance } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GolfCourse, InsertBookingRequest } from "@shared/schema";
import heroImage from "@assets/generated_images/Costa_del_Sol_golf_course_sunrise_89864b9c.png";

interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  source: string;
}

interface CourseWithSlots {
  courseId: string;
  courseName: string;
  distanceKm: number;
  bookingUrl?: string;
  slots: TeeTimeSlot[];
  note?: string;
  course?: GolfCourse;
}

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFilters, setSearchFilters] = useState<{
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
  }>({ players: 2, fromTime: "07:00", toTime: "20:00" });
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TeeTimeSlot | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch all courses
  const { data: courses, isLoading: coursesLoading } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch available tee time slots
  const { data: availableSlots, isLoading: slotsLoading, refetch: refetchSlots } = useQuery<CourseWithSlots[]>({
    queryKey: [
      "/api/slots/search",
      userLocation?.lat,
      userLocation?.lng,
      searchFilters.date?.toISOString(),
      searchFilters.players,
      searchFilters.fromTime,
      searchFilters.toTime,
    ],
    enabled: userLocation !== null,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append("lat", userLocation.lat.toString());
        params.append("lng", userLocation.lng.toString());
        params.append("radiusKm", "100");
      }
      if (searchFilters.date) {
        params.append("date", searchFilters.date.toISOString());
      }
      params.append("players", searchFilters.players.toString());
      params.append("fromTime", searchFilters.fromTime);
      params.append("toTime", searchFilters.toTime);

      const response = await fetch(`/api/slots/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch slots");
      const data = await response.json();

      // Enrich with course data
      return data.map((slot: CourseWithSlots) => {
        const course = courses?.find((c) => c.id === slot.courseId);
        return { ...slot, course };
      });
    },
  });

  // Calculate distances for all courses if we have location
  const coursesWithDistance = courses
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
    .filter(({ distance }) => !isNaN(distance || 0))
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
      setSelectedSlot(null);
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

  const handleFiltersApplied = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
    if (userLocation) {
      refetchSlots();
    }
  };

  const handleBookSlot = (courseSlot: CourseWithSlots, slot: TeeTimeSlot) => {
    if (courseSlot.course) {
      setSelectedCourse(courseSlot.course);
      setSelectedSlot(slot);
      setBookingModalOpen(true);
    }
  };

  const handleBookingSubmit = (data: Omit<InsertBookingRequest, "status">) => {
    createBookingMutation.mutate({ ...data, status: "PENDING" });
  };

  const isSearching = slotsLoading || coursesLoading;

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
              Check real-time availability and book your next round.
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
            <SearchFilters onSearch={handleFiltersApplied} />
          </div>
        </div>
      )}

      {/* Available Tee Times */}
      {userLocation && availableSlots && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold mb-2">Available Tee Times</h2>
            <p className="text-muted-foreground">
              {availableSlots.length} courses with availability in your search window
            </p>
          </div>

          {isSearching ? (
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
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="available-slots-list">
              {availableSlots.map((courseSlot) => (
                <Card key={courseSlot.courseId} className="overflow-hidden hover-elevate" data-testid={`card-slot-${courseSlot.courseId}`}>
                  <CardHeader className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-serif font-semibold text-lg leading-tight">
                          {courseSlot.courseName}
                        </h3>
                        {courseSlot.course && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {courseSlot.course.city}, {courseSlot.course.province}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" data-testid={`badge-distance-${courseSlot.courseId}`}>
                        {courseSlot.distanceKm.toFixed(1)} km
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 space-y-3">
                    {courseSlot.slots.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Available Times:</p>
                        {courseSlot.slots.slice(0, 3).map((slot, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-accent/30 rounded-md hover-elevate cursor-pointer"
                            onClick={() => handleBookSlot(courseSlot, slot)}
                            data-testid={`slot-time-${courseSlot.courseId}-${idx}`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {new Date(slot.teeTime).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-primary">
                              €{slot.greenFee}
                            </div>
                          </div>
                        ))}
                        {courseSlot.note && (
                          <p className="text-xs text-muted-foreground italic">{courseSlot.note}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No availability in selected time window
                      </p>
                    )}

                    {courseSlot.bookingUrl && (
                      <button
                        onClick={() => window.open(courseSlot.bookingUrl, "_blank")}
                        className="w-full text-sm text-primary hover:underline"
                        data-testid={`link-booking-site-${courseSlot.courseId}`}
                      >
                        View on club website →
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No available tee times found in your search window. Try adjusting your filters.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* All Courses View (when no location selected) */}
      {!userLocation && courses && courses.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-bold mb-2">All Costa del Sol Courses</h2>
            <p className="text-muted-foreground">
              {courses.length} premium golf courses from Sotogrande to Málaga
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        course={selectedCourse}
        selectedSlot={selectedSlot}
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSubmit={handleBookingSubmit}
        isPending={createBookingMutation.isPending}
      />
    </div>
  );
}
