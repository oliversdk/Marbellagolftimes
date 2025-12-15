import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAnalytics } from "@/hooks/useAnalytics";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookingModal } from "@/components/BookingModal";
import { PostBookingSignupDialog } from "@/components/PostBookingSignupDialog";
import { ShareMenu } from "@/components/ShareMenu";
import { OptimizedImage } from "@/components/OptimizedImage";
import { WeatherWidget } from "@/components/WeatherWidget";
import { MapPin, Globe, Star, Home, Calendar, Download, ChevronLeft, ChevronRight, Clock, Car, Utensils, Sun, Sunset, Users, Info, AlertCircle, FileText, Shirt, Award, Cloud, Target, ShoppingBag, Dumbbell, GraduationCap, Hotel, Waves, TreePine, Briefcase, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { CourseImage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { StarRating } from "@/components/StarRating";
import { AvailabilityDots } from "@/components/AvailabilityDots";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCourseReviewSchema, type InsertCourseReview } from "@shared/schema";
import { z } from "zod";
import type { GolfCourse, CourseRatePeriod, CourseReview, CourseWithReviews, CourseAddOn } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

// Type for API package from Golfmanager/TeeOne
interface ApiPackage {
  id: number;
  name: string;
  price: number;
  description?: string;
  includesBuggy: boolean;
  includesLunch: boolean;
  isEarlyBird: boolean;
  isTwilight: boolean;
  maxPlayers?: number;
  minPlayers?: number;
}

// Type for available slot from search API
interface AvailableSlot {
  id?: string;
  teeTime: string;
  greenFee?: number;
  slotsAvailable?: number;
  packages?: ApiPackage[];
}

// Type for selected package 
interface SelectedPackageInfo {
  id: string;
  packageType: string;
  rackRate: number;
  includesBuggy: boolean;
  includesLunch: boolean;
  isEarlyBird: boolean;
  isTwilight: boolean;
  timeRestriction?: string;
  notes?: string;
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const { trackEvent } = useAnalytics();
  const { isAuthenticated, user } = useAuth();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [showPostBookingSignup, setShowPostBookingSignup] = useState(false);
  const [lastBookingData, setLastBookingData] = useState<{
    name: string;
    email: string;
    phone: string;
  } | null>(null);
  
  // Booking tab state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<SelectedPackageInfo | null>(null);
  const [selectedApiPackage, setSelectedApiPackage] = useState<ApiPackage | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [players, setPlayers] = useState<number>(2);

  const { data: course, isLoading } = useQuery<CourseWithReviews>({
    queryKey: ['/api/courses', id],
    queryFn: async () => {
      if (!id) throw new Error('No course ID');
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error('Course not found');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<CourseReview[]>({
    queryKey: ['/api/courses', id, 'reviews'],
    queryFn: async () => {
      if (!id) return [];
      const res = await fetch(`/api/courses/${id}/reviews`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const { data: galleryImages = [] } = useQuery<CourseImage[]>({
    queryKey: ['/api/courses', id, 'images'],
    queryFn: async () => {
      if (!id) return [];
      const res = await fetch(`/api/courses/${id}/images`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  // Rate periods for booking packages
  const { data: ratePeriods = [] } = useQuery<CourseRatePeriod[]>({
    queryKey: ['/api/rate-periods', id],
    queryFn: async () => {
      if (!id) return [];
      const res = await fetch(`/api/rate-periods?courseId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  // Course add-ons (buggy, clubs, trolley, etc.)
  const { data: courseAddOns = [] } = useQuery<CourseAddOn[]>({
    queryKey: ['/api/courses', id, 'add-ons'],
    queryFn: async () => {
      if (!id) return [];
      const res = await fetch(`/api/courses/${id}/add-ons`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  // Calculate total price - use API package price if selected
  const calculateTotal = () => {
    // Priority: API package price > slot greenFee
    const basePrice = selectedApiPackage?.price || selectedSlot?.greenFee || 0;
    let addOnsTotal = 0;
    
    // Only add add-ons if package doesn't include buggy (avoid double-charging)
    const packageIncludesBuggy = selectedApiPackage?.includesBuggy;
    
    courseAddOns.forEach(addon => {
      if (selectedAddOns.has(addon.id)) {
        // Skip buggy add-on if API package already includes buggy
        if (packageIncludesBuggy && (addon.type === 'buggy_shared' || addon.type === 'buggy_individual')) {
          return;
        }
        const price = addon.priceCents / 100;
        // Shared buggy is per pair (divide by 2 if more than 1 player)
        if (addon.type === 'buggy_shared') {
          addOnsTotal += price * Math.ceil(players / 2);
        } else if (addon.perPlayer === 'true') {
          addOnsTotal += price * players;
        } else {
          addOnsTotal += price;
        }
      }
    });
    
    return (basePrice * players) + addOnsTotal;
  };

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns(prev => {
      const next = new Set(prev);
      if (next.has(addOnId)) {
        next.delete(addOnId);
      } else {
        next.add(addOnId);
      }
      return next;
    });
  };

  // Available tee time slots for selected date
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const { data: availableSlots = [], isLoading: slotsLoading } = useQuery<AvailableSlot[]>({
    queryKey: ['/api/slots/search', id, dateStr],
    queryFn: async () => {
      if (!id || !dateStr) return [];
      const res = await fetch(`/api/slots/search?courseId=${id}&date=${dateStr}`);
      if (!res.ok) return [];
      const data = await res.json();
      // API returns CourseWithSlots[] format - extract slots from first course
      if (Array.isArray(data) && data.length > 0 && data[0].slots) {
        return data[0].slots;
      }
      return [];
    },
    enabled: !!id && !!dateStr,
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const reviewFormSchema = insertCourseReviewSchema
    .omit({ courseId: true, userId: true })
    .extend({
      rating: z.number().min(1, "Please select a rating").max(5),
      title: z.string().optional(),
      review: z.string().optional(),
    });

  const reviewForm = useForm<z.infer<typeof reviewFormSchema>>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: 0,
      title: "",
      review: "",
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: {
      courseId: string;
      teeTime: string;
      players: number;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }) => {
      const response = await apiRequest('/api/booking-requests', 'POST', data);
      return await response.json();
    },
    onSuccess: (booking, variables) => {
      trackEvent('booking_request_submitted', 'booking', course?.name);
      setBookingModalOpen(false);
      setSuccessBookingId(booking.id);
      setSuccessDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
      
      // Show signup dialog for guests
      if (!isAuthenticated) {
        setLastBookingData({
          name: variables.customerName,
          email: variables.customerEmail,
          phone: variables.customerPhone,
        });
        setShowPostBookingSignup(true);
      }
    },
    onError: () => {
      trackEvent('booking_request_failed', 'booking', course?.name);
      toast({
        title: t('home.bookingFailedTitle'),
        description: t('home.bookingFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  const handleDownloadICS = () => {
    if (successBookingId) {
      trackEvent('calendar_download', 'booking', 'ics_file');
      window.open(`/api/booking-requests/${successBookingId}/calendar/download`, '_blank');
    }
  };

  const handleAddToGoogleCalendar = async () => {
    if (successBookingId) {
      trackEvent('calendar_add', 'booking', 'google_calendar');
      try {
        const res = await fetch(`/api/booking-requests/${successBookingId}/calendar/google`);
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } catch (error) {
        console.error('Failed to get Google Calendar URL:', error);
      }
    }
  };

  const reviewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof reviewFormSchema> & { courseId: string; userId: string }) => {
      const response = await apiRequest(`/api/courses/${id}/reviews`, 'POST', data);
      return await response.json();
    },
    onSuccess: () => {
      trackEvent('review_submitted', 'review', course?.name);
      toast({
        title: "Review Submitted",
        description: "Thank you for your review!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/courses', id, 'reviews'] });
      reviewForm.reset({
        rating: 0,
        title: "",
        review: "",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Submit Review",
        description: "Please try again later.",
        variant: 'destructive',
      });
    },
  });

  const handleReviewSubmit = (data: z.infer<typeof reviewFormSchema>) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a review.",
        variant: 'destructive',
      });
      return;
    }
    reviewMutation.mutate({
      ...data,
      courseId: id!,
      userId: user.id,
    });
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleBookingModalOpen = () => {
    trackEvent('booking_modal_opened', 'booking', course?.name);
    setBookingModalOpen(true);
  };

  const handleStripeCheckout = async () => {
    if (!selectedSlot || !course) return;
    
    setIsProcessingPayment(true);
    trackEvent('checkout_initiated', 'booking', course?.name);

    try {
      // Send only add-on IDs - server will validate pricing
      const selectedAddOnIds = Array.from(selectedAddOns);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          teeTime: selectedSlot.teeTime,
          players,
          selectedAddOnIds, // Only IDs - server validates pricing from cache
          customerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
          customerEmail: user?.email,
          apiPackage: selectedApiPackage, // Include selected API package from Golfmanager/TeeOne
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout',
        variant: 'destructive',
      });
      setIsProcessingPayment(false);
    }
  };

  // Simulate payment for test courses (bypasses Stripe)
  const handleSimulatePayment = async () => {
    if (!selectedSlot || !course) return;
    
    setIsProcessingPayment(true);
    trackEvent('simulate_payment', 'booking', course?.name);

    try {
      const selectedAddOnIds = Array.from(selectedAddOns);

      const response = await fetch('/api/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          teeTime: selectedSlot.teeTime,
          players,
          selectedAddOnIds,
          customerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Test User',
          customerEmail: user?.email || 'test@example.com',
          apiPackage: selectedApiPackage, // Include selected API package
          customerPhone: user?.phoneNumber || '',
        }),
      });

      const data = await response.json();

      if (data.booking) {
        setIsProcessingPayment(false);
        setSuccessBookingId(data.booking.id);
        setSuccessDialogOpen(true);
        queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
        toast({
          title: 'Payment Simulated',
          description: 'Your test booking has been created successfully!',
        });
      } else {
        throw new Error(data.error || 'Failed to simulate payment');
      }
    } catch (error) {
      console.error('Simulate payment error:', error);
      toast({
        title: 'Simulation Error',
        description: error instanceof Error ? error.message : 'Failed to simulate payment',
        variant: 'destructive',
      });
      setIsProcessingPayment(false);
    }
  };

  // Check if this is a test course (for payment simulation)
  const isTestCourse = course?.name?.toLowerCase().includes('test') ?? false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground" data-testid="text-loading">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground" data-testid="text-course-not-found">
          {t('courseDetail.courseNotFound')}
        </p>
        <Button asChild data-testid="button-back-home">
          <Link href="/">{t('common.back')}</Link>
        </Button>
      </div>
    );
  }

// Map facility names from database to translation keys
  const facilityKeyMap: Record<string, string> = {
    'Clubhouse': 'facilityClubhouse',
    'Pro Shop': 'facilityProShop',
    'Driving Range': 'facilityDrivingRange',
    'Restaurant': 'facilityRestaurant',
    'Bar': 'facilityBar',
    'Café': 'facilityCafe',
    'Putting Green': 'facilityPuttingGreen',
    'Cart Rental': 'facilityCartRental',
    'Locker Rooms': 'facilityLockerRooms',
    'Practice Facilities': 'facilityPracticeFacilities',
    'Golf Academy': 'facilityGolfAcademy',
    'Spa': 'facilitySpa',
    'Conference Rooms': 'facilityConferenceRooms',
  };

  const getFacilityTranslation = (facility: string) => {
    const key = facilityKeyMap[facility];
    if (!key) {
      // Fallback to raw facility name if no mapping exists
      return facility;
    }
    return t(`course.${key}` as any);
  };

  // LocalBusiness structured data for course (no phone/email to prevent direct contact)
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "GolfCourse"],
    "name": course.name,
    "description": course.notes || t('courseDetail.defaultDescription'),
    "image": course.imageUrl || "https://marbellagolftimes.com/favicon.png",
    "url": `https://marbellagolftimes.com/course/${course.id}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": course.city,
      "addressRegion": course.province,
      "addressCountry": "ES"
    },
    "geo": course.lat && course.lng ? {
      "@type": "GeoCoordinates",
      "latitude": course.lat,
      "longitude": course.lng
    } : undefined,
    "priceRange": "€€-€€€"
  };

  const courseDescription = course.notes 
    ? `${course.name} in ${course.city}, ${course.province}. ${course.notes}. Book your tee time today.`
    : `${course.name} in ${course.city}, ${course.province}. Experience premier golf at this exceptional Costa del Sol course. Book your tee time today.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${course.name} - Golf Tee Times | Marbella Golf Times`}
        description={courseDescription}
        image={course.imageUrl || undefined}
        url={`https://marbellagolftimes.com/course/${course.id}`}
        type="article"
        structuredData={courseSchema}
      />
      {/* Breadcrumb */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Breadcrumb data-testid="breadcrumb-navigation">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/" data-testid="link-breadcrumb-home">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/" data-testid="link-breadcrumb-courses">
                    {t('courseDetail.courses')}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage data-testid="text-breadcrumb-current">
                  {course.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative h-[35vh] sm:h-[40vh] md:h-[50vh] overflow-hidden bg-muted">
        {course.imageUrl ? (
          <OptimizedImage
            src={course.imageUrl}
            alt={course.name}
            className="w-full h-full object-cover"
            data-testid="img-course-hero"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <p className="text-muted-foreground" data-testid="text-no-image">
              {t('courseDetail.noImageAvailable')}
            </p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap mb-2">
              <h1
                className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight"
                data-testid="text-course-name"
              >
                {course.name}
              </h1>
              {course.averageRating && course.averageRating >= 4.5 && course.reviewCount && course.reviewCount > 0 && (
                <Badge variant="secondary" className="gap-1 h-fit shrink-0" data-testid="badge-top-rated-detail">
                  <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs sm:text-sm">Top Rated</span>
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm sm:text-base text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span data-testid="text-course-location">
                  {course.city}, {course.province}
                </span>
              </div>
              {course.reviewCount && course.reviewCount > 0 && (
                <div className="flex items-center gap-1" data-testid="text-course-rating">
                  <StarRating rating={course.averageRating || 0} size="sm" />
                  <span className="text-xs sm:text-sm font-medium">
                    {(course.averageRating || 0).toFixed(1)} ({course.reviewCount} {course.reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <ShareMenu course={course} size="lg" variant="outline" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="booking" data-testid="tabs-course-detail">
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-6 h-auto p-1" data-testid="tabs-list">
                  <TabsTrigger 
                    value="booking" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-booking"
                  >
                    {t('courseDetail.bookTeeTime')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="overview" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-overview"
                  >
                    {t('courseDetail.overview')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="rules" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-rules"
                  >
                    Booking Rules
                  </TabsTrigger>
                  <TabsTrigger 
                    value="facilities" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-facilities"
                  >
                    {t('courseDetail.facilities')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="gallery" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-gallery"
                  >
                    {t('courseDetail.gallery')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="reviews" 
                    className="min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                    data-testid="tab-reviews"
                  >
                    {t('courseDetail.reviews')}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Booking Tab */}
              <TabsContent value="booking" className="space-y-6" data-testid="content-booking">
                {/* Date Selection */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Select Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <CalendarPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                        setSelectedPackage(null);
                      }}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border mx-auto"
                      data-testid="calendar-date-picker"
                    />
                  </CardContent>
                </Card>

                {/* Available Tee Times */}
                {selectedDate && (
                  <Card>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Available Times for {format(selectedDate, "MMMM d, yyyy")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      {slotsLoading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {[...Array(8)].map((_, i) => (
                            <Skeleton key={i} className="h-12 rounded-md" />
                          ))}
                        </div>
                      ) : availableSlots.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" data-testid="list-tee-times">
                          {availableSlots.map((slot, index) => {
                            const time = new Date(slot.teeTime);
                            const timeStr = format(time, "HH:mm");
                            const isSelected = selectedSlot?.teeTime === slot.teeTime;
                            const hasPrice = slot.greenFee && slot.greenFee > 0;
                            return (
                              <Button
                                key={slot.id || index}
                                variant={isSelected ? "default" : "outline"}
                                className="h-16 flex flex-col items-center justify-center gap-1 px-2"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setSelectedPackage(null);
                                  setSelectedApiPackage(null); // Reset API package selection
                                  // Adjust player count if it exceeds available slots
                                  const maxSlots = slot.slotsAvailable || 4;
                                  if (players > maxSlots) {
                                    setPlayers(maxSlots);
                                  }
                                }}
                                data-testid={`slot-${index}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">{timeStr}</span>
                                  <AvailabilityDots 
                                    slotsAvailable={slot.slotsAvailable} 
                                    size="sm"
                                  />
                                </div>
                                {hasPrice && (
                                  <span className="text-xs opacity-80">€{slot.greenFee}</span>
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No available times for this date</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Players & Add-ons Selection */}
                {selectedSlot && (
                  <Card>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Players & Add-ons
                      </CardTitle>
                      <CardDescription>
                        Customize your booking for {format(new Date(selectedSlot.teeTime), "HH:mm")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                      {/* Number of Players */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Number of Players</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4].map((num) => {
                            const maxSlots = selectedSlot.slotsAvailable || 4;
                            const isDisabled = num > maxSlots;
                            return (
                              <Button
                                key={num}
                                variant={players === num ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPlayers(num)}
                                disabled={isDisabled}
                                data-testid={`players-${num}`}
                                title={isDisabled ? `Only ${maxSlots} ${maxSlots === 1 ? 'spot' : 'spots'} available` : undefined}
                              >
                                {num} {num === 1 ? 'Player' : 'Players'}
                              </Button>
                            );
                          })}
                        </div>
                        {(selectedSlot.slotsAvailable || 4) < 4 && (
                          <p className="text-xs text-muted-foreground">
                            {selectedSlot.slotsAvailable} {selectedSlot.slotsAvailable === 1 ? 'spot' : 'spots'} available for this tee time
                          </p>
                        )}
                      </div>

                      {/* API Packages from Golfmanager/TeeOne (if available) */}
                      {selectedSlot.packages && selectedSlot.packages.length > 0 ? (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Select Package</label>
                          <div className="space-y-2" data-testid="list-api-packages">
                            {selectedSlot.packages.map((pkg, index) => {
                              const isSelected = selectedApiPackage?.id === pkg.id;
                              const totalForPlayers = pkg.price * players;
                              return (
                                <div
                                  key={pkg.id}
                                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                  }`}
                                  onClick={() => {
                                    const newPkg = isSelected ? null : pkg;
                                    setSelectedApiPackage(newPkg);
                                    // Auto-deselect buggy add-ons if package includes buggy
                                    if (newPkg?.includesBuggy) {
                                      setSelectedAddOns(prev => {
                                        const next = new Set(prev);
                                        courseAddOns.forEach(addon => {
                                          if (addon.type === 'buggy_shared' || addon.type === 'buggy_individual') {
                                            next.delete(addon.id);
                                          }
                                        });
                                        return next;
                                      });
                                    }
                                  }}
                                  data-testid={`api-package-${index}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => {
                                        const newPkg = isSelected ? null : pkg;
                                        setSelectedApiPackage(newPkg);
                                        if (newPkg?.includesBuggy) {
                                          setSelectedAddOns(prev => {
                                            const next = new Set(prev);
                                            courseAddOns.forEach(addon => {
                                              if (addon.type === 'buggy_shared' || addon.type === 'buggy_individual') {
                                                next.delete(addon.id);
                                              }
                                            });
                                            return next;
                                          });
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="space-y-1">
                                      <span className="font-medium text-sm">{pkg.name}</span>
                                      {pkg.description && (
                                        <p className="text-xs text-muted-foreground">{pkg.description}</p>
                                      )}
                                      <div className="flex gap-1 flex-wrap items-center">
                                        {pkg.includesBuggy && (
                                          <Badge variant="outline" className="text-xs">
                                            <Car className="h-3 w-3 mr-1" />Buggy
                                          </Badge>
                                        )}
                                        {pkg.includesLunch && (
                                          <Badge variant="outline" className="text-xs">
                                            <Utensils className="h-3 w-3 mr-1" />Lunch
                                          </Badge>
                                        )}
                                        {pkg.isEarlyBird && (
                                          <Badge variant="secondary" className="text-xs">
                                            <Sun className="h-3 w-3 mr-1" />
                                            Early Bird
                                          </Badge>
                                        )}
                                        {pkg.isTwilight && (
                                          <Badge variant="secondary" className="text-xs">
                                            <Sunset className="h-3 w-3 mr-1" />
                                            Twilight
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-medium text-sm text-primary">€{totalForPlayers.toFixed(2)}</span>
                                    <p className="text-xs text-muted-foreground">€{pkg.price}/player</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Green Fee Summary - fallback when no API packages */
                        <div className="p-3 bg-muted/50 rounded-md">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Green Fee ({players}x €{selectedSlot.greenFee || 0})</span>
                            <span className="font-medium">€{(selectedSlot.greenFee || 0) * players}</span>
                          </div>
                        </div>
                      )}

                      {/* Add-ons */}
                      {courseAddOns.length > 0 && (
                        <div className="space-y-3">
                          <label className="text-sm font-medium">Optional Add-ons</label>
                          {courseAddOns.map((addon) => {
                            const isSelected = selectedAddOns.has(addon.id);
                            const price = addon.priceCents / 100;
                            let displayPrice = price;
                            let priceLabel = "";
                            
                            if (addon.type === 'buggy_shared') {
                              displayPrice = price * Math.ceil(players / 2);
                              priceLabel = `€${price}/buggy`;
                            } else if (addon.perPlayer === 'true') {
                              displayPrice = price * players;
                              priceLabel = `€${price}/player`;
                            } else {
                              priceLabel = `€${price}`;
                            }

                            return (
                              <div
                                key={addon.id}
                                className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleAddOn(addon.id);
                                }}
                                data-testid={`addon-${addon.type}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (typeof checked === 'boolean') {
                                        setSelectedAddOns(prev => {
                                          const next = new Set(prev);
                                          if (checked) {
                                            next.add(addon.id);
                                          } else {
                                            next.delete(addon.id);
                                          }
                                          return next;
                                        });
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`checkbox-${addon.type}`}
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      {addon.type === 'buggy_shared' || addon.type === 'buggy_individual' ? (
                                        <Car className="h-4 w-4 text-muted-foreground" />
                                      ) : addon.type === 'clubs' ? (
                                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="font-medium text-sm">{addon.name}</span>
                                    </div>
                                    {addon.description && (
                                      <p className="text-xs text-muted-foreground">{addon.description}</p>
                                    )}
                                    <span className="text-xs text-muted-foreground">{priceLabel}</span>
                                  </div>
                                </div>
                                <span className="font-medium text-sm">
                                  {isSelected ? `+€${displayPrice.toFixed(0)}` : `€${displayPrice.toFixed(0)}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Total */}
                      <div className="p-4 bg-primary/10 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total</span>
                          <span className="text-2xl font-bold text-primary">€{calculateTotal().toFixed(0)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Includes green fee for {players} player{players > 1 ? 's' : ''}{selectedAddOns.size > 0 ? ` + ${selectedAddOns.size} add-on${selectedAddOns.size > 1 ? 's' : ''}` : ''}
                        </p>
                      </div>

                      {/* Book Button */}
                      <Button
                        size="lg"
                        className="w-full min-h-[48px]"
                        onClick={handleStripeCheckout}
                        disabled={isProcessingPayment}
                        data-testid="button-proceed-booking"
                      >
                        {isProcessingPayment ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Processing...
                          </>
                        ) : (
                          <>Pay Now - €{calculateTotal().toFixed(0)}</>
                        )}
                      </Button>

                      {/* Simulate Payment Button - Only for Test Courses */}
                      {isTestCourse && (
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full min-h-[48px] border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          onClick={handleSimulatePayment}
                          disabled={isProcessingPayment}
                          data-testid="button-simulate-payment"
                        >
                          {isProcessingPayment ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Processing...
                            </>
                          ) : (
                            <>Simulate Payment (Test Mode)</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Booking Terms - Only show if course has specific terms */}
                {(() => {
                  // Parse booking rules from course data
                  let bookingRules: {
                    arrivalTime?: string;
                    dressCode?: string;
                    handicapRequirement?: string;
                    buggyPolicy?: string;
                    groupDiscount?: string;
                    cancellationPolicy?: string;
                    additionalNotes?: string[];
                  } | null = null;
                  
                  if (course?.bookingRulesJson) {
                    try {
                      bookingRules = JSON.parse(course.bookingRulesJson);
                    } catch {
                      bookingRules = null;
                    }
                  }
                  
                  // Don't render if no booking rules
                  if (!bookingRules || Object.keys(bookingRules).length === 0) {
                    return null;
                  }
                  
                  return (
                    <Card>
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                          <Info className="h-5 w-5" />
                          Booking Terms
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <div className="space-y-3 text-sm text-muted-foreground">
                          {bookingRules.arrivalTime && (
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                              <span>{bookingRules.arrivalTime}</span>
                            </div>
                          )}
                          {bookingRules.buggyPolicy && (
                            <div className="flex items-start gap-2">
                              <Car className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{bookingRules.buggyPolicy}</span>
                            </div>
                          )}
                          {bookingRules.dressCode && (
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{bookingRules.dressCode}</span>
                            </div>
                          )}
                          {bookingRules.handicapRequirement && (
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{bookingRules.handicapRequirement}</span>
                            </div>
                          )}
                          {bookingRules.groupDiscount && (
                            <div className="flex items-start gap-2">
                              <Users className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                              <span className="text-green-600">{bookingRules.groupDiscount}</span>
                            </div>
                          )}
                          {bookingRules.cancellationPolicy && (
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{bookingRules.cancellationPolicy}</span>
                            </div>
                          )}
                          {bookingRules.additionalNotes?.map((note, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Info className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{note}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

              </TabsContent>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('course.description')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="text-course-description">
                      {course.notes || t('courseDetail.defaultDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">{t('courseDetail.specifications')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" data-testid="content-specifications">
                      <div className="text-center p-3 sm:p-4 bg-muted rounded-md">
                        <p className="text-xl sm:text-2xl font-serif font-bold" data-testid="text-holes">
                          18
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t('courseDetail.holes')}
                        </p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-muted rounded-md">
                        <p className="text-xl sm:text-2xl font-serif font-bold" data-testid="text-par">
                          72
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t('courseDetail.par')}
                        </p>
                      </div>
                      <div className="text-center p-3 sm:p-4 bg-muted rounded-md">
                        <p className="text-xl sm:text-2xl font-serif font-bold" data-testid="text-length">
                          6,200m
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t('courseDetail.length')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Booking Rules Tab */}
              <TabsContent value="rules" className="space-y-6" data-testid="content-rules">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Booking Rules & Terms
                    </CardTitle>
                    <CardDescription>
                      Please read these terms before booking your tee time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-6">
                    {(() => {
                      let rules: Record<string, any> = {};
                      try {
                        rules = course.bookingRulesJson ? JSON.parse(course.bookingRulesJson) : {};
                      } catch (e) {
                        console.warn('Failed to parse bookingRulesJson:', e);
                      }
                      
                      return (
                        <>
                          {/* Arrival & Check-in */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />
                              Arrival & Check-in
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.arrivalTime || "Please arrive at least 20 minutes before your tee time. Check in at the Pro Shop upon arrival. Late arrivals may result in loss of booking without refund."}
                            </p>
                          </div>

                          {/* Dress Code */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Shirt className="h-4 w-4 text-primary" />
                              Dress Code
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.dressCode || "Golf attire required: collared shirts, tailored shorts/trousers. Soft-spiked golf shoes only. No jeans, cargo shorts, or t-shirts on the course."}
                            </p>
                          </div>

                          {/* Buggy & Equipment */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Car className="h-4 w-4 text-primary" />
                              Buggy & Equipment
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.buggyPolicy || "Shared buggy between 2 players. Golf clubs available for rental at the Pro Shop. Buggy GPS rules must be followed at all times."}
                            </p>
                          </div>

                          {/* Handicap Requirements */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Award className="h-4 w-4 text-primary" />
                              Handicap Requirements
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.handicapRequirements || "Valid handicap certificate required. Maximum handicap: 28 for men, 36 for ladies. Digital handicap certificates accepted."}
                            </p>
                          </div>

                          {/* Cancellation Policy */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-primary" />
                              Cancellation Policy
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.cancellationPolicy || "Free cancellation up to 48 hours before tee time. 50% charge for cancellations within 48 hours. No refund for no-shows or same-day cancellations."}
                            </p>
                          </div>

                          {/* Weather Policy */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-primary" />
                              Weather Policy
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.weatherPolicy || "Rain voucher issued if course is closed due to weather. Voucher valid for 12 months from issue date. Subject to availability for rebooking."}
                            </p>
                          </div>

                          {/* Group Bookings */}
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              Group Bookings
                            </h4>
                            <p className="text-sm text-muted-foreground ml-6">
                              {rules.groupBookings || "Groups of 8+ paying players: 1 player plays free. Contact us directly for group rates and packages. Custom arrangements available for tournaments."}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Facilities Tab */}
              <TabsContent value="facilities" data-testid="content-facilities">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">{t('courseDetail.facilities')}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {t('courseDetail.availableAmenities')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    {(() => {
                      let facilitiesData: Record<string, any> | null = null;
                      try {
                        facilitiesData = course.facilitiesJson ? JSON.parse(course.facilitiesJson) : null;
                      } catch (e) {
                        console.warn('Failed to parse facilitiesJson:', e);
                      }
                      
                      if (facilitiesData) {
                        const facilityIcons: Record<string, any> = {
                          drivingRange: Target,
                          puttingGreen: TreePine,
                          chippingArea: Target,
                          proShop: ShoppingBag,
                          restaurant: Utensils,
                          hotel: Hotel,
                          clubRental: Briefcase,
                          buggyRental: Car,
                          golfAcademy: GraduationCap,
                          spa: Waves,
                          pool: Waves,
                        };
                        
                        const facilityLabels: Record<string, string> = {
                          drivingRange: "Driving Range",
                          puttingGreen: "Putting Green",
                          chippingArea: "Chipping Area",
                          proShop: "Pro Shop",
                          restaurant: "Restaurant",
                          hotel: "Hotel",
                          clubRental: "Club Rental",
                          buggyRental: "Buggy Rental",
                          golfAcademy: "Golf Academy",
                          spa: "Spa",
                          pool: "Swimming Pool",
                        };
                        
                        const entries = Object.entries(facilitiesData).filter(([key, val]) => val && key !== 'otherAmenities');
                        
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {entries.map(([key, facility]) => {
                                const Icon = facilityIcons[key] || Info;
                                const label = facilityLabels[key] || key;
                                const data = facility as { name?: string; description?: string; hours?: string; features?: string; priceRange?: string };
                                return (
                                  <Dialog key={key}>
                                    <DialogTrigger asChild>
                                      <button 
                                        className="p-3 rounded-lg border bg-card hover-elevate cursor-pointer text-left w-full"
                                        data-testid={`facility-card-${key}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="p-2 rounded-md bg-primary/10 shrink-0">
                                            <Icon className="h-4 w-4 text-primary" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm">{data.name || label}</h4>
                                            {data.description && (
                                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.description}</p>
                                            )}
                                            {data.hours && (
                                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {data.hours}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          <Icon className="h-5 w-5 text-primary" />
                                          {data.name || label}
                                        </DialogTitle>
                                        <DialogDescription>
                                          {course.name}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        {data.description && (
                                          <p className="text-sm">{data.description}</p>
                                        )}
                                        <div className="grid gap-3">
                                          {data.hours && (
                                            <div className="flex items-center gap-2 text-sm">
                                              <Clock className="h-4 w-4 text-primary" />
                                              <span className="font-medium">Hours:</span>
                                              <span>{data.hours}</span>
                                            </div>
                                          )}
                                          {data.features && (
                                            <div className="flex items-start gap-2 text-sm">
                                              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                              <span className="font-medium">Features:</span>
                                              <span>{data.features}</span>
                                            </div>
                                          )}
                                          {data.priceRange && (
                                            <div className="flex items-center gap-2 text-sm">
                                              <span className="font-medium">Price:</span>
                                              <span>{data.priceRange}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                );
                              })}
                            </div>
                            {facilitiesData.otherAmenities && facilitiesData.otherAmenities.length > 0 && (
                              <div className="pt-2 border-t">
                                <h4 className="font-medium text-sm mb-2">Other Amenities</h4>
                                <div className="flex flex-wrap gap-2">
                                  {facilitiesData.otherAmenities.map((amenity: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {amenity}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      const defaultFacilities = course.facilities && course.facilities.length > 0 
                        ? course.facilities 
                        : ["Driving Range", "Putting Green", "Pro Shop", "Restaurant", "Club Rental", "Buggy Rental"];
                      
                      const facilityIcons: Record<string, any> = {
                        "Driving Range": Target,
                        "Putting Green": TreePine,
                        "Chipping Area": Target,
                        "Pro Shop": ShoppingBag,
                        "Restaurant": Utensils,
                        "Hotel": Hotel,
                        "Club Rental": Briefcase,
                        "Buggy Rental": Car,
                        "Golf Academy": GraduationCap,
                        "Spa": Waves,
                        "Swimming Pool": Waves,
                      };
                      
                      const defaultDescriptions: Record<string, string> = {
                        "Driving Range": "Practice your long game at our well-maintained driving range with natural grass hitting bays.",
                        "Putting Green": "Fine-tune your putting on our championship-quality practice green.",
                        "Chipping Area": "Perfect your short game with dedicated chipping and pitching areas.",
                        "Pro Shop": "Visit our fully stocked pro shop for all your golfing needs, from clubs to apparel.",
                        "Restaurant": "Enjoy a meal or refreshments at our clubhouse restaurant with stunning course views.",
                        "Hotel": "On-site accommodation available for the ultimate golf getaway experience.",
                        "Club Rental": "Quality rental clubs available for visitors. Reserve in advance for best selection.",
                        "Buggy Rental": "Electric buggies available for rent. GPS-equipped for easy navigation.",
                        "Golf Academy": "Professional instruction available for all skill levels.",
                        "Spa": "Relax and rejuvenate after your round at our on-site spa facilities.",
                        "Swimming Pool": "Cool off in our swimming pool, perfect for the whole family.",
                      };
                      
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {defaultFacilities.map((facility, index) => {
                              const Icon = facilityIcons[facility] || Info;
                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                                  data-testid={`badge-facility-${index}`}
                                >
                                  <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                                    <Icon className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <span className="text-xs font-medium truncate">{getFacilityTranslation(facility)}</span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            Detailed facility information will be available after AI enrichment.
                          </p>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Gallery Tab */}
              <TabsContent value="gallery" data-testid="content-gallery">
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">{t('courseDetail.gallery')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                    {galleryImages.length > 0 ? (
                      <div className="space-y-4">
                        <Carousel 
                          className="w-full" 
                          opts={{ loop: true }}
                          data-testid="carousel-gallery"
                        >
                          <CarouselContent className="-ml-2 sm:-ml-4">
                            {galleryImages.map((image, index) => (
                              <CarouselItem key={image.id} className="pl-2 sm:pl-4" data-testid={`carousel-item-${index}`}>
                                <div className="space-y-2">
                                  <OptimizedImage
                                    src={image.imageUrl}
                                    alt={image.caption || `${course.name} - Image ${index + 1}`}
                                    className="w-full rounded-md object-cover aspect-video"
                                    data-testid={`img-gallery-${index}`}
                                  />
                                  {image.caption && (
                                    <p 
                                      className="text-xs sm:text-sm text-muted-foreground text-center px-2"
                                      data-testid={`caption-gallery-${index}`}
                                    >
                                      {image.caption}
                                    </p>
                                  )}
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <CarouselPrevious 
                            className="left-1 sm:left-2 h-10 w-10 sm:h-8 sm:w-8 bg-background/90 hover:bg-background"
                            data-testid="button-gallery-prev"
                          />
                          <CarouselNext 
                            className="right-1 sm:right-2 h-10 w-10 sm:h-8 sm:w-8 bg-background/90 hover:bg-background"
                            data-testid="button-gallery-next"
                          />
                        </Carousel>
                        <div className="flex justify-center gap-2">
                          {galleryImages.map((_, index) => (
                            <div
                              key={index}
                              className={`h-2 w-2 rounded-full transition-colors ${
                                index === currentImageIndex ? 'bg-primary' : 'bg-muted'
                              }`}
                              data-testid={`dot-gallery-${index}`}
                            />
                          ))}
                        </div>
                        <p 
                          className="text-center text-sm text-muted-foreground"
                          data-testid="text-image-count"
                        >
                          {galleryImages.length} {galleryImages.length === 1 ? 'image' : 'images'}
                        </p>
                      </div>
                    ) : course.imageUrl ? (
                      <div className="space-y-4">
                        <OptimizedImage
                          src={course.imageUrl}
                          alt={course.name}
                          className="w-full rounded-md object-cover aspect-video"
                          data-testid="img-gallery-main"
                        />
                        <p className="text-center text-muted-foreground" data-testid="text-more-photos">
                          {t('courseDetail.morePhotos')}
                        </p>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center justify-center h-64 bg-muted rounded-md"
                        data-testid="gallery-no-images"
                      >
                        <p className="text-muted-foreground">
                          {t('courseDetail.noImageAvailable')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" data-testid="content-reviews">
                <div className="space-y-4 sm:space-y-6">
                  {/* Review Submission Form */}
                  {isAuthenticated ? (
                    <Card>
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">Write a Review</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Share your experience with this course</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                        <Form {...reviewForm}>
                          <form onSubmit={reviewForm.handleSubmit(handleReviewSubmit)} className="space-y-4">
                            <FormField
                              control={reviewForm.control}
                              name="rating"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm">Rating *</FormLabel>
                                  <FormControl>
                                    <div className="py-2">
                                      <StarRating
                                        rating={field.value}
                                        size="lg"
                                        interactive
                                        onRatingChange={(rating) => {
                                          field.onChange(rating);
                                        }}
                                        data-testid="input-review-rating"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={reviewForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm">Title</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Summarize your experience"
                                      className="min-h-[44px] text-base sm:text-sm"
                                      {...field}
                                      data-testid="input-review-title"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={reviewForm.control}
                              name="review"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm">Review</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Tell us about your experience at this course..."
                                      className="min-h-32 text-base sm:text-sm"
                                      {...field}
                                      data-testid="input-review-text"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              disabled={reviewMutation.isPending}
                              className="w-full sm:w-auto min-h-[44px]"
                              data-testid="button-submit-review"
                            >
                              {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                            </Button>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-6 px-4 sm:px-6">
                        <p className="text-center text-sm sm:text-base text-muted-foreground">
                          Please{" "}
                          <Link href="/login" className="text-primary hover:underline font-medium">
                            log in
                          </Link>{" "}
                          to write a review
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Existing Reviews */}
                  <Card>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">
                        {reviews.length > 0
                          ? `Reviews (${reviews.length})`
                          : t('courseDetail.reviews')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      {reviewsLoading ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">Loading reviews...</p>
                        </div>
                      ) : reviews.length > 0 ? (
                        <div className="space-y-4 sm:space-y-6">
                          {reviews.map((review: CourseReview) => (
                            <div
                              key={review.id}
                              className="border-b pb-4 sm:pb-6 last:border-b-0 last:pb-0"
                              data-testid={`review-${review.id}`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                                <div>
                                  <StarRating rating={review.rating} size="sm" />
                                  {review.title && (
                                    <h4 className="font-medium mt-1 text-sm sm:text-base" data-testid="text-review-title">
                                      {review.title}
                                    </h4>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                                </p>
                              </div>
                              {review.review && (
                                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed" data-testid="text-review-content">
                                  {review.review}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 sm:py-12">
                          <Star className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/30 mb-4" />
                          <p className="text-sm text-muted-foreground" data-testid="text-no-reviews">
                            {t('courseDetail.noReviews')}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Location & Info */}
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">{t('courseDetail.location')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                <div className="flex items-start gap-3 p-2 -m-2" data-testid="contact-location">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium">{course.city}, {course.province}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Costa del Sol, Spain
                    </p>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            {course.lat && course.lng && (
              <WeatherWidget lat={course.lat} lng={course.lng} />
            )}

            {selectedDate && selectedSlot && selectedPackage ? (
              <Card className="border-primary">
                <CardContent className="p-4 sm:pt-6 space-y-2">
                  <div className="text-sm mb-2">
                    <p className="font-medium">{format(selectedDate, "EEE, MMM d")}</p>
                    <p className="text-muted-foreground">{format(new Date(selectedSlot.teeTime), "HH:mm")} - €{selectedPackage.rackRate}</p>
                  </div>
                  <Button
                    className="w-full min-h-[48px]"
                    size="lg"
                    onClick={handleBookingModalOpen}
                    data-testid="button-book-sidebar"
                  >
                    {t('courseDetail.bookTeeTime')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 sm:pt-6 space-y-2">
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    Select a date, time, and package to book
                  </p>
                  <ShareMenu course={course} size="lg" variant="outline" className="w-full min-h-[44px]" />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        course={course}
        selectedSlot={selectedSlot ? {
          teeTime: selectedSlot.teeTime,
          greenFee: selectedPackage?.rackRate || selectedSlot.greenFee || 0,
          currency: 'EUR',
          players: 2,
          holes: 18,
          source: 'mock',
          slotsAvailable: selectedSlot.slotsAvailable || 4,
        } : undefined}
        open={bookingModalOpen}
        onOpenChange={(open) => {
          setBookingModalOpen(open);
          if (!open) {
            // Reset selections when modal closes
          }
        }}
        onSubmit={(data) => bookingMutation.mutate(data)}
        isPending={bookingMutation.isPending}
      />

      {/* Success Dialog with Calendar Options */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[500px] rounded-lg sm:rounded-xl" data-testid="dialog-booking-success">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl sm:text-2xl text-center">
              {t('home.bookingSuccessTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3 pt-2">
              <div className="text-sm sm:text-base">
                {t('home.bookingSuccessDescription')}
              </div>
              <div className="bg-muted p-3 sm:p-4 rounded-md">
                <p className="text-xs sm:text-sm font-medium text-foreground mb-1 flex items-center justify-center gap-2">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  {t('booking.emailConfirmationSent')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('booking.checkEmailForDetails')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <p className="text-xs sm:text-sm font-medium text-center text-muted-foreground">
              {t('booking.addToCalendar')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={handleAddToGoogleCalendar}
                data-testid="button-add-google-calendar"
                className="w-full min-h-[44px] text-xs sm:text-sm"
              >
                <Calendar className="mr-2 h-4 w-4 shrink-0" />
                Google Calendar
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadICS}
                data-testid="button-download-ics"
                className="w-full min-h-[44px] text-xs sm:text-sm"
              >
                <Download className="mr-2 h-4 w-4 shrink-0" />
                {t('booking.downloadICS')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t('booking.calendarDescription')}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setSuccessDialogOpen(false)}
              data-testid="button-close-success"
              className="w-full min-h-[44px]"
            >
              {t('common.close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
