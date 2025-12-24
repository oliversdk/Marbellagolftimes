import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, ChevronRight, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format, isPast } from "date-fns";
import { MobileLayout } from "@/components/MobileLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BookingRequest } from "@shared/schema";

interface BookingWithCourse extends BookingRequest {
  courseName?: string;
  courseImageUrl?: string;
}

export default function MyBookings() {
  const { t } = useI18n();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: bookings, isLoading } = useQuery<BookingWithCourse[]>({
    queryKey: ['/api/bookings'],
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest('POST', `/api/bookings/${bookingId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({
        title: t('profile.bookingCancelled'),
        description: t('profile.bookingCancelledDesc'),
      });
    },
  });

  const upcomingBookings = bookings?.filter(b => 
    !isPast(new Date(b.teeTime)) && b.status !== 'CANCELLED'
  ) || [];
  
  const pastBookings = bookings?.filter(b => 
    isPast(new Date(b.teeTime)) || b.status === 'CANCELLED'
  ) || [];

  const getStatusBadge = (status: string, teeTime: string) => {
    if (status === 'CANCELLED') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (isPast(new Date(teeTime))) {
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (status === 'CONFIRMED') {
      return <Badge className="bg-green-500">Confirmed</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  if (authLoading) {
    return (
      <MobileLayout activeTab="bookings">
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </MobileLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MobileLayout activeTab="bookings">
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="bg-muted/50 rounded-full p-6 mb-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('profile.loginRequired')}</h2>
          <p className="text-muted-foreground mb-6">{t('profile.loginToViewBookings')}</p>
          <Button onClick={() => navigate('/login')} className="w-full max-w-xs" data-testid="button-login">
            {t('auth.login')}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout activeTab="bookings">
      <div className="sticky top-0 z-40 bg-gradient-to-b from-primary to-primary/95 text-white shadow-lg">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">{t('mobile.navBookings')}</h1>
          <p className="text-sm text-white/80">
            {bookings?.length || 0} {t('profile.totalBookings')}
          </p>
        </div>
        <div className="h-4 bg-gradient-to-b from-primary/95 to-transparent" />
      </div>

      <div className="px-4 -mt-2">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : bookings && bookings.length > 0 ? (
          <div className="space-y-6">
            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {t('profile.upcomingBookings')} ({upcomingBookings.length})
                </h2>
                <div className="space-y-3" data-testid="upcoming-bookings-list">
                  {upcomingBookings.map((booking) => (
                    <Card key={booking.id} className="overflow-hidden" data-testid={`booking-card-${booking.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-base">{booking.courseName || 'Golf Course'}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(booking.teeTime), 'EEE, MMM d')}
                              <span className="mx-1">•</span>
                              <Clock className="h-4 w-4" />
                              {format(new Date(booking.teeTime), 'HH:mm')}
                            </div>
                          </div>
                          {getStatusBadge(booking.status, String(booking.teeTime))}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <span className="text-lg font-bold text-primary">
                            €{((booking.totalAmountCents || 0) / 100).toFixed(0)}
                          </span>
                          {booking.status !== 'CANCELLED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelMutation.mutate(booking.id)}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-${booking.id}`}
                            >
                              {t('profile.cancelBooking')}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                  {t('profile.pastBookings')} ({pastBookings.length})
                </h2>
                <div className="space-y-3" data-testid="past-bookings-list">
                  {pastBookings.slice(0, 5).map((booking) => (
                    <Card key={booking.id} className="overflow-hidden opacity-75" data-testid={`booking-card-${booking.id}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-sm">{booking.courseName || 'Golf Course'}</h3>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(booking.teeTime), 'MMM d, yyyy')}
                            </div>
                          </div>
                          {getStatusBadge(booking.status, String(booking.teeTime))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted/50 rounded-full p-6 mb-4">
              <Calendar className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('profile.noBookings')}</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {t('profile.noBookingsDesc')}
            </p>
            <Button onClick={() => navigate('/')} data-testid="button-browse-courses">
              {t('profile.browseCourses')}
            </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
