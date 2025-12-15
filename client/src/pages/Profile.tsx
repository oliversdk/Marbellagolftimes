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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar, X, RotateCcw, AlertTriangle, Pencil, Flag, Trophy, MapPin, Clock, User as UserIcon } from "lucide-react";
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

const cancelBookingSchema = z.object({
  reason: z.string().min(3, "Please provide a reason (minimum 3 characters)"),
});

type CancelBookingFormData = z.infer<typeof cancelBookingSchema>;

const editProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  country: z.string().optional(),
  handicap: z.string().optional(),
  homeClub: z.string().optional(),
  preferredTeeTime: z.string().optional(),
  gender: z.string().optional(),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

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

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const { isMobile } = useBreakpoint();
  const typedUser = user as User | undefined;

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithCourse | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const cancelForm = useForm<CancelBookingFormData>({
    resolver: zodResolver(cancelBookingSchema),
    defaultValues: {
      reason: "",
    },
  });

  const editProfileForm = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      country: "",
      handicap: "",
      homeClub: "",
      preferredTeeTime: "",
      gender: "",
    },
  });

  // Populate edit form when user data is available
  useEffect(() => {
    if (typedUser && editProfileOpen) {
      editProfileForm.reset({
        firstName: typedUser.firstName || "",
        lastName: typedUser.lastName || "",
        phoneNumber: typedUser.phoneNumber || "",
        country: typedUser.country || "",
        handicap: typedUser.handicap?.toString() || "",
        homeClub: typedUser.homeClub || "",
        preferredTeeTime: typedUser.preferredTeeTime || "",
        gender: typedUser.gender || "",
      });
    }
  }, [typedUser, editProfileOpen, editProfileForm]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithCourse[]>({
    queryKey: ['/api/bookings'],
    enabled: isAuthenticated,
  });

  const { toast } = useToast();

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      return await apiRequest(`/api/booking-requests/${bookingId}/cancel`, 'PATCH', { cancellationReason: reason });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      cancelForm.reset();
      
      const providerSuccess = data?.providerCancellation?.success;
      toast({
        title: t('common.success'),
        description: providerSuccess 
          ? 'Booking cancelled successfully with the course' 
          : 'Booking cancelled locally',
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

  const updateProfileMutation = useMutation({
    mutationFn: async (data: EditProfileFormData) => {
      return await apiRequest('/api/profile', 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setEditProfileOpen(false);
      toast({
        title: t('common.success'),
        description: 'Profile updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || 'Failed to update profile',
      });
    },
  });

  const onEditProfileSubmit = (data: EditProfileFormData) => {
    updateProfileMutation.mutate(data);
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
        title={`${t('profile.title')} - Marbella Golf Times`}
        description="View your booking history and manage your golf tee time reservations"
      />
      <div className="container mx-auto p-4 md:p-6 max-w-6xl" data-testid="page-profile">
        {/* User Info Card - Mobile Responsive */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <Avatar className="h-16 w-16 md:h-20 md:w-20 mx-auto md:mx-0 flex-shrink-0">
                <AvatarFallback className="text-lg md:text-xl bg-primary text-primary-foreground">
                  {getInitials(typedUser.firstName, typedUser.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left flex-1 min-w-0">
                <div className="flex items-center justify-center md:justify-between gap-2 flex-wrap">
                  <CardTitle className="text-xl md:text-2xl">
                    {typedUser.firstName} {typedUser.lastName}
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditProfileOpen(true)}
                    data-testid="button-edit-profile"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
                <CardDescription className="mt-1 text-sm md:text-base">
                  <span className="block md:inline">{typedUser.email}</span>
                  {typedUser.phoneNumber && (
                    <>
                      <span className="hidden md:inline"> • </span>
                      <span className="block md:inline">{typedUser.phoneNumber}</span>
                    </>
                  )}
                </CardDescription>
                
                {/* Golf Profile Info */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {typedUser.handicap !== null && typedUser.handicap !== undefined && (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-handicap">
                      <Trophy className="h-4 w-4 flex-shrink-0" />
                      <span>HCP: {typedUser.handicap}</span>
                    </div>
                  )}
                  {typedUser.homeClub && (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-home-club">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{typedUser.homeClub}</span>
                    </div>
                  )}
                  {typedUser.country && (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-country">
                      <Flag className="h-4 w-4 flex-shrink-0" />
                      <span>{typedUser.country}</span>
                    </div>
                  )}
                  {typedUser.preferredTeeTime && (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-preferred-time">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span className="capitalize">{typedUser.preferredTeeTime}</span>
                    </div>
                  )}
                </div>
                
                {/* Prompt to complete profile if empty */}
                {!typedUser.handicap && !typedUser.homeClub && !typedUser.country && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Complete your golf profile to get personalized recommendations!
                  </p>
                )}
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

        {/* Cancel Booking Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) cancelForm.reset();
        }}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-cancel-booking">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Cancel Booking
              </DialogTitle>
              <DialogDescription className="space-y-3">
                <span className="block">
                  You are about to cancel your booking at <strong>{selectedBooking?.courseName}</strong> on{' '}
                  {selectedBooking && format(new Date(selectedBooking.teeTime), 'PPP p')}.
                </span>
                
                {selectedBooking && (
                  <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                    <div className="font-medium text-foreground">Cancellation Policy</div>
                    <div className="text-muted-foreground">
                      Free cancellation up to 24 hours before tee time.
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium text-foreground">
                        {Math.floor(differenceInHours(new Date(selectedBooking.teeTime), new Date()))} hours remaining
                      </span>
                    </div>
                  </div>
                )}
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

        {/* Edit Profile Dialog */}
        <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-profile">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your personal information and golf profile.
              </DialogDescription>
            </DialogHeader>
            <Form {...editProfileForm}>
              <form onSubmit={editProfileForm.handleSubmit(onEditProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={editProfileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editProfileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editProfileForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+45 12345678" data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editProfileForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Select your country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Denmark">Denmark</SelectItem>
                          <SelectItem value="Sweden">Sweden</SelectItem>
                          <SelectItem value="Norway">Norway</SelectItem>
                          <SelectItem value="Finland">Finland</SelectItem>
                          <SelectItem value="Germany">Germany</SelectItem>
                          <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                          <SelectItem value="Netherlands">Netherlands</SelectItem>
                          <SelectItem value="Belgium">Belgium</SelectItem>
                          <SelectItem value="France">France</SelectItem>
                          <SelectItem value="Spain">Spain</SelectItem>
                          <SelectItem value="Portugal">Portugal</SelectItem>
                          <SelectItem value="Ireland">Ireland</SelectItem>
                          <SelectItem value="USA">USA</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={editProfileForm.control}
                    name="handicap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Golf Handicap</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.1" 
                            min="-10" 
                            max="54" 
                            placeholder="e.g., 18.5" 
                            data-testid="input-handicap" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editProfileForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editProfileForm.control}
                  name="homeClub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Golf Club</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Royal Copenhagen Golf Club" data-testid="input-home-club" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editProfileForm.control}
                  name="preferredTeeTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Tee Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-preferred-time">
                            <SelectValue placeholder="Select preferred time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Morning (before 10:00)</SelectItem>
                          <SelectItem value="midday">Midday (10:00 - 14:00)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (14:00 - 17:00)</SelectItem>
                          <SelectItem value="twilight">Twilight (after 17:00)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto min-h-[44px]"
                    onClick={() => setEditProfileOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px]"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
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
