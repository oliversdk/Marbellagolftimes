import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useBreakpoint } from "@/hooks/use-breakpoint";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableCard, type TableCardColumn } from "@/components/ui/table-card";
import { MobileCardGrid } from "@/components/ui/mobile-card-grid";
import { Mail, Send, CheckCircle2, XCircle, Clock, Image, Save, Upload, Trash2, Users, Edit, AlertTriangle, BarChart3, Percent, DollarSign, CheckSquare, ArrowRight, Phone, User, Handshake, Key, CircleDot, ChevronDown, ExternalLink, Search, ArrowUpDown, Download, FileSpreadsheet, MessageSquare, Plus, History, FileText, PhoneCall, UserPlus, ChevronUp, Images, ArrowUpRight, ArrowDownLeft, Lock, Inbox, Reply, Archive, Settings, Bell, BellOff, ArrowLeft, CalendarIcon, MoreHorizontal, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { GolfLoader } from "@/components/GolfLoader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPersonalFeedback } from "@/lib/personalFeedback";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { CommissionDashboard } from "@/components/CommissionDashboard";
import { AdCampaigns } from "@/components/AdCampaigns";
import type { GolfCourse, BookingRequest, CourseContactLog, InsertCourseContactLog, CourseImage } from "@shared/schema";
import { CONTACT_LOG_TYPES } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";
import * as XLSX from "xlsx";

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
  golfmanagerUser: string | null;
  golfmanagerPassword: string | null;
};

type OnboardingStage = "NOT_CONTACTED" | "OUTREACH_SENT" | "INTERESTED" | "NOT_INTERESTED" | "PARTNERSHIP_ACCEPTED" | "CREDENTIALS_RECEIVED";

type UnmatchedEmail = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string | null;
  assignedToCourseId: string | null;
  assignedByUserId: string | null;
  assignedAt: string | null;
  receivedAt: string;
};

type InboundEmailThread = {
  id: string;
  courseId: string | null;
  courseName?: string | null;
  fromEmail: string;
  subject: string;
  status: "OPEN" | "REPLIED" | "CLOSED" | "ARCHIVED";
  isRead: string;
  requiresResponse: string;
  isMuted: string;
  lastActivityAt: string;
  respondedAt: string | null;
  respondedByUserId: string | null;
  lastAlertSentAt: string | null;
  createdAt: string;
};

type InboundEmail = {
  id: string;
  threadId: string;
  direction: "IN" | "OUT";
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  sentByUserId: string | null;
};

type ThreadWithMessages = InboundEmailThread & {
  messages: InboundEmail[];
};

type AlertSettings = {
  emailAlerts: string;
  alertThresholdHours: number;
  alertEmail: string | null;
};

type AlertSettingsUpdate = {
  emailAlerts?: boolean;
  alertThresholdHours?: number;
  alertEmail?: string | null;
};

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdById: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: string;
  createdAt: string;
};

type CreateApiKeyResponse = ApiKey & {
  rawKey: string;
};

type CourseOnboardingData = {
  courseId: string;
  courseName: string;
  city: string;
  email: string | null;
  phone: string | null;
  providerType: string | null;
  stage: OnboardingStage;
  outreachSentAt: string | null;
  outreachMethod: string | null;
  responseReceivedAt: string | null;
  responseNotes: string | null;
  partnershipAcceptedAt: string | null;
  agreedCommission: number | null;
  credentialsReceivedAt: string | null;
  credentialsType: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  updatedAt: string | null;
};

const ONBOARDING_STAGES: { value: OnboardingStage; label: string; color: string; icon: typeof CircleDot }[] = [
  { value: "NOT_CONTACTED", label: "Not Contacted", color: "bg-gray-100 text-gray-700", icon: CircleDot },
  { value: "OUTREACH_SENT", label: "Outreach Sent", color: "bg-blue-100 text-blue-700", icon: Mail },
  { value: "INTERESTED", label: "Interested", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  { value: "NOT_INTERESTED", label: "Not Interested", color: "bg-red-100 text-red-700", icon: XCircle },
  { value: "PARTNERSHIP_ACCEPTED", label: "Partnership Accepted", color: "bg-purple-100 text-purple-700", icon: Handshake },
  { value: "CREDENTIALS_RECEIVED", label: "Credentials Received", color: "bg-emerald-100 text-emerald-700", icon: Key },
];

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

const courseDetailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  websiteUrl: z.string().optional(),
  notes: z.string().optional(),
});

const editOnboardingSchema = z.object({
  contactPerson: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  agreedCommission: z.number().min(0, "Must be at least 0").max(100, "Must be at most 100").optional(),
  notes: z.string().optional(),
});

const addContactLogSchema = z.object({
  type: z.enum(["EMAIL", "PHONE", "IN_PERSON", "NOTE"]),
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  subject: z.string().optional(),
  body: z.string().min(1, "Content is required"),
  outcome: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "NO_RESPONSE"]).optional(),
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
  
  // Gallery management state
  const [newGalleryImageUrl, setNewGalleryImageUrl] = useState("");
  const [newGalleryCaption, setNewGalleryCaption] = useState("");
  
  // Partnership Funnel state
  const [onboardingSearchQuery, setOnboardingSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<OnboardingStage | "ALL">("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [selectedOnboardingIds, setSelectedOnboardingIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "stage" | "lastContacted">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editingOnboarding, setEditingOnboarding] = useState<CourseOnboardingData | null>(null);
  const [contactLogsCourse, setContactLogsCourse] = useState<CourseOnboardingData | null>(null);
  
  // Course Profile Sheet state
  const [selectedCourseProfile, setSelectedCourseProfile] = useState<GolfCourse | null>(null);
  const [profileTab, setProfileTab] = useState<string>("details");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  
  // URL-based tab navigation
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabFromUrl = urlParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "analytics");
  
  // Inbox state
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unanswered" | "open" | "replied" | "closed" | "archived" | "deleted">("unanswered");
  const [replyText, setReplyText] = useState("");
  const [pendingMembersOnlyUpdates, setPendingMembersOnlyUpdates] = useState<Set<string>>(new Set());
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  
  // Bookings tab state
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ALL");
  const [bookingDateFilter, setBookingDateFilter] = useState<Date | undefined>(undefined);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  
  // API Keys state
  const [showCreateApiKeyDialog, setShowCreateApiKeyDialog] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyScopes, setNewApiKeyScopes] = useState<string[]>([]);
  const [newApiKeyExpiration, setNewApiKeyExpiration] = useState<Date | undefined>(undefined);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  
  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ["analytics", "money", "bookings", "users", "courses", "emails", "inbox", "api-keys"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const { t } = useI18n();
  const { isMobile } = useBreakpoint();

  // Fetch ALL courses including members-only for admin dashboard
  // Wait for auth to fully load before fetching to avoid 401 errors
  const { data: courses } = useQuery<GolfCourse[]>({
    queryKey: ["/api/admin/courses"],
    enabled: !isLoading && isAuthenticated && isAdmin,
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

  // Fetch course onboarding data - only if authenticated
  const { data: onboardingData, isLoading: isLoadingOnboarding } = useQuery<CourseOnboardingData[]>({
    queryKey: ["/api/admin/onboarding"],
    enabled: isAuthenticated,
  });

  // Fetch onboarding stats
  const { data: onboardingStats } = useQuery<Record<OnboardingStage, number>>({
    queryKey: ["/api/admin/onboarding/stats"],
    enabled: isAuthenticated,
  });

  // Fetch API keys (admin only)
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    enabled: isAuthenticated && isAdmin,
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: { name: string; scopes: string[]; expiresAt?: string }): Promise<CreateApiKeyResponse> => {
      const response = await apiRequest("/api/admin/api-keys", "POST", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setCreatedApiKey(data.rawKey);
      setNewApiKeyName("");
      setNewApiKeyScopes([]);
      setNewApiKeyExpiration(undefined);
      toast({
        title: "API Key Created",
        description: "Your new API key has been created. Copy it now - it won't be shown again!",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create API key",
        description: "An error occurred while creating the API key",
        variant: "destructive",
      });
    },
  });

  // Revoke API key mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest(`/api/admin/api-keys/${keyId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked and can no longer be used",
      });
    },
    onError: () => {
      toast({
        title: "Failed to revoke API key",
        description: "An error occurred while revoking the API key",
        variant: "destructive",
      });
    },
  });

  // Update onboarding stage mutation
  const updateOnboardingStageMutation = useMutation({
    mutationFn: async ({ courseId, stage }: { courseId: string; stage: OnboardingStage }) => {
      return await apiRequest(`/api/admin/onboarding/${courseId}/stage`, "PUT", { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding/stats"] });
      toast({
        title: "Stage updated",
        description: "Course partnership stage has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update partnership stage",
        variant: "destructive",
      });
    },
  });

  // Set members-only status mutation with double-click protection
  const setMembersOnlyMutation = useMutation({
    mutationFn: async ({ courseId, membersOnly }: { courseId: string; membersOnly: boolean }) => {
      // Add to pending set to prevent double mutations
      setPendingMembersOnlyUpdates(prev => new Set(prev).add(courseId));
      return await apiRequest(`/api/admin/courses/${courseId}/members-only`, "PATCH", { membersOnly });
    },
    onSuccess: (_, { courseId }) => {
      // Remove from pending set
      setPendingMembersOnlyUpdates(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding"] });
      toast({
        title: "Status updated",
        description: "Course visibility has been updated",
      });
    },
    onError: (_, { courseId }) => {
      // Remove from pending set on error too
      setPendingMembersOnlyUpdates(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      toast({
        title: "Update failed",
        description: "Failed to update course visibility",
        variant: "destructive",
      });
    },
  });

  // Track pending provider updates to prevent double mutations
  const [pendingProviderUpdates, setPendingProviderUpdates] = useState<Set<string>>(new Set());

  // Set course provider mutation
  const setCourseProviderMutation = useMutation({
    mutationFn: async ({ courseId, providerType }: { courseId: string; providerType: string }) => {
      setPendingProviderUpdates(prev => new Set(prev).add(courseId));
      return await apiRequest(`/api/admin/courses/${courseId}/provider`, "PATCH", { providerType });
    },
    onSuccess: (_, { courseId }) => {
      setPendingProviderUpdates(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/course-providers"] });
      toast({
        title: "Provider updated",
        description: "Course booking provider has been updated",
      });
    },
    onError: (_, { courseId }) => {
      setPendingProviderUpdates(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      toast({
        title: "Update failed",
        description: "Failed to update course provider",
        variant: "destructive",
      });
    },
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

  // Filter bookings based on search, status, and date
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((booking) => {
      const matchesSearch = !bookingSearchQuery || 
        booking.customerName.toLowerCase().includes(bookingSearchQuery.toLowerCase()) ||
        booking.customerEmail.toLowerCase().includes(bookingSearchQuery.toLowerCase()) ||
        (booking.customerPhone && booking.customerPhone.includes(bookingSearchQuery));
      
      const matchesStatus = bookingStatusFilter === "ALL" || booking.status === bookingStatusFilter;
      
      const matchesDate = !bookingDateFilter || 
        (booking.teeTime && format(new Date(booking.teeTime), "yyyy-MM-dd") === format(bookingDateFilter, "yyyy-MM-dd"));
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookings, bookingSearchQuery, bookingStatusFilter, bookingDateFilter]);

  // Calculate booking stats
  const bookingStats = useMemo(() => {
    const total = bookings?.length || 0;
    const pending = bookings?.filter(b => b.status === "PENDING").length || 0;
    const confirmed = bookings?.filter(b => b.status === "CONFIRMED").length || 0;
    const cancelled = bookings?.filter(b => b.status === "CANCELLED").length || 0;
    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.estimatedPrice || 0), 0) || 0;
    return { total, pending, confirmed, cancelled, totalRevenue };
  }, [bookings]);

  // Get course name by ID
  const getCourseNameById = (courseId: string) => {
    const course = courses?.find(c => c.id === courseId);
    return course?.name || courseId;
  };

  // Fetch contact logs for selected course profile
  const { data: profileContactLogs, isLoading: isLoadingProfileContactLogs } = useQuery<CourseContactLog[]>({
    queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "contact-logs"],
    enabled: !!selectedCourseProfile,
  });

  // Gallery images for profile sheet
  const { data: profileGalleryImages = [] } = useQuery<CourseImage[]>({
    queryKey: ['/api/courses', selectedCourseProfile?.id, 'images'],
    queryFn: async () => {
      if (!selectedCourseProfile?.id) return [];
      const res = await fetch(`/api/courses/${selectedCourseProfile.id}/images`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCourseProfile?.id,
  });

  // Fetch unmatched inbound emails
  const { data: unmatchedEmails = [] } = useQuery<UnmatchedEmail[]>({
    queryKey: ["/api/admin/unmatched-emails"],
    enabled: isAuthenticated && isAdmin,
  });

  // Assign email to course mutation
  const assignEmailMutation = useMutation({
    mutationFn: async ({ emailId, courseId }: { emailId: string; courseId: string }) => {
      return await apiRequest(`/api/admin/unmatched-emails/${emailId}/assign`, "POST", { courseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unmatched-emails"] });
      toast({
        title: "Email assigned",
        description: "Email has been assigned to the course and logged",
      });
    },
    onError: () => {
      toast({
        title: "Assignment failed",
        description: "Failed to assign email to course",
        variant: "destructive",
      });
    },
  });

  // Delete unmatched email mutation
  const deleteUnmatchedEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      return await apiRequest(`/api/admin/unmatched-emails/${emailId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unmatched-emails"] });
      toast({
        title: "Email deleted",
        description: "Unmatched email has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete email",
        variant: "destructive",
      });
    },
  });

  // Update booking status mutation (Admin)
  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      return await apiRequest(`/api/booking-requests/${bookingId}/status`, "PATCH", { status });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      setSelectedBooking(data);
      toast({
        title: "Status opdateret",
        description: `Booking status ændret til ${data.status}`,
      });
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke opdatere booking status",
        variant: "destructive",
      });
    },
  });

  // Inbox - Fetch all email threads
  const { data: inboxThreads = [], refetch: refetchInboxThreads } = useQuery<InboundEmailThread[]>({
    queryKey: ["/api/admin/inbox"],
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30000, // Auto refresh every 30 seconds
  });

  // Inbox - Get selected thread with messages
  const { data: selectedThread, isLoading: isLoadingThread, dataUpdatedAt } = useQuery<ThreadWithMessages>({
    queryKey: ["/api/admin/inbox", selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return null;
      const res = await fetch(`/api/admin/inbox/${selectedThreadId}`);
      if (!res.ok) throw new Error("Failed to fetch thread");
      return res.json();
    },
    enabled: !!selectedThreadId && isAuthenticated && isAdmin,
  });
  
  // When a thread is fetched (and marked as read by backend), refresh the inbox list
  useEffect(() => {
    if (dataUpdatedAt && selectedThreadId) {
      // Refresh the inbox list to show updated read status
      refetchInboxThreads();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/count"] });
    }
  }, [dataUpdatedAt]);

  // Inbox - Get inbox count for badge (also used in Header)
  const { data: inboxCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/inbox/count"],
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30000,
  });
  const unansweredCount = inboxCountData?.count ?? 0;

  // Inbox - Get alert settings
  const { data: alertSettings } = useQuery<AlertSettings>({
    queryKey: ["/api/admin/inbox/settings"],
    enabled: isAuthenticated && isAdmin && showAlertSettings,
  });

  // Filter threads based on selected filter
  const filteredThreads = useMemo(() => {
    if (!inboxThreads) return [];
    
    switch (inboxFilter) {
      case "unanswered":
        return inboxThreads.filter(t => t.requiresResponse === "true" && t.status === "OPEN");
      case "open":
        return inboxThreads.filter(t => t.status === "OPEN");
      case "replied":
        return inboxThreads.filter(t => t.status === "REPLIED");
      case "closed":
        return inboxThreads.filter(t => t.status === "CLOSED");
      case "archived":
        return inboxThreads.filter(t => t.status === "ARCHIVED");
      case "deleted":
        return inboxThreads.filter(t => t.status === "DELETED");
      default:
        // "all" filter - exclude deleted threads
        return inboxThreads.filter(t => t.status !== "DELETED");
    }
  }, [inboxThreads, inboxFilter]);

  // Inbox - Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/reply`, "POST", { body });
    },
    onSuccess: async () => {
      // Force immediate refetch of all inbox data to update status and count
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/admin/inbox"] }),
        queryClient.refetchQueries({ queryKey: ["/api/admin/inbox/count"] }),
        selectedThreadId ? queryClient.refetchQueries({ queryKey: ["/api/admin/inbox", selectedThreadId] }) : Promise.resolve(),
      ]);
      setReplyText("");
      // Switch to "replied" filter so user can see the status changed
      setInboxFilter("replied");
      toast({
        title: t('inbox.replySent'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToSendReply'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Update thread status mutation
  const updateThreadStatusMutation = useMutation({
    mutationFn: async ({ threadId, status, requiresResponse }: { threadId: string; status?: string; requiresResponse?: boolean }) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/status`, "PATCH", { status, requiresResponse });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/count"] });
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox", selectedThreadId] });
      }
      toast({
        title: t('inbox.statusUpdated'),
        description: t('inbox.statusUpdatedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToUpdateStatus'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Link thread to course mutation
  const linkThreadToCourseMutation = useMutation({
    mutationFn: async ({ threadId, courseId }: { threadId: string; courseId: string | null }) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/link-course`, "PATCH", { courseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/count"] });
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox", selectedThreadId] });
      }
      toast({
        title: t('inbox.threadLinked'),
        description: t('inbox.threadLinkedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToLinkThread'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Mute/unmute thread mutation
  const muteThreadMutation = useMutation({
    mutationFn: async ({ threadId, muted }: { threadId: string; muted: boolean }) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/mute`, "PATCH", { muted });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox", selectedThreadId] });
      }
      toast({
        title: variables.muted ? t('inbox.threadMuted') : t('inbox.threadUnmuted'),
        description: variables.muted ? t('inbox.threadMutedDescription') : t('inbox.threadUnmutedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToMuteThread'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Update alert settings mutation
  const updateAlertSettingsMutation = useMutation({
    mutationFn: async (settings: AlertSettingsUpdate) => {
      return await apiRequest(`/api/admin/inbox/settings`, "PATCH", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox/settings"] });
      toast({
        title: t('inbox.settingsSaved'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToSaveSettings'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Delete thread mutation (soft delete)
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return await apiRequest(`/api/admin/inbox/${threadId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      setSelectedThreadId(null);
      toast({
        title: t('inbox.threadDeleted'),
        description: t('inbox.threadDeletedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToDeleteThread'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Restore deleted thread mutation
  const restoreThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/restore`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox", selectedThreadId] });
      }
      toast({
        title: t('inbox.threadRestored'),
        description: t('inbox.threadRestoredDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToRestoreThread'),
        variant: "destructive",
      });
    },
  });

  // Inbox - Permanently delete thread mutation
  const permanentlyDeleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return await apiRequest(`/api/admin/inbox/${threadId}/permanent`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      setSelectedThreadId(null);
      toast({
        title: t('inbox.threadPermanentlyDeleted'),
        description: t('inbox.threadPermanentlyDeletedDescription'),
      });
    },
    onError: () => {
      toast({
        title: t('inbox.error'),
        description: t('inbox.failedToDeleteThread'),
        variant: "destructive",
      });
    },
  });

  // Combined courses with onboarding data for unified table
  const coursesWithOnboarding = useMemo(() => {
    if (!courses) return [];
    return courses.map(course => {
      const onboarding = onboardingData?.find(o => o.courseId === course.id);
      const provider = courseProviders?.find(p => p.id === course.id);
      return {
        ...course,
        onboarding,
        provider,
      };
    });
  }, [courses, onboardingData, courseProviders]);

  // Filtered courses for the unified table
  const filteredCourses = useMemo(() => {
    let filtered = coursesWithOnboarding;
    
    // Search filter
    if (courseSearchQuery) {
      const query = courseSearchQuery.toLowerCase();
      filtered = filtered.filter(course =>
        course.name.toLowerCase().includes(query) ||
        course.city.toLowerCase().includes(query) ||
        course.onboarding?.contactPerson?.toLowerCase().includes(query)
      );
    }
    
    // Stage filter
    if (stageFilter !== "ALL") {
      filtered = filtered.filter(course => course.onboarding?.stage === stageFilter);
    }
    
    // Provider filter
    if (providerFilter !== "ALL") {
      filtered = filtered.filter(course => {
        const providerType = course.provider?.providerType || "None";
        return providerType === providerFilter;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "stage") {
        const stageA = a.onboarding?.stage || "NOT_CONTACTED";
        const stageB = b.onboarding?.stage || "NOT_CONTACTED";
        comparison = stageA.localeCompare(stageB);
      } else if (sortBy === "lastContacted") {
        const dateA = a.onboarding?.outreachSentAt ? new Date(a.onboarding.outreachSentAt).getTime() : 0;
        const dateB = b.onboarding?.outreachSentAt ? new Date(b.onboarding.outreachSentAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [coursesWithOnboarding, courseSearchQuery, stageFilter, providerFilter, sortBy, sortOrder]);

  // Filter and sort onboarding data
  const filteredAndSortedOnboardingData = useMemo(() => {
    if (!onboardingData) return [];
    
    let filtered = onboardingData.filter((item) => {
      // Search filter
      if (onboardingSearchQuery) {
        const query = onboardingSearchQuery.toLowerCase();
        const matchesSearch = 
          item.courseName.toLowerCase().includes(query) ||
          item.city.toLowerCase().includes(query) ||
          (item.contactPerson?.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Stage filter
      if (stageFilter !== "ALL") {
        if (item.stage !== stageFilter) return false;
      }
      
      // Provider filter
      if (providerFilter !== "ALL") {
        const itemProvider = item.providerType || "None";
        if (itemProvider !== providerFilter) return false;
      }
      
      return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      let comparison = 0;
      
      if (sortBy === "name") {
        comparison = (a.courseName || "").localeCompare(b.courseName || "");
      } else if (sortBy === "stage") {
        comparison = (a.stage || "").localeCompare(b.stage || "");
      } else if (sortBy === "lastContacted") {
        const dateA = a.outreachSentAt ? new Date(a.outreachSentAt).getTime() : 0;
        const dateB = b.outreachSentAt ? new Date(b.outreachSentAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [onboardingData, onboardingSearchQuery, stageFilter, providerFilter, sortBy, sortOrder]);

  // Check if outreach is stale (more than 7 days in OUTREACH_SENT)
  const isOutreachStale = (item: CourseOnboardingData) => {
    if (item.stage !== "OUTREACH_SENT") return false;
    if (!item.outreachSentAt) return false;
    const daysSinceSent = differenceInDays(new Date(), new Date(item.outreachSentAt));
    return daysSinceSent > 7;
  };

  // Toggle onboarding selection
  const toggleOnboardingSelection = (courseId: string) => {
    setSelectedOnboardingIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // Select all visible onboarding items
  const selectAllOnboarding = () => {
    const allIds = filteredAndSortedOnboardingData.map((item) => item.courseId);
    const allSelected = allIds.every((id) => selectedOnboardingIds.includes(id));
    if (allSelected) {
      setSelectedOnboardingIds([]);
    } else {
      setSelectedOnboardingIds(allIds);
    }
  };

  // Toggle sort
  const toggleSort = (column: "name" | "stage" | "lastContacted") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

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
      const feedback = getPersonalFeedback(user?.firstName, 'user_updated');
      toast({
        title: feedback.title,
        description: feedback.description,
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
      const feedback = getPersonalFeedback(user?.firstName, 'user_deleted');
      toast({
        title: feedback.title,
        description: feedback.description,
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

  // Course details form (name, city, etc.)
  const courseDetailsForm = useForm<z.infer<typeof courseDetailsSchema>>({
    resolver: zodResolver(courseDetailsSchema),
    defaultValues: {
      name: "",
      city: "",
      province: "",
      email: "",
      phone: "",
      websiteUrl: "",
      notes: "",
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
      const feedback = getPersonalFeedback(user?.firstName, 'commission_updated');
      toast({
        title: feedback.title,
        description: feedback.description,
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

  // Edit onboarding form
  const onboardingForm = useForm<z.infer<typeof editOnboardingSchema>>({
    resolver: zodResolver(editOnboardingSchema),
    defaultValues: {
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      agreedCommission: 0,
      notes: "",
    },
  });

  // Contact log form
  const contactLogForm = useForm<z.infer<typeof addContactLogSchema>>({
    resolver: zodResolver(addContactLogSchema),
    defaultValues: {
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "",
      body: "",
      outcome: undefined,
    },
  });

  // Fetch contact logs for selected course
  const { data: contactLogs, isLoading: isLoadingContactLogs } = useQuery<CourseContactLog[]>({
    queryKey: ["/api/admin/courses", contactLogsCourse?.courseId, "contact-logs"],
    enabled: !!contactLogsCourse,
  });

  // Update onboarding mutation
  const updateOnboardingMutation = useMutation({
    mutationFn: async ({ courseId, data }: { courseId: string; data: z.infer<typeof editOnboardingSchema> }) => {
      return await apiRequest(`/api/admin/onboarding/${courseId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding"] });
      const feedback = getPersonalFeedback(user?.firstName, 'onboarding_updated');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
      setEditingOnboarding(null);
      onboardingForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update onboarding details",
        variant: "destructive",
      });
    },
  });

  // Add contact log mutation
  const addContactLogMutation = useMutation({
    mutationFn: async ({ courseId, data }: { courseId: string; data: z.infer<typeof addContactLogSchema> }) => {
      return await apiRequest(`/api/admin/courses/${courseId}/contact-logs`, "POST", data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", contactLogsCourse?.courseId, "contact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "contact-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", variables.courseId, "contact-logs"] });
      const feedback = getPersonalFeedback(user?.firstName, 'contact_logged');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
      contactLogForm.reset({
        type: "EMAIL",
        direction: "OUTBOUND",
        subject: "",
        body: "",
        outcome: undefined,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Add failed",
        description: error.message || "Failed to add contact log",
        variant: "destructive",
      });
    },
  });

  // Handle edit onboarding - populate form
  const handleEditOnboarding = (data: CourseOnboardingData) => {
    setEditingOnboarding(data);
    onboardingForm.reset({
      contactPerson: data.contactPerson || "",
      contactEmail: data.contactEmail || "",
      contactPhone: data.contactPhone || "",
      agreedCommission: data.agreedCommission || 0,
      notes: data.notes || "",
    });
  };

  // Handle save onboarding
  const handleSaveOnboarding = (data: z.infer<typeof editOnboardingSchema>) => {
    if (editingOnboarding) {
      updateOnboardingMutation.mutate({
        courseId: editingOnboarding.courseId,
        data,
      });
    }
  };

  // Handle add contact log
  const handleAddContactLog = (data: z.infer<typeof addContactLogSchema>) => {
    if (contactLogsCourse) {
      addContactLogMutation.mutate({
        courseId: contactLogsCourse.courseId,
        data,
      });
    }
  };

  // Handle add contact log for profile sheet
  const handleAddProfileContactLog = (data: z.infer<typeof addContactLogSchema>) => {
    if (selectedCourseProfile) {
      addContactLogMutation.mutate({
        courseId: selectedCourseProfile.id,
        data,
      });
    }
  };

  // Open course profile sheet
  const openCourseProfile = (course: GolfCourse) => {
    setSelectedCourseProfile(course);
    setProfileTab("details");
    // Initialize forms with course data
    const onboarding = onboardingData?.find(o => o.courseId === course.id);
    onboardingForm.reset({
      contactPerson: onboarding?.contactPerson || "",
      contactEmail: onboarding?.contactEmail || "",
      contactPhone: onboarding?.contactPhone || "",
      agreedCommission: onboarding?.agreedCommission || 0,
      notes: onboarding?.notes || "",
    });
    // Initialize course details form
    courseDetailsForm.reset({
      name: course.name || "",
      city: course.city || "",
      province: course.province || "",
      websiteUrl: course.websiteUrl || "",
      email: course.email || "",
      phone: course.phone || "",
      notes: course.notes || "",
    });
    // Initialize credentials/kickback form
    courseForm.reset({
      kickbackPercent: course.kickbackPercent || 0,
      golfmanagerUser: course.golfmanagerUser || "",
      golfmanagerPassword: course.golfmanagerPassword || "",
    });
    contactLogForm.reset({
      type: "EMAIL",
      direction: "OUTBOUND",
      subject: "",
      body: "",
      outcome: undefined,
    });
  };

  // Handle save profile details (course info)
  // Update course details mutation
  const updateCourseDetailsMutation = useMutation({
    mutationFn: async ({ courseId, data }: { courseId: string; data: z.infer<typeof courseDetailsSchema> }) => {
      const response = await apiRequest(`/api/admin/courses/${courseId}/details`, "PATCH", data);
      return await response.json() as GolfCourse;
    },
    onSuccess: (data: GolfCourse) => {
      queryClient.setQueryData<GolfCourse[]>(["/api/courses"], (old) => {
        if (!old) return old;
        return old.map((course) => course.id === data.id ? data : course);
      });
      setSelectedCourseProfile(data);
      const feedback = getPersonalFeedback(user?.firstName, 'course_updated');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update course details",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfileDetails = (data: z.infer<typeof courseDetailsSchema>) => {
    if (selectedCourseProfile) {
      updateCourseDetailsMutation.mutate({
        courseId: selectedCourseProfile.id,
        data,
      });
    }
  };

  // Handle save profile partnership (onboarding info)
  const handleSaveProfilePartnership = (data: z.infer<typeof editOnboardingSchema>) => {
    if (selectedCourseProfile) {
      updateOnboardingMutation.mutate({
        courseId: selectedCourseProfile.id,
        data,
      });
    }
  };

  // Export to Excel function
  const exportToExcel = () => {
    const exportData = filteredAndSortedOnboardingData.map((item) => ({
      "Course Name": item.courseName,
      "City": item.city,
      "Stage": item.stage,
      "Provider Type": item.providerType || "None",
      "Contact Person": item.contactPerson || "",
      "Contact Email": item.contactEmail || "",
      "Contact Phone": item.contactPhone || "",
      "Commission %": item.agreedCommission || 0,
      "Notes": item.notes || "",
      "Outreach Sent": item.outreachSentAt ? format(new Date(item.outreachSentAt), "PP") : "Never",
      "Last Updated": item.updatedAt ? format(new Date(item.updatedAt), "PP") : "Never",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Partnership Funnel");
    XLSX.writeFile(wb, `partnership-funnel-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    
    toast({
      title: "Export Complete",
      description: `Exported ${exportData.length} courses to Excel`,
    });
  };

  // Send affiliate emails mutation
  const sendEmailsMutation = useMutation({
    mutationFn: async (data: { courseIds: string[]; subject: string; body: string; senderName: string }) => {
      return await apiRequest("/api/affiliate-emails/send", "POST", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliate-emails"] });
      const feedback = getPersonalFeedback(user?.firstName, 'email_sent');
      toast({
        title: feedback.title,
        description: feedback.description,
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
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

  // Upload course image mutation (single) using Object Storage for persistence
  const uploadImageMutation = useMutation({
    mutationFn: async ({ courseId, file }: { courseId: string; file: File }) => {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPEG, PNG, and WebP images are allowed");
      }
      
      // Step 1: Get presigned upload URL from server
      const urlResponse = await fetch("/api/objects/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      
      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error || "Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await urlResponse.json();
      
      // Step 2: Upload file directly to Object Storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }
      
      // Step 3: Complete upload and register in database
      const completeResponse = await fetch(`/api/courses/${courseId}/images/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath, setAsMain: true }),
      });
      
      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || "Failed to complete upload");
      }
      
      return { imageUrl: objectPath };
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

  // Upload multiple course images mutation using Object Storage for persistence
  const uploadImagesMutation = useMutation({
    mutationFn: async ({ courseId, formData }: { courseId: string; formData: FormData }) => {
      const files = formData.getAll("images") as File[];
      const uploadedImages: Array<{ id: string; imageUrl: string }> = [];
      
      // Validate all files first
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.name}. Only JPEG, PNG, and WebP are allowed.`);
        }
      }
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Step 1: Get presigned upload URL from server
        const urlResponse = await fetch("/api/objects/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        
        if (!urlResponse.ok) {
          const error = await urlResponse.json();
          throw new Error(error.error || "Failed to get upload URL");
        }
        
        const { uploadURL, objectPath } = await urlResponse.json();
        
        // Step 2: Upload file directly to Object Storage
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }
        
        // Step 3: Complete upload and add to course gallery
        const completeResponse = await fetch(`/api/courses/${courseId}/images/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            objectPath, 
            setAsMain: i === 0 
          }),
        });
        
        if (!completeResponse.ok) {
          const error = await completeResponse.json();
          throw new Error(error.error || "Failed to complete upload");
        }
        
        const result = await completeResponse.json();
        if (result.image) {
          uploadedImages.push({ id: result.image.id, imageUrl: objectPath });
        }
      }
      
      return { uploaded: uploadedImages.length, images: uploadedImages };
    },
    onSuccess: (data: { uploaded: number; images?: Array<{ id: string }> }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", variables.courseId, "images"] });
      const feedback = getPersonalFeedback(user?.firstName, 'image_uploaded');
      toast({
        title: feedback.title,
        description: feedback.description,
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      const feedback = getPersonalFeedback(user?.firstName, 'image_deleted');
      toast({
        title: feedback.title,
        description: feedback.description,
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

  // Gallery images query
  const { data: galleryImages = [], refetch: refetchGalleryImages } = useQuery<CourseImage[]>({
    queryKey: ['/api/courses', editingCourse?.id, 'images'],
    queryFn: async () => {
      if (!editingCourse?.id) return [];
      const res = await fetch(`/api/courses/${editingCourse.id}/images`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingCourse?.id,
  });

  // Add gallery image mutation
  const addGalleryImageMutation = useMutation({
    mutationFn: async ({ courseId, imageUrl, caption }: { courseId: string; imageUrl: string; caption?: string }) => {
      return await apiRequest(`/api/courses/${courseId}/images`, "POST", { imageUrl, caption });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses', editingCourse?.id, 'images'] });
      setNewGalleryImageUrl("");
      setNewGalleryCaption("");
      const feedback = getPersonalFeedback(user?.firstName, 'image_uploaded');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Image",
        description: error.message || "Could not add gallery image",
        variant: "destructive",
      });
    },
  });

  // Delete gallery image mutation
  const deleteGalleryImageMutation = useMutation({
    mutationFn: async ({ imageId, courseId }: { imageId: string; courseId: string }) => {
      return await apiRequest(`/api/course-images/${imageId}`, "DELETE", undefined);
    },
    onSuccess: (_data, variables) => {
      // Invalidate both editingCourse and selectedCourseProfile galleries
      queryClient.invalidateQueries({ queryKey: ['/api/courses', variables.courseId, 'images'] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      const feedback = getPersonalFeedback(user?.firstName, 'image_deleted');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Image",
        description: error.message || "Could not delete gallery image",
        variant: "destructive",
      });
    },
  });

  // Reorder gallery images mutation
  const reorderGalleryImagesMutation = useMutation({
    mutationFn: async ({ courseId, imageIds }: { courseId: string; imageIds: string[] }) => {
      return await apiRequest(`/api/courses/${courseId}/images/reorder`, "PATCH", { imageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses', editingCourse?.id, 'images'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Reorder Images",
        description: error.message || "Could not reorder gallery images",
        variant: "destructive",
      });
    },
  });

  // Move gallery image up or down
  const handleMoveGalleryImage = (imageId: string, direction: 'up' | 'down') => {
    if (!editingCourse?.id) return;
    
    const currentIndex = galleryImages.findIndex(img => img.id === imageId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= galleryImages.length) return;
    
    const newOrder = [...galleryImages];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    
    reorderGalleryImagesMutation.mutate({
      courseId: editingCourse.id,
      imageIds: newOrder.map(img => img.id),
    });
  };

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
          <GolfLoader size="lg" text={t('common.loading')} />
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
      case "ACCEPTED":
        return <Badge variant="default" className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Accepted</Badge>;
      case "FULFILLED":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Fulfilled</Badge>;
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="money" data-testid="tab-money">
              <DollarSign className="h-4 w-4 mr-2" />
              Money
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">{t('admin.tabBookingRequests')}</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="h-4 w-4 mr-2" />
                User Management
              </TabsTrigger>
            )}
            <TabsTrigger value="courses" data-testid="tab-courses">
              <Handshake className="h-4 w-4 mr-2" />
              Courses & Partnerships
            </TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">{t('admin.tabAffiliateEmails')}</TabsTrigger>
            <TabsTrigger value="inbox" data-testid="tab-inbox" className="relative">
              <Inbox className="h-4 w-4 mr-2" />
              {t('inbox.title')}
              {unansweredCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs font-bold"
                  data-testid="badge-inbox-tab-count"
                >
                  {unansweredCount > 99 ? "99+" : unansweredCount}
                </Badge>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="api-keys" data-testid="tab-api-keys">
                <Key className="h-4 w-4 mr-2" />
                API Keys
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="money">
            <div className="space-y-6">
              <CommissionDashboard />
              <AdCampaigns />
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="space-y-6">
              <MobileCardGrid columns={{ mobile: 1, tablet: 2, desktop: 4 }} gap="md">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Total Bookings</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="stat-total-bookings">{bookingStats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-muted-foreground">Pending</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-bookings">{bookingStats.pending}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-muted-foreground">Confirmed</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600" data-testid="stat-confirmed-bookings">{bookingStats.confirmed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Est. Revenue</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid="stat-total-revenue">€{bookingStats.totalRevenue.toFixed(0)}</p>
                  </CardContent>
                </Card>
              </MobileCardGrid>

              <Card>
                <CardHeader>
                  <CardTitle>{t('admin.recentBookingRequests')}</CardTitle>
                  <CardDescription>
                    {t('admin.bookingRequestsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, phone..."
                        value={bookingSearchQuery}
                        onChange={(e) => setBookingSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-booking-search"
                      />
                    </div>
                    <Select value={bookingStatusFilter} onValueChange={setBookingStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-booking-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[200px] justify-start text-left font-normal" data-testid="button-date-filter">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bookingDateFilter ? format(bookingDateFilter, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={bookingDateFilter}
                          onSelect={setBookingDateFilter}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(bookingSearchQuery || bookingStatusFilter !== "ALL" || bookingDateFilter) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBookingSearchQuery("");
                          setBookingStatusFilter("ALL");
                          setBookingDateFilter(undefined);
                        }}
                        className="w-full sm:w-auto"
                        data-testid="button-clear-filters"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                  
                  <TableCard
                    columns={[
                      {
                        key: "teeTime",
                        label: "Date",
                        render: (value) => value ? format(new Date(value as string), "PP") : "-",
                      },
                      {
                        key: "teeTime",
                        label: "Time",
                        hideOnMobile: true,
                        render: (value) => value ? format(new Date(value as string), "p") : "-",
                      },
                      {
                        key: "courseId",
                        label: "Course",
                        render: (value) => getCourseNameById(value as string),
                      },
                      {
                        key: "customerName",
                        label: "Customer",
                      },
                      {
                        key: "players",
                        label: "Players",
                        hideOnMobile: true,
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (value) => getStatusBadge(value as string),
                      },
                      {
                        key: "estimatedPrice",
                        label: "Price",
                        hideOnMobile: true,
                        render: (value) => value ? `€${(value as number).toFixed(0)}` : "-",
                      },
                    ] as TableCardColumn<BookingRequest & { courseName?: string }>[]}
                    data={filteredBookings as (BookingRequest & { courseName?: string })[]}
                    onRowClick={(booking) => setSelectedBooking(booking as BookingRequest)}
                    emptyMessage={t('admin.noBookings')}
                    keyExtractor={(row) => row.id}
                  />
                </CardContent>
              </Card>
            </div>

            <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
              <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Booking Details</DialogTitle>
                  <DialogDescription>
                    Booking #{selectedBooking?.id?.slice(0, 8)}
                  </DialogDescription>
                </DialogHeader>
                {selectedBooking && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Customer</Label>
                        <p className="font-medium">{selectedBooking.customerName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Email</Label>
                        <p className="text-sm">{selectedBooking.customerEmail}</p>
                      </div>
                      {selectedBooking.customerPhone && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">Phone</Label>
                          <p className="text-sm">{selectedBooking.customerPhone}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Course</Label>
                        <p className="font-medium">{getCourseNameById(selectedBooking.courseId)}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Players</Label>
                        <p className="font-medium">{selectedBooking.players}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Date</Label>
                        <p className="font-medium">
                          {selectedBooking.teeTime ? format(new Date(selectedBooking.teeTime), "PPP") : "-"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Time</Label>
                        <p className="font-medium">
                          {selectedBooking.teeTime ? format(new Date(selectedBooking.teeTime), "p") : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Status</Label>
                        <Select
                          value={selectedBooking.status}
                          onValueChange={(value) => {
                            updateBookingStatusMutation.mutate({
                              bookingId: selectedBooking.id,
                              status: value,
                            });
                          }}
                          disabled={updateBookingStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-full" data-testid="select-booking-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="ACCEPTED">Accepted</SelectItem>
                            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Est. Price</Label>
                        <p className="font-medium">{selectedBooking.estimatedPrice ? `€${selectedBooking.estimatedPrice.toFixed(0)}` : "-"}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Created</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedBooking.createdAt ? format(new Date(selectedBooking.createdAt), "PPpp") : "-"}
                      </p>
                    </div>
                  </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedBooking(null)}
                    className="w-full sm:w-auto"
                    data-testid="button-close-booking-dialog"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by name, email, or phone..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      data-testid="input-search-users"
                      className="pl-9 w-full"
                    />
                  </div>
                  {userSearchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserSearchQuery("")}
                      data-testid="button-clear-search"
                      className="w-full sm:w-auto"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {filteredUsers && filteredUsers.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Showing {filteredUsers.length} of {users?.length || 0} users
                    </p>
                    <TableCard
                      columns={[
                        {
                          key: "name" as keyof User,
                          label: "Name",
                          render: (_value, row: User) => (
                            <span className="font-medium">
                              {row.firstName} {row.lastName}
                            </span>
                          ),
                        },
                        {
                          key: "email",
                          label: "Email",
                          render: (value) => (
                            <span className="text-sm truncate max-w-[200px] block">{value as string}</span>
                          ),
                        },
                        {
                          key: "phoneNumber",
                          label: "Phone",
                          hideOnMobile: true,
                          render: (value) => (value as string) || "—",
                        },
                        {
                          key: "isAdmin",
                          label: "Role",
                          render: (value) =>
                            value === "true" ? (
                              <Badge variant="default">Admin</Badge>
                            ) : (
                              <Badge variant="secondary">User</Badge>
                            ),
                        },
                        {
                          key: "id" as keyof User,
                          label: "Actions",
                          render: (_value, row: User) => (
                            <>
                              {/* Desktop: Show all buttons */}
                              <div className="hidden sm:flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingUserBookings(row);
                                  }}
                                  data-testid={`button-view-bookings-${row.id}`}
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  View Bookings
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditUser(row);
                                  }}
                                  data-testid={`button-edit-user-${row.id}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingUser(row);
                                  }}
                                  data-testid={`button-delete-user-${row.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                              {/* Mobile: Dropdown menu */}
                              <div className="sm:hidden flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-10 w-10"
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`button-user-actions-${row.id}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                      onClick={() => setViewingUserBookings(row)}
                                      className="py-3"
                                      data-testid={`menu-view-bookings-${row.id}`}
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      View Bookings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleEditUser(row)}
                                      className="py-3"
                                      data-testid={`menu-edit-user-${row.id}`}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeletingUser(row)}
                                      className="py-3 text-destructive focus:text-destructive"
                                      data-testid={`menu-delete-user-${row.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </>
                          ),
                        },
                      ] as TableCardColumn<User>[]}
                      data={filteredUsers as User[]}
                      keyExtractor={(row) => row.id}
                      emptyMessage="No users found"
                    />
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
            <div className="space-y-6">
              {/* Funnel Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ONBOARDING_STAGES.map((stage) => {
                  const count = onboardingStats?.[stage.value] ?? 0;
                  const StageIcon = stage.icon;
                  return (
                    <Card key={stage.value} className={`${stage.color} border-0`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <StageIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{stage.label}</span>
                        </div>
                        <p className="text-2xl font-bold">{count}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Course List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Course Management
                  </CardTitle>
                  <CardDescription>
                    Manage courses, partnerships, and communications. Click a row to view full profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search, Filters, and Export */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, city, or contact..."
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-course-search"
                      />
                    </div>
                    
                    <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as OnboardingStage | "ALL")}>
                      <SelectTrigger className="w-[180px]" data-testid="select-stage-filter">
                        <SelectValue placeholder="All Stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Stages</SelectItem>
                        {ONBOARDING_STAGES.map((stage) => {
                          const Icon = stage.icon;
                          return (
                            <SelectItem key={stage.value} value={stage.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-3 w-3" />
                                <span>{stage.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    
                    <Select value={providerFilter} onValueChange={setProviderFilter}>
                      <SelectTrigger className="w-[140px]" data-testid="select-provider-filter">
                        <SelectValue placeholder="All Providers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Providers</SelectItem>
                        <SelectItem value="golfmanager_v1">GM V1</SelectItem>
                        <SelectItem value="golfmanager_v3">GM V3</SelectItem>
                        <SelectItem value="teeone">TeeOne</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      onClick={exportToExcel}
                      data-testid="button-export-excel"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>

                  {/* Results count */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Showing {filteredCourses.length} of {courses?.length || 0} courses
                    </span>
                  </div>

                  {isLoadingOnboarding ? (
                    <div className="py-12">
                      <GolfLoader size="md" text="Loading course data..." />
                    </div>
                  ) : filteredCourses.length > 0 ? (
                    <>
                      {/* Mobile/Tablet Card View */}
                      <div className="lg:hidden">
                        <MobileCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap="md">
                          {filteredCourses.map((course) => {
                            const currentStage = ONBOARDING_STAGES.find(s => s.value === course.onboarding?.stage);
                            const StageIcon = currentStage?.icon || CircleDot;
                            const hasCredentials = course.golfmanagerUser && course.golfmanagerPassword;
                            const hasKickback = (course.kickbackPercent ?? 0) > 0;
                            const isMembersOnly = course.membersOnly === "true";
                            
                            return (
                              <Card 
                                key={course.id}
                                className={`cursor-pointer hover-elevate ${isMembersOnly ? "opacity-50 bg-muted/50" : ""}`}
                                onClick={() => openCourseProfile(course)}
                                data-testid={`card-course-${course.id}`}
                              >
                                <CardContent className="p-3">
                                  <div className="flex gap-3">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                      <OptimizedImage
                                        src={course.imageUrl || undefined}
                                        alt={course.name}
                                        className="w-full h-full object-cover"
                                        data-testid={`img-course-thumb-${course.id}`}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                      <div>
                                        <p className="font-medium text-sm sm:text-base truncate">{course.name}</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{course.city}, {course.province}</p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        {course.provider?.providerType === "golfmanager_v1" && (
                                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GM V1</Badge>
                                        )}
                                        {course.provider?.providerType === "golfmanager_v3" && (
                                          <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">GM V3</Badge>
                                        )}
                                        {course.provider?.providerType === "teeone" && (
                                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">TeeOne</Badge>
                                        )}
                                        {hasKickback && (
                                          <Badge variant="outline" className="text-xs">{course.kickbackPercent}%</Badge>
                                        )}
                                        {hasCredentials && (
                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                            <Lock className="h-3 w-3" />
                                          </Badge>
                                        )}
                                        {isMembersOnly && (
                                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                                            Members
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Select
                                      value={course.onboarding?.stage || "NOT_CONTACTED"}
                                      onValueChange={(value: OnboardingStage) => {
                                        if (value !== course.onboarding?.stage) {
                                          updateOnboardingStageMutation.mutate({ courseId: course.id, stage: value });
                                        }
                                      }}
                                      disabled={updateOnboardingStageMutation.isPending}
                                    >
                                      <SelectTrigger 
                                        className="flex-1 h-9" 
                                        data-testid={`select-stage-${course.id}`}
                                      >
                                        <Badge variant="secondary" className={`${currentStage?.color} text-xs`}>
                                          <StageIcon className="h-3 w-3 mr-1" />
                                          <span className="truncate">{currentStage?.label || "Not Contacted"}</span>
                                        </Badge>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ONBOARDING_STAGES.map((stage) => {
                                          const Icon = stage.icon;
                                          return (
                                            <SelectItem 
                                              key={stage.value} 
                                              value={stage.value}
                                              data-testid={`option-stage-${stage.value}-${course.id}`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Icon className="h-3 w-3" />
                                                <span>{stage.label}</span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCourse(course);
                                      }}
                                      data-testid={`button-edit-course-${course.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </MobileCardGrid>
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden lg:block border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Image</TableHead>
                              <TableHead>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium hover:bg-transparent"
                                  onClick={() => toggleSort("name")}
                                  data-testid="button-sort-name"
                                >
                                  Course
                                  <ArrowUpDown className="ml-1 h-3 w-3" />
                                </Button>
                              </TableHead>
                              <TableHead>Provider</TableHead>
                              <TableHead>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium hover:bg-transparent"
                                  onClick={() => toggleSort("stage")}
                                  data-testid="button-sort-stage"
                                >
                                  Stage
                                  <ArrowUpDown className="ml-1 h-3 w-3" />
                                </Button>
                              </TableHead>
                              <TableHead>Kickback</TableHead>
                              <TableHead>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium hover:bg-transparent"
                                  onClick={() => toggleSort("lastContacted")}
                                  data-testid="button-sort-contacted"
                                >
                                  Last Contact
                                  <ArrowUpDown className="ml-1 h-3 w-3" />
                                </Button>
                              </TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCourses.map((course) => {
                              const currentStage = ONBOARDING_STAGES.find(s => s.value === course.onboarding?.stage);
                              const StageIcon = currentStage?.icon || CircleDot;
                              const hasCredentials = course.golfmanagerUser && course.golfmanagerPassword;
                              const hasKickback = (course.kickbackPercent ?? 0) > 0;
                              
                              const isMembersOnly = course.membersOnly === "true";
                              
                              return (
                                <TableRow 
                                  key={course.id} 
                                  data-testid={`row-course-${course.id}`}
                                  className={`cursor-pointer hover-elevate ${isMembersOnly ? "opacity-50 bg-muted/50" : ""}`}
                                  onClick={() => openCourseProfile(course)}
                                >
                                  <TableCell>
                                    <div className="w-12 h-12 rounded-md overflow-hidden bg-muted">
                                      <OptimizedImage
                                        src={course.imageUrl || undefined}
                                        alt={course.name}
                                        className="w-full h-full object-cover"
                                        data-testid={`img-course-thumb-${course.id}`}
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <span className="font-medium">{course.name}</span>
                                        <p className="text-sm text-muted-foreground">{course.city}, {course.province}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Select
                                      value={course.provider?.providerType || "none"}
                                      onValueChange={(value: string) => {
                                        if (value !== (course.provider?.providerType || "none")) {
                                          setCourseProviderMutation.mutate({ courseId: course.id, providerType: value });
                                        }
                                      }}
                                      disabled={pendingProviderUpdates.has(course.id) || setCourseProviderMutation.isPending}
                                    >
                                      <SelectTrigger 
                                        className="w-[120px]" 
                                        data-testid={`select-provider-${course.id}`}
                                      >
                                        <SelectValue>
                                          {course.provider?.providerType === "golfmanager_v1" && (
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GM V1</Badge>
                                          )}
                                          {course.provider?.providerType === "golfmanager_v3" && (
                                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">GM V3</Badge>
                                          )}
                                          {course.provider?.providerType === "teeone" && (
                                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">TeeOne</Badge>
                                          )}
                                          {!course.provider?.providerType && (
                                            <span className="text-muted-foreground text-sm">None</span>
                                          )}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">
                                          <span className="text-muted-foreground">None</span>
                                        </SelectItem>
                                        <SelectItem value="golfmanager_v1">
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GM V1</Badge>
                                        </SelectItem>
                                        <SelectItem value="golfmanager_v3">
                                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">GM V3</Badge>
                                        </SelectItem>
                                        <SelectItem value="teeone">
                                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">TeeOne</Badge>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Select
                                      value={course.onboarding?.stage || "NOT_CONTACTED"}
                                      onValueChange={(value: OnboardingStage) => {
                                        if (value !== course.onboarding?.stage) {
                                          updateOnboardingStageMutation.mutate({ courseId: course.id, stage: value });
                                        }
                                      }}
                                      disabled={updateOnboardingStageMutation.isPending}
                                    >
                                      <SelectTrigger 
                                        className="w-[140px]" 
                                        data-testid={`select-stage-${course.id}`}
                                      >
                                        <Badge variant="secondary" className={currentStage?.color}>
                                          <StageIcon className="h-3 w-3 mr-1" />
                                          {currentStage?.label || "Not Contacted"}
                                        </Badge>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ONBOARDING_STAGES.map((stage) => {
                                          const Icon = stage.icon;
                                          return (
                                            <SelectItem 
                                              key={stage.value} 
                                              value={stage.value}
                                              data-testid={`option-stage-${stage.value}-${course.id}`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <Icon className="h-3 w-3" />
                                                <span>{stage.label}</span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {hasKickback ? (
                                      <Badge variant="outline">{course.kickbackPercent}%</Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {course.onboarding?.outreachSentAt ? (
                                      <span className="text-sm">
                                        {format(new Date(course.onboarding.outreachSentAt), "PP")}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">Never</span>
                                    )}
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-1">
                                            <Switch
                                              checked={!isMembersOnly}
                                              onCheckedChange={(checked) => {
                                                // Prevent double mutations for this course
                                                if (pendingMembersOnlyUpdates.has(course.id)) return;
                                                setMembersOnlyMutation.mutate({ courseId: course.id, membersOnly: !checked });
                                              }}
                                              disabled={pendingMembersOnlyUpdates.has(course.id)}
                                              data-testid={`switch-public-${course.id}`}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                              {isMembersOnly ? "Members" : "Public"}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {isMembersOnly ? "Hidden from public site (members only)" : "Visible on public site"}
                                        </TooltipContent>
                                      </Tooltip>
                                      {hasKickback && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                              <DollarSign className="h-3 w-3" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>Kickback configured</TooltipContent>
                                        </Tooltip>
                                      )}
                                      {hasCredentials && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                              <Lock className="h-3 w-3" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>Credentials set</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      {courseSearchQuery || stageFilter !== "ALL" || providerFilter !== "ALL" 
                        ? "No courses match your filters" 
                        : "No courses found"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Course Profile Sheet */}
            <Sheet open={!!selectedCourseProfile} onOpenChange={(open) => !open && setSelectedCourseProfile(null)}>
              <SheetContent className="w-full max-w-[100vw] sm:max-w-[600px] md:max-w-[800px] overflow-y-auto p-4 sm:p-6">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3">
                    {selectedCourseProfile?.imageUrl && (
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted">
                        <OptimizedImage
                          src={selectedCourseProfile.imageUrl}
                          alt={selectedCourseProfile.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <span>{selectedCourseProfile?.name}</span>
                      <p className="text-sm font-normal text-muted-foreground">
                        {selectedCourseProfile?.city}, {selectedCourseProfile?.province}
                      </p>
                    </div>
                  </SheetTitle>
                  <SheetDescription>
                    Manage course details, partnership info, and communications
                  </SheetDescription>
                </SheetHeader>

                {selectedCourseProfile && (
                  <Tabs value={profileTab} onValueChange={setProfileTab} className="mt-4 sm:mt-6">
                    <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-5 scrollbar-hide">
                      <TabsTrigger value="details" className="flex-shrink-0" data-testid="profile-tab-details">Details</TabsTrigger>
                      <TabsTrigger value="partnership" className="flex-shrink-0" data-testid="profile-tab-partnership">Partnership</TabsTrigger>
                      <TabsTrigger value="credentials" className="flex-shrink-0" data-testid="profile-tab-credentials">Credentials</TabsTrigger>
                      <TabsTrigger value="images" className="flex-shrink-0" data-testid="profile-tab-images">Images</TabsTrigger>
                      <TabsTrigger value="communications" className="flex-shrink-0" data-testid="profile-tab-communications">Comms</TabsTrigger>
                    </TabsList>

                    {/* Details Tab */}
                    <TabsContent value="details" className="space-y-4 mt-4">
                      <Form {...courseDetailsForm}>
                        <form onSubmit={courseDetailsForm.handleSubmit(handleSaveProfileDetails)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={courseDetailsForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Course Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={courseDetailsForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-city" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={courseDetailsForm.control}
                              name="province"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Province</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-province" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={courseDetailsForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-email" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={courseDetailsForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-phone" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={courseDetailsForm.control}
                              name="websiteUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Website</FormLabel>
                                  <FormControl>
                                    <div className="flex gap-2">
                                      <Input {...field} data-testid="input-profile-website" className="flex-1" />
                                      {field.value && (
                                        <a 
                                          href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-center px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                                          data-testid="link-profile-website"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={courseDetailsForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                  <Textarea {...field} className="min-h-[100px]" data-testid="textarea-profile-notes" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" disabled={updateCourseDetailsMutation.isPending} data-testid="button-save-profile-details">
                            {updateCourseDetailsMutation.isPending ? "Saving..." : "Save Details"}
                          </Button>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Partnership Tab */}
                    <TabsContent value="partnership" className="space-y-4 mt-4">
                      <Form {...onboardingForm}>
                        <form onSubmit={onboardingForm.handleSubmit(handleSaveProfilePartnership)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={onboardingForm.control}
                              name="contactPerson"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Person</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-contact-person" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={onboardingForm.control}
                              name="contactEmail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Email</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="email" data-testid="input-profile-contact-email" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={onboardingForm.control}
                              name="contactPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Phone</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-profile-contact-phone" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={onboardingForm.control}
                              name="agreedCommission"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Agreed Commission (%)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      data-testid="input-profile-commission" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={onboardingForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                  <Textarea {...field} className="min-h-[100px]" data-testid="textarea-profile-notes" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" disabled={updateOnboardingMutation.isPending} data-testid="button-save-profile-partnership">
                            {updateOnboardingMutation.isPending ? "Saving..." : "Save Partnership Info"}
                          </Button>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Credentials Tab */}
                    <TabsContent value="credentials" className="space-y-4 mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Provider Credentials
                          </CardTitle>
                          <CardDescription>
                            Golfmanager or TeeOne login credentials
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Username</Label>
                              <Input 
                                value={selectedCourseProfile?.golfmanagerUser || ""} 
                                disabled 
                                placeholder="Not configured"
                                data-testid="input-profile-gm-user"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Password</Label>
                              <Input 
                                type="password" 
                                value={selectedCourseProfile?.golfmanagerPassword || ""} 
                                disabled 
                                placeholder="Not configured"
                                data-testid="input-profile-gm-password"
                              />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Credentials are stored on the course. Use Edit Course dialog to update.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Images Tab */}
                    <TabsContent value="images" className="space-y-4 mt-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Upload Images
                          </CardTitle>
                          <CardDescription>
                            Upload up to 5 images at once. First image becomes main image if none exists.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                              uploadImagesMutation.isPending ? "opacity-50" : "hover:border-primary cursor-pointer"
                            }`}
                            onClick={() => !uploadImagesMutation.isPending && document.getElementById("image-upload-input")?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")).slice(0, 5);
                              if (files.length > 0 && selectedCourseProfile) {
                                const formData = new FormData();
                                files.forEach(file => formData.append("images", file));
                                formData.append("setAsMain", (!selectedCourseProfile.imageUrl).toString());
                                uploadImagesMutation.mutate({ courseId: selectedCourseProfile.id, formData });
                              }
                            }}
                            data-testid="dropzone-images"
                          >
                            <input
                              id="image-upload-input"
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []).slice(0, 5);
                                if (files.length > 0 && selectedCourseProfile) {
                                  const formData = new FormData();
                                  files.forEach(file => formData.append("images", file));
                                  formData.append("setAsMain", (!selectedCourseProfile.imageUrl).toString());
                                  uploadImagesMutation.mutate({ courseId: selectedCourseProfile.id, formData });
                                  e.target.value = "";
                                }
                              }}
                              data-testid="input-image-upload"
                            />
                            {uploadImagesMutation.isPending ? (
                              <GolfLoader size="sm" text="Uploading images..." />
                            ) : (
                              <div className="space-y-2">
                                <Images className="h-10 w-10 mx-auto text-muted-foreground" />
                                <p className="font-medium">Drop images here or click to browse</p>
                                <p className="text-sm text-muted-foreground">Max 5 images, JPG/PNG/WebP</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base">Current Images ({profileGalleryImages.length + (selectedCourseProfile.imageUrl ? 1 : 0)})</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedCourseProfile.imageUrl || profileGalleryImages.length > 0 ? (
                            <>
                              {/* Mobile: Horizontal scrolling gallery */}
                              <div className="sm:hidden -mx-4 px-4">
                                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                                  {selectedCourseProfile.imageUrl && (
                                    <div className="flex-shrink-0 w-36 snap-start relative">
                                      <div className="aspect-video rounded-md overflow-hidden bg-muted ring-2 ring-primary ring-offset-1">
                                        <OptimizedImage
                                          src={selectedCourseProfile.imageUrl}
                                          alt="Main image"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <Badge className="absolute bottom-1 left-1 text-xs">Main</Badge>
                                    </div>
                                  )}
                                  {profileGalleryImages.map((image) => (
                                    <div key={image.id} className="flex-shrink-0 w-36 snap-start relative">
                                      <div className="aspect-video rounded-md overflow-hidden bg-muted">
                                        <OptimizedImage
                                          src={image.imageUrl}
                                          alt={image.caption || "Gallery image"}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div className="absolute bottom-1 right-1 flex gap-1">
                                        <Button
                                          variant="secondary"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            updateCourseImageMutation.mutate({ 
                                              courseId: selectedCourseProfile.id, 
                                              imageUrl: image.imageUrl 
                                            });
                                          }}
                                          title="Set as main"
                                          data-testid={`button-set-main-${image.id}`}
                                        >
                                          <CheckSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => deleteGalleryImageMutation.mutate({ imageId: image.id, courseId: selectedCourseProfile!.id })}
                                          data-testid={`button-delete-${image.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Desktop: Grid layout */}
                              <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 gap-3">
                                {selectedCourseProfile.imageUrl && (
                                  <div className="relative group">
                                    <div className="aspect-video rounded-md overflow-hidden bg-muted ring-2 ring-primary ring-offset-2">
                                      <OptimizedImage
                                        src={selectedCourseProfile.imageUrl}
                                        alt="Main image"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <Badge className="absolute bottom-1 left-1 text-xs">Main</Badge>
                                  </div>
                                )}
                                {profileGalleryImages.map((image) => (
                                  <div key={image.id} className="relative group">
                                    <div className="aspect-video rounded-md overflow-hidden bg-muted">
                                      <OptimizedImage
                                        src={image.imageUrl}
                                        alt={image.caption || "Gallery image"}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="secondary"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          updateCourseImageMutation.mutate({ 
                                            courseId: selectedCourseProfile.id, 
                                            imageUrl: image.imageUrl 
                                          });
                                        }}
                                        title="Set as main"
                                        data-testid={`button-set-main-${image.id}`}
                                      >
                                        <CheckSquare className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => deleteGalleryImageMutation.mutate({ imageId: image.id, courseId: selectedCourseProfile!.id })}
                                        data-testid={`button-delete-${image.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Images className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No images uploaded yet</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Communications Tab */}
                    <TabsContent value="communications" className="space-y-4 mt-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add Communication
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Form {...contactLogForm}>
                            <form onSubmit={contactLogForm.handleSubmit(handleAddProfileContactLog)} className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={contactLogForm.control}
                                  name="type"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Type</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-profile-contact-type">
                                            <SelectValue placeholder="Select type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="EMAIL">
                                            <div className="flex items-center gap-2">
                                              <Mail className="h-3 w-3" />
                                              Email
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="PHONE">
                                            <div className="flex items-center gap-2">
                                              <PhoneCall className="h-3 w-3" />
                                              Phone
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="IN_PERSON">
                                            <div className="flex items-center gap-2">
                                              <UserPlus className="h-3 w-3" />
                                              In Person
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="NOTE">
                                            <div className="flex items-center gap-2">
                                              <FileText className="h-3 w-3" />
                                              Note
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={contactLogForm.control}
                                  name="direction"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Direction</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-profile-contact-direction">
                                            <SelectValue placeholder="Select direction" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="OUTBOUND">Outbound (We contacted)</SelectItem>
                                          <SelectItem value="INBOUND">Inbound (They contacted)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <FormField
                                control={contactLogForm.control}
                                name="subject"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Subject</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Brief subject or title" data-testid="input-profile-contact-subject" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={contactLogForm.control}
                                name="body"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Content</FormLabel>
                                    <FormControl>
                                      <Textarea {...field} placeholder="What was discussed..." className="min-h-[80px]" data-testid="textarea-profile-contact-body" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={contactLogForm.control}
                                name="outcome"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Outcome</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-profile-contact-outcome">
                                          <SelectValue placeholder="Select outcome" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="POSITIVE">Positive</SelectItem>
                                        <SelectItem value="NEUTRAL">Neutral</SelectItem>
                                        <SelectItem value="NEGATIVE">Negative</SelectItem>
                                        <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button type="submit" disabled={addContactLogMutation.isPending} className="w-full" data-testid="button-add-profile-contact">
                                {addContactLogMutation.isPending ? "Adding..." : "Add Entry"}
                              </Button>
                            </form>
                          </Form>
                        </CardContent>
                      </Card>

                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-3">Communication History</h4>
                        <ScrollArea className="h-[300px]">
                          {isLoadingProfileContactLogs ? (
                            <div className="py-8">
                              <GolfLoader size="sm" text="Loading communication history..." />
                            </div>
                          ) : profileContactLogs && profileContactLogs.length > 0 ? (
                            <div className="space-y-3">
                              {profileContactLogs.map((log) => {
                                const TypeIcon = log.type === "EMAIL" ? Mail 
                                  : log.type === "PHONE" ? PhoneCall 
                                  : log.type === "IN_PERSON" ? UserPlus 
                                  : FileText;
                                
                                const DirectionIcon = log.direction === "OUTBOUND" ? ArrowUpRight : ArrowDownLeft;
                                const directionColor = log.direction === "OUTBOUND" 
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800" 
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                                
                                const outcomeColor = log.outcome === "POSITIVE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : log.outcome === "NEGATIVE" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : log.outcome === "NEUTRAL" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  : log.outcome === "NO_RESPONSE" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                  : "";

                                return (
                                  <div 
                                    key={log.id} 
                                    className={`border rounded-md p-3 space-y-2 ${log.direction === "INBOUND" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                                    data-testid={`profile-contact-log-${log.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                        <Badge variant="outline">
                                          {log.type.replace("_", " ")}
                                        </Badge>
                                        <Badge variant="outline" className={directionColor}>
                                          <DirectionIcon className="h-3 w-3 mr-1" />
                                          {log.direction === "OUTBOUND" ? "Sent" : "Received"}
                                        </Badge>
                                        {log.outcome && (
                                          <Badge variant="secondary" className={outcomeColor}>
                                            {log.outcome.replace("_", " ")}
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(log.loggedAt), "PP p")}
                                      </span>
                                    </div>
                                    {log.subject && (
                                      <p className="font-medium text-sm">{log.subject}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                      {log.body}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No communication history yet
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </SheetContent>
            </Sheet>
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

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {selectedCourseIds.length} course{selectedCourseIds.length !== 1 && "s"} selected
                      </p>
                      <Button
                        onClick={handleSendEmails}
                        disabled={selectedCourseIds.length === 0 || sendEmailsMutation.isPending}
                        className="w-full sm:w-auto"
                        data-testid="button-send-emails"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sendEmailsMutation.isPending ? "Sending..." : "Send Partnership Emails"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Unmatched Inbound Emails */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownLeft className="h-5 w-5" />
                    Unmatched Inbound Emails
                    {unmatchedEmails.filter(e => !e.assignedToCourseId).length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {unmatchedEmails.filter(e => !e.assignedToCourseId).length} pending
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Emails received that couldn't be automatically matched to a course. Assign them manually.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {unmatchedEmails.filter(e => !e.assignedToCourseId).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No unmatched emails</p>
                      <p className="text-sm">All incoming emails have been matched or assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {unmatchedEmails.filter(e => !e.assignedToCourseId).map((email) => (
                        <div
                          key={email.id}
                          className="border rounded-lg p-4 space-y-3"
                          data-testid={`unmatched-email-${email.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {email.fromName || email.fromEmail}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(email.receivedAt), "MMM d, yyyy HH:mm")}
                                </span>
                              </div>
                              <p className="font-medium mt-2 truncate">
                                {email.subject || "(No subject)"}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {email.body?.substring(0, 200) || "(No content)"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select
                              onValueChange={(courseId) => {
                                assignEmailMutation.mutate({ emailId: email.id, courseId });
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-[280px]" data-testid={`select-assign-course-${email.id}`}>
                                <SelectValue placeholder="Assign to course..." />
                              </SelectTrigger>
                              <SelectContent>
                                {courses?.map((course) => (
                                  <SelectItem key={course.id} value={course.id}>
                                    {course.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteUnmatchedEmailMutation.mutate(email.id)}
                              disabled={deleteUnmatchedEmailMutation.isPending}
                              className="self-end sm:self-auto"
                              data-testid={`button-delete-email-${email.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inbox Tab - Course Email Conversations */}
          <TabsContent value="inbox">
            <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Thread List - Hidden on mobile when viewing a thread */}
              <div className={`lg:col-span-1 ${selectedThreadId ? 'hidden lg:block' : 'block'}`}>
                <Card className="h-[calc(100vh-200px)] lg:h-[calc(100vh-300px)]">
                  <CardHeader className="pb-3 px-3 lg:px-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                        <Inbox className="h-4 w-4 lg:h-5 lg:w-5" />
                        {t('inbox.title')}
                        {unansweredCount > 0 && (
                          <Badge variant="destructive" data-testid="badge-inbox-header-count">
                            {unansweredCount}
                          </Badge>
                        )}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowAlertSettings(true)}
                        data-testid="button-inbox-settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-2">
                      {(["unanswered", "all", "open", "replied", "closed", "archived", "deleted"] as const).map((filter) => (
                        <Button
                          key={filter}
                          variant={inboxFilter === filter ? "default" : "outline"}
                          size="sm"
                          className={`text-xs lg:text-sm px-2 lg:px-3 ${filter === "deleted" ? "text-destructive border-destructive/50" : ""}`}
                          onClick={() => setInboxFilter(filter)}
                          data-testid={`button-filter-${filter}`}
                        >
                          {filter === "deleted" ? (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('inbox.deleted')}
                            </>
                          ) : (
                            <>
                              {t(`inbox.${filter}`)}
                              {filter === "unanswered" && unansweredCount > 0 && (
                                <Badge variant="destructive" className="ml-1 h-4 min-w-4 p-0 text-xs">
                                  {unansweredCount}
                                </Badge>
                              )}
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-350px)] lg:h-[calc(100vh-450px)]">
                      {filteredThreads.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          {t('inbox.noEmails')}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredThreads.map((thread) => (
                            <div
                              key={thread.id}
                              className={`p-3 lg:p-3 cursor-pointer hover-elevate ${
                                selectedThreadId === thread.id ? "bg-accent" : ""
                              } ${thread.isRead !== "true" ? "bg-primary/5" : ""}`}
                              onClick={() => setSelectedThreadId(thread.id)}
                              data-testid={`row-thread-${thread.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {thread.isRead !== "true" && (
                                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                    )}
                                    <span className={`text-sm font-medium truncate ${thread.isRead !== "true" ? "font-semibold" : ""}`}>
                                      {thread.fromEmail}
                                    </span>
                                  </div>
                                  <p className="text-sm truncate text-muted-foreground">
                                    {thread.subject}
                                  </p>
                                  {thread.courseName && (
                                    <p className="text-xs text-primary truncate">
                                      {thread.courseName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <div className="flex items-center gap-1">
                                    {thread.isMuted === "true" && (
                                      <BellOff className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(thread.lastActivityAt), "MMM d")}
                                    </span>
                                  </div>
                                  <Badge 
                                    variant={
                                      thread.status === "OPEN" && thread.requiresResponse === "true" && thread.isRead !== "true" ? "destructive" :
                                      thread.status === "OPEN" && thread.requiresResponse === "true" && thread.isRead === "true" ? "secondary" :
                                      thread.status === "OPEN" ? "secondary" :
                                      thread.status === "REPLIED" ? "default" :
                                      thread.status === "CLOSED" ? "outline" :
                                      thread.status === "DELETED" ? "destructive" :
                                      "outline"
                                    }
                                    className={`text-xs ${
                                      thread.status === "OPEN" && thread.requiresResponse === "true" && thread.isRead === "true" ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" :
                                      thread.status === "REPLIED" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" :
                                      thread.status === "CLOSED" ? "bg-slate-500 hover:bg-slate-600 text-white border-slate-500" :
                                      thread.status === "ARCHIVED" ? "bg-slate-300 hover:bg-slate-400 text-slate-700 border-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-600" :
                                      thread.status === "DELETED" ? "bg-red-500 hover:bg-red-600 text-white border-red-500" :
                                      ""
                                    }`}
                                  >
                                    {thread.status === "OPEN" && thread.requiresResponse === "true" && thread.isRead !== "true"
                                      ? t('inbox.needsResponse') || "Needs Response"
                                      : thread.status === "OPEN" && thread.requiresResponse === "true" && thread.isRead === "true"
                                      ? t('inbox.open')
                                      : t(`inbox.${thread.status.toLowerCase()}`)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Message View & Reply - Full screen on mobile when viewing a thread */}
              <div className={`lg:col-span-2 ${selectedThreadId ? 'block' : 'hidden lg:block'}`}>
                <Card className="h-[calc(100vh-200px)] lg:h-[calc(100vh-300px)]">
                  {!selectedThreadId ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{t('inbox.viewThread')}</p>
                      </div>
                    </div>
                  ) : isLoadingThread || !selectedThread ? (
                    <div className="flex flex-col h-full">
                      {/* Mobile back button during loading */}
                      <div className="p-3 lg:hidden border-b">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedThreadId(null)}
                          data-testid="button-back-to-list-loading"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-center flex-1">
                        <GolfLoader size="md" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Thread Header - Mobile optimized */}
                      <CardHeader className="pb-2 lg:pb-3 border-b px-3 lg:px-6">
                        <div className="flex flex-col gap-2">
                          {/* Mobile back button and title row */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:hidden flex-shrink-0"
                              onClick={() => setSelectedThreadId(null)}
                              data-testid="button-back-to-list"
                            >
                              <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base lg:text-lg truncate">{selectedThread.subject}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1 text-sm truncate">
                                <span className="truncate">{selectedThread.fromEmail}</span>
                                {selectedThread.courseName && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="text-primary truncate hidden sm:inline">{selectedThread.courseName}</span>
                                  </>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          
                          {/* Action buttons - scrollable on mobile */}
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            <Select
                              value={selectedThread.courseId || "__none__"}
                              onValueChange={(courseId) => {
                                linkThreadToCourseMutation.mutate({ 
                                  threadId: selectedThread.id, 
                                  courseId: courseId === "__none__" ? null : courseId 
                                });
                              }}
                            >
                              <SelectTrigger className="w-[140px] lg:w-[200px] flex-shrink-0" data-testid="select-link-course">
                                <SelectValue placeholder={t('inbox.linkToCourse')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t('inbox.unlinked')}</SelectItem>
                                {courses?.map((course) => (
                                  <SelectItem key={course.id} value={course.id}>
                                    {course.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {selectedThread.status === "DELETED" ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => restoreThreadMutation.mutate(selectedThread.id)}
                                  disabled={restoreThreadMutation.isPending}
                                  data-testid="button-restore-thread"
                                >
                                  <Archive className="h-4 w-4 lg:mr-1" />
                                  <span className="hidden lg:inline">{t('inbox.restore')}</span>
                                </Button>
                                
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => {
                                    if (confirm(t('inbox.confirmPermanentDelete'))) {
                                      permanentlyDeleteThreadMutation.mutate(selectedThread.id);
                                    }
                                  }}
                                  disabled={permanentlyDeleteThreadMutation.isPending}
                                  data-testid="button-permanent-delete-thread"
                                >
                                  <Trash2 className="h-4 w-4 lg:mr-1" />
                                  <span className="hidden lg:inline">{t('inbox.permanentDelete')}</span>
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => updateThreadStatusMutation.mutate({
                                    threadId: selectedThread.id,
                                    status: selectedThread.status === "ARCHIVED" ? "OPEN" : "ARCHIVED"
                                  })}
                                  data-testid="button-archive-thread"
                                >
                                  <Archive className="h-4 w-4 lg:mr-1" />
                                  <span className="hidden lg:inline">{selectedThread.status === "ARCHIVED" ? t('inbox.reopen') : t('inbox.archive')}</span>
                                </Button>
                                
                                <Button
                                  variant={selectedThread.isMuted === "true" ? "default" : "outline"}
                                  size="sm"
                                  className="flex-shrink-0"
                                  onClick={() => muteThreadMutation.mutate({
                                    threadId: selectedThread.id,
                                    muted: selectedThread.isMuted !== "true"
                                  })}
                                  data-testid="button-mute-thread"
                                >
                                  {selectedThread.isMuted === "true" ? (
                                    <>
                                      <Bell className="h-4 w-4 lg:mr-1" />
                                      <span className="hidden lg:inline">{t('inbox.unmute')}</span>
                                    </>
                                  ) : (
                                    <>
                                      <BellOff className="h-4 w-4 lg:mr-1" />
                                      <span className="hidden lg:inline">{t('inbox.mute')}</span>
                                    </>
                                  )}
                                </Button>
                                
                                {selectedThread.status !== "CLOSED" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-shrink-0"
                                    onClick={() => updateThreadStatusMutation.mutate({
                                      threadId: selectedThread.id,
                                      status: "CLOSED"
                                    })}
                                    data-testid="button-close-thread"
                                  >
                                    <XCircle className="h-4 w-4 lg:mr-1" />
                                    <span className="hidden lg:inline">{t('inbox.close')}</span>
                                  </Button>
                                )}
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-shrink-0 text-destructive hover:text-destructive"
                                  onClick={() => deleteThreadMutation.mutate(selectedThread.id)}
                                  disabled={deleteThreadMutation.isPending}
                                  data-testid="button-delete-thread"
                                >
                                  <Trash2 className="h-4 w-4 lg:mr-1" />
                                  <span className="hidden lg:inline">{t('inbox.delete')}</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      {/* Messages */}
                      <ScrollArea className="flex-1 p-3 lg:p-4">
                        {!selectedThread.messages || selectedThread.messages.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            {t('inbox.noMessages')}
                          </div>
                        ) : (
                          <div className="space-y-3 lg:space-y-4">
                            {selectedThread.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`p-3 lg:p-4 rounded-lg ${
                                  msg.direction === "OUT" 
                                    ? "bg-primary/10 ml-4 lg:ml-8" 
                                    : "bg-muted mr-4 lg:mr-8"
                                }`}
                                data-testid={`message-${msg.id}`}
                              >
                                <div className="flex items-center justify-between mb-2 gap-2">
                                  <span className="text-sm font-medium truncate">
                                    {msg.direction === "OUT" ? t('inbox.you') : msg.fromEmail}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(msg.receivedAt), "PPp")}
                                  </span>
                                </div>
                                <div className="text-sm whitespace-pre-wrap break-words">
                                  {msg.bodyText || t('inbox.noContent')}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      {/* Reply Box - Mobile optimized */}
                      <div className="p-3 lg:p-4 border-t">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={t('inbox.replyPlaceholder')}
                            className="flex-1 min-h-[60px] lg:min-h-[80px]"
                            data-testid="textarea-reply"
                          />
                          <Button
                            className="w-full sm:w-auto"
                            onClick={() => {
                              if (selectedThreadId && replyText.trim()) {
                                sendReplyMutation.mutate({ threadId: selectedThreadId, body: replyText });
                              }
                            }}
                            disabled={!replyText.trim() || sendReplyMutation.isPending}
                            data-testid="button-send-reply"
                          >
                            <Reply className="h-4 w-4 mr-1" />
                            {t('inbox.sendReply')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Alert Settings Dialog */}
            <Dialog open={showAlertSettings} onOpenChange={setShowAlertSettings}>
              <DialogContent data-testid="dialog-alert-settings">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t('inbox.alertSettings')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('inbox.alertSettingsDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <Label>{t('inbox.emailAlerts')}</Label>
                    <Switch
                      checked={alertSettings?.emailAlerts === "true"}
                      onCheckedChange={(checked) => {
                        updateAlertSettingsMutation.mutate({ emailAlerts: checked });
                      }}
                      data-testid="switch-email-alerts"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('inbox.alertThreshold')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="72"
                        value={alertSettings?.alertThresholdHours ?? 2}
                        onChange={(e) => {
                          const hours = parseInt(e.target.value);
                          if (hours > 0 && hours <= 72) {
                            updateAlertSettingsMutation.mutate({ alertThresholdHours: hours });
                          }
                        }}
                        className="w-20"
                        data-testid="input-alert-threshold"
                      />
                      <span className="text-sm text-muted-foreground">{t('inbox.hours')}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('inbox.alertEmail')}</Label>
                    <Input
                      type="email"
                      placeholder={t('inbox.useAccountEmail')}
                      value={alertSettings?.alertEmail ?? ""}
                      onChange={(e) => {
                        updateAlertSettingsMutation.mutate({ alertEmail: e.target.value || null });
                      }}
                      data-testid="input-alert-email"
                    />
                    <p className="text-xs text-muted-foreground">{t('inbox.useAccountEmail')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    External API Keys
                  </CardTitle>
                  <CardDescription>
                    Manage API keys for AI CEO and external integrations. These keys allow programmatic access to the platform.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateApiKeyDialog(true)}
                  data-testid="button-create-api-key"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingApiKeys ? (
                  <div className="py-12">
                    <GolfLoader size="md" text="Loading API keys..." />
                  </div>
                ) : apiKeys && apiKeys.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Key Prefix</TableHead>
                          <TableHead>Scopes</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((apiKey) => (
                          <TableRow key={apiKey.id} data-testid={`row-api-key-${apiKey.id}`}>
                            <TableCell>
                              <span className="font-medium">{apiKey.name}</span>
                            </TableCell>
                            <TableCell>
                              <code className="text-sm bg-muted px-2 py-1 rounded">{apiKey.keyPrefix}...</code>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {apiKey.scopes.map((scope) => (
                                  <Badge key={scope} variant="secondary" className="text-xs">
                                    {scope}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(apiKey.createdAt), "PP")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {apiKey.lastUsedAt 
                                  ? format(new Date(apiKey.lastUsedAt), "PP") 
                                  : "Never"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {apiKey.isActive === "true" ? (
                                <Badge variant="default" className="bg-green-600">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                  <ShieldOff className="h-3 w-3 mr-1" />
                                  Revoked
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {apiKey.isActive === "true" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => revokeApiKeyMutation.mutate(apiKey.id)}
                                  disabled={revokeApiKeyMutation.isPending}
                                  data-testid={`button-revoke-api-key-${apiKey.id}`}
                                >
                                  <ShieldOff className="h-4 w-4 mr-1" />
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No API keys created yet</p>
                    <p className="text-sm">Create an API key to enable external access to the platform</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Create API Key Dialog */}
            <Dialog open={showCreateApiKeyDialog} onOpenChange={setShowCreateApiKeyDialog}>
              <DialogContent className="max-w-[95vw] sm:max-w-md" data-testid="dialog-create-api-key">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Create API Key
                  </DialogTitle>
                  <DialogDescription>
                    Create a new API key for external integrations. The key will only be shown once after creation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key-name">Name *</Label>
                    <Input
                      id="api-key-name"
                      placeholder="e.g., AI CEO Integration"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      data-testid="input-api-key-name"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Scopes</Label>
                    <div className="space-y-2">
                      {[
                        { value: "read:courses", label: "Read Courses" },
                        { value: "read:bookings", label: "Read Bookings" },
                        { value: "write:bookings", label: "Write Bookings" },
                        { value: "read:analytics", label: "Read Analytics" },
                        { value: "read:users", label: "Read Users" },
                      ].map((scope) => (
                        <div key={scope.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`scope-${scope.value}`}
                            checked={newApiKeyScopes.includes(scope.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewApiKeyScopes([...newApiKeyScopes, scope.value]);
                              } else {
                                setNewApiKeyScopes(newApiKeyScopes.filter((s) => s !== scope.value));
                              }
                            }}
                            data-testid={`checkbox-scope-${scope.value}`}
                          />
                          <Label htmlFor={`scope-${scope.value}`} className="text-sm font-normal cursor-pointer">
                            {scope.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiration (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-expiration-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newApiKeyExpiration 
                            ? format(newApiKeyExpiration, "PPP") 
                            : "No expiration"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newApiKeyExpiration}
                          onSelect={setNewApiKeyExpiration}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                        {newApiKeyExpiration && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => setNewApiKeyExpiration(undefined)}
                            >
                              Clear expiration
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateApiKeyDialog(false);
                      setNewApiKeyName("");
                      setNewApiKeyScopes([]);
                      setNewApiKeyExpiration(undefined);
                    }}
                    data-testid="button-cancel-create-api-key"
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!newApiKeyName.trim()) {
                        toast({
                          title: "Name required",
                          description: "Please enter a name for the API key",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (newApiKeyScopes.length === 0) {
                        toast({
                          title: "Scopes required",
                          description: "Please select at least one scope",
                          variant: "destructive",
                        });
                        return;
                      }
                      createApiKeyMutation.mutate({
                        name: newApiKeyName.trim(),
                        scopes: newApiKeyScopes,
                        expiresAt: newApiKeyExpiration?.toISOString(),
                      });
                    }}
                    disabled={createApiKeyMutation.isPending}
                    data-testid="button-confirm-create-api-key"
                    className="w-full sm:w-auto"
                  >
                    {createApiKeyMutation.isPending ? "Creating..." : "Create API Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Created API Key Display Dialog */}
            <Dialog 
              open={!!createdApiKey} 
              onOpenChange={(open) => {
                if (!open) {
                  setCreatedApiKey(null);
                  setShowCreateApiKeyDialog(false);
                }
              }}
            >
              <DialogContent className="max-w-[95vw] sm:max-w-lg" data-testid="dialog-api-key-created">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API key now. It will not be shown again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-medium mb-1">Important</p>
                        <p>Make sure to copy this key and store it securely. You won't be able to see it again.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Your API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={createdApiKey || ""}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-created-api-key"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (createdApiKey) {
                            navigator.clipboard.writeText(createdApiKey);
                            toast({
                              title: "Copied!",
                              description: "API key copied to clipboard",
                            });
                          }
                        }}
                        data-testid="button-copy-api-key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreatedApiKey(null);
                      setShowCreateApiKeyDialog(false);
                    }}
                    data-testid="button-close-api-key-created"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md" data-testid="dialog-edit-user">
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
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingUser(null)}
                    data-testid="button-cancel-edit"
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    data-testid="button-save-user"
                    className="w-full sm:w-auto"
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
          <DialogContent className="max-w-[95vw] sm:max-w-md" data-testid="dialog-delete-user">
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
                <p className="text-sm text-muted-foreground break-all">{deletingUser.email}</p>
                <div>
                  {deletingUser.isAdmin === "true" ? (
                    <Badge variant="default">Admin</Badge>
                  ) : (
                    <Badge variant="secondary">User</Badge>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingUser(null)}
                data-testid="button-cancel-delete"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
                className="w-full sm:w-auto"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Course Dialog */}
        <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-course">
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
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium text-sm sm:text-base">{editingCourse.name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {editingCourse.city}, {editingCourse.province}
                  </p>
                </div>

                {/* Course Image Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Course Image</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Current Image</Label>
                      {editingCourse.imageUrl ? (
                        <div className="space-y-2">
                          <div className="relative w-full h-32 sm:h-32 rounded-md overflow-hidden bg-muted">
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
                            className="w-full min-h-[44px]"
                            onClick={handleDeleteCourseImage}
                            data-testid="button-delete-course-image"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
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
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
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
                          className="flex-1 min-h-[44px]"
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
                          className="flex-1 min-h-[44px]"
                          data-testid="button-save-course-image"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updateCourseImageMutation.isPending ? "Saving..." : "Set URL"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gallery Images Section */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Images className="h-4 w-4" />
                      Gallery Images
                    </Label>
                    <Badge variant="secondary" data-testid="badge-gallery-count">
                      {galleryImages.length} images
                    </Badge>
                  </div>
                  
                  {/* Existing Gallery Images - Horizontal scroll on mobile, vertical list on desktop */}
                  {galleryImages.length > 0 && (
                    <>
                      {/* Mobile: Horizontal scrolling gallery */}
                      <div className="sm:hidden -mx-3 px-3">
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                          {galleryImages.map((image, index) => (
                            <div 
                              key={image.id} 
                              className="flex-shrink-0 w-32 snap-start"
                              data-testid={`gallery-image-card-${index}`}
                            >
                              <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted">
                                <img 
                                  src={image.imageUrl} 
                                  alt={image.caption || `Image ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  data-testid={`gallery-image-preview-${index}`}
                                />
                                <div className="absolute bottom-1 right-1 flex gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8"
                                    onClick={() => deleteGalleryImageMutation.mutate({ imageId: image.id, courseId: editingCourse!.id })}
                                    disabled={deleteGalleryImageMutation.isPending}
                                    data-testid={`button-gallery-delete-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              {image.caption && (
                                <p className="text-xs mt-1 truncate" data-testid={`gallery-image-caption-${index}`}>
                                  {image.caption}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Desktop: Vertical list */}
                      <div className="hidden sm:block space-y-2 max-h-48 overflow-y-auto">
                        {galleryImages.map((image, index) => (
                          <div 
                            key={image.id} 
                            className="flex items-center gap-2 p-2 bg-muted rounded-md"
                            data-testid={`gallery-image-row-${index}`}
                          >
                            <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0">
                              <img 
                                src={image.imageUrl} 
                                alt={image.caption || `Image ${index + 1}`}
                                className="w-full h-full object-cover"
                                data-testid={`gallery-image-preview-${index}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground truncate" data-testid={`gallery-image-url-${index}`}>
                                {image.imageUrl}
                              </p>
                              {image.caption && (
                                <p className="text-xs font-medium truncate" data-testid={`gallery-image-caption-${index}`}>
                                  {image.caption}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleMoveGalleryImage(image.id, 'up')}
                                disabled={index === 0 || reorderGalleryImagesMutation.isPending}
                                data-testid={`button-gallery-move-up-${index}`}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleMoveGalleryImage(image.id, 'down')}
                                disabled={index === galleryImages.length - 1 || reorderGalleryImagesMutation.isPending}
                                data-testid={`button-gallery-move-down-${index}`}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteGalleryImageMutation.mutate({ imageId: image.id, courseId: editingCourse!.id })}
                                disabled={deleteGalleryImageMutation.isPending}
                                data-testid={`button-gallery-delete-${index}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Add New Gallery Image */}
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs text-muted-foreground">Add New Gallery Image</Label>
                    <div className="flex flex-col gap-2">
                      <Input
                        value={newGalleryImageUrl}
                        onChange={(e) => setNewGalleryImageUrl(e.target.value)}
                        placeholder="/stock_images/gallery.jpg"
                        className="font-mono text-sm"
                        data-testid="input-gallery-image-url"
                      />
                      <Input
                        value={newGalleryCaption}
                        onChange={(e) => setNewGalleryCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="text-sm"
                        data-testid="input-gallery-caption"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto min-h-[44px]"
                      onClick={() => {
                        if (!newGalleryImageUrl || !newGalleryImageUrl.trim()) {
                          toast({
                            title: "Invalid Input",
                            description: "Please enter an image URL",
                            variant: "destructive",
                          });
                          return;
                        }
                        addGalleryImageMutation.mutate({
                          courseId: editingCourse.id,
                          imageUrl: newGalleryImageUrl,
                          caption: newGalleryCaption || undefined,
                        });
                      }}
                      disabled={!newGalleryImageUrl || addGalleryImageMutation.isPending}
                      data-testid="button-add-gallery-image"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {addGalleryImageMutation.isPending ? "Adding..." : "Add to Gallery"}
                    </Button>
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
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-user-bookings">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Booking History
              </DialogTitle>
              {viewingUserBookings && (
                <DialogDescription className="break-all">
                  Showing all bookings for {viewingUserBookings.firstName} {viewingUserBookings.lastName} ({viewingUserBookings.email})
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4">
              {isLoadingUserBookings ? (
                <div className="py-12">
                  <GolfLoader size="md" text="Loading bookings..." />
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
                  <TableCard
                    columns={[
                      {
                        key: "courseId" as keyof BookingRequest,
                        label: "Course",
                        render: (value) => {
                          const course = courses?.find(c => c.id === value);
                          return <span className="font-medium">{course?.name || (value as string)}</span>;
                        },
                      },
                      {
                        key: "teeTime",
                        label: "Tee Time",
                        render: (value) => format(new Date(value as string), "PPp"),
                      },
                      {
                        key: "players",
                        label: "Players",
                        hideOnMobile: true,
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (value) => getStatusBadge(value as string),
                      },
                      {
                        key: "createdAt",
                        label: "Requested",
                        hideOnMobile: true,
                        render: (value) => (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(value as string), "PP")}
                          </span>
                        ),
                      },
                    ] as TableCardColumn<BookingRequest>[]}
                    data={userBookings as BookingRequest[]}
                    keyExtractor={(row) => row.id}
                    emptyMessage="No bookings found for this user"
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No bookings found for this user
                </div>
              )}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewingUserBookings(null)}
                data-testid="button-close-bookings"
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Onboarding Dialog */}
        <Dialog open={!!editingOnboarding} onOpenChange={(open) => !open && setEditingOnboarding(null)}>
          <DialogContent className="max-w-lg" data-testid="dialog-edit-onboarding">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Partnership Details
              </DialogTitle>
              <DialogDescription>
                Update contact information and partnership details
              </DialogDescription>
            </DialogHeader>
            {editingOnboarding && (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium">{editingOnboarding.courseName}</p>
                  <p className="text-sm text-muted-foreground">{editingOnboarding.city}</p>
                </div>

                <Form {...onboardingForm}>
                  <form onSubmit={onboardingForm.handleSubmit(handleSaveOnboarding)} className="space-y-4">
                    <FormField
                      control={onboardingForm.control}
                      name="contactPerson"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., John Smith"
                              data-testid="input-onboarding-contact-person"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={onboardingForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="e.g., contact@golfcourse.com"
                              data-testid="input-onboarding-contact-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={onboardingForm.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., +34 123 456 789"
                              data-testid="input-onboarding-contact-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={onboardingForm.control}
                      name="agreedCommission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agreed Commission (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                placeholder="20"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-onboarding-commission"
                                className="pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                %
                              </span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={onboardingForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Add any relevant notes about the partnership..."
                              className="min-h-[100px]"
                              data-testid="input-onboarding-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditingOnboarding(null)}
                        data-testid="button-cancel-edit-onboarding"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateOnboardingMutation.isPending}
                        data-testid="button-save-onboarding"
                      >
                        {updateOnboardingMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Contact Logs Dialog */}
        <Dialog open={!!contactLogsCourse} onOpenChange={(open) => !open && setContactLogsCourse(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh]" data-testid="dialog-contact-logs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Contact History
              </DialogTitle>
              {contactLogsCourse && (
                <DialogDescription>
                  Communication history with {contactLogsCourse.courseName}
                </DialogDescription>
              )}
            </DialogHeader>
            {contactLogsCourse && (
              <div className="space-y-4">
                {/* Add New Contact Log Form */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add New Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...contactLogForm}>
                      <form onSubmit={contactLogForm.handleSubmit(handleAddContactLog)} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={contactLogForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-contact-log-type">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="EMAIL">
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        Email
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="PHONE">
                                      <div className="flex items-center gap-2">
                                        <PhoneCall className="h-3 w-3" />
                                        Phone
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="IN_PERSON">
                                      <div className="flex items-center gap-2">
                                        <UserPlus className="h-3 w-3" />
                                        In Person
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="NOTE">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3" />
                                        Note
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={contactLogForm.control}
                            name="direction"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Direction</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-contact-log-direction">
                                      <SelectValue placeholder="Select direction" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="OUTBOUND">Outbound (We contacted)</SelectItem>
                                    <SelectItem value="INBOUND">Inbound (They contacted)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={contactLogForm.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subject (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Brief subject or title"
                                  data-testid="input-contact-log-subject"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={contactLogForm.control}
                          name="body"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Content</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="What was discussed or communicated..."
                                  className="min-h-[80px]"
                                  data-testid="input-contact-log-body"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={contactLogForm.control}
                          name="outcome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Outcome (Optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-contact-log-outcome">
                                    <SelectValue placeholder="Select outcome" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="POSITIVE">Positive</SelectItem>
                                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                                  <SelectItem value="NEGATIVE">Negative</SelectItem>
                                  <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={addContactLogMutation.isPending}
                          className="w-full"
                          data-testid="button-add-contact-log"
                        >
                          {addContactLogMutation.isPending ? "Adding..." : "Add Entry"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                {/* Contact Logs Timeline */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">History</h4>
                  <ScrollArea className="h-[300px]">
                    {isLoadingContactLogs ? (
                      <div className="py-8">
                        <GolfLoader size="sm" text="Loading contact history..." />
                      </div>
                    ) : contactLogs && contactLogs.length > 0 ? (
                      <div className="space-y-3">
                        {contactLogs.map((log) => {
                          const TypeIcon = log.type === "EMAIL" ? Mail 
                            : log.type === "PHONE" ? PhoneCall 
                            : log.type === "IN_PERSON" ? UserPlus 
                            : FileText;
                          
                          const DirectionIcon = log.direction === "OUTBOUND" ? ArrowUpRight : ArrowDownLeft;
                          const directionColor = log.direction === "OUTBOUND" 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                          
                          const outcomeColor = log.outcome === "POSITIVE" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : log.outcome === "NEGATIVE" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : log.outcome === "NEUTRAL" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            : log.outcome === "NO_RESPONSE" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            : "";

                          return (
                            <div 
                              key={log.id} 
                              className={`border rounded-md p-3 space-y-2 ${log.direction === "INBOUND" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                              data-testid={`contact-log-${log.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                  <Badge variant="outline">
                                    {log.type.replace("_", " ")}
                                  </Badge>
                                  <Badge variant="outline" className={directionColor}>
                                    <DirectionIcon className="h-3 w-3 mr-1" />
                                    {log.direction === "OUTBOUND" ? "Sent" : "Received"}
                                  </Badge>
                                  {log.outcome && (
                                    <Badge variant="secondary" className={outcomeColor}>
                                      {log.outcome.replace("_", " ")}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(log.loggedAt), "PP p")}
                                </span>
                              </div>
                              {log.subject && (
                                <p className="font-medium text-sm">{log.subject}</p>
                              )}
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {log.body}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No contact history yet
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactLogsCourse(null)}
                data-testid="button-close-contact-logs"
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
