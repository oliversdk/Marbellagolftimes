import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
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
import { ShareMenu } from "@/components/ShareMenu";
import { OptimizedImage } from "@/components/OptimizedImage";
import { WeatherWidget } from "@/components/WeatherWidget";
import { MapPin, Phone, Mail, Globe, Star, Home, Calendar, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GolfCourse } from "@shared/schema";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

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

  const bookingMutation = useMutation({
    mutationFn: async (data: {
      courseId: string;
      teeTime: string;
      players: number;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }) => {
      return await apiRequest('POST', '/api/booking-requests', data);
    },
    onSuccess: (booking) => {
      setBookingModalOpen(false);
      setSuccessBookingId(booking.id);
      setSuccessDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests'] });
    },
    onError: () => {
      toast({
        title: t('home.bookingFailedTitle'),
        description: t('home.bookingFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  const handleDownloadICS = () => {
    if (successBookingId) {
      window.open(`/api/booking-requests/${successBookingId}/calendar/download`, '_blank');
    }
  };

  const handleAddToGoogleCalendar = async () => {
    if (successBookingId) {
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

  const stubFacilities = [
    t('courseDetail.facilityClubhouse'),
    t('courseDetail.facilityProShop'),
    t('courseDetail.facilityDrivingRange'),
    t('courseDetail.facilityRestaurant'),
    t('courseDetail.facilityPuttingGreen'),
    t('courseDetail.facilityCartRental'),
    t('courseDetail.facilityLockerRooms'),
    t('courseDetail.facilityPracticeFacilities'),
  ];

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
        image={course.imageUrl}
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
            <h1
              className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2"
              data-testid="text-course-name"
            >
              {course.name}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <MapPin className="h-5 w-5" />
              <span data-testid="text-course-location">
                {course.city}, {course.province}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="lg"
                onClick={() => setBookingModalOpen(true)}
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
                      {stubFacilities.map((facility, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="justify-center py-2"
                          data-testid={`badge-facility-${index}`}
                        >
                          {facility}
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
                    {course.imageUrl && (
                      <OptimizedImage
                        src={course.imageUrl}
                        alt={course.name}
                        className="w-full rounded-md object-cover aspect-video"
                        data-testid="img-gallery-main"
                      />
                    )}
                    <p className="text-center text-muted-foreground" data-testid="text-more-photos">
                      {t('courseDetail.morePhotos')}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" data-testid="content-reviews">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('courseDetail.reviews')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground" data-testid="text-no-reviews">
                        {t('courseDetail.noReviews')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
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
                  onClick={() => setBookingModalOpen(true)}
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
    </div>
  );
}
