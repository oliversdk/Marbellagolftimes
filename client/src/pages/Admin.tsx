import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { CourseCard } from "@/components/CourseCard";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Mail, Send, CheckCircle2, XCircle, Clock, Image, Save, Upload, Trash2, Users, Edit, AlertTriangle, BarChart3, Percent, DollarSign, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { CommissionDashboard } from "@/components/CommissionDashboard";
import { AdCampaigns } from "@/components/AdCampaigns";
import type { GolfCourse, BookingRequest } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const DEFAULT_EMAIL_TEMPLATE = {
  subject: "Green fee partnership proposal – new guests for [COURSE_NAME]",
  body: `Dear [COURSE_NAME] team,

My name is [SENDER_NAME] and I run a new tee-time finder for golfers on the Costa del Sol.

Our guests are mainly international golfers staying between Sotogrande and Málaga, and we would like to send more players to your course.

I would like to propose a simple collaboration:

– We list your course and send you confirmed bookings.
– For each paid green fee generated through our platform, you offer us a 20% commission.
– You keep full control of your prices and availability – we simply refer players and send you the booking details.

If this is interesting for you, please let me know who is the best person to speak with, and we can set up a simple agreement.

Kind regards,
[SENDER_NAME]

———

Estimado equipo de [COURSE_NAME],

Me llamo [SENDER_NAME] y gestiono una nueva plataforma de reservas de green fees en la Costa del Sol.

Nuestros clientes son principalmente golfistas internacionales entre Sotogrande y Málaga y nos gustaría enviar más jugadores a su campo.

Me gustaría proponer una colaboración sencilla:

– Mostramos su campo y les enviamos reservas confirmadas.
– Por cada green fee pagado generado a través de nuestra plataforma, ustedes nos ofrecen una comisión del 20 %.
– Ustedes mantienen el control total sobre sus precios y disponibilidad; nosotros solo les remitimos los jugadores y los datos de la reserva.

Si les interesa, por favor indíquenme la persona de contacto adecuada y podemos formalizar un acuerdo sencillo.

Atentamente,
[SENDER_NAME]`,
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  isAdmin: string;
};

type CourseProvider = {
  id: string;
  name: string;
  city: string;
  providerType: "golfmanager_v1" | "golfmanager_v3" | "teeone" | null;
  providerCode: string | null;
};

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().optional(),
  isAdmin: z.enum(["true", "false"]),
});

const editCourseSchema = z.object({
  kickbackPercent: z.number().min(0, "Must be at least 0").max(100, "Must be at most 100"),
  golfmanagerUser: z.string().optional(),
  golfmanagerPassword: z.string().optional(),
});

export default function Admin() {
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_TEMPLATE.subject);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE.body);
  const [senderName, setSenderName] = useState("");
  const [courseImageUrls, setCourseImageUrls] = useState<Record<string, string>>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [viewingUserBookings, setViewingUserBookings] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [editingCourse, setEditingCourse] = useState<GolfCourse | null>(null);
  const [editCourseImageUrl, setEditCourseImageUrl] = useState("");
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const { t } = useI18n();

  // Fetch courses (public endpoint)
  const { data: courses } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch course providers (admin only)
  const { data: courseProviders } = useQuery<CourseProvider[]>({
    queryKey: ["/api/admin/course-providers"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch bookings - only if authenticated
  const { data: bookings } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests"],
    enabled: isAuthenticated,
  });

  // Fetch users - only if authenticated and admin
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch bookings for a specific user
  const { data: userBookings, isLoading: isLoadingUserBookings, error: userBookingsError } = useQuery<BookingRequest[]>({
    queryKey: ["/api/admin/users", viewingUserBookings?.id, "bookings"],
    enabled: !!viewingUserBookings,
  });

  // Filter users based on search query
  const filteredUsers = users?.filter((user) => {
    if (!userSearchQuery) return true;
    const query = userSearchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.phoneNumber && user.phoneNumber.toLowerCase().includes(query))
    );
  });

  // Edit user form
  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      isAdmin: "false",
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof editUserSchema> }) => {
      return await apiRequest(`/api/admin/users/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User updated",
        description: "User information has been updated successfully",
      });
      setEditingUser(null);
      editForm.reset();
    },
    onError: (error: any) => {
      let description = "Please try again later";
      
      // Check HTTP status code
      if (error?.status === 403 || error?.statusCode === 403) {
        description = "You cannot edit your own account";
      } else if (error?.status === 409 || error?.statusCode === 409) {
        description = "This email is already being used by another user";
      } else if (error?.message) {
        description = error.message;
      }
      
      toast({
        title: "Update failed",
        description,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/users/${id}`, "DELETE", undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User deleted",
        description: "User has been deleted successfully",
      });
      setDeletingUser(null);
    },
    onError: (error: any) => {
      let description = "Please try again later";
      
      // Check HTTP status code
      if (error?.status === 403 || error?.statusCode === 403) {
        description = "You cannot delete your own account";
      } else if (error?.message) {
        description = error.message;
      }
      
      toast({
        title: "Delete failed",
        description,
        variant: "destructive",
      });
    },
  });

  // Handle edit user - populate form
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      isAdmin: user.isAdmin as "true" | "false",
    });
  };

  // Handle save edited user
  const handleSaveUser = (data: z.infer<typeof editUserSchema>) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    }
  };

  // Edit course form (kickback + credentials)
  const courseForm = useForm<z.infer<typeof editCourseSchema>>({
    resolver: zodResolver(editCourseSchema),
    defaultValues: {
      kickbackPercent: 0,
      golfmanagerUser: "",
      golfmanagerPassword: "",
    },
  });

  // Update course (kickback + credentials) mutation
  const updateCourseMutation = useMutation({
    mutationFn: async ({ courseId, kickbackPercent, golfmanagerUser, golfmanagerPassword }: { 
      courseId: string; 
      kickbackPercent: number;
      golfmanagerUser?: string;
      golfmanagerPassword?: string;
    }) => {
      const response = await apiRequest(`/api/admin/courses/${courseId}`, "PATCH", { 
        kickbackPercent,
        golfmanagerUser,
        golfmanagerPassword
      });
      return await response.json() as GolfCourse;
    },
    onSuccess: async (data: GolfCourse) => {
      // Update cache with server response (source of truth)
      queryClient.setQueryData<GolfCourse[]>(["/api/courses"], (old) => {
        if (!old) return old;
        return old.map((course) =>
          course.id === data.id ? data : course
        );
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/commission"] });
      toast({
        title: "Course Updated",
        description: "Course settings have been updated successfully",
      });
      setEditingCourse(null);
      courseForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update course settings",
        variant: "destructive",
      });
    },
  });

  // Handle edit course - populate form
  const handleEditCourse = (course: GolfCourse) => {
    setEditingCourse(course);
    setEditCourseImageUrl(course.imageUrl || "");
    courseForm.reset({
      kickbackPercent: course.kickbackPercent || 0,
      golfmanagerUser: course.golfmanagerUser || "",
      golfmanagerPassword: course.golfmanagerPassword || "",
    });
  };

  // Handle save course (kickback + credentials)
  const handleSaveCourse = (data: z.infer<typeof editCourseSchema>) => {
    if (editingCourse) {
      updateCourseMutation.mutate({ 
        courseId: editingCourse.id, 
        ...data
      });
    }
  };
  
  // Handle delete image for editing course
  const handleDeleteCourseImage = () => {
    if (!editingCourse?.imageUrl) return;
    const parts = editingCourse.imageUrl.split("/");
    const filename = parts.pop();
    const directory = parts[parts.length - 1];
    if (filename && window.confirm(`Delete ${filename}? This cannot be undone.`)) {
      deleteImageMutation.mutate({ filename, courseId: editingCourse.id, directory });
    }
  };

  // Send affiliate emails mutation
  const sendEmailsMutation = useMutation({
    mutationFn: async (data: { courseIds: string[]; subject: string; body: string; senderName: string }) => {
      return await apiRequest("/api/affiliate-emails/send", "POST", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate-emails"] });
      toast({
        title: t('admin.emailsSentTitle'),
        description: t('admin.emailsSentDescription', { count: data.sent || selectedCourseIds.length }),
      });
      setSelectedCourseIds([]);
    },
    onError: () => {
      toast({
        title: t('admin.emailSendFailedTitle'),
        description: t('admin.emailSendFailedDescription'),
        variant: "destructive",
      });
    },
  });

  // Update course image mutation
  const updateCourseImageMutation = useMutation({
    mutationFn: async ({ courseId, imageUrl }: { courseId: string; imageUrl: string }) => {
      return await apiRequest(`/api/courses/${courseId}/image`, "PATCH", { imageUrl });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      const courseName = courses?.find(c => c.id === variables.courseId)?.name || "course";
      toast({
        title: t('admin.imageUpdatedTitle'),
        description: t('admin.imageUpdatedDescription', { courseName }),
      });
      // Update local state in dialog using state setter callback to avoid stale closure
      setEditingCourse((current) => {
        if (current?.id === variables.courseId) {
          // Also update URL input when updating course
          setEditCourseImageUrl(variables.imageUrl);
          return { ...current, imageUrl: variables.imageUrl };
        }
        return current;
      });
      // Clear the input for this course
      setCourseImageUrls((prev) => {
        const updated = { ...prev };
        delete updated[variables.courseId];
        return updated;
      });
    },
    onError: (error: any) => {
      toast({
        title: t('admin.updateFailedTitle'),
        description: error.message || t('admin.updateFailedDescription'),
        variant: "destructive",
      });
    },
  });

  // Upload course image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ courseId, file }: { courseId: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/upload/course-image", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: async (data: { imageUrl: string }, variables) => {
      // Update the course with the new image URL
      await updateCourseImageMutation.mutateAsync({
        courseId: variables.courseId,
        imageUrl: data.imageUrl,
      });
    },
    onError: (error: any) => {
      toast({
        title: t('admin.uploadFailedTitle'),
        description: error.message || t('admin.uploadFailedDescription'),
        variant: "destructive",
      });
    },
  });

  // Delete course image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async ({ filename, courseId, directory }: { filename: string; courseId: string; directory: string }) => {
      const encodedFilename = encodeURIComponent(filename);
      return await apiRequest(`/api/images/${encodedFilename}?courseId=${encodeURIComponent(courseId)}&directory=${encodeURIComponent(directory)}`, "DELETE", undefined);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({
        title: t('admin.imageDeletedTitle'),
        description: t('admin.imageDeletedDescription'),
      });
      // Update local state in dialog using state setter callback to avoid stale closure
      setEditingCourse((current) => {
        if (current?.id === variables.courseId) {
          // Also clear URL input when deleting image
          setEditCourseImageUrl("");
          return { ...current, imageUrl: null };
        }
        return current;
      });
    },
    onError: (error: any) => {
      toast({
        title: t('admin.deleteFailedTitle'),
        description: error.message || t('admin.deleteFailedDescription'),
        variant: "destructive",
      });
    },
  });

  // Page-level auth protection - Code from blueprint:javascript_log_in_with_replit
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: t('admin.unauthorizedTitle'),
        description: t('admin.unauthorizedDescription'),
        variant: "destructive",
      });
      setTimeout(() => {
        // Preserve return path for post-login redirect
        const returnTo = encodeURIComponent(window.location.pathname);
        window.location.href = `/api/login?returnTo=${returnTo}`;
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast, t]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render admin content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleToggleAll = () => {
    if (selectedCourseIds.length === courses?.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(courses?.map((c) => c.id) || []);
    }
  };

  const handleSendEmails = () => {
    if (selectedCourseIds.length === 0) {
      toast({
        title: t('admin.noCourseSelectedTitle'),
        description: t('admin.noCourseSelectedDescription'),
        variant: "destructive",
      });
      return;
    }

    if (!senderName.trim()) {
      toast({
        title: t('admin.senderNameRequiredTitle'),
        description: t('admin.senderNameRequiredDescription'),
        variant: "destructive",
      });
      return;
    }

    sendEmailsMutation.mutate({
      courseIds: selectedCourseIds,
      subject: emailSubject,
      body: emailBody,
      senderName,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t('admin.statusPending')}</Badge>;
      case "CONFIRMED":
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />{t('admin.statusConfirmed')}</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t('admin.statusCancelled')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-bold mb-2">{t('admin.dashboardTitle')}</h1>
          <p className="text-muted-foreground">
            {t('admin.dashboardDescription')}
          </p>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="commission" data-testid="tab-commission">
              <DollarSign className="h-4 w-4 mr-2" />
              Commission
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">{t('admin.tabBookingRequests')}</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="h-4 w-4 mr-2" />
                User Management
              </TabsTrigger>
            )}
            <TabsTrigger value="courses" data-testid="tab-courses">
              <Percent className="h-4 w-4 mr-2" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">{t('admin.tabAffiliateEmails')}</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="commission">
            <div className="space-y-6">
              <CommissionDashboard />
              <AdCampaigns />
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.recentBookingRequests')}</CardTitle>
                <CardDescription>
                  {t('admin.bookingRequestsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bookings && bookings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.tableHeaderCustomer')}</TableHead>
                        <TableHead>{t('admin.tableHeaderCourse')}</TableHead>
                        <TableHead>{t('admin.tableHeaderTeeTime')}</TableHead>
                        <TableHead>{t('admin.tableHeaderPlayers')}</TableHead>
                        <TableHead>{t('admin.tableHeaderStatus')}</TableHead>
                        <TableHead>{t('admin.tableHeaderContact')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
                          <TableCell className="font-medium">{booking.customerName}</TableCell>
                          <TableCell>{booking.courseId}</TableCell>
                          <TableCell>
                            {format(new Date(booking.teeTime), "PPp")}
                          </TableCell>
                          <TableCell>{booking.players}</TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {booking.customerEmail}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('admin.noBookings')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  View, edit, and manage user accounts and booking history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search users by name, email, or phone..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    data-testid="input-search-users"
                    className="max-w-md"
                  />
                  {userSearchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserSearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {filteredUsers && filteredUsers.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Showing {filteredUsers.length} of {users?.length || 0} users
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell className="font-medium">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.phoneNumber || "—"}</TableCell>
                            <TableCell>
                              {user.isAdmin === "true" ? (
                                <Badge variant="default">Admin</Badge>
                              ) : (
                                <Badge variant="secondary">User</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingUserBookings(user)}
                                  data-testid={`button-view-bookings-${user.id}`}
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  View Bookings
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingUser(user)}
                                  data-testid={`button-delete-user-${user.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : userSearchQuery ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No users found matching "{userSearchQuery}"
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No users found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Course Management
                </CardTitle>
                <CardDescription>
                  Manage course images, commission percentages, and details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selection toolbar */}
                <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const gmCourseIds = courseProviders
                        ?.filter(p => p.providerType === "golfmanager_v1" || p.providerType === "golfmanager_v3")
                        .map(p => p.id) || [];
                      setSelectedCourseIds(gmCourseIds);
                    }}
                    data-testid="button-select-golfmanager"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select All Golfmanager ({courseProviders?.filter(p => p.providerType === "golfmanager_v1" || p.providerType === "golfmanager_v3").length || 0})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const teeOneCourseIds = courseProviders
                        ?.filter(p => p.providerType === "teeone")
                        .map(p => p.id) || [];
                      setSelectedCourseIds(teeOneCourseIds);
                    }}
                    data-testid="button-select-teeone"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select All TeeOne ({courseProviders?.filter(p => p.providerType === "teeone").length || 0})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCourseIds([])}
                    disabled={selectedCourseIds.length === 0}
                    data-testid="button-deselect-all"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Clear Selection
                  </Button>
                  {selectedCourseIds.length > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Badge variant="secondary" data-testid="badge-selected-count">
                        {selectedCourseIds.length} selected
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => {
                          const selectedCourses = courses?.filter(c => selectedCourseIds.includes(c.id)) || [];
                          const courseNames = selectedCourses.map(c => c.name).join(", ");
                          toast({
                            title: "Email Feature",
                            description: `Ready to email ${selectedCourseIds.length} courses: ${courseNames.substring(0, 100)}${courseNames.length > 100 ? "..." : ""}`,
                          });
                        }}
                        data-testid="button-email-selected"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Email Selected Courses
                      </Button>
                    </div>
                  )}
                </div>

                {courses && courses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={courses.length > 0 && selectedCourseIds.length === courses.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCourseIds(courses.map(c => c.id));
                              } else {
                                setSelectedCourseIds([]);
                              }
                            }}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Image</TableHead>
                        <TableHead>Course Name</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right" data-testid="table-column-kickback">Kickback %</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => {
                        const provider = courseProviders?.find(p => p.id === course.id);
                        const isSelected = selectedCourseIds.includes(course.id);
                        return (
                          <TableRow key={course.id} data-testid={`row-course-${course.id}`} className={isSelected ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCourseIds([...selectedCourseIds, course.id]);
                                  } else {
                                    setSelectedCourseIds(selectedCourseIds.filter(id => id !== course.id));
                                  }
                                }}
                                data-testid={`checkbox-course-${course.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted">
                                <OptimizedImage
                                  src={course.imageUrl || undefined}
                                  alt={course.name}
                                  className="w-full h-full object-cover"
                                  data-testid={`img-course-thumb-${course.id}`}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{course.name}</TableCell>
                            <TableCell>
                              {provider?.providerType === "golfmanager_v1" && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400" data-testid={`badge-provider-${course.id}`}>
                                  GM V1
                                </Badge>
                              )}
                              {provider?.providerType === "golfmanager_v3" && (
                                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-400" data-testid={`badge-provider-${course.id}`}>
                                  GM V3
                                </Badge>
                              )}
                              {provider?.providerType === "teeone" && (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400" data-testid={`badge-provider-${course.id}`}>
                                  TeeOne
                                </Badge>
                              )}
                              {!provider?.providerType && (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>{course.city}, {course.province}</TableCell>
                            <TableCell className="text-right">
                              {course.kickbackPercent !== null && course.kickbackPercent !== undefined 
                                ? `${course.kickbackPercent}%` 
                                : "0%"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCourse(course)}
                                data-testid={`button-edit-course-${course.id}`}
                                aria-label="Edit course"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit Course
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No courses found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="emails">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Affiliate Partnership Emails
                  </CardTitle>
                  <CardDescription>
                    Send partnership proposals to golf courses requesting 20% commission
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="sender-name">Your Name</Label>
                    <Input
                      id="sender-name"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Enter your name for [SENDER_NAME] placeholder"
                      data-testid="input-sender-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject line"
                      data-testid="input-email-subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email Body</Label>
                    <Textarea
                      id="email-body"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Email template with [COURSE_NAME] and [SENDER_NAME] placeholders"
                      className="min-h-[300px] font-mono text-sm"
                      data-testid="textarea-email-body"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use [COURSE_NAME] and [SENDER_NAME] as placeholders
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Select Golf Courses</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleAll}
                        data-testid="button-toggle-all-courses"
                      >
                        {t('admin.selectAll', { count: selectedCourseIds.length === courses?.length ? courses?.length || 0 : courses?.length || 0 })}
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      {courses?.map((course) => (
                        <div
                          key={course.id}
                          className="flex items-center space-x-3 p-3 border-b last:border-b-0 hover-elevate"
                          data-testid={`checkbox-course-${course.id}`}
                        >
                          <Checkbox
                            id={`course-${course.id}`}
                            checked={selectedCourseIds.includes(course.id)}
                            onCheckedChange={() => handleToggleCourse(course.id)}
                          />
                          <label
                            htmlFor={`course-${course.id}`}
                            className="flex-1 text-sm cursor-pointer"
                          >
                            <div className="font-medium">{course.name}</div>
                            <div className="text-muted-foreground text-xs">
                              {course.email || "No email"}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {selectedCourseIds.length} course{selectedCourseIds.length !== 1 && "s"} selected
                      </p>
                      <Button
                        onClick={handleSendEmails}
                        disabled={selectedCourseIds.length === 0 || sendEmailsMutation.isPending}
                        data-testid="button-send-emails"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sendEmailsMutation.isPending ? "Sending..." : "Send Partnership Emails"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent data-testid="dialog-edit-user">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information. You cannot edit your own account.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleSaveUser)} className="space-y-4">
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
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Access Level</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          {field.value === "true" ? "Administrator" : "Regular User"}
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === "true"}
                          onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                          data-testid="switch-edit-admin"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingUser(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    data-testid="button-save-user"
                  >
                    {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <DialogContent data-testid="dialog-delete-user">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deletingUser && (
              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="font-medium">
                  {deletingUser.firstName} {deletingUser.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{deletingUser.email}</p>
                <div>
                  {deletingUser.isAdmin === "true" ? (
                    <Badge variant="default">Admin</Badge>
                  ) : (
                    <Badge variant="secondary">User</Badge>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingUser(null)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Course Dialog */}
        <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
          <DialogContent className="max-w-2xl" data-testid="dialog-edit-course">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Course
              </DialogTitle>
              <DialogDescription>
                Update course image and commission percentage
              </DialogDescription>
            </DialogHeader>
            {editingCourse && (
              <div className="space-y-6">
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium">{editingCourse.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {editingCourse.city}, {editingCourse.province}
                  </p>
                </div>

                {/* Course Image Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Course Image</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Current Image</Label>
                      {editingCourse.imageUrl ? (
                        <div className="space-y-2">
                          <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted">
                            <OptimizedImage
                              src={editingCourse.imageUrl}
                              alt={editingCourse.name}
                              className="w-full h-full object-cover"
                              data-testid="img-edit-course-current"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={handleDeleteCourseImage}
                            data-testid="button-delete-course-image"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete Image
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">No image</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-image-url" className="text-xs text-muted-foreground">
                        New Image URL or Upload
                      </Label>
                      <Input
                        id="edit-image-url"
                        value={editCourseImageUrl}
                        onChange={(e) => setEditCourseImageUrl(e.target.value)}
                        placeholder="/stock_images/course.jpg"
                        className="font-mono text-sm"
                        data-testid="input-edit-image-url"
                      />
                      <p className="text-xs text-muted-foreground">
                        Path must start with /stock_images/ or /generated_images/
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/jpeg,image/jpg,image/png,image/webp";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                uploadImageMutation.mutate({ courseId: editingCourse.id, file });
                              }
                            };
                            input.click();
                          }}
                          disabled={uploadImageMutation.isPending}
                          className="flex-1"
                          data-testid="button-upload-course-image"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadImageMutation.isPending ? "Uploading..." : "Upload"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!editCourseImageUrl || !editCourseImageUrl.trim()) {
                              toast({
                                title: "Invalid Input",
                                description: "Please enter an image URL",
                                variant: "destructive",
                              });
                              return;
                            }
                            const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
                            const hasValidExtension = validExtensions.some(ext => 
                              editCourseImageUrl.toLowerCase().endsWith(ext)
                            );
                            const startsWithValidDirectory = editCourseImageUrl.startsWith("/stock_images/") || editCourseImageUrl.startsWith("/generated_images/");
                            if (!startsWithValidDirectory || !hasValidExtension) {
                              toast({
                                title: "Invalid Format",
                                description: "URL must start with /stock_images/ or /generated_images/ and end with .jpg, .jpeg, .png, or .webp",
                                variant: "destructive",
                              });
                              return;
                            }
                            updateCourseImageMutation.mutate({
                              courseId: editingCourse.id,
                              imageUrl: editCourseImageUrl,
                            });
                          }}
                          disabled={
                            !editCourseImageUrl || 
                            updateCourseImageMutation.isPending
                          }
                          className="flex-1"
                          data-testid="button-save-course-image"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updateCourseImageMutation.isPending ? "Saving..." : "Set URL"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Course Settings Form */}
                <div className="border-t pt-4">
                  <Form {...courseForm}>
                    <form onSubmit={courseForm.handleSubmit(handleSaveCourse)} className="space-y-4">
                      {/* Commission Percentage */}
                      <FormField
                        control={courseForm.control}
                        name="kickbackPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commission Percentage</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  data-testid="input-kickback-percent"
                                  className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </FormControl>
                            <p className="text-sm text-muted-foreground">
                              Enter the commission percentage you earn from bookings at this course (0-100%)
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Golfmanager API Credentials */}
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <FormLabel className="text-base font-semibold">Golfmanager API Credentials</FormLabel>
                          <span className="text-xs text-muted-foreground">(Optional)</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Add course-specific Golfmanager credentials to enable real-time tee time availability
                        </p>

                        <FormField
                          control={courseForm.control}
                          name="golfmanagerUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Username</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="text"
                                  placeholder="Enter Golfmanager API username"
                                  data-testid="input-golfmanager-user"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={courseForm.control}
                          name="golfmanagerPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Enter Golfmanager API password"
                                  data-testid="input-golfmanager-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingCourse(null)}
                          data-testid="button-cancel-edit-course"
                        >
                          Close
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateCourseMutation.isPending}
                          data-testid="button-save-course"
                        >
                          {updateCourseMutation.isPending ? "Saving..." : "Save Course Settings"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View User Bookings Dialog */}
        <Dialog open={!!viewingUserBookings} onOpenChange={(open) => !open && setViewingUserBookings(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-user-bookings">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Booking History
              </DialogTitle>
              {viewingUserBookings && (
                <DialogDescription>
                  Showing all bookings for {viewingUserBookings.firstName} {viewingUserBookings.lastName} ({viewingUserBookings.email})
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingUserBookings ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading bookings...
                </div>
              ) : userBookingsError ? (
                <div className="text-center py-12 text-destructive">
                  Failed to load bookings. Please try again.
                </div>
              ) : userBookings && userBookings.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Total bookings: {userBookings.length}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Tee Time</TableHead>
                        <TableHead>Players</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userBookings.map((booking) => {
                        const course = courses?.find(c => c.id === booking.courseId);
                        return (
                          <TableRow key={booking.id} data-testid={`row-user-booking-${booking.id}`}>
                            <TableCell className="font-medium">
                              {course?.name || booking.courseId}
                            </TableCell>
                            <TableCell>
                              {format(new Date(booking.teeTime), "PPp")}
                            </TableCell>
                            <TableCell>{booking.players}</TableCell>
                            <TableCell>{getStatusBadge(booking.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(booking.createdAt), "PP")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No bookings found for this user
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingUserBookings(null)}
                data-testid="button-close-bookings"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
