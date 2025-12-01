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
import { AvailabilityDotsCompact } from "@/components/AvailabilityDots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { MobileCardGrid } from "@/components/ui/mobile-card-grid";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Clock, Mail, CheckCircle2, LayoutGrid, Map, Heart, Euro, TrendingUp, TrendingDown, Flame, Sun, Sunset, Moon, MapPin, Car, Navigation, SlidersHorizontal } from "lucide-react";
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

// Time period classification for tee times
type TimePeriod = 'morning' | 'midday' | 'afternoon' | 'twilight';

function getTimePeriod(teeTime: Date): TimePeriod {
  const hour = teeTime.getHours();
  if (hour < 11) return 'morning';      // Before 11:00
  if (hour < 14) return 'midday';       // 11:00 - 13:59
  if (hour < 17) return 'afternoon';    // 14:00 - 16:59
  return 'twilight';                     // 17:00+
}

function groupSlotsByPeriod(slots: TeeTimeSlot[]): Record<TimePeriod, TeeTimeSlot[]> {
  const groups: Record<TimePeriod, TeeTimeSlot[]> = {
    morning: [],
    midday: [],
    afternoon: [],
    twilight: []
  };
  
  slots.forEach(slot => {
    const period = getTimePeriod(new Date(slot.teeTime));
    groups[period].push(slot);
  });
  
  // Sort each group by time
  Object.keys(groups).forEach(key => {
    groups[key as TimePeriod].sort((a, b) => 
      new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
    );
  });
  
  return groups;
}

// Calculate average price to determine if a slot is a "hot deal"
function getAveragePrice(slots: TeeTimeSlot[]): number {
  if (slots.length === 0) return 0;
  return slots.reduce((sum, s) => sum + s.greenFee, 0) / slots.length;
}

// Check if slot is significantly cheaper than average (20%+ discount)
function isHotDeal(slot: TeeTimeSlot, averagePrice: number): boolean {
  if (averagePrice === 0) return false;
  const discountPercent = ((averagePrice - slot.greenFee) / averagePrice) * 100;
  return discountPercent >= 15; // 15%+ cheaper = hot deal
}

// Calculate discount percentage
function getDiscountPercent(slotPrice: number, averagePrice: number): number {
  if (averagePrice === 0) return 0;
  return Math.round(((averagePrice - slotPrice) / averagePrice) * 100);
}

// Distance category classification
type DistanceCategory = 'nearby' | 'shortDrive' | 'furtherAway';

function getDistanceCategory(distanceKm: number | null | undefined): DistanceCategory {
  if (distanceKm === null || distanceKm === undefined) return 'furtherAway';
  if (distanceKm <= 15) return 'nearby';       // 0-15 km
  if (distanceKm <= 40) return 'shortDrive';   // 15-40 km
  return 'furtherAway';                         // 40+ km
}

function groupCoursesByDistance(courses: CourseWithSlots[]): Record<DistanceCategory, CourseWithSlots[]> {
  const groups: Record<DistanceCategory, CourseWithSlots[]> = {
    nearby: [],
    shortDrive: [],
    furtherAway: []
  };
  
  courses.forEach(course => {
    const category = getDistanceCategory(course.distanceKm);
    groups[category].push(course);
  });
  
  // Sort each group by distance
  Object.keys(groups).forEach(key => {
    groups[key as DistanceCategory].sort((a, b) => 
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  });
  
  return groups;
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const { favorites } = useFavorites();
  const { isAuthenticated, user } = useAuth();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const isAdmin = user?.isAdmin === "true";
  
  // Track selected tee per course (courseId -> teeName or null for "all")
  const [selectedTees, setSelectedTees] = useState<Record<string, string | null>>({});

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

  // Session seed for greetings - changes each login but stays consistent during session
  const [sessionSeed] = useState(() => {
    const storedSeed = sessionStorage.getItem('greetingSeed');
    if (storedSeed) return parseInt(storedSeed);
    const newSeed = Math.floor(Math.random() * 100000);
    sessionStorage.setItem('greetingSeed', newSeed.toString());
    return newSeed;
  });

  // Fun personalized greetings for admins - changes each login
  const adminGreeting = useMemo(() => {
    if (!user || !revenueData) return null;
    
    const firstName = user.firstName || "Boss";
    const commission = revenueData.totalCommission;
    const roi = revenueData.roi;
    
    // Use session seed so greeting changes each login but stays consistent during session
    const pseudoRandom = (index: number) => ((sessionSeed + index) * 9301 + 49297) % 233280 / 233280;
    
    // Special greetings based on name
    const personalGreetings: Record<string, string[]> = {
      "Morten": [
        `Hej Morten, din flotte fyr! 😎`,
        `Goddag Morten! Klar til at erobre golfverdenen? 🏌️`,
        `Morten! Du ser godt ud i dag! 💪`,
        `Hey Morten - lad os tjene nogle penge! 💰`,
        `Morten! Champagnen venter - lad os gøre det! 🍾`,
        `Morten! Er der nogen der har fortalt dig hvor god du er i dag? 🌟`,
        `Hey Morten - du er simpelthen bare for sej! 🔥`,
        `Morten! Vidste du at du er en legende? 👑`,
        `Godmorgen verdens bedste golfentreprenør! 🏆`,
        `Morten! Golfbanerne er heldige at have dig! ⭐`,
        `Hey champ! Klar til at være fantastisk igen? 💫`,
        `Morten! Du gør det bare så godt! 🎯`,
        `Hej boss! Costa del Sol venter på dig! 🌴`,
      ],
      "Frida": [
        `Hej Frida, din snygga tjej! 🌟`,
        `Frida! Ska vi signa några golfbanor idag? ✨`,
        `God morgon Frida! Du är en stjärna! ⭐`,
        `Hey Frida - låt oss göra magin! 💫`,
        `Frida! Redo att crusha det idag? 🔥`,
        `Frida! Har någon berättat för dig hur fantastisk du är idag? 🌟`,
        `Hey Frida - du är helt enkelt för cool! 👑`,
        `Frida! Du gör det bara så bra! 🎯`,
        `God morgon vackra! Redo att erövra världen? 💪`,
        `Frida! Costa del Sol har tur som har dig! 🌴`,
        `Hey champion! Redo att vara fantastisk igen? 🏆`,
        `Frida! Du är bäst - ingen diskussion! 💎`,
      ],
    };
    
    // Get base greeting
    const greetings = personalGreetings[firstName] || [
      `Hej ${firstName}! 👋`,
      `Velkommen tilbage, ${firstName}! 🎯`,
      `Hey ${firstName}! Klar til action? 🚀`,
    ];
    const baseGreeting = greetings[Math.floor(pseudoRandom(1) * greetings.length)];
    
    // Add context-based motivation
    let motivation = "";
    
    if (commission === 0) {
      const zeroMessages = [
        "Skal vi få det første salg i dag? Du kan gøre det! 💪",
        "Dagen er ung - lad os skaffe nogle bookings! 🏌️",
        "Ingen salg endnu, men det ændrer vi! 🎯",
        "Første salg venter derude - go get it! 🚀",
        "I dag er dagen! Lad os få gang i pengene! 💸",
      ];
      motivation = zeroMessages[Math.floor(pseudoRandom(2) * zeroMessages.length)];
    } else if (commission > 0 && commission < 100) {
      const firstSaleMessages = [
        "Hvor er du god! Pengene er begyndt at rulle! 🎉",
        "BOOM! Vi er i gang! 💰",
        "Yes! Det virker! Keep it up! 🔥",
        "Du har knækket koden - mere af det! 🏆",
        "Det første er altid det sværeste - nu ruller det! 🚀",
      ];
      motivation = firstSaleMessages[Math.floor(pseudoRandom(2) * firstSaleMessages.length)];
    } else if (commission >= 100 && commission < 500) {
      const growingMessages = [
        `Du er on fire! €${commission.toFixed(0)} i commission! 🔥`,
        "Det går fremad! Fortsæt det gode arbejde! 💪",
        "Wow, du crusher det! 🚀",
        "Imponerende! Kan vi slå rekorden i morgen? 📈",
        `€${commission.toFixed(0)} allerede! Du er en stjerne! ⭐`,
      ];
      motivation = growingMessages[Math.floor(pseudoRandom(2) * growingMessages.length)];
    } else if (commission >= 500) {
      const successMessages = [
        `LEGENDE! €${commission.toFixed(0)} - du er en maskine! 🏆`,
        "Du har slået alle rekorder! Hvor er du sej! 👑",
        `€${commission.toFixed(0)}?! Du er jo fantastisk! 🌟`,
        "Boss-level unlocked! Keep crushing it! 💎",
        `€${commission.toFixed(0)} i commission! Champagne-tid! 🍾`,
      ];
      motivation = successMessages[Math.floor(pseudoRandom(2) * successMessages.length)];
    }
    
    // Add ROI comment if impressive
    if (roi > 100) {
      motivation += ` ROI på ${roi.toFixed(0)}%?! VANVITTIGT! 📊🔥`;
    } else if (roi > 50) {
      motivation += ` ROI på ${roi.toFixed(0)}% er super! 📊`;
    }
    
    return { baseGreeting, motivation };
  }, [user?.firstName, revenueData?.totalCommission, revenueData?.roi, sessionSeed]);

  // Activity feed for admins - shows recent events with team commentary
  type ActivityItem = {
    type: 'booking' | 'email_sent' | 'partnership' | 'milestone';
    timestamp: string;
    data: Record<string, unknown>;
  };
  
  type ActivityFeedData = {
    activities: ActivityItem[];
    stats: {
      totalBookings: number;
      totalCourses: number;
      totalPartnerships: number;
      pendingBookings: number;
      confirmedBookings: number;
    };
  };

  const { data: activityFeed } = useQuery<ActivityFeedData>({
    queryKey: ['/api/admin/activity-feed'],
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds for live feel
    queryFn: async () => {
      const response = await fetch('/api/admin/activity-feed?limit=5');
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
  });

  // Generate team commentary for activities
  const getActivityCommentary = useMemo(() => {
    if (!activityFeed) return null;
    
    const firstName = user?.firstName || "Boss";
    const { activities, stats } = activityFeed;
    
    // Commentary based on recent activity
    const commentaries: string[] = [];
    
    // Check for new bookings
    const recentBookings = activities.filter(a => a.type === 'booking');
    if (recentBookings.length > 0) {
      const latestBooking = recentBookings[0];
      const courseName = latestBooking.data.courseName as string || 'en bane';
      const rawCustomerName = latestBooking.data.customerName as string;
      const customerName = rawCustomerName?.split(' ')[0] || 'En kunde';
      const bookingComments = [
        `🎯 Ny booking på ${courseName}! ${customerName} er klar til golf!`,
        `💰 Cha-ching! ${customerName} har booket på ${courseName}!`,
        `🏌️ ${courseName} har lige fået en booking fra ${customerName}!`,
        `🔥 Det sker! ${customerName} booker ${courseName}!`,
      ];
      const seed = sessionSeed % bookingComments.length;
      commentaries.push(bookingComments[seed]);
    }
    
    // Check partnerships progress
    if (stats.totalPartnerships >= 5) {
      const partnershipComments = [
        `🏆 WOW! ${stats.totalPartnerships} partnerskaber allerede! I er et dream team!`,
        `⭐ ${stats.totalPartnerships} baner med aftale! Keep crushing it!`,
        `💪 ${stats.totalPartnerships} partnerskaber! Det er fantastisk, ${firstName}!`,
      ];
      commentaries.push(partnershipComments[(sessionSeed + 1) % partnershipComments.length]);
    } else if (stats.totalPartnerships > 0) {
      commentaries.push(`📈 ${stats.totalPartnerships} partnerskaber indtil videre - kan vi nå 5 i dag?`);
    }
    
    // Pending bookings encouragement
    if (stats.pendingBookings > 0) {
      const pendingComments = [
        `⏳ ${stats.pendingBookings} ventende bookings - tjek admin og få dem confirmed! 💪`,
        `📋 Husk: ${stats.pendingBookings} bookings venter på bekræftelse!`,
        `🎯 ${stats.pendingBookings} kunder venter på svar - lad os gøre dem glade!`,
      ];
      commentaries.push(pendingComments[(sessionSeed + 2) % pendingComments.length]);
    }
    
    // Confirmed bookings celebration
    if (stats.confirmedBookings > 0) {
      commentaries.push(`✅ ${stats.confirmedBookings} bekræftede bookings! Godt arbejde, holdet!`);
    }
    
    return commentaries.length > 0 ? commentaries[0] : null;
  }, [activityFeed, user?.firstName, sessionSeed]);

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
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            {/* Personalized Greeting + Activity Commentary */}
            {(adminGreeting || getActivityCommentary) && (
              <div className="mb-3 pb-3 border-b border-primary/10 space-y-2">
                {adminGreeting && (
                  <p className="text-base font-medium">
                    <span className="mr-2">{adminGreeting.baseGreeting}</span>
                    <span className="text-muted-foreground">{adminGreeting.motivation}</span>
                  </p>
                )}
                {getActivityCommentary && (
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {getActivityCommentary}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
                {/* Quick Stats - Clickable */}
                {activityFeed?.stats && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>•</span>
                    <Link href="/admin?tab=bookings">
                      <span className="cursor-pointer hover:text-primary hover:underline transition-colors">
                        {activityFeed.stats.totalBookings} bookings
                      </span>
                    </Link>
                    <span>•</span>
                    <Link href="/admin?tab=courses">
                      <span className="cursor-pointer hover:text-primary hover:underline transition-colors">
                        {activityFeed.stats.totalPartnerships} partners
                      </span>
                    </Link>
                  </div>
                )}
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

      {/* Hero Section - Responsive heights and mobile optimizations */}
      <div className="relative h-[40vh] min-h-[350px] sm:h-[50vh] sm:min-h-[450px] md:h-[60vh] md:min-h-[500px] w-full overflow-hidden">
        <div className="absolute inset-0">
          {/* Show poster image on mobile for performance, video on desktop */}
          {isMobile ? (
            <img
              src={heroImage}
              alt="Costa del Sol Golf Course"
              className="w-full h-full object-cover"
              data-testid="img-hero-mobile"
            />
          ) : (
            <video
              src={golfVideo}
              autoPlay
              muted
              loop
              playsInline
              poster={heroImage}
              className="w-full h-full object-cover"
              data-testid="video-hero"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative h-full flex items-center justify-center px-3 sm:px-4">
          <div className="max-w-3xl mx-auto text-center space-y-3 sm:space-y-4 md:space-y-6">
            <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight px-1">
              {t('home.heroTitle')}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto px-1">
              {t('home.heroDescription')}
            </p>

            <Card className="bg-white/95 backdrop-blur-md border-0 shadow-xl max-w-xl mx-auto">
              <CardHeader className="pb-3 sm:pb-4 md:pb-6 px-3 sm:px-6">
                <CardTitle className="text-center text-base sm:text-lg md:text-xl">{t('home.startSearchTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <LocationSearch onLocationSelected={handleLocationSelected} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Filters - Mobile drawer vs Desktop inline */}
      {userLocation && (
        <div className="border-b bg-card lg:relative lg:z-auto sticky top-16 z-40 lg:shadow-none shadow-md">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 touch-manipulation">
            {/* Mobile: Show Filters button that opens drawer */}
            {isMobile ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="min-h-11 flex-1"
                  data-testid="button-open-mobile-filters"
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters
                  {(searchFilters.date || searchFilters.courseSearch) && (
                    <Badge variant="secondary" className="ml-2">
                      Active
                    </Badge>
                  )}
                </Button>
                <MobileSheet
                  open={mobileFiltersOpen}
                  onOpenChange={setMobileFiltersOpen}
                  title={t('search.filters')}
                  description={t('search.filtersDescription') || "Adjust your search criteria"}
                >
                  <div className="space-y-4">
                    <SearchFilters 
                      currentFilters={searchFilters} 
                      onSearch={(filters) => {
                        handleFiltersApplied(filters);
                        setMobileFiltersOpen(false);
                      }} 
                    />
                  </div>
                </MobileSheet>
              </div>
            ) : (
              /* Desktop/Tablet: Show inline filters */
              <SearchFilters currentFilters={searchFilters} onSearch={handleFiltersApplied} />
            )}
          </div>
        </div>
      )}

      {/* Available Tee Times */}
      {userLocation && (availableSlots || slotsLoading) && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
          <div className="mb-4 sm:mb-6">
            <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{t('home.resultsTitle')}</h2>
            {availableSlots && (
              <p className="text-sm sm:text-base text-muted-foreground font-semibold">
                {t('home.resultsCount', { count: availableSlots.length })}
              </p>
            )}
          </div>

          {isSearching ? (
            <>
              {/* Show view toggle even during loading */}
              <div className="mb-4 sm:mb-6">
                <div className="flex gap-2 mb-4">
                  <Button 
                    variant={viewMode === "list" ? "default" : "outline"}
                    onClick={() => setViewMode("list")}
                    className="min-h-11 flex-1 sm:flex-none"
                    data-testid="button-view-list"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">{t('search.viewList')}</span>
                    <span className="xs:hidden">List</span>
                  </Button>
                  <Button 
                    variant={viewMode === "map" ? "default" : "outline"}
                    onClick={() => setViewMode("map")}
                    className="min-h-11 flex-1 sm:flex-none"
                    data-testid="button-view-map"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">{t('search.viewMap')}</span>
                    <span className="xs:hidden">Map</span>
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
              <div className="mb-4 sm:mb-6 touch-manipulation">
                {/* View Mode Toggle - Touch-friendly 44px+ targets */}
                <div className="flex gap-2 mb-3 sm:mb-4">
                  <Button 
                    variant={viewMode === "list" ? "default" : "outline"}
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-list"
                    className="min-h-11 min-w-11 flex-1 sm:flex-none"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t('search.viewList')}</span>
                    <span className="sm:hidden">List</span>
                  </Button>
                  <Button 
                    variant={viewMode === "map" ? "default" : "outline"}
                    onClick={() => setViewMode("map")}
                    data-testid="button-view-map"
                    className="min-h-11 min-w-11 flex-1 sm:flex-none"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t('search.viewMap')}</span>
                    <span className="sm:hidden">Map</span>
                  </Button>
                </div>
                
                {/* Sorting Controls - Only for List View */}
                {viewMode === "list" && (
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" data-testid="sort-controls">
                    <button
                      onClick={() => setSortMode("distance-asc")}
                      className={`px-2 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
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
                      className={`px-2 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
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
                      className={`px-2 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
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
                      className={`px-2 sm:px-4 py-2 min-h-11 rounded-md border text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
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
                
                // Distance category configuration
                const distanceCategoryConfig: { key: DistanceCategory; label: string; range: string; icon: typeof MapPin }[] = [
                  { key: 'nearby', label: t('home.distanceNearby'), range: t('home.distanceNearbyRange'), icon: MapPin },
                  { key: 'shortDrive', label: t('home.distanceShortDrive'), range: t('home.distanceShortDriveRange'), icon: Car },
                  { key: 'furtherAway', label: t('home.distanceFurtherAway'), range: t('home.distanceFurtherAwayRange'), icon: Navigation },
                ];
                
                // Group courses by distance
                const groupedByDistance = groupCoursesByDistance(visibleCourses);
                
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

                    {/* Distance Category Groups */}
                    <div className="space-y-8" data-testid="available-slots-list">
                      {distanceCategoryConfig.map(({ key, label, range, icon: Icon }) => {
                        const categoryCourses = groupedByDistance[key];
                        if (categoryCourses.length === 0) return null;
                        
                        return (
                          <div key={key} className="space-y-4" data-testid={`distance-category-${key}`}>
                            {/* Distance Category Header */}
                            <div className="flex items-center gap-3 pb-2 border-b">
                              <div className={`p-2 rounded-lg ${
                                key === 'nearby' ? 'bg-green-100 dark:bg-green-900/30' : 
                                key === 'shortDrive' ? 'bg-blue-100 dark:bg-blue-900/30' : 
                                'bg-orange-100 dark:bg-orange-900/30'
                              }`}>
                                <Icon className={`h-5 w-5 ${
                                  key === 'nearby' ? 'text-green-600 dark:text-green-400' : 
                                  key === 'shortDrive' ? 'text-blue-600 dark:text-blue-400' : 
                                  'text-orange-600 dark:text-orange-400'
                                }`} />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">{label}</h3>
                                <p className="text-xs text-muted-foreground">{range} • {categoryCourses.length} {categoryCourses.length === 1 ? 'course' : 'courses'}</p>
                              </div>
                            </div>
                            
                            {/* Courses in this category */}
                            <div className="space-y-4 pl-2">
                              {categoryCourses.map((courseSlot) => {
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

                                {/* Tee Times with Hot Deals and Time Periods */}
                                {(() => {
                                  // Get unique tee names from slots
                                  const uniqueTees = Array.from(new Set(
                                    courseSlot.slots
                                      .map(s => s.teeName)
                                      .filter((name): name is string => !!name)
                                  )).sort();
                                  
                                  const hasMultipleTees = uniqueTees.length > 1;
                                  const storedTee = selectedTees[courseSlot.courseId] ?? null;
                                  
                                  // Reset to "all" if stored tee no longer exists in available tees
                                  const isStaleTee = storedTee !== null && !uniqueTees.includes(storedTee);
                                  const selectedTee = isStaleTee ? null : storedTee;
                                  
                                  // Clear stale tee from state (schedule for next tick to avoid render loop)
                                  if (isStaleTee) {
                                    setTimeout(() => {
                                      setSelectedTees(prev => ({ ...prev, [courseSlot.courseId]: null }));
                                    }, 0);
                                  }
                                  
                                  // Filter slots by selected tee (null = show all)
                                  const filteredSlots = selectedTee 
                                    ? courseSlot.slots.filter(s => s.teeName === selectedTee)
                                    : courseSlot.slots;
                                  
                                  const avgPrice = getAveragePrice(filteredSlots);
                                  const hotDeals = filteredSlots.filter(s => isHotDeal(s, avgPrice));
                                  const groupedSlots = groupSlotsByPeriod(filteredSlots);
                                  
                                  const periodConfig: { key: TimePeriod; label: string; icon: typeof Sun }[] = [
                                    { key: 'morning', label: t('home.morningTimes'), icon: Sun },
                                    { key: 'midday', label: t('home.middayTimes'), icon: Sun },
                                    { key: 'afternoon', label: t('home.afternoonTimes'), icon: Sunset },
                                    { key: 'twilight', label: t('home.twilightTimes'), icon: Moon },
                                  ];
                                  
                                  return (
                                    <div className="space-y-3">
                                      {/* Header with View Details */}
                                      <div className="flex items-center justify-between">
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
                                      
                                      {/* Tee Selector - only show if course has multiple tees */}
                                      {hasMultipleTees && (
                                        <div className="flex items-center gap-1.5 flex-wrap" data-testid={`tee-selector-${courseSlot.courseId}`}>
                                          <Button
                                            size="sm"
                                            variant={selectedTee === null ? "default" : "outline"}
                                            onClick={() => setSelectedTees(prev => ({ ...prev, [courseSlot.courseId]: null }))}
                                            data-testid={`button-tee-all-${courseSlot.courseId}`}
                                          >
                                            {t('home.allTees')}
                                          </Button>
                                          {uniqueTees.map((teeName) => (
                                            <Button
                                              key={teeName}
                                              size="sm"
                                              variant={selectedTee === teeName ? "default" : "outline"}
                                              onClick={() => setSelectedTees(prev => ({ ...prev, [courseSlot.courseId]: teeName }))}
                                              data-testid={`button-tee-${courseSlot.courseId}-${teeName.replace(/\s+/g, '-')}`}
                                            >
                                              {teeName}
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Hot Deals Section */}
                                      {hotDeals.length > 0 && (
                                        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 border border-orange-200 dark:border-orange-800" data-testid={`hot-deals-${courseSlot.courseId}`}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Flame className="h-4 w-4 text-orange-500" />
                                            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                              {t('home.hotDealsTitle')}
                                            </span>
                                          </div>
                                          <div className="flex gap-2 overflow-x-auto pb-1">
                                            {hotDeals
                                              .sort((a, b) => a.greenFee - b.greenFee)
                                              .slice(0, 5)
                                              .map((slot, idx) => {
                                                const slotTime = new Date(slot.teeTime);
                                                const formattedTime = slotTime.toLocaleTimeString("en-US", { 
                                                  hour: "2-digit", minute: "2-digit", hour12: false 
                                                });
                                                const discount = getDiscountPercent(slot.greenFee, avgPrice);
                                                
                                                return (
                                                  <Button
                                                    key={`hot-${idx}`}
                                                    size="sm"
                                                    onClick={() => handleBookCourse(courseSlot, slot)}
                                                    className="flex-shrink-0 flex flex-col items-start px-3 py-2 h-auto bg-orange-500 hover:bg-orange-600 text-white border-orange-600"
                                                    data-testid={`button-hot-deal-${courseSlot.courseId}-${idx}`}
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <Flame className="h-3 w-3" />
                                                      <span className="font-semibold text-sm">{formattedTime}</span>
                                                      {slot.slotsAvailable !== undefined && (
                                                        <AvailabilityDotsCompact 
                                                          slotsAvailable={slot.slotsAvailable} 
                                                          className="text-white/70"
                                                        />
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-xs font-bold">€{slot.greenFee}</span>
                                                      {discount > 0 && (
                                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-white/20 text-white border-0">
                                                          -{discount}%
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  </Button>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Time Period Sections */}
                                      <div className="space-y-2" data-testid={`slots-container-${courseSlot.courseId}`}>
                                        {periodConfig.map(({ key, label, icon: Icon }) => {
                                          const periodSlots = groupedSlots[key];
                                          if (periodSlots.length === 0) return null;
                                          
                                          return (
                                            <div key={key} className="flex items-start gap-2">
                                              <div className="flex items-center gap-1 min-w-[90px] pt-1">
                                                <Icon className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">{label}</span>
                                              </div>
                                              <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
                                                {periodSlots.slice(0, 6).map((slot, idx) => {
                                                  const slotTime = new Date(slot.teeTime);
                                                  const formattedTime = slotTime.toLocaleTimeString("en-US", { 
                                                    hour: "2-digit", minute: "2-digit", hour12: false 
                                                  });
                                                  const slotIsHotDeal = isHotDeal(slot, avgPrice);
                                                  
                                                  return (
                                                    <Button
                                                      key={`${key}-${idx}`}
                                                      size="sm"
                                                      variant={slotIsHotDeal ? "default" : "outline"}
                                                      onClick={() => handleBookCourse(courseSlot, slot)}
                                                      className={`flex-shrink-0 flex flex-col items-start px-2 py-1.5 h-auto ${slotIsHotDeal ? 'bg-orange-500 hover:bg-orange-600 border-orange-600' : ''}`}
                                                      data-testid={`button-slot-${courseSlot.courseId}-${key}-${idx}`}
                                                    >
                                                      <div className="flex items-center gap-1.5 w-full">
                                                        <span className="font-medium text-xs">{formattedTime}</span>
                                                        {slot.slotsAvailable !== undefined && (
                                                          <AvailabilityDotsCompact 
                                                            slotsAvailable={slot.slotsAvailable} 
                                                            className={slotIsHotDeal ? 'text-white/70' : ''}
                                                          />
                                                        )}
                                                      </div>
                                                      <span className={`text-[10px] ${slotIsHotDeal ? 'text-white/80' : 'text-muted-foreground'}`}>€{slot.greenFee}</span>
                                                    </Button>
                                                  );
                                                })}
                                                {periodSlots.length > 6 && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                    className="flex-shrink-0 px-2 py-1.5 h-auto text-xs"
                                                  >
                                                    <Link href={`/course/${courseSlot.courseId}`}>
                                                      +{periodSlots.length - 6}
                                                    </Link>
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

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
                          </div>
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
          <div className="bg-muted/30 py-8 sm:py-12 md:py-16">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
              <div className="text-center mb-6 sm:mb-8 md:mb-12">
                <h2 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">{t('home.personalConciergeTitle')}</h2>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
                  {t('home.personalConciergeDescription')}
                </p>
              </div>

              <MobileCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap="md">
                <Card>
                  <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                      {t('home.realTimeTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {t('home.realTimeDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                      {t('home.personalServiceTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {t('home.personalServiceDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      {t('home.premiumCoursesTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {t('home.premiumCoursesDescription')}
                    </p>
                  </CardContent>
                </Card>
              </MobileCardGrid>
            </div>
          </div>

          {/* Call to Action */}
          <div className="py-8 sm:py-12 md:py-16">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 text-center">
              <h2 className="font-serif text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 md:mb-6 px-2">
                Ready to Find Your Perfect Tee Time?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
                Start your search above and discover real-time availability across Costa del Sol's premier courses.
              </p>
              <Button 
                size="lg" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="min-h-11 w-full sm:w-auto"
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
