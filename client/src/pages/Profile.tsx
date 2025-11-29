import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { SEO } from "@/components/SEO";
import { GolfLoader } from "@/components/GolfLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Shield, ShieldOff, Pencil, Trash2, X, RotateCcw, AlertTriangle, User as UserIcon } from "lucide-react";
import { format, isPast, differenceInHours } from "date-fns";
import type { BookingRequest, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface BookingWithCourse extends BookingRequest {
  courseName: string;
}

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
});

type EditUserFormData = z.infer<typeof editUserSchema>;

const cancelBookingSchema = z.object({
  reason: z.string().min(3, "Please provide a reason (minimum 3 characters)"),
});

type CancelBookingFormData = z.infer<typeof cancelBookingSchema>;

function BookingCard({ 
  booking, 
  index, 
  isUpcoming,
  canCancel,
  onCancel, 
  onRebook,
  rebookPending,
  getStatusVariant,
  t
}: { 
  booking: BookingWithCourse;
  index: number;
  isUpcoming: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onRebook: () => void;
  rebookPending: boolean;
  getStatusVariant: (status: string) => "default" | "secondary" | "destructive";
  t: (key: string) => string;
}) {
  return (
    <Card 
      className="w-full" 
      data-testid={`card-${isUpcoming ? 'upcoming' : 'past'}-booking-${index}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-base leading-tight">{booking.courseName}</h3>
          <Badge variant={getStatusVariant(booking.status)} className="flex-shrink-0">
            {t(`profile.status${booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}`)}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{format(new Date(booking.teeTime), 'PPP p')}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('profile.players')}</span>
            <span className="font-medium">{booking.players}</span>
          </div>
        </div>
        
        <div className="pt-2">
          {isUpcoming ? (
            canCancel ? (
              <Button
                className="w-full min-h-[44px]"
                variant="destructive"
                onClick={onCancel}
                data-testid={`button-cancel-${index}`}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Booking
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Cannot cancel (less than 24h before tee time)</span>
              </div>
            )
          ) : (
            <Button
              className="w-full min-h-[44px]"
              variant="outline"
              onClick={onRebook}
              disabled={rebookPending}
              data-testid={`button-rebook-${index}`}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Book Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminUserCard({
  adminUser,
  currentUserId,
  onEdit,
  onToggleAdmin,
  onDelete,
  togglePending,
  deletePending,
}: {
  adminUser: User;
  currentUserId: string;
  onEdit: () => void;
  onToggleAdmin: () => void;
  onDelete: () => void;
  togglePending: boolean;
  deletePending: boolean;
}) {
  const isCurrentUser = adminUser.id === currentUserId;
  
  return (
    <Card className="w-full" data-testid={`card-user-${adminUser.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-base truncate">
              {adminUser.firstName} {adminUser.lastName}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{adminUser.email}</p>
            {adminUser.phoneNumber && (
              <p className="text-sm text-muted-foreground">{adminUser.phoneNumber}</p>
            )}
          </div>
          {adminUser.isAdmin === 'true' ? (
            <Badge variant="default" className="gap-1 flex-shrink-0">
              <Shield className="h-3 w-3" />
              Admin
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex-shrink-0">
              User
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1 min-h-[44px]"
            variant="outline"
            onClick={onEdit}
            data-testid={`button-edit-${adminUser.id}`}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            className="flex-1 min-h-[44px]"
            variant="outline"
            onClick={onToggleAdmin}
            disabled={togglePending || isCurrentUser}
            data-testid={`button-toggle-admin-${adminUser.id}`}
          >
            {adminUser.isAdmin === 'true' ? (
              <>
                <ShieldOff className="h-4 w-4 mr-2" />
                Remove
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </>
            )}
          </Button>
          <Button
            className="min-h-[44px]"
            size="icon"
            variant="destructive"
            onClick={onDelete}
            disabled={deletePending || isCurrentUser}
            data-testid={`button-delete-${adminUser.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const { isMobile } = useBreakpoint();
  const typedUser = user as User | undefined;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithCourse | null>(null);

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
    },
  });

  const cancelForm = useForm<CancelBookingFormData>({
    resolver: zodResolver(cancelBookingSchema),
    defaultValues: {
      reason: "",
    },
  });

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

  const updateUserMutation = useMutation({
    mutationFn: async (data: EditUserFormData & { userId: string }) => {
      const { userId, ...updateData } = data;
      await apiRequest(`/api/admin/users/${userId}`, 'PATCH', updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditDialogOpen(false);
      editForm.reset();
      toast({
        title: t('common.success'),
        description: 'User updated successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to update user',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/admin/users/${userId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: t('common.success'),
        description: 'User deleted successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to delete user',
      });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      await apiRequest(`/api/booking-requests/${bookingId}/cancel`, 'POST', { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      cancelForm.reset();
      toast({
        title: t('common.success'),
        description: 'Booking cancelled successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to cancel booking',
      });
    },
  });

  const rebookMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest(`/api/booking-requests/${bookingId}/rebook`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({
        title: t('common.success'),
        description: 'Booking duplicated successfully! Check your Upcoming bookings.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Failed to duplicate booking',
      });
    },
  });

  const handleEditUser = (adminUser: User) => {
    setSelectedUser(adminUser);
    editForm.reset({
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: adminUser.email,
      phoneNumber: adminUser.phoneNumber || "",
    });
    setEditDialogOpen(true);
  };

  const handleDeleteUser = (adminUser: User) => {
    setSelectedUser(adminUser);
    setDeleteDialogOpen(true);
  };

  const onEditSubmit = (data: EditUserFormData) => {
    if (selectedUser) {
      updateUserMutation.mutate({ ...data, userId: selectedUser.id });
    }
  };

  const handleCancelBooking = (booking: BookingWithCourse) => {
    setSelectedBooking(booking);
    setCancelDialogOpen(true);
  };

  const onCancelSubmit = (data: CancelBookingFormData) => {
    if (selectedBooking) {
      cancelBookingMutation.mutate({ bookingId: selectedBooking.id, reason: data.reason });
    }
  };

  const handleRebook = (booking: BookingWithCourse) => {
    rebookMutation.mutate(booking.id);
  };

  const canCancelBooking = (booking: BookingWithCourse): boolean => {
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') return false;
    const hoursUntilTeeTime = differenceInHours(new Date(booking.teeTime), new Date());
    return hoursUntilTeeTime >= 24;
  };

  const upcomingBookings = bookings?.filter(b => !isPast(new Date(b.teeTime)) && b.status !== 'CANCELLED') || [];
  const pastBookings = bookings?.filter(b => isPast(new Date(b.teeTime)) || b.status === 'CANCELLED') || [];

  if (authLoading || !typedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GolfLoader size="lg" text={t('common.loading')} />
      </div>
    );
  }

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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <>
      <SEO 
        title={`${t('profile.title')} - Fridas Golf`}
        description="View your booking history and manage your golf tee time reservations"
      />
      <div className="container mx-auto p-4 md:p-6 max-w-6xl" data-testid="page-profile">
        {/* User Info Card - Mobile Responsive */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <Avatar className="h-16 w-16 md:h-20 md:w-20 mx-auto md:mx-0">
                <AvatarFallback className="text-lg md:text-xl bg-primary text-primary-foreground">
                  {getInitials(typedUser.firstName, typedUser.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left flex-1 min-w-0">
                <CardTitle className="text-xl md:text-2xl">
                  {typedUser.firstName} {typedUser.lastName}
                </CardTitle>
                <CardDescription className="mt-1 text-sm md:text-base">
                  <span className="block md:inline">{typedUser.email}</span>
                  {typedUser.phoneNumber && (
                    <>
                      <span className="hidden md:inline"> • </span>
                      <span className="block md:inline">{typedUser.phoneNumber}</span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Booking History Card with Tabs */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">{t('profile.bookingHistory')}</CardTitle>
            <CardDescription className="text-sm">
              {bookings && bookings.length > 0
                ? `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`
                : t('profile.noBookings')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
            {bookingsLoading ? (
              <div className="py-8">
                <GolfLoader size="md" text={t('common.loading')} />
              </div>
            ) : bookings && bookings.length > 0 ? (
              <Tabs defaultValue="upcoming" className="w-full">
                {/* Mobile-friendly scrollable tabs */}
                <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                  <TabsList className="inline-flex w-full md:grid md:grid-cols-2 mb-4 min-h-[44px]">
                    <TabsTrigger 
                      value="upcoming" 
                      className="flex-shrink-0 min-h-[44px] px-6 md:px-4 snap-start"
                      data-testid="tab-upcoming"
                    >
                      Upcoming ({upcomingBookings.length})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="past" 
                      className="flex-shrink-0 min-h-[44px] px-6 md:px-4 snap-start"
                      data-testid="tab-past"
                    >
                      Past ({pastBookings.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="upcoming">
                  {upcomingBookings.length > 0 ? (
                    isMobile ? (
                      <div className="space-y-3" data-testid="cards-upcoming-bookings">
                        {upcomingBookings.map((booking, index) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            index={index}
                            isUpcoming={true}
                            canCancel={canCancelBooking(booking)}
                            onCancel={() => handleCancelBooking(booking)}
                            onRebook={() => handleRebook(booking)}
                            rebookPending={rebookMutation.isPending}
                            getStatusVariant={getStatusVariant}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : (
                      <Table data-testid="table-upcoming-bookings">
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('profile.course')}</TableHead>
                            <TableHead>{t('profile.teeTime')}</TableHead>
                            <TableHead>{t('profile.players')}</TableHead>
                            <TableHead>{t('profile.status')}</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upcomingBookings.map((booking, index) => (
                            <TableRow key={booking.id} data-testid={`row-upcoming-booking-${index}`}>
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
                              <TableCell>
                                <div className="flex gap-2">
                                  {canCancelBooking(booking) ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleCancelBooking(booking)}
                                      data-testid={`button-cancel-${index}`}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                  ) : (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>Cannot cancel ({"<"}24h)</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : (
                    <div className="text-center py-8 px-4" data-testid="text-no-upcoming-bookings">
                      <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No upcoming bookings</p>
                      <Button 
                        onClick={() => navigate('/')} 
                        className="w-full md:w-auto min-h-[44px]"
                        data-testid="button-book-now"
                      >
                        {t('profile.bookNow')}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="past">
                  {pastBookings.length > 0 ? (
                    isMobile ? (
                      <div className="space-y-3" data-testid="cards-past-bookings">
                        {pastBookings.map((booking, index) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            index={index}
                            isUpcoming={false}
                            canCancel={false}
                            onCancel={() => {}}
                            onRebook={() => handleRebook(booking)}
                            rebookPending={rebookMutation.isPending}
                            getStatusVariant={getStatusVariant}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : (
                      <Table data-testid="table-past-bookings">
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('profile.course')}</TableHead>
                            <TableHead>{t('profile.teeTime')}</TableHead>
                            <TableHead>{t('profile.players')}</TableHead>
                            <TableHead>{t('profile.status')}</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pastBookings.map((booking, index) => (
                            <TableRow key={booking.id} data-testid={`row-past-booking-${index}`}>
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
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRebook(booking)}
                                  disabled={rebookMutation.isPending}
                                  data-testid={`button-rebook-${index}`}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Book Again
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  ) : (
                    <div className="text-center py-8 px-4" data-testid="text-no-past-bookings">
                      <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No past bookings</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12 px-4" data-testid="text-no-bookings">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">{t('profile.noBookings')}</p>
                <Button 
                  onClick={() => navigate('/')} 
                  className="w-full md:w-auto min-h-[44px]"
                  data-testid="button-book-now"
                >
                  {t('profile.bookNow')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin User Management (only visible to admins) */}
        {typedUser.isAdmin === 'true' && (
          <Card className="mt-4 md:mt-6">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Shield className="h-5 w-5" />
                Admin User Management
              </CardTitle>
              <CardDescription className="text-sm">
                Manage admin privileges for all users
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
              {usersLoading ? (
                <div className="py-8">
                  <GolfLoader size="md" text={t('common.loading')} />
                </div>
              ) : allUsers && allUsers.length > 0 ? (
                isMobile ? (
                  <div className="space-y-3" data-testid="cards-admin-users">
                    {allUsers.map((adminUser) => (
                      <AdminUserCard
                        key={adminUser.id}
                        adminUser={adminUser}
                        currentUserId={typedUser.id}
                        onEdit={() => handleEditUser(adminUser)}
                        onToggleAdmin={() => toggleAdminMutation.mutate({
                          userId: adminUser.id,
                          isAdmin: adminUser.isAdmin !== 'true',
                        })}
                        onDelete={() => handleDeleteUser(adminUser)}
                        togglePending={toggleAdminMutation.isPending}
                        deletePending={deleteUserMutation.isPending}
                      />
                    ))}
                  </div>
                ) : (
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
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditUser(adminUser)}
                                data-testid={`button-edit-${adminUser.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAdminMutation.mutate({
                                  userId: adminUser.id,
                                  isAdmin: adminUser.isAdmin !== 'true',
                                })}
                                disabled={toggleAdminMutation.isPending || adminUser.id === typedUser.id}
                                data-testid={`button-toggle-admin-${adminUser.id}`}
                              >
                                {adminUser.isAdmin === 'true' ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <Shield className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteUser(adminUser)}
                                disabled={deleteUserMutation.isPending || adminUser.id === typedUser.id}
                                data-testid={`button-delete-${adminUser.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                <div className="text-center py-8 px-4">
                  <UserIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-edit-user">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information for {selectedUser?.firstName} {selectedUser?.lastName}
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input className="min-h-[44px]" {...field} data-testid="input-edit-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input className="min-h-[44px]" {...field} data-testid="input-edit-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input className="min-h-[44px]" {...field} type="email" data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (optional)</FormLabel>
                      <FormControl>
                        <Input className="min-h-[44px]" {...field} data-testid="input-edit-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto min-h-[44px]"
                    onClick={() => setEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px]"
                    disabled={updateUserMutation.isPending}
                    data-testid="button-submit-edit"
                  >
                    {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-delete-user">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedUser?.firstName} {selectedUser?.lastName}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => setDeleteDialogOpen(false)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Booking Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) cancelForm.reset();
        }}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-cancel-booking">
            <DialogHeader>
              <DialogTitle>Cancel Booking</DialogTitle>
              <DialogDescription>
                You are about to cancel your booking at {selectedBooking?.courseName} on{' '}
                {selectedBooking && format(new Date(selectedBooking.teeTime), 'PPP p')}.
                Please provide a reason for cancellation.
              </DialogDescription>
            </DialogHeader>
            <Form {...cancelForm}>
              <form onSubmit={cancelForm.handleSubmit(onCancelSubmit)} className="space-y-4">
                <FormField
                  control={cancelForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cancellation Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Please explain why you're cancelling this booking..."
                          className="min-h-[100px]"
                          data-testid="input-cancel-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto min-h-[44px]"
                    onClick={() => {
                      setCancelDialogOpen(false);
                      cancelForm.reset();
                    }}
                    data-testid="button-cancel-dialog"
                  >
                    Keep Booking
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full sm:w-auto min-h-[44px]"
                    disabled={cancelBookingMutation.isPending}
                    data-testid="button-confirm-cancel"
                  >
                    {cancelBookingMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
