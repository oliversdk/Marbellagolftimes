import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
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
import { BookingModal } from "@/components/BookingModal";
import { ShareMenu } from "@/components/ShareMenu";
import { MapPin, Phone, Mail, Globe, Star, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GolfCourse } from "@shared/schema";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

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
    onSuccess: () => {
      toast({
        title: t('home.bookingSuccessTitle'),
        description: t('home.bookingSuccessDescription'),
      });
      setBookingModalOpen(false);
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

  return (
    <div className="min-h-screen bg-background">
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
          <img
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
                      <img
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
    </div>
  );
}
