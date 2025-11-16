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
import type { GolfCourse, InsertBookingRequest, CourseWithSlots, TeeTimeSlot } from "@shared/schema";
import heroImage from "@assets/generated_images/Daytime_Costa_del_Sol_golf_walk_d48fdca9.png";

type SortMode = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";

// Utility: Get time range from slots
function getTimeRange(slots: TeeTimeSlot[]): { from: string; to: string } | null {
  if (slots.length === 0) return null;
  
  const times = slots.map(s => new Date(s.teeTime)).sort((a, b) => a.getTime() - b.getTime());
  const earliest = times[0];
  const latest = times[times.length - 1];
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  
  return { from: formatTime(earliest), to: formatTime(latest) };
}

// Utility: Get minimum price from slots
function getMinPrice(slots: TeeTimeSlot[]): number | null {
  if (slots.length === 0) return null;
  return Math.min(...slots.map(s => s.greenFee));
}

// Utility: Get cheapest slot from course
function getCheapestSlot(slots: TeeTimeSlot[]): TeeTimeSlot | null {
  if (slots.length === 0) return null;
  return slots.reduce((cheapest, current) => 
    current.greenFee < cheapest.greenFee ? current : cheapest
  );
}

// Utility: Sort courses by selected mode
function sortCourses(courses: CourseWithSlots[], mode: SortMode): CourseWithSlots[] {
  const sorted = [...courses];
  
  switch (mode) {
    case "distance-asc":
      return sorted.sort((a, b) => {
        const distA = a.distanceKm ?? Infinity;
        const distB = b.distanceKm ?? Infinity;
        return distA - distB;
      });
    case "distance-desc":
      return sorted.sort((a, b) => {
        const distA = a.distanceKm ?? -Infinity;
        const distB = b.distanceKm ?? -Infinity;
        return distB - distA;
      });
    case "price-asc":
      return sorted.sort((a, b) => {
        const priceA = getMinPrice(a.slots) ?? Infinity;
        const priceB = getMinPrice(b.slots) ?? Infinity;
        return priceA - priceB;
      });
    case "price-desc":
      return sorted.sort((a, b) => {
        const priceA = getMinPrice(a.slots) ?? -Infinity;
        const priceB = getMinPrice(b.slots) ?? -Infinity;
        return priceB - priceA;
      });
    default:
      return sorted;
  }
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
  const [sortMode, setSortMode] = useState<SortMode>("distance-asc");
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

  const handleBookCourse = (courseSlot: CourseWithSlots) => {
    if (courseSlot.course) {
      const cheapestSlot = getCheapestSlot(courseSlot.slots);
      if (cheapestSlot) {
        setSelectedCourse(courseSlot.course);
        setSelectedSlot(cheapestSlot);
        setBookingModalOpen(true);
      }
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
            alt="Owner's perspective walking across a pristine Costa del Sol golf course on a sunny day, with vibrant green fairways, Mediterranean Sea views and coastal mountains"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative h-full flex items-center justify-center px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Your Personal Guide to Costa del Sol Golf
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              Welcome to Fridas Golf. We curate the finest tee times across Costa del Sol's premier courses, 
              from Sotogrande to Málaga, with real-time availability and personal service.
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
          <div className="mb-6">
            <h2 className="font-serif text-3xl font-bold mb-2">costa del sol</h2>
            <p className="text-muted-foreground font-semibold">
              {availableSlots.length} results
            </p>
          </div>

          {isSearching ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-3/5" />
                    <Skeleton className="h-8 w-1/5" />
                  </div>
                </Card>
              ))}
            </div>
          ) : availableSlots.length > 0 ? (
            <>
              {/* Sorting Controls */}
              <div className="flex flex-wrap gap-2 mb-6" data-testid="sort-controls">
                <button
                  onClick={() => setSortMode("distance-asc")}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    sortMode === "distance-asc"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover-elevate"
                  }`}
                  data-testid="button-sort-closer"
                >
                  Closer
                </button>
                <button
                  onClick={() => setSortMode("distance-desc")}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    sortMode === "distance-desc"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover-elevate"
                  }`}
                  data-testid="button-sort-farther"
                >
                  Farther away
                </button>
                <button
                  onClick={() => setSortMode("price-asc")}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    sortMode === "price-asc"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover-elevate"
                  }`}
                  data-testid="button-sort-cheaper"
                >
                  Cheaper
                </button>
                <button
                  onClick={() => setSortMode("price-desc")}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    sortMode === "price-desc"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover-elevate"
                  }`}
                  data-testid="button-sort-expensive"
                >
                  More expensive
                </button>
              </div>

              {/* Compact List */}
              <div className="space-y-3" data-testid="available-slots-list">
                {sortCourses(availableSlots, sortMode).map((courseSlot) => {
                  const timeRange = getTimeRange(courseSlot.slots);
                  const minPrice = getMinPrice(courseSlot.slots);
                  
                  return (
                    <Card 
                      key={courseSlot.courseId} 
                      className="p-4 hover-elevate" 
                      data-testid={`card-slot-${courseSlot.courseId}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Course Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-base" data-testid={`text-course-name-${courseSlot.courseId}`}>
                              {courseSlot.courseName}
                            </h3>
                            {courseSlot.providerType === "DEEP_LINK" && (
                              <Badge variant="outline" className="text-xs" data-testid={`badge-booking-type-${courseSlot.courseId}`}>
                                Direct
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide" data-testid={`text-tee-info-${courseSlot.courseId}`}>
                            TEE 1
                          </p>
                        </div>

                        {/* Time Range */}
                        <div className="flex-shrink-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tee times</p>
                          <p className="text-sm font-medium" data-testid={`text-time-range-${courseSlot.courseId}`}>
                            {timeRange ? `${timeRange.from} - ${timeRange.to}` : "--"}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="flex-shrink-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Prices from</p>
                          <p className="text-sm font-semibold text-primary" data-testid={`text-price-from-${courseSlot.courseId}`}>
                            {minPrice !== null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(minPrice) : "--"}
                          </p>
                        </div>

                        {/* Distance Badge */}
                        <div className="flex-shrink-0">
                          <Badge variant="secondary" data-testid={`badge-distance-${courseSlot.courseId}`}>
                            {courseSlot.distanceKm != null ? `${courseSlot.distanceKm.toFixed(1)} km` : "--"}
                          </Badge>
                        </div>

                        {/* Book Button */}
                        {courseSlot.slots.length > 0 ? (
                          <button
                            onClick={() => handleBookCourse(courseSlot)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover-elevate active-elevate-2"
                            data-testid={`button-book-${courseSlot.courseId}`}
                          >
                            Book now
                          </button>
                        ) : (
                          <span className="px-4 py-2 text-muted-foreground text-sm" data-testid={`text-no-availability-${courseSlot.courseId}`}>
                            No availability
                          </span>
                        )}
                      </div>

                      {/* Optional: Note */}
                      {courseSlot.note && (
                        <p className="text-xs text-muted-foreground italic mt-2" data-testid={`text-note-${courseSlot.courseId}`}>
                          {courseSlot.note}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
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
