import { useEffect, useState } from "react";
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
import { Calendar, Shield, ShieldOff, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
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

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const typedUser = user as User | undefined;

  // State for dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form for editing user
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
    },
  });

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

  // Handler for opening edit dialog
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

  // Handler for opening delete confirmation dialog
  const handleDeleteUser = (adminUser: User) => {
    setSelectedUser(adminUser);
    setDeleteDialogOpen(true);
  };

  // Handler for submitting edit form
  const onEditSubmit = (data: EditUserFormData) => {
    if (selectedUser) {
      updateUserMutation.mutate({ ...data, userId: selectedUser.id });
    }
  };

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
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent data-testid="dialog-edit-user">
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
                        <Input {...field} data-testid="input-edit-first-name" />
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
                        <Input {...field} data-testid="input-edit-last-name" />
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
                        <Input {...field} type="email" data-testid="input-edit-email" />
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
                        <Input {...field} data-testid="input-edit-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
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
          <DialogContent data-testid="dialog-delete-user">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedUser?.firstName} {selectedUser?.lastName}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
