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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, CheckCircle2, XCircle, Clock, Image, Save, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GolfCourse, BookingRequest } from "@shared/schema";
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

export default function Admin() {
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_TEMPLATE.subject);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE.body);
  const [senderName, setSenderName] = useState("");
  const [courseImageUrls, setCourseImageUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  // Fetch courses (public endpoint)
  const { data: courses } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
  });

  // Fetch bookings - only if authenticated
  const { data: bookings } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests"],
    enabled: isAuthenticated,
  });

  // Send affiliate emails mutation
  const sendEmailsMutation = useMutation({
    mutationFn: async (data: { courseIds: string[]; subject: string; body: string; senderName: string }) => {
      return await apiRequest("POST", "/api/affiliate-emails/send", data);
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
      return await apiRequest("PATCH", `/api/courses/${courseId}/image`, { imageUrl });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      const courseName = courses?.find(c => c.id === variables.courseId)?.name || "course";
      toast({
        title: t('admin.imageUpdatedTitle'),
        description: t('admin.imageUpdatedDescription', { courseName }),
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
      return await apiRequest("DELETE", `/api/images/${encodedFilename}?courseId=${encodeURIComponent(courseId)}&directory=${encodeURIComponent(directory)}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({
        title: t('admin.imageDeletedTitle'),
        description: t('admin.imageDeletedDescription'),
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

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="bookings" data-testid="tab-bookings">{t('admin.tabBookingRequests')}</TabsTrigger>
            <TabsTrigger value="courses" data-testid="tab-courses">{t('admin.tabGolfCourses')}</TabsTrigger>
            <TabsTrigger value="featured" data-testid="tab-featured">{t('admin.tabFeaturedCourses')}</TabsTrigger>
            <TabsTrigger value="all-courses" data-testid="tab-all-courses">{t('admin.tabAllCourses')}</TabsTrigger>
            <TabsTrigger value="course-images" data-testid="tab-course-images">{t('admin.tabCourseImages')}</TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">{t('admin.tabAffiliateEmails')}</TabsTrigger>
          </TabsList>

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

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.courseDirectory')}</CardTitle>
                <CardDescription>
                  {t('admin.coursesFromRegion', { count: courses?.length || 0 })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses && courses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('admin.tableHeaderName')}</TableHead>
                        <TableHead>{t('admin.tableHeaderCity')}</TableHead>
                        <TableHead>{t('admin.tableHeaderProvince')}</TableHead>
                        <TableHead>{t('admin.tableHeaderEmail')}</TableHead>
                        <TableHead>{t('admin.tableHeaderPhone')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => (
                        <TableRow key={course.id} data-testid={`row-course-${course.id}`}>
                          <TableCell className="font-medium">{course.name}</TableCell>
                          <TableCell>{course.city}</TableCell>
                          <TableCell>{course.province}</TableCell>
                          <TableCell className="text-sm">{course.email}</TableCell>
                          <TableCell className="text-sm">{course.phone}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('admin.noCourses')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="featured">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.featuredTitle')}</CardTitle>
                <CardDescription>
                  {t('admin.featuredDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses && courses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {courses.slice(0, 3).map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('admin.noCourses')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all-courses">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.allCoursesTitle')}</CardTitle>
                <CardDescription>
                  {t('admin.allCoursesDescription', { count: courses?.length || 0 })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses && courses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('admin.noCourses')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="course-images">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  {t('admin.courseImageManager')}
                </CardTitle>
                <CardDescription>
                  {t('admin.updateImagesDescription', { count: courses?.length || 0 })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courses && courses.length > 0 ? (
                  <div className="space-y-4">
                    {courses.map((course) => (
                      <div 
                        key={course.id} 
                        className="border rounded-md p-4 hover-elevate"
                        data-testid={`card-course-image-${course.id}`}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <div className="font-medium">{course.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {course.city}, {course.province}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t('admin.currentImage')}</Label>
                            {course.imageUrl ? (
                              <div className="space-y-2">
                                <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted">
                                  <OptimizedImage
                                    src={course.imageUrl}
                                    alt={course.name}
                                    className="w-full h-full object-cover"
                                    data-testid={`img-course-${course.id}`}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => {
                                    if (!course.imageUrl) return;
                                    const parts = course.imageUrl.split("/");
                                    const filename = parts.pop();
                                    const directory = parts[parts.length - 1];
                                    if (filename && window.confirm(`Delete ${filename}? This cannot be undone.`)) {
                                      deleteImageMutation.mutate({ filename, courseId: course.id, directory });
                                    }
                                  }}
                                  data-testid={`button-delete-image-${course.id}`}
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  {t('admin.deleteImage')}
                                </Button>
                                <div className="text-xs text-muted-foreground break-all">
                                  {course.imageUrl}
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">{t('admin.noImage')}</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`image-url-${course.id}`} className="text-xs text-muted-foreground">
                              {t('admin.newImageUrlOrUpload')}
                            </Label>
                            <Input
                              id={`image-url-${course.id}`}
                              value={courseImageUrls[course.id] || ""}
                              onChange={(e) => 
                                setCourseImageUrls((prev) => ({
                                  ...prev,
                                  [course.id]: e.target.value,
                                }))
                              }
                              placeholder={t('admin.pathPlaceholder')}
                              className="font-mono text-sm"
                              data-testid={`input-image-url-${course.id}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t('admin.pathHint')}
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
                                      uploadImageMutation.mutate({ courseId: course.id, file });
                                    }
                                  };
                                  input.click();
                                }}
                                disabled={uploadImageMutation.isPending}
                                className="flex-1"
                                data-testid={`button-upload-image-${course.id}`}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                {uploadImageMutation.isPending ? t('admin.uploading') : t('admin.upload')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const newImageUrl = courseImageUrls[course.id];
                                  if (!newImageUrl || !newImageUrl.trim()) {
                                    toast({
                                      title: "Invalid Input",
                                      description: "Please enter an image URL",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
                                  const hasValidExtension = validExtensions.some(ext => 
                                    newImageUrl.toLowerCase().endsWith(ext)
                                  );
                                  const startsWithValidDirectory = newImageUrl.startsWith("/stock_images/") || newImageUrl.startsWith("/generated_images/");
                                  if (!startsWithValidDirectory || !hasValidExtension) {
                                    toast({
                                      title: "Invalid Format",
                                      description: "URL must start with /stock_images/ or /generated_images/ and end with .jpg, .jpeg, .png, or .webp",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  updateCourseImageMutation.mutate({
                                    courseId: course.id,
                                    imageUrl: newImageUrl,
                                  });
                                }}
                                disabled={
                                  !courseImageUrls[course.id] || 
                                  updateCourseImageMutation.isPending
                                }
                                className="flex-1"
                                data-testid={`button-save-image-${course.id}`}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                {updateCourseImageMutation.isPending ? t('common.saving') : t('admin.setImageUrl')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {t('admin.noCourses')}
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
      </div>
    </div>
  );
}
