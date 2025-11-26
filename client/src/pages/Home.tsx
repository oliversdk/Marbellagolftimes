import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { LocationSearch } from "@/components/LocationSearch";
import { SearchFilters } from "@/components/SearchFilters";
import { CourseCard } from "@/components/CourseCard";
import { BookingModal } from "@/components/BookingModal";
import { PostBookingSignupDialog } from "@/components/PostBookingSignupDialog";
import { CoursesMap } from "@/components/CoursesMap";
import { CompactWeather } from "@/components/CompactWeather";
import { CourseCardSkeletonGrid, MapLoadingSkeleton } from "@/components/CourseCardSkeleton";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Mail, CheckCircle2, LayoutGrid, Map, Heart, Euro, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { calculateDistance } from "@/lib/geolocation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GolfCourse, InsertBookingRequest, CourseWithSlots, TeeTimeSlot } from "@shared/schema";
import { useFilterPersistence, type SortMode } from "@/hooks/useFilterPersistence";
import heroImage from "@assets/generated_images/Daytime_Costa_del_Sol_golf_walk_d48fdca9.png";
import placeholderImage from "@assets/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";
import golfVideo from "@assets/golf video_1763551739293.mp4";

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
  const { searchFilters, setSearchFilters, sortMode, setSortMode, viewMode, setViewMode } = useFilterPersistence();
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TeeTimeSlot | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [showPostBookingSignup, setShowPostBookingSignup] = useState(false);
  const [lastBookingData, setLastBookingData] = useState<{
    name: string;
    email: string;
    phone: string;
  } | null>(null);
  const { toast } = useToast();
  const { t } = useI18n();
  const { favorites } = useFavorites();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.isAdmin === "true";

  // Fetch revenue data for admin users
  type ROIAnalytics = {
    totalCommission: number;
    totalAdSpend: number;
    netProfit: number;
    roi: number;
  };
  
  const { data: revenueData } = useQuery<ROIAnalytics>({
    queryKey: ['/api/admin/analytics/roi'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/roi');
      if (!response.ok) throw new Error('Failed to fetch revenue');
      return response.json();
    },
  });

  // Reset visible count when filters or sort mode changes
  useEffect(() => {
    setVisibleCount(12);
  }, [searchFilters, sortMode]);

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
      searchFilters.holes,
      searchFilters.courseSearch,
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
      params.append("holes", searchFilters.holes.toString());

      const response = await fetch(`/api/slots/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch slots");
      const data = await response.json();

      // Enrich with course data
      let enrichedData = data.map((slot: CourseWithSlots) => {
        const course = courses?.find((c) => c.id === slot.courseId);
        return { ...slot, course };
      });

      // Filter by course name if courseSearch is provided
      if (searchFilters.courseSearch) {
        const searchTerm = searchFilters.courseSearch.toLowerCase();
        enrichedData = enrichedData.filter((slot: CourseWithSlots) =>
          slot.courseName.toLowerCase().includes(searchTerm)
        );
      }

      return enrichedData;
    },
  });

  // Calculate distances for all courses if we have location (memoized)
  const coursesWithDistance = useMemo(() => {
    return courses
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
  }, [courses, userLocation]);

  // Create booking request mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: InsertBookingRequest) => {
      return await apiRequest("POST", "/api/booking-requests", data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      setBookingModalOpen(false);
      setSelectedSlot(null);
      toast({
        title: t('home.bookingSuccessTitle'),
        description: t('home.bookingSuccessDescription'),
      });
      
      // Show signup dialog for guests
      if (!isAuthenticated) {
        setLastBookingData({
          name: variables.customerName ?? "",
          email: variables.customerEmail ?? "",
          phone: variables.customerPhone ?? "",
        });
        setShowPostBookingSignup(true);
      }
    },
    onError: () => {
      toast({
        title: t('home.bookingFailedTitle'),
        description: t('home.bookingFailedDescription'),
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

  // Organization structured data for homepage
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Marbella Golf Times",
    "url": "https://marbellagolftimes.com",
    "logo": "https://marbellagolftimes.com/favicon.png",
    "description": "Premium golf tee time booking service for Costa del Sol. Curated selection of 40+ premier golf courses from Sotogrande to Málaga with real-time availability and personal concierge service.",
    "address": {
      "@type": "PostalAddress",
      "addressRegion": "Costa del Sol",
      "addressCountry": "ES"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "36.5201",
      "longitude": "-4.8844"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "areaServed": "ES"
    },
    "sameAs": [
      "https://marbellagolftimes.com"
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Marbella Golf Times - Premium Golf Tee Times Costa del Sol"
        description="Book tee times at 40+ premier golf courses from Sotogrande to Málaga. Real availability, curated selection, concierge service."
        image={heroImage}
        url="https://marbellagolftimes.com"
        type="website"
        structuredData={organizationSchema}
      />
      <Header />

      {/* Admin Revenue Bar */}
      {isAdmin && revenueData && (
        <div className="bg-primary/5 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Commission:</span>
                  <span className="text-sm font-bold text-primary">€{revenueData.totalCommission.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Ad Spend:</span>
                  <span className="text-sm">€{revenueData.totalAdSpend.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Net:</span>
                  <span className={`text-sm font-bold ${revenueData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{revenueData.netProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {revenueData.roi >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">ROI:</span>
                  <span className={`text-sm font-bold ${revenueData.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {revenueData.roi >= 0 ? '+' : ''}{revenueData.roi.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Link href="/admin">
                <Button variant="outline" size="sm" data-testid="button-go-to-admin">
                  View Full Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[450px] sm:h-[60vh] sm:min-h-[500px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <video
            src={golfVideo}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            data-testid="video-hero"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative h-full flex items-center justify-center px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight px-2">
              {t('home.heroTitle')}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-2xl mx-auto px-2">
              {t('home.heroDescription')}
            </p>

            <Card className="bg-white/95 backdrop-blur-md border-0 shadow-xl max-w-xl mx-auto">
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="text-center text-lg sm:text-xl">{t('home.startSearchTitle')}</CardTitle>
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
        <div className="border-b bg-card lg:relative lg:z-auto sticky top-16 z-40 lg:shadow-none shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 touch-manipulation">
            <SearchFilters currentFilters={searchFilters} onSearch={handleFiltersApplied} />
          </div>
        </div>
      )}

      {/* Available Tee Times */}
      {userLocation && (availableSlots || slotsLoading) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-6">
            <h2 className="font-serif text-3xl font-bold mb-2">{t('home.resultsTitle')}</h2>
            {availableSlots && (
              <p className="text-muted-foreground font-semibold">
                {t('home.resultsCount', { count: availableSlots.length })}
              </p>
            )}
          </div>

          {isSearching ? (
            <>
              {/* Show view toggle even during loading */}
              <div className="mb-6">
                <div className="flex gap-2 mb-4">
                  <Button 
                    variant={viewMode === "list" ? "default" : "outline"}
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    {t('search.viewList')}
                  </Button>
                  <Button 
                    variant={viewMode === "map" ? "default" : "outline"}
                    onClick={() => setViewMode("map")}
                    data-testid="button-view-map"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    {t('search.viewMap')}
                  </Button>
                </div>
              </div>
              
              {/* Show appropriate skeleton based on view mode */}
              {viewMode === "list" ? (
                <CourseCardSkeletonGrid />
              ) : (
                <MapLoadingSkeleton />
              )}
            </>
          ) : availableSlots && availableSlots.length > 0 ? (
            <>
              {/* View Toggle + Sorting Controls */}
              <div className="mb-6 touch-manipulation">
                {/* View Mode Toggle */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Button 
                    variant={viewMode === "list" ? "default" : "outline"}
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                    className="min-h-11 flex-1 sm:flex-none"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">{t('search.viewList')}</span>
                    <span className="inline xs:hidden">List</span>
                  </Button>
                  <Button 
                    variant={viewMode === "map" ? "default" : "outline"}
                    onClick={() => setViewMode("map")}
                    data-testid="button-view-map"
                    className="min-h-11 flex-1 sm:flex-none"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">{t('search.viewMap')}</span>
                    <span className="inline xs:hidden">Map</span>
                  </Button>
                </div>
                
                {/* Sorting Controls - Only for List View */}
                {viewMode === "list" && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" data-testid="sort-controls">
                    <button
                      onClick={() => setSortMode("distance-asc")}
                      className={`px-3 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        sortMode === "distance-asc"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover-elevate"
                      }`}
                      data-testid="button-sort-closer"
                    >
                      {t('home.closer')}
                    </button>
                    <button
                      onClick={() => setSortMode("distance-desc")}
                      className={`px-3 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        sortMode === "distance-desc"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover-elevate"
                      }`}
                      data-testid="button-sort-farther"
                    >
                      {t('home.fartherAway')}
                    </button>
                    <button
                      onClick={() => setSortMode("price-asc")}
                      className={`px-3 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        sortMode === "price-asc"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover-elevate"
                      }`}
                      data-testid="button-sort-cheaper"
                    >
                      {t('home.cheaper')}
                    </button>
                    <button
                      onClick={() => setSortMode("price-desc")}
                      className={`px-3 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        sortMode === "price-desc"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover-elevate"
                      }`}
                      data-testid="button-sort-expensive"
                    >
                      {t('home.moreExpensive')}
                    </button>
                  </div>
                )}
              </div>

              {/* Results */}
              {(() => {
                // Filter by favorites if showFavoritesOnly is enabled
                let filteredCourses = availableSlots;
                if (searchFilters.showFavoritesOnly) {
                  filteredCourses = availableSlots.filter(courseSlot => 
                    favorites.has(courseSlot.courseId.toString())
                  );
                }
                
                const sortedCourses = sortCourses(filteredCourses, sortMode);
                const visibleCourses = viewMode === 'list' ? sortedCourses.slice(0, visibleCount) : sortedCourses;
                
                // Calculate minimum price across all visible courses for Best Deal badge
                const bestDealPrice = visibleCourses.reduce((min, courseSlot) => {
                  const courseMinPrice = getMinPrice(courseSlot.slots);
                  return courseMinPrice !== null && courseMinPrice < min ? courseMinPrice : min;
                }, Infinity);
                const hasBestDeal = bestDealPrice !== Infinity;
                
                // Empty state when favorites filter is active but no favorites exist
                if (searchFilters.showFavoritesOnly && filteredCourses.length === 0) {
                  return (
                    <Card className="text-center" data-testid="empty-state-favorites">
                      <CardContent className="space-y-4">
                        <Heart className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                        <h3 className="text-xl font-semibold">{t('course.noFavorites')}</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          {t('course.noFavoritesDescription')}
                        </p>
                      </CardContent>
                    </Card>
                  );
                }
                
                return viewMode === "list" ? (
                  <>
                    {/* Showing X of Y Counter */}
                    <div className="mb-4 text-center">
                      <p className="text-sm text-muted-foreground" data-testid="text-showing-count">
                        {t('home.showingCourses', { 
                          visible: Math.min(visibleCount, filteredCourses.length), 
                          total: filteredCourses.length 
                        })}
                      </p>
                    </div>

                    <div className="space-y-4" data-testid="available-slots-list">
                      {visibleCourses.map((courseSlot) => {
                        const minPrice = getMinPrice(courseSlot.slots);
                        const courseImage = courseSlot.course?.imageUrl || placeholderImage;
                        const isBestDeal = hasBestDeal && minPrice !== null && minPrice === bestDealPrice;
                        
                        return (
                          <Card 
                            key={courseSlot.courseId} 
                            className="overflow-hidden" 
                            data-testid={`card-slot-${courseSlot.courseId}`}
                          >
                            <div className="flex flex-col md:flex-row gap-4 p-4">
                              {/* Left: Course Image */}
                              <Link href={`/course/${courseSlot.courseId}`} className="w-full md:w-48 flex-shrink-0">
                                <img 
                                  src={courseImage}
                                  alt={`${courseSlot.courseName} golf course`}
                                  className="w-full h-32 object-cover rounded-md hover-elevate cursor-pointer"
                                  data-testid={`img-course-${courseSlot.courseId}`}
                                />
                              </Link>

                              {/* Right: Course Info + Inline Tee Times */}
                              <div className="flex-1 min-w-0 flex flex-col gap-3">
                                {/* Header: Name + Location + Price + Distance */}
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <Link href={`/course/${courseSlot.courseId}`}>
                                        <h3 className="font-semibold text-lg hover:underline cursor-pointer" data-testid={`text-course-name-${courseSlot.courseId}`}>
                                          {courseSlot.courseName}
                                        </h3>
                                      </Link>
                                      {isBestDeal && (
                                        <Badge variant="default" data-testid={`badge-best-deal-${courseSlot.courseId}`}>
                                          {t('course.bestDeal')}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Compact Weather Display */}
                                    {courseSlot.course?.lat && courseSlot.course?.lng && (
                                      <CompactWeather 
                                        lat={courseSlot.course.lat} 
                                        lng={courseSlot.course.lng}
                                        courseId={courseSlot.courseId}
                                      />
                                    )}
                                    
                                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-location-${courseSlot.courseId}`}>
                                      {courseSlot.course?.city || "Costa del Sol"}, {courseSlot.course?.province || "Spain"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Distance Badge */}
                                    <Badge variant="secondary" data-testid={`badge-distance-${courseSlot.courseId}`}>
                                      {courseSlot.distanceKm != null ? `${courseSlot.distanceKm.toFixed(1)} km` : "--"}
                                    </Badge>
                                    
                                    {/* Price Display - Enhanced */}
                                    {minPrice !== null && (
                                      <div className="text-right" data-testid={`text-price-${courseSlot.courseId}`}>
                                        <div className="text-xs text-muted-foreground">{t('course.from')}</div>
                                        <div className="text-xl font-bold">€{minPrice}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Inline Tee Times - Horizontal Scroll */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                      {t('home.availableTeeTimes')}
                                    </p>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      asChild
                                      data-testid={`button-details-${courseSlot.courseId}`}
                                    >
                                      <Link href={`/course/${courseSlot.courseId}`}>
                                        {t('home.viewDetails')}
                                      </Link>
                                    </Button>
                                  </div>
                                  <div className="overflow-x-auto pb-2" data-testid={`slots-container-${courseSlot.courseId}`}>
                                    <div className="flex gap-2">
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
                                            currency: 'EUR',
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                          }).format(slot.greenFee);
                                          
                                          return (
                                            <Button
                                              key={idx}
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleBookCourse(courseSlot, slot)}
                                              className="flex-shrink-0 flex flex-col items-start px-3 py-2 h-auto"
                                              data-testid={`button-slot-${courseSlot.courseId}-${idx}`}
                                            >
                                              <span className="font-semibold text-sm">{formattedTime}</span>
                                              <span className="text-xs text-muted-foreground">{formattedPrice}</span>
                                            </Button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>

                                {/* Optional: Note */}
                                {courseSlot.note && (
                                  <p className="text-xs text-muted-foreground italic" data-testid={`text-note-${courseSlot.courseId}`}>
                                    {courseSlot.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Load More Button */}
                    {filteredCourses.length > visibleCount && (
                      <div className="mt-8 text-center" data-testid="load-more-container">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => setVisibleCount(prev => prev + 12)}
                          data-testid="button-load-more"
                        >
                          {t('home.loadMore', { count: Math.min(12, filteredCourses.length - visibleCount) })}
                        </Button>
                      </div>
                    )}

                    {/* All Courses Shown Message */}
                    {filteredCourses.length > 0 && filteredCourses.length <= visibleCount && (
                      <div className="mt-4 text-center" data-testid="all-courses-shown">
                        <p className="text-sm text-muted-foreground">
                          {t('home.allCoursesShown')}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <CoursesMap 
                    courses={sortedCourses}
                    center={userLocation}
                  />
                );
              })()}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {t('home.noTeeTimesMessage')}
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
                <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">{t('home.personalConciergeTitle')}</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  {t('home.personalConciergeDescription')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      {t('home.realTimeTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t('home.realTimeDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      {t('home.personalServiceTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t('home.personalServiceDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      {t('home.premiumCoursesTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {t('home.premiumCoursesDescription')}
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

      {/* Testimonials Carousel */}
      <TestimonialsCarousel />

      {/* Booking Modal */}
      <BookingModal
        course={selectedCourse}
        selectedSlot={selectedSlot}
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSubmit={handleBookingSubmit}
        isPending={createBookingMutation.isPending}
      />

      {/* Post-Booking Signup Dialog */}
      <PostBookingSignupDialog
        open={showPostBookingSignup}
        onOpenChange={setShowPostBookingSignup}
        customerName={lastBookingData?.name || ""}
        customerEmail={lastBookingData?.email || ""}
        customerPhone={lastBookingData?.phone || ""}
      />
    </div>
  );
}
