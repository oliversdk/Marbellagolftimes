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
import { Button } from "@/components/ui/button";
import { Clock, ChevronDown, ChevronUp, Mail, CheckCircle2 } from "lucide-react";
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
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
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

  const toggleExpanded = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const handleBookCourse = (courseSlot: CourseWithSlots, specificSlot?: TeeTimeSlot) => {
    if (courseSlot.course) {
      const slotToBook = specificSlot || getCheapestSlot(courseSlot.slots);
      if (slotToBook) {
        setSelectedCourse(courseSlot.course);
        setSelectedSlot(slotToBook);
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
                  const isExpanded = expandedCourses.has(courseSlot.courseId);
                  
                  return (
                    <Card 
                      key={courseSlot.courseId} 
                      className="overflow-visible" 
                      data-testid={`card-slot-${courseSlot.courseId}`}
                    >
                      {/* Clickable Header */}
                      <button 
                        className="w-full p-4 hover-elevate text-left flex flex-col sm:flex-row sm:items-center gap-4"
                        onClick={() => toggleExpanded(courseSlot.courseId)}
                        data-testid={`button-expand-${courseSlot.courseId}`}
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`slots-panel-${courseSlot.courseId}`}
                      >
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

                        {/* Expand/Collapse Icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expanded: Individual Slots */}
                      {isExpanded && courseSlot.slots.length > 0 && (
                        <div 
                          id={`slots-panel-${courseSlot.courseId}`}
                          role="region"
                          aria-label={`Available tee times for ${courseSlot.courseName}`}
                          className="border-t px-4 pb-4 pt-3" 
                          data-testid={`slots-expanded-${courseSlot.courseId}`}
                        >
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Available Tee Times</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {courseSlot.slots
                              .sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime())
                              .map((slot, idx) => {
                                const slotTime = new Date(slot.teeTime);
                                const formattedTime = slotTime.toLocaleTimeString("en-US", { 
                                  hour: "2-digit", 
                                  minute: "2-digit", 
                                  hour12: false 
                                });
                                const formattedPrice = new Intl.NumberFormat('en-US', { 
                                  style: 'currency', 
                                  currency: 'EUR' 
                                }).format(slot.greenFee);
                                const cheapestSlot = getCheapestSlot(courseSlot.slots);
                                const isCheapest = cheapestSlot && slot.teeTime === cheapestSlot.teeTime && slot.greenFee === cheapestSlot.greenFee;
                                
                                return (
                                  <div 
                                    key={idx}
                                    className={`flex items-center justify-between p-3 border rounded-md hover-elevate ${
                                      isCheapest ? 'border-primary bg-primary/5' : ''
                                    }`}
                                    data-testid={`slot-${courseSlot.courseId}-${idx}`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium text-sm">{formattedTime}</p>
                                          {isCheapest && (
                                            <Badge variant="secondary" className="text-xs">Best price</Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{formattedPrice}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBookCourse(courseSlot, slot);
                                      }}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium text-xs hover-elevate active-elevate-2 flex-shrink-0"
                                      data-testid={`button-book-slot-${courseSlot.courseId}-${idx}`}
                                    >
                                      Book
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Optional: Note */}
                      {courseSlot.note && (
                        <p className="text-xs text-muted-foreground italic px-4 pb-4" data-testid={`text-note-${courseSlot.courseId}`}>
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

      {/* Landing Page Sections (when no location selected) */}
      {!userLocation && (
        <>
          {/* Our Service */}
          <div className="bg-muted/30 py-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Your Personal Golf Concierge</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  We curate the finest tee times with the personal touch of a dedicated advisor
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Real-Time Availability
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      See actual available tee times, not just booking forms. Know exactly what's available before you request.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      Personal Service
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Boutique-quality service with local expertise. We handle the details so you can focus on your game.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Curated Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Only the finest courses from Sotogrande to Málaga. Premium experiences, carefully selected.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="py-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
                Ready to Find Your Perfect Tee Time?
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                Start your search above and discover real-time availability across Costa del Sol's premier courses.
              </p>
              <Button 
                size="lg" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                data-testid="button-scroll-to-search"
              >
                Start Your Search
              </Button>
            </div>
          </div>
        </>
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
