import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Calendar, Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import type { BookingRequest, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: isAuthenticated && typedUser?.isAdmin === 'true',
  });

  const { toast } = useToast();

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      await apiRequest(`/api/admin/users/${userId}/admin`, 'PATCH', { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: t('common.success'),
        description: 'Admin status updated successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to update admin status',
      });
    },
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
              {typedUser.phoneNumber && ` • ${typedUser.phoneNumber}`}
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

        {/* Admin User Management (only visible to admins) */}
        {typedUser.isAdmin === 'true' && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin User Management
              </CardTitle>
              <CardDescription>
                Manage admin privileges for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t('common.loading')}</p>
                </div>
              ) : allUsers && allUsers.length > 0 ? (
                <Table data-testid="table-admin-users">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Admin Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((adminUser) => (
                      <TableRow key={adminUser.id} data-testid={`row-user-${adminUser.id}`}>
                        <TableCell className="font-medium">
                          {adminUser.firstName} {adminUser.lastName}
                        </TableCell>
                        <TableCell>{adminUser.email}</TableCell>
                        <TableCell>{adminUser.phoneNumber || '-'}</TableCell>
                        <TableCell>
                          {adminUser.isAdmin === 'true' ? (
                            <Badge variant="default" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              User
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={adminUser.isAdmin === 'true' ? 'destructive' : 'default'}
                            onClick={() => toggleAdminMutation.mutate({
                              userId: adminUser.id,
                              isAdmin: adminUser.isAdmin !== 'true',
                            })}
                            disabled={toggleAdminMutation.isPending || adminUser.id === typedUser.id}
                            data-testid={`button-toggle-admin-${adminUser.id}`}
                          >
                            {adminUser.isAdmin === 'true' ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-1" />
                                Make Admin
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
