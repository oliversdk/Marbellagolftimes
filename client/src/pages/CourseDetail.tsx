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
import { BookingModal } from "@/components/BookingModal";
import { PostBookingSignupDialog } from "@/components/PostBookingSignupDialog";
import { ShareMenu } from "@/components/ShareMenu";
import { OptimizedImage } from "@/components/OptimizedImage";
import { WeatherWidget } from "@/components/WeatherWidget";
import { MapPin, Phone, Mail, Globe, Star, Home, Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCourseReviewSchema, type InsertCourseReview } from "@shared/schema";
import { z } from "zod";
import type { GolfCourse } from "@shared/schema";

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

  const { data: course, isLoading } = useQuery<GolfCourse>({
    queryKey: ['/api/courses', id],
    queryFn: async () => {
      if (!id) throw new Error('No course ID');
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error('Course not found');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<any[]>({
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

  const handleBookingModalOpen = () => {
    trackEvent('booking_modal_opened', 'booking', course?.name);
    setBookingModalOpen(true);
  };

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

  // LocalBusiness structured data for course
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "GolfCourse"],
    "name": course.name,
    "description": course.notes || t('courseDetail.defaultDescription'),
    "image": course.imageUrl || "https://fridasgolf.com/favicon.png",
    "url": `https://fridasgolf.com/course/${course.id}`,
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
    "priceRange": "€€-€€€",
    "telephone": course.phone || undefined,
    "email": course.email || undefined
  };

  const courseDescription = course.notes 
    ? `${course.name} in ${course.city}, ${course.province}. ${course.notes}. Book your tee time today.`
    : `${course.name} in ${course.city}, ${course.province}. Experience premier golf at this exceptional Costa del Sol course. Book your tee time today.`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${course.name} - Golf Tee Times | Fridas Golf`}
        description={courseDescription}
        image={course.imageUrl || undefined}
        url={`https://fridasgolf.com/course/${course.id}`}
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
      <div className="relative h-[40vh] md:h-[50vh] overflow-hidden bg-muted">
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
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1
                className="font-serif text-4xl md:text-5xl font-bold text-foreground"
                data-testid="text-course-name"
              >
                {course.name}
              </h1>
              {(course as any).averageRating >= 4.5 && (course as any).reviewCount > 0 && (
                <Badge variant="secondary" className="gap-1 h-fit" data-testid="badge-top-rated-detail">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  Top Rated
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span data-testid="text-course-location">
                  {course.city}, {course.province}
                </span>
              </div>
              {(course as any).reviewCount > 0 && (
                <div className="flex items-center gap-1" data-testid="text-course-rating">
                  <StarRating rating={(course as any).averageRating} size="sm" />
                  <span className="text-sm font-medium">
                    {(course as any).averageRating.toFixed(1)} ({(course as any).reviewCount} {(course as any).reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="lg"
                onClick={handleBookingModalOpen}
                data-testid="button-book-tee-time"
              >
                {t('courseDetail.bookTeeTime')}
              </Button>
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
            <Tabs defaultValue="overview" data-testid="tabs-course-detail">
              <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  {t('courseDetail.overview')}
                </TabsTrigger>
                <TabsTrigger value="facilities" data-testid="tab-facilities">
                  {t('courseDetail.facilities')}
                </TabsTrigger>
                <TabsTrigger value="gallery" data-testid="tab-gallery">
                  {t('courseDetail.gallery')}
                </TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews">
                  {t('courseDetail.reviews')}
                </TabsTrigger>
              </TabsList>

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
                  <CardHeader>
                    <CardTitle>{t('courseDetail.specifications')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4" data-testid="content-specifications">
                      <div className="text-center p-4 bg-muted rounded-md">
                        <p className="text-2xl font-serif font-bold" data-testid="text-holes">
                          18
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('courseDetail.holes')}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-md">
                        <p className="text-2xl font-serif font-bold" data-testid="text-par">
                          72
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('courseDetail.par')}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-md">
                        <p className="text-2xl font-serif font-bold" data-testid="text-length">
                          6,200m
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('courseDetail.length')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Facilities Tab */}
              <TabsContent value="facilities" data-testid="content-facilities">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('courseDetail.facilities')}</CardTitle>
                    <CardDescription>
                      {t('courseDetail.availableAmenities')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(course.facilities || []).map((facility, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="justify-center py-2"
                          data-testid={`badge-facility-${index}`}
                        >
                          {getFacilityTranslation(facility)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Gallery Tab */}
              <TabsContent value="gallery" data-testid="content-gallery">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('courseDetail.gallery')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {galleryImages.length > 0 ? (
                      <div className="space-y-4">
                        <Carousel 
                          className="w-full" 
                          opts={{ loop: true }}
                          data-testid="carousel-gallery"
                        >
                          <CarouselContent>
                            {galleryImages.map((image, index) => (
                              <CarouselItem key={image.id} data-testid={`carousel-item-${index}`}>
                                <div className="space-y-2">
                                  <OptimizedImage
                                    src={image.imageUrl}
                                    alt={image.caption || `${course.name} - Image ${index + 1}`}
                                    className="w-full rounded-md object-cover aspect-video"
                                    data-testid={`img-gallery-${index}`}
                                  />
                                  {image.caption && (
                                    <p 
                                      className="text-sm text-muted-foreground text-center"
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
                            className="left-2 bg-background/80 hover:bg-background"
                            data-testid="button-gallery-prev"
                          />
                          <CarouselNext 
                            className="right-2 bg-background/80 hover:bg-background"
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
                <div className="space-y-6">
                  {/* Review Submission Form */}
                  {isAuthenticated ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Write a Review</CardTitle>
                        <CardDescription>Share your experience with this course</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Form {...reviewForm}>
                          <form onSubmit={reviewForm.handleSubmit(handleReviewSubmit)} className="space-y-4">
                            <FormField
                              control={reviewForm.control}
                              name="rating"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Rating *</FormLabel>
                                  <FormControl>
                                    <div>
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
                                  <FormLabel>Title</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Summarize your experience"
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
                                  <FormLabel>Review</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Tell us about your experience at this course..."
                                      className="min-h-32"
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
                      <CardContent className="py-6">
                        <p className="text-center text-muted-foreground">
                          Please{" "}
                          <Link href="/login" className="text-primary hover:underline">
                            log in
                          </Link>{" "}
                          to write a review
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Existing Reviews */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {reviews.length > 0
                          ? `Reviews (${reviews.length})`
                          : t('courseDetail.reviews')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {reviewsLoading ? (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">Loading reviews...</p>
                        </div>
                      ) : reviews.length > 0 ? (
                        <div className="space-y-6">
                          {reviews.map((review: any) => (
                            <div
                              key={review.id}
                              className="border-b pb-6 last:border-b-0 last:pb-0"
                              data-testid={`review-${review.id}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <StarRating rating={review.rating} size="sm" />
                                  {review.title && (
                                    <h4 className="font-medium mt-1" data-testid="text-review-title">
                                      {review.title}
                                    </h4>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              {review.review && (
                                <p className="text-sm text-muted-foreground mt-2" data-testid="text-review-content">
                                  {review.review}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                          <p className="text-muted-foreground" data-testid="text-no-reviews">
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

          {/* Sidebar - Contact Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('courseDetail.contactInformation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {course.email && (
                  <div className="flex items-start gap-3" data-testid="contact-email">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t('courseDetail.email')}</p>
                      <a
                        href={`mailto:${course.email}`}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors break-all"
                      >
                        {course.email}
                      </a>
                    </div>
                  </div>
                )}
                
                {course.phone && (
                  <div className="flex items-start gap-3" data-testid="contact-phone">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('courseDetail.phone')}</p>
                      <a
                        href={`tel:${course.phone}`}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {course.phone}
                      </a>
                    </div>
                  </div>
                )}
                
                {course.websiteUrl && (
                  <div className="flex items-start gap-3" data-testid="contact-website">
                    <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{t('courseDetail.website')}</p>
                      <a
                        href={course.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary transition-colors break-all"
                      >
                        {t('courseDetail.visitWebsite')}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3" data-testid="contact-location">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('courseDetail.location')}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.city}, {course.province}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {course.lat && course.lng && (
              <WeatherWidget lat={course.lat} lng={course.lng} />
            )}

            <Card>
              <CardContent className="pt-6 space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBookingModalOpen}
                  data-testid="button-book-sidebar"
                >
                  {t('courseDetail.bookTeeTime')}
                </Button>
                <ShareMenu course={course} size="lg" variant="outline" className="w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        course={course}
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSubmit={(data) => bookingMutation.mutate(data)}
        isPending={bookingMutation.isPending}
      />

      {/* Success Dialog with Calendar Options */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px]" data-testid="dialog-booking-success">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl text-center">
              {t('home.bookingSuccessTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3 pt-2">
              <div className="text-base">
                {t('home.bookingSuccessDescription')}
              </div>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t('booking.emailConfirmationSent')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('booking.checkEmailForDetails')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <p className="text-sm font-medium text-center text-muted-foreground">
              {t('booking.addToCalendar')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleAddToGoogleCalendar}
                data-testid="button-add-google-calendar"
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Google Calendar
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadICS}
                data-testid="button-download-ics"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
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
              className="w-full"
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
