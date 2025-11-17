import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import type { BookingRequest, User } from "@shared/schema";

interface BookingWithCourse extends BookingRequest {
  courseName: string;
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const typedUser = user as User | undefined;

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithCourse[]>({
    queryKey: ['/api/bookings'],
    enabled: isAuthenticated,
  });

  // Show loading state
  if (authLoading || !typedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  // Get status badge variant
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'CONFIRMED':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <SEO 
        title={`${t('profile.title')} - Fridas Golf`}
        description="View your booking history and manage your golf tee time reservations"
      />
      <div className="container mx-auto p-6 max-w-6xl" data-testid="page-profile">
        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('profile.title')}</CardTitle>
            <CardDescription>
              {typedUser.firstName} {typedUser.lastName} • {typedUser.email}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Booking History Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.bookingHistory')}</CardTitle>
            <CardDescription>
              {bookings && bookings.length > 0
                ? `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`
                : t('profile.noBookings')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : bookings && bookings.length > 0 ? (
              <Table data-testid="table-booking-history">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('profile.course')}</TableHead>
                    <TableHead>{t('profile.teeTime')}</TableHead>
                    <TableHead>{t('profile.players')}</TableHead>
                    <TableHead>{t('profile.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking, index) => (
                    <TableRow key={booking.id} data-testid={`row-booking-${index}`}>
                      <TableCell className="font-medium">{booking.courseName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(booking.teeTime), 'PPP p')}
                        </div>
                      </TableCell>
                      <TableCell>{booking.players}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(booking.status)}>
                          {t(`profile.status${booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12" data-testid="text-no-bookings">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t('profile.noBookings')}</p>
                <Button onClick={() => navigate('/')} data-testid="button-book-now">
                  {t('profile.bookNow')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
