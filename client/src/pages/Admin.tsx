import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { Separator } from "@/components/ui/separator";
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
import { Mail, Send, CheckCircle2, XCircle, Clock, Image, Save, Upload, Trash2, Users, Edit, AlertTriangle, BarChart3, Percent, DollarSign, CheckSquare, ArrowRight, Phone, User, Handshake, Key, CircleDot, ChevronDown, ExternalLink, Search, ArrowUpDown, Download, FileSpreadsheet, MessageSquare, Plus, History, FileText, PhoneCall, UserPlus, ChevronUp, Images, ArrowUpRight, ArrowDownLeft, Lock, Inbox, Reply, Archive, Settings, Bell, BellOff, ArrowLeft, CalendarIcon, MoreHorizontal, Copy, ShieldCheck, ShieldOff, GripVertical, Sparkles, FileCheck, Contact, Paperclip, Globe, Loader2, RefreshCw, Star } from "lucide-react";
import { GolfLoader } from "@/components/GolfLoader";
import { EmailConfirmDialog } from "@/components/EmailConfirmDialog";
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
import type { GolfCourse, BookingRequest, CourseContactLog, InsertCourseContactLog, CourseImage, CourseDocument, CourseRatePeriod, CourseContact, PartnershipForm, EmailLog } from "@shared/schema";
import { CONTACT_LOG_TYPES, EMAIL_LOG_TYPES } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInDays } from "date-fns";
import * as XLSX from "xlsx";

const DEFAULT_EMAIL_TEMPLATE = {
  subject: "Partnership inquiry – new guests for [COURSE_NAME]",
  body: `Dear [COURSE_NAME] team,

My name is [SENDER_NAME] and I run a new tee-time finder for golfers on the Costa del Sol.

Our guests are mainly international golfers staying between Sotogrande and Málaga, and we would like to send more players to your course.

We are currently establishing partnerships with courses in the region and would be very interested in learning about your terms for collaboration.

Could you please send us:
– Your current commission structure or partnership terms
– A draft contract or agreement template you use with booking agents

We are flexible and open to discussing the details that work best for both parties.

Kind regards,
[SENDER_NAME]

———

Estimado equipo de [COURSE_NAME],

Me llamo [SENDER_NAME] y gestiono una nueva plataforma de reservas de green fees en la Costa del Sol.

Nuestros clientes son principalmente golfistas internacionales entre Sotogrande y Málaga y nos gustaría enviar más jugadores a su campo.

Actualmente estamos estableciendo acuerdos con campos de la región y nos interesaría mucho conocer sus condiciones de colaboración.

¿Podrían enviarnos?
– Su estructura de comisiones actual o condiciones de colaboración
– Un borrador de contrato o modelo de acuerdo que utilicen con agentes de reservas

Somos flexibles y estamos abiertos a negociar los detalles que mejor convengan a ambas partes.

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

type AffiliateEmailCourse = {
  id: string;
  name: string;
  city: string;
  email: string | null;
  membersOnly: string;
  lastAffiliateSentAt: string | null;
  emailCount: number;
  onboardingStage: string | null;
  totalOpens: number;
  lastOpenedAt: string | null;
};

type SentAffiliateEmail = {
  id: string;
  courseId: string;
  subject: string;
  body: string;
  sentAt: string | null;
  status: string;
  errorMessage: string | null;
  trackingToken: string | null;
  openedAt: string | null;
  openCount: number;
  courseName?: string;
  courseEmail?: string;
};

const MAX_EMAIL_BATCH = 10;

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

type RatePeriodWithCourse = {
  id: string;
  courseId: string;
  courseName: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  year: number | null;
  rackRate: number;
  netRate: number;
  kickbackPercent: number;
  currency: string;
  notes: string | null;
  isVerified: string;
  createdAt: string | null;
};

type CourseContactWithCourse = {
  id: string;
  courseId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: string;
  notes: string | null;
};

type BookingNotificationWithDetails = {
  id: string;
  bookingId: string;
  type: string;
  status: string;
  createdAt: string;
  booking?: BookingRequest;
  courseName?: string;
};

type FollowUpItem = {
  courseId: string;
  courseName: string;
  stage: string;
  outreachSentAt: string;
  nextFollowUpAt: string;
  daysOverdue: number;
  contactPerson: string | null;
  contactEmail: string | null;
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
  golfmanagerV1User: z.string().optional(),
  golfmanagerV1Password: z.string().optional(),
  golfmanagerUser: z.string().optional(),
  golfmanagerPassword: z.string().optional(),
  teeoneIdEmpresa: z.string().optional(),
  teeoneIdTeeSheet: z.string().optional(),
  teeoneApiUser: z.string().optional(),
  teeoneApiPassword: z.string().optional(),
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

interface SortableImageItem {
  id: string;
  imageUrl: string;
  isMain: boolean;
  caption?: string | null;
}

interface CredentialsFormData {
  golfmanagerV1User?: string;
  golfmanagerV1Password?: string;
  golfmanagerUser?: string;
  golfmanagerPassword?: string;
  teeoneIdEmpresa?: number;
  teeoneIdTeeSheet?: number;
  teeoneApiUser?: string;
  teeoneApiPassword?: string;
}

function CredentialsEditor({ 
  course, 
  onSave,
  isSaving 
}: { 
  course: GolfCourse | null; 
  onSave: (data: CredentialsFormData) => Promise<void>;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [gmV1User, setGmV1User] = useState(course?.golfmanagerV1User || "");
  const [gmV1Password, setGmV1Password] = useState(course?.golfmanagerV1Password || "");
  const [gmV3User, setGmV3User] = useState(course?.golfmanagerUser || "");
  const [gmV3Password, setGmV3Password] = useState(course?.golfmanagerPassword || "");
  const [teeoneEmpresa, setTeeoneEmpresa] = useState(course?.teeoneIdEmpresa?.toString() || "");
  const [teeoneTeeSheet, setTeeoneTeeSheet] = useState(course?.teeoneIdTeeSheet?.toString() || "");
  const [teeoneUser, setTeeoneUser] = useState(course?.teeoneApiUser || "");
  const [teeonePassword, setTeeonePassword] = useState(course?.teeoneApiPassword || "");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setGmV1User(course?.golfmanagerV1User || "");
    setGmV1Password(course?.golfmanagerV1Password || "");
    setGmV3User(course?.golfmanagerUser || "");
    setGmV3Password(course?.golfmanagerPassword || "");
    setTeeoneEmpresa(course?.teeoneIdEmpresa?.toString() || "");
    setTeeoneTeeSheet(course?.teeoneIdTeeSheet?.toString() || "");
    setTeeoneUser(course?.teeoneApiUser || "");
    setTeeonePassword(course?.teeoneApiPassword || "");
    setHasChanges(false);
  }, [course]);

  const handleSave = async () => {
    try {
      await onSave({
        golfmanagerV1User: gmV1User || undefined,
        golfmanagerV1Password: gmV1Password || undefined,
        golfmanagerUser: gmV3User || undefined,
        golfmanagerPassword: gmV3Password || undefined,
        teeoneIdEmpresa: teeoneEmpresa ? parseInt(teeoneEmpresa, 10) : undefined,
        teeoneIdTeeSheet: teeoneTeeSheet ? parseInt(teeoneTeeSheet, 10) : undefined,
        teeoneApiUser: teeoneUser || undefined,
        teeoneApiPassword: teeonePassword || undefined,
      });
      setHasChanges(false);
      toast({ title: "Credentials saved", description: "API credentials have been updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save credentials", variant: "destructive" });
    }
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!text) {
      toast({ title: "Nothing to copy", description: `${label} is empty`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Golfmanager V1 (Legacy)
          </CardTitle>
          <CardDescription>
            Old Golfmanager API credentials (short username format)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>V1 Username</Label>
              <div className="flex gap-2">
                <Input 
                  value={gmV1User}
                  onChange={handleChange(setGmV1User)}
                  placeholder="e.g. SZc5XNpGd0"
                  data-testid="input-profile-gm-v1-user"
                />
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(gmV1User, "V1 Username")}
                  data-testid="button-copy-gm-v1-user"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>V1 Password</Label>
              <div className="flex gap-2">
                <Input 
                  type="password"
                  value={gmV1Password}
                  onChange={handleChange(setGmV1Password)}
                  placeholder="V1 API password"
                  data-testid="input-profile-gm-v1-password"
                />
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(gmV1Password, "V1 Password")}
                  data-testid="button-copy-gm-v1-password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Golfmanager V3 (Current)
          </CardTitle>
          <CardDescription>
            Current Golfmanager API credentials (email login format)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>V3 Email/Username</Label>
              <div className="flex gap-2">
                <Input 
                  value={gmV3User}
                  onChange={handleChange(setGmV3User)}
                  placeholder="e.g. user@example.com"
                  data-testid="input-profile-gm-v3-user"
                />
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(gmV3User, "V3 Username")}
                  data-testid="button-copy-gm-v3-user"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>V3 Password</Label>
              <div className="flex gap-2">
                <Input 
                  type="password"
                  value={gmV3Password}
                  onChange={handleChange(setGmV3Password)}
                  placeholder="V3 API password"
                  data-testid="input-profile-gm-v3-password"
                />
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={() => copyToClipboard(gmV3Password, "V3 Password")}
                  data-testid="button-copy-gm-v3-password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            TeeOne API Credentials
          </CardTitle>
          <CardDescription>
            Credentials for TeeOne booking system (El Paraíso, Marbella Golf, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ID Empresa (Company ID)</Label>
              <Input 
                value={teeoneEmpresa}
                onChange={handleChange(setTeeoneEmpresa)}
                placeholder="e.g. 123"
                data-testid="input-profile-teeone-empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>ID TeeSheet</Label>
              <Input 
                value={teeoneTeeSheet}
                onChange={handleChange(setTeeoneTeeSheet)}
                placeholder="e.g. 456"
                data-testid="input-profile-teeone-teesheet"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Username</Label>
              <Input 
                value={teeoneUser}
                onChange={handleChange(setTeeoneUser)}
                placeholder="TeeOne username"
                data-testid="input-profile-teeone-user"
              />
            </div>
            <div className="space-y-2">
              <Label>API Password</Label>
              <Input 
                type="password"
                value={teeonePassword}
                onChange={handleChange(setTeeonePassword)}
                placeholder="TeeOne password"
                data-testid="input-profile-teeone-password"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isSaving}
          data-testid="button-save-credentials"
        >
          {isSaving ? "Saving..." : "Save Credentials"}
        </Button>
      </div>
    </div>
  );
}

function SortableImage({ 
  item, 
  onDelete, 
  onSetMain,
  isDeleting 
}: { 
  item: SortableImageItem; 
  onDelete: () => void; 
  onSetMain: () => void;
  isDeleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? 'ring-2 ring-primary shadow-lg' : ''}`}
    >
      <div className={`aspect-video rounded-md overflow-hidden bg-muted ${item.isMain ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <OptimizedImage
          src={item.imageUrl}
          alt={item.caption || (item.isMain ? "Main image" : "Gallery image")}
          className="w-full h-full object-cover"
        />
      </div>
      {item.isMain && (
        <Badge className="absolute bottom-1 left-1 text-xs">Main</Badge>
      )}
      <div 
        className="absolute top-1 left-1 cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-white" />
      </div>
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!item.isMain && (
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6"
            onClick={onSetMain}
            title="Set as main"
            data-testid={`button-set-main-${item.id}`}
          >
            <CheckSquare className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          className="h-6 w-6"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete image"
          data-testid={`button-delete-${item.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ContactFormTab({ 
  contact, 
  role, 
  label, 
  courseId, 
  color 
}: { 
  contact: CourseContactWithCourse | undefined; 
  role: string; 
  label: string;
  courseId: string;
  color: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(contact?.name || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  
  useEffect(() => {
    setName(contact?.name || "");
    setEmail(contact?.email || "");
    setPhone(contact?.phone || "");
  }, [contact]);

  const saveContactMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/admin/courses/${courseId}/contacts`, "POST", {
        role,
        name,
        email,
        phone,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: `${label} contact saved` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", courseId, "contacts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save contact", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className={`p-4 border rounded-md ${color}`}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={`${role}-name`} className="text-xs text-muted-foreground">Name</Label>
          <Input 
            id={`${role}-name`}
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
            data-testid={`input-${label.toLowerCase()}-name`}
          />
        </div>
        <div>
          <Label htmlFor={`${role}-email`} className="text-xs text-muted-foreground">Email</Label>
          <Input 
            id={`${role}-email`}
            type="email"
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            data-testid={`input-${label.toLowerCase()}-email`}
          />
        </div>
        <div>
          <Label htmlFor={`${role}-phone`} className="text-xs text-muted-foreground">Phone</Label>
          <Input 
            id={`${role}-phone`}
            value={phone} 
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 123 456 789"
            data-testid={`input-${label.toLowerCase()}-phone`}
          />
        </div>
        <Button 
          onClick={() => saveContactMutation.mutate()}
          disabled={saveContactMutation.isPending || !courseId}
          size="sm"
          data-testid={`button-save-${label.toLowerCase()}-contact`}
        >
          <Save className="h-3 w-3 mr-1" />
          {saveContactMutation.isPending ? "Saving..." : `Save ${label} Contact`}
        </Button>
      </div>
    </div>
  );
}

interface ZestPendingFacility {
  id: string;
  name: string;
  country: string;
  city: string;
  status: string;
  holes: number;
  onZestSince: string;
}

interface ZestAutomationResponse {
  success: boolean;
  message: string;
  facilitiesProcessed?: number;
  facilities?: ZestPendingFacility[];
  error?: string;
}

interface ZestPricingEntry {
  courseId: string;
  courseName: string;
  zestFacilityId: number;
  averageCommissionPercent: number | null;
  lastSyncedAt: string | null;
  syncStatus: string;
  pricingJson: {
    facilityName: string;
    syncDate: string;
    greenFeePricing: Array<{
      players: number;
      price: { amount: number; currency: string };
      netRate: { amount: number; currency: string };
      publicRate: { amount: number; currency: string };
      commissionPercent: number;
    }>;
    extraProducts: Array<{
      mid: number;
      name: string;
      category: string;
      price: { amount: number; currency: string };
      netRate: { amount: number; currency: string };
      publicRate: { amount: number; currency: string };
      commissionPercent: number;
    }>;
  };
}

function EmailLogTab({ 
  courses, 
  emailLogFilter, 
  setEmailLogFilter, 
  emailLogPage, 
  setEmailLogPage,
  emailLogLimit 
}: { 
  courses: GolfCourse[];
  emailLogFilter: string;
  setEmailLogFilter: (filter: string) => void;
  emailLogPage: number;
  setEmailLogPage: (page: number) => void;
  emailLogLimit: number;
}) {
  const emailLogsQuery = useQuery<{ logs: EmailLog[]; total: number }>({
    queryKey: ["/api/admin/email-logs", emailLogFilter, emailLogPage, emailLogLimit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (emailLogFilter !== "all") {
        params.set("emailType", emailLogFilter);
      }
      params.set("limit", String(emailLogLimit));
      params.set("offset", String(emailLogPage * emailLogLimit));
      const response = await fetch(`/api/admin/email-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch email logs");
      return response.json();
    },
  });

  const emailLogs = emailLogsQuery.data?.logs || [];
  const totalEmailLogs = emailLogsQuery.data?.total || 0;
  const totalPages = Math.ceil(totalEmailLogs / emailLogLimit);

  const getCourseName = (courseId: string | null) => {
    if (!courseId) return "-";
    const course = courses.find(c => c.id === courseId);
    return course?.name || courseId;
  };

  const getEmailTypeBadge = (type: string) => {
    switch (type) {
      case "CUSTOMER_CONFIRMATION":
        return <Badge variant="default" className="text-xs">Customer</Badge>;
      case "COURSE_NOTIFICATION":
        return <Badge variant="secondary" className="text-xs">Course</Badge>;
      case "REVIEW_REQUEST":
        return <Badge variant="outline" className="text-xs">Review</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <Badge className="bg-green-100 text-green-700 text-xs">Sent</Badge>;
      case "FAILED":
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Log
          </CardTitle>
          <CardDescription>
            Track all booking-related emails sent to customers and courses
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={emailLogFilter} onValueChange={(value) => { setEmailLogFilter(value); setEmailLogPage(0); }}>
            <SelectTrigger className="w-[180px]" data-testid="select-email-log-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="CUSTOMER_CONFIRMATION">Customer Confirmation</SelectItem>
              <SelectItem value="COURSE_NOTIFICATION">Course Notification</SelectItem>
              <SelectItem value="REVIEW_REQUEST">Review Request</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => emailLogsQuery.refetch()}
            disabled={emailLogsQuery.isFetching}
            data-testid="button-refresh-email-logs"
          >
            <RefreshCw className={`h-4 w-4 ${emailLogsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {emailLogsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : emailLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No email logs found</p>
            <p className="text-sm mt-1">Sent emails will appear here</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`email-log-row-${log.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {log.sentAt ? format(new Date(log.sentAt), "MMM d, yyyy h:mm a") : "-"}
                      </TableCell>
                      <TableCell>{getEmailTypeBadge(log.emailType)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={log.recipientEmail}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate">{log.recipientName || "-"}</span>
                          <span className="text-xs text-muted-foreground truncate">{log.recipientEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm" title={log.subject || ""}>
                        {log.subject || "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {getCourseName(log.courseId)}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {emailLogPage * emailLogLimit + 1} - {Math.min((emailLogPage + 1) * emailLogLimit, totalEmailLogs)} of {totalEmailLogs}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailLogPage(emailLogPage - 1)}
                    disabled={emailLogPage === 0}
                    data-testid="button-email-log-prev"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {emailLogPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailLogPage(emailLogPage + 1)}
                    disabled={emailLogPage >= totalPages - 1}
                    data-testid="button-email-log-next"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ZestAutomationCard() {
  const { toast } = useToast();
  const [pendingFacilities, setPendingFacilities] = useState<ZestPendingFacility[]>([]);
  const [pricingData, setPricingData] = useState<ZestPricingEntry[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  
  const pricingQuery = useQuery({
    queryKey: ["/api/zest/pricing"],
    queryFn: async () => {
      const response = await fetch("/api/zest/pricing");
      if (!response.ok) throw new Error("Failed to fetch pricing");
      return response.json();
    },
  });

  useEffect(() => {
    if (pricingQuery.data?.data) {
      setPricingData(pricingQuery.data.data);
    }
  }, [pricingQuery.data]);

  const syncPricingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/zest/pricing/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Sync failed");
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Pricing synced",
        description: data.message,
      });
      pricingQuery.refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (): Promise<ZestAutomationResponse> => {
      const response = await fetch("/api/zest/automation/test");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Connection test failed");
      }
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection successful" : "Connection failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      if (data.facilities) {
        setPendingFacilities(data.facilities);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendAllMutation = useMutation({
    mutationFn: async (): Promise<ZestAutomationResponse> => {
      const response = await fetch("/api/zest/automation/resend-all", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Resend failed");
      }
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Resend triggered" : "Resend failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      if (data.facilities) {
        setPendingFacilities(data.facilities);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Resend failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Zest Golf Automation
        </CardTitle>
        <CardDescription>
          Manage pending facility connections in Zest Golf Channel Manager
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => testConnectionMutation.mutate()} 
            disabled={testConnectionMutation.isPending || resendAllMutation.isPending}
            variant="outline"
            data-testid="button-zest-connection-test"
          >
            {testConnectionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          
          <Button 
            onClick={() => resendAllMutation.mutate()} 
            disabled={resendAllMutation.isPending || testConnectionMutation.isPending || pendingFacilities.length === 0}
            variant="default"
            data-testid="button-zest-resend-all"
          >
            {resendAllMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Resend Invites to All
              </>
            )}
          </Button>
        </div>
        
        {pendingFacilities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Pending Facilities ({pendingFacilities.length})</h4>
            <div className="max-h-48 overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">City</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFacilities.map((facility, idx) => (
                    <tr key={facility.id || idx} className="border-t" data-testid={`row-zest-facility-${facility.id || idx}`}>
                      <td className="p-2" data-testid={`text-facility-name-${facility.id || idx}`}>{facility.name}</td>
                      <td className="p-2">{facility.city}</td>
                      <td className="p-2">
                        <Badge variant="outline">{facility.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Commission Rates & Pricing
            </h4>
            <Button
              onClick={() => syncPricingMutation.mutate()}
              disabled={syncPricingMutation.isPending}
              size="sm"
              variant="outline"
              data-testid="button-zest-sync-pricing"
            >
              {syncPricingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Pricing from API
                </>
              )}
            </Button>
          </div>

          {pricingQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pricingData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pricing data synced yet. Click "Sync Pricing from API" to fetch current rates.</p>
          ) : (
            <div className="space-y-3">
              {pricingData.map((entry) => (
                <div key={entry.courseId} className="border rounded-md">
                  <button
                    onClick={() => setExpandedCourse(expandedCourse === entry.courseId ? null : entry.courseId)}
                    className="w-full p-3 flex items-center justify-between hover-elevate"
                    data-testid={`button-expand-pricing-${entry.courseId}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{entry.courseName}</span>
                      <Badge variant="secondary" data-testid={`badge-commission-${entry.courseId}`}>
                        {entry.averageCommissionPercent?.toFixed(1) || 0}% avg commission
                      </Badge>
                      {entry.syncStatus === "success" ? (
                        <Badge variant="outline" className="text-green-600">Synced</Badge>
                      ) : (
                        <Badge variant="destructive">Error</Badge>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedCourse === entry.courseId ? "rotate-180" : ""}`} />
                  </button>
                  
                  {expandedCourse === entry.courseId && entry.pricingJson && (
                    <div className="p-3 border-t bg-muted/20 space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Last synced: {entry.lastSyncedAt ? new Date(entry.lastSyncedAt).toLocaleString() : "Never"}
                      </p>
                      
                      {entry.pricingJson.greenFeePricing?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium mb-2">Green Fee Pricing</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-2">Players</th>
                                  <th className="text-right p-2">Public Rate</th>
                                  <th className="text-right p-2">Net Rate</th>
                                  <th className="text-right p-2">Commission</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.pricingJson.greenFeePricing.map((gf, idx) => (
                                  <tr key={idx} className="border-t">
                                    <td className="p-2">{gf.players} player(s)</td>
                                    <td className="p-2 text-right">{gf.publicRate.amount.toFixed(2)} {gf.publicRate.currency}</td>
                                    <td className="p-2 text-right">{gf.netRate.amount.toFixed(2)} {gf.netRate.currency}</td>
                                    <td className="p-2 text-right font-medium text-green-600">{gf.commissionPercent.toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      {entry.pricingJson.extraProducts?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium mb-2">Extra Products</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-2">Product</th>
                                  <th className="text-left p-2">Category</th>
                                  <th className="text-right p-2">Public Rate</th>
                                  <th className="text-right p-2">Net Rate</th>
                                  <th className="text-right p-2">Commission</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.pricingJson.extraProducts.map((ep, idx) => (
                                  <tr key={idx} className="border-t">
                                    <td className="p-2">{ep.name}</td>
                                    <td className="p-2">{ep.category}</td>
                                    <td className="p-2 text-right">{ep.publicRate.amount.toFixed(2)} {ep.publicRate.currency}</td>
                                    <td className="p-2 text-right">{ep.netRate.amount.toFixed(2)} {ep.netRate.currency}</td>
                                    <td className="p-2 text-right font-medium text-green-600">{ep.commissionPercent.toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_TEMPLATE.subject);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE.body);
  const [senderName, setSenderName] = useState("");
  const [emailProviderFilter, setEmailProviderFilter] = useState<"ALL" | "golfmanager" | "teeone" | "none">("ALL");
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
  const [selectedSentEmail, setSelectedSentEmail] = useState<SentAffiliateEmail | null>(null);
  const [inboxFilter, setInboxFilter] = useState<"all" | "unanswered" | "open" | "replied" | "closed" | "archived" | "deleted" | "sent">("unanswered");
  const [replyText, setReplyText] = useState("");
  const [pendingMembersOnlyUpdates, setPendingMembersOnlyUpdates] = useState<Set<string>>(new Set());
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  
  // Email log state
  const [emailLogFilter, setEmailLogFilter] = useState<string>("all");
  const [emailLogPage, setEmailLogPage] = useState(0);
  const emailLogLimit = 25;
  
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
  
  // Rate periods state
  const [ratePeriodsCourseFilter, setRatePeriodsCourseFilter] = useState<string>("ALL");
  const [ratePeriodsSearchQuery, setRatePeriodsSearchQuery] = useState("");
  const [expandedRateCourses, setExpandedRateCourses] = useState<Set<string>>(new Set());
  
  // Affiliate Emails tab state
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showResendConfirmDialog, setShowResendConfirmDialog] = useState(false);
  const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
  const [pendingEmailRecipients, setPendingEmailRecipients] = useState<{email: string; name?: string}[]>([]);
  
  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ["analytics", "money", "bookings", "users", "courses", "emails", "inbox", "api-keys", "rates", "settings"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const { toast } = useToast();
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const { t } = useI18n();
  const { isMobile } = useBreakpoint();

  // DnD sensors for image reordering - must be at top level, not inside conditional
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // Fetch all rate periods for kickback rates tab
  const { data: allRatePeriods, isLoading: isLoadingRatePeriods } = useQuery<RatePeriodWithCourse[]>({
    queryKey: ["/api/admin/rate-periods"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch documents for selected course profile
  const { data: profileDocuments = [], isLoading: isLoadingProfileDocuments } = useQuery<CourseDocument[]>({
    queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "documents"],
    enabled: !!selectedCourseProfile?.id && isAuthenticated && isAdmin,
  });

  // Fetch contacts for selected course profile
  const { data: profileContacts = [], isLoading: isLoadingProfileContacts } = useQuery<CourseContactWithCourse[]>({
    queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "contacts"],
    enabled: !!selectedCourseProfile?.id && isAuthenticated && isAdmin,
  });

  // Fetch API keys (admin only)
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch courses with affiliate email stats for the Affiliate Emails tab
  const { data: affiliateEmailCourses } = useQuery<AffiliateEmailCourse[]>({
    queryKey: ["/api/admin/affiliate-email-courses"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch admin notification count
  const { data: notificationCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/notifications/count"],
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 30000,
  });

  // Fetch admin notifications
  const { data: notifications } = useQuery<BookingNotificationWithDetails[]>({
    queryKey: ["/api/admin/notifications"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch follow-up reminders
  const { data: followUps, isLoading: followUpsLoading } = useQuery<FollowUpItem[]>({
    queryKey: ["/api/admin/follow-ups"],
    enabled: isAuthenticated && isAdmin,
  });
  
  // Follow-ups expanded state (collapsed by default)
  const [followUpsExpanded, setFollowUpsExpanded] = useState(false);

  // Snooze follow-up mutation
  const snoozeMutation = useMutation({
    mutationFn: async ({ courseId, days }: { courseId: string; days: number }) => {
      return apiRequest(`/api/admin/follow-ups/${courseId}/snooze`, "PATCH", { days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"] });
      toast({ title: "Follow-up snoozed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to snooze", description: error.message, variant: "destructive" });
    },
  });

  // Complete follow-up mutation
  const completeMutation = useMutation({
    mutationFn: async (courseId: string) => {
      return apiRequest(`/api/admin/follow-ups/${courseId}/complete`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"] });
      toast({ title: "Follow-up completed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to complete", description: error.message, variant: "destructive" });
    },
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest(`/api/admin/notifications/${notificationId}/read`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/count"] });
    },
  });

  // Mark all notifications as read mutation
  const markAllNotificationsReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/notifications/mark-all-read", "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/count"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (data: { name: string; scopes: string[]; expiresAt?: string }): Promise<CreateApiKeyResponse> => {
      const response = await apiRequest("/api/admin/api-keys", "POST", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      // Close the create dialog first, then show the key dialog
      setShowCreateApiKeyDialog(false);
      setCreatedApiKey(data.rawKey);
      setNewApiKeyName("");
      setNewApiKeyScopes([]);
      setNewApiKeyExpiration(undefined);
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
      return await apiRequest(`/api/admin/api-keys/${keyId}/revoke`, "PATCH");
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

  // Delete API key mutation (permanently removes)
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest(`/api/admin/api-keys/${keyId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({
        title: "API Key Deleted",
        description: "The API key has been permanently deleted",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete API key",
        description: "An error occurred while deleting the API key",
        variant: "destructive",
      });
    },
  });

  // Course enrichment mutation - AI-powered course data enrichment
  const enrichCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      return await apiRequest(`/api/courses/${courseId}/enrich`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({
        title: "Enrichment Started",
        description: "AI is analyzing course information. This may take a minute.",
      });
    },
    onError: () => {
      toast({
        title: "Enrichment Failed",
        description: "Failed to start course enrichment",
        variant: "destructive",
      });
    },
  });

  // Batch enrichment mutation - Enrich all courses at once
  const enrichAllCoursesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/courses/enrich-all`, "POST");
    },
    onSuccess: () => {
      toast({
        title: "Batch Enrichment Started",
        description: "AI is searching the web and enriching all courses. This runs in the background and may take several minutes.",
      });
    },
    onError: () => {
      toast({
        title: "Batch Enrichment Failed",
        description: "Failed to start batch enrichment",
        variant: "destructive",
      });
    },
  });

  // Send review requests mutation - Send review request emails to customers
  const sendReviewRequestsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/send-review-requests", "POST");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Review Requests Sent",
        description: data.message || `Sent ${data.sent || 0} review request emails`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to Send Review Requests",
        description: "An error occurred while sending review request emails",
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

  // Fetch partnership forms for selected course profile
  const { data: partnershipForms = [], isLoading: isLoadingPartnershipForms } = useQuery<PartnershipForm[]>({
    queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "partnership-forms"],
    enabled: !!selectedCourseProfile?.id,
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

  // Partnership forms mutations
  const createPartnershipFormMutation = useMutation({
    mutationFn: async (data: { courseId: string; formType: string; formName: string; notes?: string }) => {
      return await apiRequest(`/api/admin/courses/${data.courseId}/partnership-forms`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "partnership-forms"] });
      toast({ title: "Form created", description: "Partnership form has been added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create partnership form", variant: "destructive" });
    },
  });

  const updatePartnershipFormMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; notes?: string }) => {
      return await apiRequest(`/api/admin/partnership-forms/${id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "partnership-forms"] });
      toast({ title: "Form updated", description: "Partnership form status updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update form", variant: "destructive" });
    },
  });

  const deletePartnershipFormMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/partnership-forms/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "partnership-forms"] });
      toast({ title: "Form deleted", description: "Partnership form has been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete form", variant: "destructive" });
    },
  });

  // Scrape Zest portal contacts mutation (gets all 3 contact types: Primary, Billing, Reservations)
  const syncZestContactsMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await fetch(`/api/zest/contacts/scrape/${courseId}`, { method: "POST" });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const contactCount = data.contacts?.length || 0;
        const contactTypes = data.contacts?.map((c: any) => c.role.replace('Zest ', '')).join(', ') || 'None';
        toast({ 
          title: "Portal Contacts Synced", 
          description: `Found ${contactCount} contact(s): ${contactTypes}` 
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "contacts"] });
        // Update form with primary contact data
        if (data.primaryContact) {
          onboardingForm.reset({
            contactPerson: data.primaryContact.name || "",
            contactEmail: data.primaryContact.email || "",
            contactPhone: data.primaryContact.phone || "",
            agreedCommission: onboardingForm.getValues("agreedCommission") || 0,
            notes: onboardingForm.getValues("notes") || "",
          });
        }
      } else {
        toast({ title: "Sync Failed", description: data.message || data.error, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  // AI Form Filler - upload form and get filled PDF
  const [isFillingForm, setIsFillingForm] = useState(false);
  const fillFormMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsFillingForm(true);
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/admin/fill-form", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fill form");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filled-${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
    onSuccess: () => {
      setIsFillingForm(false);
      toast({ title: "Form filled!", description: "Your filled PDF has been downloaded" });
    },
    onError: (error: Error) => {
      setIsFillingForm(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  // Process contract with AI mutation
  const processContractMutation = useMutation({
    mutationFn: async ({ courseId, documentId }: { courseId: string; documentId: string }) => {
      const response = await apiRequest(`/api/admin/courses/${courseId}/documents/${documentId}/process`, "POST");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rate-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "contacts"] });
      toast({
        title: "Contract Processed",
        description: `Extracted ${data.ratePeriods?.length || 0} rate periods and ${data.contacts?.length || 0} contacts`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Processing Failed",
        description: error?.message || "Failed to process contract with AI",
        variant: "destructive",
      });
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ courseId, file }: { courseId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("category", "contract");
      
      const response = await fetch(`/api/admin/courses/${courseId}/documents`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "documents"] });
      toast({
        title: "Document Uploaded",
        description: "The document has been uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error?.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ courseId, documentId }: { courseId: string; documentId: string }) => {
      const response = await fetch(`/api/admin/courses/${courseId}/documents/${documentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete document");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses", selectedCourseProfile?.id, "documents"] });
      toast({
        title: "Document Deleted",
        description: "The document has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Filter rate periods based on course selection and search
  const filteredRatePeriods = useMemo(() => {
    if (!allRatePeriods) return [];
    return allRatePeriods.filter((period) => {
      const matchesCourse = ratePeriodsCourseFilter === "ALL" || period.courseId === ratePeriodsCourseFilter;
      const matchesSearch = !ratePeriodsSearchQuery || 
        period.courseName.toLowerCase().includes(ratePeriodsSearchQuery.toLowerCase()) ||
        period.seasonLabel.toLowerCase().includes(ratePeriodsSearchQuery.toLowerCase());
      return matchesCourse && matchesSearch;
    });
  }, [allRatePeriods, ratePeriodsCourseFilter, ratePeriodsSearchQuery]);

  // Group rate periods by course for collapsible display
  const groupedRatePeriods = useMemo(() => {
    const groups: { [courseId: string]: { courseName: string; periods: typeof filteredRatePeriods } } = {};
    filteredRatePeriods.forEach((period) => {
      if (!groups[period.courseId]) {
        groups[period.courseId] = { courseName: period.courseName, periods: [] };
      }
      groups[period.courseId].periods.push(period);
    });
    return Object.entries(groups).sort((a, b) => a[1].courseName.localeCompare(b[1].courseName));
  }, [filteredRatePeriods]);

  // Toggle expanded state for a course in rate periods
  const toggleRateCourseExpanded = (courseId: string) => {
    setExpandedRateCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

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

  // Inbox - Fetch sent affiliate emails (for "Sent" filter)
  const { data: sentEmails = [], isLoading: isLoadingSentEmails } = useQuery<SentAffiliateEmail[]>({
    queryKey: ["/api/admin/sent-emails"],
    enabled: isAuthenticated && isAdmin && inboxFilter === "sent",
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
      golfmanagerV1User: "",
      golfmanagerV1Password: "",
      golfmanagerUser: "",
      golfmanagerPassword: "",
      teeoneIdEmpresa: "",
      teeoneIdTeeSheet: "",
      teeoneApiUser: "",
      teeoneApiPassword: "",
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

  // Sync course details form when selectedCourseProfile changes
  useEffect(() => {
    if (selectedCourseProfile) {
      courseDetailsForm.reset({
        name: selectedCourseProfile.name || "",
        city: selectedCourseProfile.city || "",
        province: selectedCourseProfile.province || "",
        email: selectedCourseProfile.email || "",
        phone: selectedCourseProfile.phone || "",
        websiteUrl: selectedCourseProfile.websiteUrl || "",
        notes: selectedCourseProfile.notes || "",
      });
    }
  }, [selectedCourseProfile, courseDetailsForm]);

  // Update course (kickback + credentials) mutation
  const updateCourseMutation = useMutation({
    mutationFn: async ({ courseId, kickbackPercent, golfmanagerV1User, golfmanagerV1Password, golfmanagerUser, golfmanagerPassword, teeoneIdEmpresa, teeoneIdTeeSheet, teeoneApiUser, teeoneApiPassword }: { 
      courseId: string; 
      kickbackPercent: number;
      golfmanagerV1User?: string;
      golfmanagerV1Password?: string;
      golfmanagerUser?: string;
      golfmanagerPassword?: string;
      teeoneIdEmpresa?: number;
      teeoneIdTeeSheet?: number;
      teeoneApiUser?: string;
      teeoneApiPassword?: string;
    }) => {
      const response = await apiRequest(`/api/admin/courses/${courseId}`, "PATCH", { 
        kickbackPercent,
        golfmanagerV1User,
        golfmanagerV1Password,
        golfmanagerUser,
        golfmanagerPassword,
        teeoneIdEmpresa,
        teeoneIdTeeSheet,
        teeoneApiUser,
        teeoneApiPassword
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
      golfmanagerV1User: course.golfmanagerV1User || "",
      golfmanagerV1Password: course.golfmanagerV1Password || "",
      golfmanagerUser: course.golfmanagerUser || "",
      golfmanagerPassword: course.golfmanagerPassword || "",
      teeoneIdEmpresa: course.teeoneIdEmpresa?.toString() || "",
      teeoneIdTeeSheet: course.teeoneIdTeeSheet?.toString() || "",
      teeoneApiUser: course.teeoneApiUser || "",
      teeoneApiPassword: course.teeoneApiPassword || "",
    });
  };

  // Handle save course (kickback + credentials)
  const handleSaveCourse = (data: z.infer<typeof editCourseSchema>) => {
    if (editingCourse) {
      updateCourseMutation.mutate({ 
        courseId: editingCourse.id, 
        kickbackPercent: data.kickbackPercent,
        golfmanagerV1User: data.golfmanagerV1User,
        golfmanagerV1Password: data.golfmanagerV1Password,
        golfmanagerUser: data.golfmanagerUser,
        golfmanagerPassword: data.golfmanagerPassword,
        teeoneIdEmpresa: data.teeoneIdEmpresa ? parseInt(data.teeoneIdEmpresa, 10) : undefined,
        teeoneIdTeeSheet: data.teeoneIdTeeSheet ? parseInt(data.teeoneIdTeeSheet, 10) : undefined,
        teeoneApiUser: data.teeoneApiUser,
        teeoneApiPassword: data.teeoneApiPassword,
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
      golfmanagerV1User: course.golfmanagerV1User || "",
      golfmanagerV1Password: course.golfmanagerV1Password || "",
      golfmanagerUser: course.golfmanagerUser || "",
      golfmanagerPassword: course.golfmanagerPassword || "",
      teeoneIdEmpresa: course.teeoneIdEmpresa?.toString() || "",
      teeoneIdTeeSheet: course.teeoneIdTeeSheet?.toString() || "",
      teeoneApiUser: course.teeoneApiUser || "",
      teeoneApiPassword: course.teeoneApiPassword || "",
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
      // Don't invalidate queries - we use optimistic updates to avoid UI flashing
      // Instead, update the cache directly
      queryClient.setQueryData(['/api/admin/courses'], (old: GolfCourse[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === variables.courseId 
          ? { ...c, imageUrl: variables.imageUrl }
          : c
        );
      });
      queryClient.setQueryData(['/api/courses'], (old: GolfCourse[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === variables.courseId 
          ? { ...c, imageUrl: variables.imageUrl }
          : c
        );
      });
      
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
    onSuccess: (data: { uploaded: number; images?: Array<{ id: string; imageUrl: string }> }, variables) => {
      // Force refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/courses", variables.courseId, "images"],
        refetchType: 'all'
      });
      
      // Update selectedCourseProfile if this is the course being edited
      if (data.images && data.images.length > 0) {
        const firstImage = data.images[0];
        setSelectedCourseProfile((prev) => {
          if (prev?.id === variables.courseId && !prev.imageUrl) {
            return { ...prev, imageUrl: firstImage.imageUrl };
          }
          return prev;
        });
      }
      
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

  // Clear main image mutation (sets imageUrl to null)
  const clearMainImageMutation = useMutation({
    mutationFn: async ({ courseId }: { courseId: string }) => {
      return await apiRequest(`/api/courses/${courseId}/image`, "PATCH", { imageUrl: null });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", variables.courseId, "images"] });
      const feedback = getPersonalFeedback(user?.firstName, 'image_deleted');
      toast({
        title: feedback.title,
        description: feedback.description,
      });
      // Update local state in profile dialog
      setSelectedCourseProfile((current) => {
        if (current?.id === variables.courseId) {
          return { ...current, imageUrl: null };
        }
        return current;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Main Image",
        description: error.message || "Could not delete main image",
        variant: "destructive",
      });
    },
  });

  // Delete gallery image mutation
  const deleteGalleryImageMutation = useMutation({
    mutationFn: async ({ imageId, courseId }: { imageId: string; courseId: string }) => {
      return await apiRequest(`/api/course-images/${imageId}`, "DELETE", undefined);
    },
    onSuccess: async (_data, variables) => {
      // Refetch gallery images immediately to update UI
      await queryClient.refetchQueries({ queryKey: ['/api/courses', variables.courseId, 'images'] });
      // Also invalidate course lists to update image counts
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
      const result = await apiRequest(`/api/courses/${courseId}/images/reorder`, "PATCH", { imageIds });
      return { result, courseId, imageIds };
    },
    onSuccess: (_data, variables) => {
      // Don't refetch - trust the optimistic update already set in onDragEnd
      // The server has saved the new order (200 status), UI already reflects it
      toast({
        title: "Images Reordered",
        description: "The image order has been saved",
      });
    },
    onError: (error: any, variables) => {
      // On error, refetch to restore the correct order from server
      queryClient.refetchQueries({ queryKey: ['/api/courses', variables.courseId, 'images'] });
      toast({
        title: "Failed to Reorder Images",
        description: error.message || "Could not reorder gallery images",
        variant: "destructive",
      });
    },
  });

  // Swap main image with gallery image mutation
  const swapMainImageMutation = useMutation({
    mutationFn: async ({ courseId, promoteImageId, demoteToPosition }: { 
      courseId: string; 
      promoteImageId: string;
      demoteToPosition: number;
    }): Promise<{ course: GolfCourse; images: CourseImage[] }> => {
      const response = await fetch(`/api/courses/${courseId}/images/swap-main`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoteImageId, demoteToPosition }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to swap images");
      }
      return response.json();
    },
    onSuccess: (data: { course: GolfCourse; images: CourseImage[] }, variables) => {
      // Update caches with the returned data
      queryClient.setQueryData(['/api/courses', variables.courseId, 'images'], data.images);
      queryClient.setQueryData(['/api/admin/courses'], (old: GolfCourse[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === variables.courseId ? data.course : c);
      });
      queryClient.setQueryData(['/api/courses'], (old: GolfCourse[] | undefined) => {
        if (!old) return old;
        return old.map(c => c.id === variables.courseId ? data.course : c);
      });
      
      // Update local state
      setSelectedCourseProfile(prev => prev?.id === variables.courseId ? data.course : prev);
      
      toast({
        title: "Main Image Swapped",
        description: "The images have been swapped successfully",
      });
    },
    onError: (error: any, variables) => {
      // Refetch to restore correct state
      queryClient.refetchQueries({ queryKey: ['/api/courses', variables.courseId, 'images'] });
      queryClient.refetchQueries({ queryKey: ['/api/admin/courses'] });
      toast({
        title: "Failed to Swap Images",
        description: error.message || "Could not swap main image",
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

  // Helper to determine course provider type from provider links
  const getCourseProvider = useCallback((courseId: string): "golfmanager" | "teeone" | "none" => {
    const providerInfo = courseProviders?.find(p => p.id === courseId);
    if (!providerInfo?.providerType) return "none";
    if (providerInfo.providerType === "golfmanager_v1" || providerInfo.providerType === "golfmanager_v3") return "golfmanager";
    if (providerInfo.providerType === "teeone") return "teeone";
    return "none";
  }, [courseProviders]);

  // Helper to get onboarding stage for a course
  const getCourseOnboardingStage = useCallback((courseId: string): OnboardingStage => {
    const onboarding = onboardingData?.find(o => o.courseId === courseId);
    return onboarding?.stage || "NOT_CONTACTED";
  }, [onboardingData]);

  // Helper to check if course has been contacted via Zest (OUTREACH_SENT or later stages)
  const isContactedViaZest = useCallback((courseId: string): boolean => {
    const stage = getCourseOnboardingStage(courseId);
    return stage !== "NOT_CONTACTED";
  }, [getCourseOnboardingStage]);

  // Helper to check if course is members only (not public)
  const isMembersOnly = useCallback((course: GolfCourse | AffiliateEmailCourse): boolean => {
    return course.membersOnly === "true";
  }, []);

  // Helper to check if course was recently contacted (within 7 days)
  const isRecentlyContacted = useCallback((course: AffiliateEmailCourse): { recent: boolean; daysAgo: number } => {
    if (!course.lastAffiliateSentAt) return { recent: false, daysAgo: 0 };
    const sentDate = new Date(course.lastAffiliateSentAt);
    const daysAgo = differenceInDays(new Date(), sentDate);
    return { recent: daysAgo <= 7, daysAgo };
  }, []);

  // Get unique cities from affiliate email courses for filter dropdown
  const uniqueCities = useMemo(() => {
    if (!affiliateEmailCourses) return [];
    const cities = [...new Set(affiliateEmailCourses.map(c => c.city))].sort();
    return cities;
  }, [affiliateEmailCourses]);

  // Filter courses for email section using affiliate email courses data
  const filteredEmailCourses = useMemo(() => {
    if (!affiliateEmailCourses) return [];
    return affiliateEmailCourses.filter((course) => {
      // Exclude members only courses
      if (isMembersOnly(course)) return false;
      // Exclude courses already contacted via Zest (onboardingStage is set)
      if (course.onboardingStage && course.onboardingStage !== "NOT_CONTACTED") return false;
      // Apply hasEmail filter
      if (hasEmailFilter && !course.email) return false;
      // Apply city filter
      if (cityFilter !== "ALL" && course.city !== cityFilter) return false;
      // Apply provider filter
      if (emailProviderFilter !== "ALL") {
        const provider = getCourseProvider(course.id);
        if (provider !== emailProviderFilter) return false;
      }
      return true;
    });
  }, [affiliateEmailCourses, hasEmailFilter, cityFilter, emailProviderFilter, getCourseProvider, isMembersOnly]);

  // Get courses that were filtered out because they were contacted via Zest
  const zestContactedCourses = useMemo(() => {
    if (!affiliateEmailCourses) return [];
    return affiliateEmailCourses.filter((course) => {
      if (isMembersOnly(course)) return false;
      if (!course.onboardingStage || course.onboardingStage === "NOT_CONTACTED") return false;
      if (emailProviderFilter !== "ALL") {
        const provider = getCourseProvider(course.id);
        if (provider !== emailProviderFilter) return false;
      }
      return true;
    });
  }, [affiliateEmailCourses, emailProviderFilter, getCourseProvider, isMembersOnly]);

  // Get courses that are members only (excluded from email outreach)
  const membersOnlyCourses = useMemo(() => {
    if (!affiliateEmailCourses) return [];
    return affiliateEmailCourses.filter((course) => {
      if (!isMembersOnly(course)) return false;
      if (emailProviderFilter !== "ALL") {
        const provider = getCourseProvider(course.id);
        if (provider !== emailProviderFilter) return false;
      }
      return true;
    });
  }, [affiliateEmailCourses, emailProviderFilter, getCourseProvider, isMembersOnly]);

  // Count of excluded courses
  const excludedCount = zestContactedCourses.length + membersOnlyCourses.length;

  // Check if any selected courses were recently contacted
  const recentlyContactedSelected = useMemo(() => {
    return selectedCourseIds.filter(id => {
      const course = affiliateEmailCourses?.find(c => c.id === id);
      if (!course) return false;
      return isRecentlyContacted(course).recent;
    });
  }, [selectedCourseIds, affiliateEmailCourses, isRecentlyContacted]);

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
    if (selectedCourseIds.length === filteredEmailCourses.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(filteredEmailCourses.map((c) => c.id));
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

    if (selectedCourseIds.length > MAX_EMAIL_BATCH) {
      toast({
        title: "Too many courses selected",
        description: `Maximum ${MAX_EMAIL_BATCH} courses can be emailed at once`,
        variant: "destructive",
      });
      return;
    }

    // Build list of recipients for confirmation
    const recipients = selectedCourseIds
      .map(id => affiliateEmailCourses?.find(c => c.id === id))
      .filter(c => c?.email)
      .map(c => ({ email: c!.email!, name: c!.name }));
    
    setPendingEmailRecipients(recipients);
    setShowEmailConfirmDialog(true);
  };

  const confirmSendEmails = () => {
    setShowEmailConfirmDialog(false);
    
    if (recentlyContactedSelected.length > 0) {
      setShowResendConfirmDialog(true);
      return;
    }

    sendEmailsMutation.mutate({
      courseIds: selectedCourseIds,
      subject: emailSubject,
      body: emailBody,
      senderName,
    });
  };

  const confirmResendEmails = () => {
    setShowResendConfirmDialog(false);
    setShowEmailConfirmDialog(false);
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
        <div className="mb-8 flex flex-row items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-bold mb-2">{t('admin.dashboardTitle')}</h1>
            <p className="text-muted-foreground">
              {t('admin.dashboardDescription')}
            </p>
          </div>
          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="relative"
                  data-testid="button-notifications"
                >
                  <Bell className="h-5 w-5" />
                  {(notificationCountData?.count ?? 0) > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs font-bold"
                      data-testid="badge-notification-count"
                    >
                      {notificationCountData!.count > 99 ? "99+" : notificationCountData!.count}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex items-center justify-between">
                  <h4 className="font-semibold text-sm">New Booking Alerts</h4>
                  {(notifications?.length ?? 0) > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => markAllNotificationsReadMutation.mutate()}
                      disabled={markAllNotificationsReadMutation.isPending}
                      data-testid="button-mark-all-read"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="max-h-80">
                  {(!notifications || notifications.length === 0) ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No new booking notifications
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className="p-3 hover-elevate cursor-pointer"
                          onClick={() => {
                            markNotificationReadMutation.mutate(notification.id);
                            setActiveTab("bookings");
                          }}
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="bg-primary/10 rounded-full p-1.5 mt-0.5">
                              <Bell className="h-3 w-3 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                New booking: {notification.booking?.customerName || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {notification.courseName || "Unknown course"} • {notification.booking?.players || 0} players
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
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
            <TabsTrigger value="notifications" data-testid="tab-notifications" className="relative">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
              {(notifications?.length ?? 0) > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 min-w-5 flex items-center justify-center p-0 text-xs font-bold"
                  data-testid="badge-notifications-tab-count"
                >
                  {(notifications?.length ?? 0) > 99 ? "99+" : notifications?.length}
                </Badge>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="email-logs" data-testid="tab-email-logs">
                <Mail className="h-4 w-4 mr-2" />
                Email Log
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="api-keys" data-testid="tab-api-keys">
                <Key className="h-4 w-4 mr-2" />
                API Keys
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="rates" data-testid="tab-rates">
                <Percent className="h-4 w-4 mr-2" />
                Kickback Rates
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
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
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Review Requests
                    </CardTitle>
                    <CardDescription>
                      Send review request emails to customers after their completed rounds
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => sendReviewRequestsMutation.mutate()}
                    disabled={sendReviewRequestsMutation.isPending}
                    data-testid="button-send-review-requests"
                  >
                    {sendReviewRequestsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Review Requests
                      </>
                    )}
                  </Button>
                </CardHeader>
              </Card>

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
              {/* Funnel Stats Overview - Clickable to filter */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ONBOARDING_STAGES.map((stage) => {
                  const count = onboardingStats?.[stage.value] ?? 0;
                  const StageIcon = stage.icon;
                  const isSelected = stageFilter === stage.value;
                  return (
                    <Card 
                      key={stage.value} 
                      className={`${stage.color} border-0 cursor-pointer transition-all hover-elevate ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      onClick={() => setStageFilter(isSelected ? "ALL" : stage.value)}
                      data-testid={`card-stage-${stage.value}`}
                    >
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

              {/* Follow-up Reminders - Collapsible */}
              {(followUps && followUps.length > 0) && (
                <Card data-testid="card-follow-up-reminders">
                  <CardHeader 
                    className="pb-3 cursor-pointer hover-elevate"
                    onClick={() => setFollowUpsExpanded(!followUpsExpanded)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Follow-up Reminders
                        <Badge variant="secondary">{followUps.length}</Badge>
                        {followUps.filter(f => f.daysOverdue > 0).length > 0 && (
                          <Badge variant="destructive">
                            {followUps.filter(f => f.daysOverdue > 0).length} overdue
                          </Badge>
                        )}
                      </CardTitle>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {followUpsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  {followUpsExpanded && (
                    <CardContent className="space-y-2 pt-0">
                      {followUpsLoading ? (
                        <div className="py-4 text-center text-muted-foreground">Loading...</div>
                      ) : (
                        <>
                          {followUps.slice(0, 5).map((item) => (
                            <div 
                              key={item.courseId} 
                              className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-md"
                            >
                              <div className="flex-1 min-w-0">
                                <Link 
                                  href={`/admin?tab=courses`}
                                  onClick={() => {
                                    const course = courses?.find(c => c.id === item.courseId);
                                    if (course) setSelectedCourseProfile(course);
                                  }}
                                  className="font-medium hover:underline truncate block"
                                >
                                  {item.courseName}
                                </Link>
                                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                  {item.contactPerson && <span>{item.contactPerson}</span>}
                                  {item.contactEmail && (
                                    <a href={`mailto:${item.contactEmail}`} className="hover:underline">
                                      {item.contactEmail}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                {item.daysOverdue > 0 ? (
                                  <Badge variant="destructive" className="self-start sm:self-auto">{item.daysOverdue}d overdue</Badge>
                                ) : (
                                  <Badge variant="outline" className="self-start sm:self-auto">Due today</Badge>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); snoozeMutation.mutate({ courseId: item.courseId, days: 7 }); }}
                                    disabled={snoozeMutation.isPending}
                                    data-testid={`button-snooze-${item.courseId}`}
                                    className="flex-1 sm:flex-initial"
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    <span className="hidden xs:inline">Snooze</span> 7d
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); completeMutation.mutate(item.courseId); }}
                                    disabled={completeMutation.isPending}
                                    data-testid={`button-complete-${item.courseId}`}
                                    className="flex-1 sm:flex-initial"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Done
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {followUps.length > 5 && (
                            <div className="text-center pt-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setStageFilter("OUTREACH_SENT")}
                              >
                                View all {followUps.length} follow-ups
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

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
                    
                    <Button
                      variant="default"
                      onClick={() => enrichAllCoursesMutation.mutate()}
                      disabled={enrichAllCoursesMutation.isPending}
                      data-testid="button-enrich-all-courses"
                    >
                      {enrichAllCoursesMutation.isPending ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Enriching...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Enrich All with AI
                        </>
                      )}
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
                    <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-7 scrollbar-hide">
                      <TabsTrigger value="details" className="flex-shrink-0" data-testid="profile-tab-details">Details</TabsTrigger>
                      <TabsTrigger value="partnership" className="flex-shrink-0" data-testid="profile-tab-partnership">Partnership</TabsTrigger>
                      <TabsTrigger value="credentials" className="flex-shrink-0" data-testid="profile-tab-credentials">Credentials</TabsTrigger>
                      <TabsTrigger value="images" className="flex-shrink-0" data-testid="profile-tab-images">Images</TabsTrigger>
                      <TabsTrigger value="documents" className="flex-shrink-0" data-testid="profile-tab-documents">Docs</TabsTrigger>
                      <TabsTrigger value="contacts" className="flex-shrink-0" data-testid="profile-tab-contacts">Contacts</TabsTrigger>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" disabled={updateCourseDetailsMutation.isPending} data-testid="button-save-profile-details">
                              {updateCourseDetailsMutation.isPending ? "Saving..." : "Save Details"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => enrichCourseMutation.mutate(selectedCourseProfile.id)}
                              disabled={enrichCourseMutation.isPending || selectedCourseProfile.enrichmentStatus === "processing"}
                              data-testid="button-enrich-course"
                            >
                              {enrichCourseMutation.isPending || selectedCourseProfile.enrichmentStatus === "processing" ? (
                                <>
                                  <span className="animate-spin mr-2">⏳</span>
                                  Enriching...
                                </>
                              ) : selectedCourseProfile.enrichmentStatus === "complete" ? (
                                <>Re-enrich with AI</>
                              ) : (
                                <>Enrich with AI</>
                              )}
                            </Button>
                            {selectedCourseProfile.enrichmentStatus && (
                              <Badge 
                                variant={selectedCourseProfile.enrichmentStatus === "complete" ? "default" : "secondary"}
                                className={selectedCourseProfile.enrichmentStatus === "complete" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : ""}
                              >
                                {selectedCourseProfile.enrichmentStatus === "complete" ? "Enriched" : selectedCourseProfile.enrichmentStatus}
                              </Badge>
                            )}
                          </div>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Partnership Tab */}
                    <TabsContent value="partnership" className="space-y-4 mt-4">
                      {/* Contact Sub-Tabs */}
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Contact className="h-4 w-4" />
                                Partnership Contacts
                              </CardTitle>
                              <CardDescription>
                                Primary, Billing, and Reservations contacts for this partnership
                              </CardDescription>
                            </div>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => selectedCourseProfile && syncZestContactsMutation.mutate(selectedCourseProfile.id)}
                              disabled={syncZestContactsMutation.isPending || !selectedCourseProfile}
                              data-testid="button-sync-zest-contacts"
                            >
                              <RefreshCw className={`h-3 w-3 mr-1 ${syncZestContactsMutation.isPending ? 'animate-spin' : ''}`} />
                              {syncZestContactsMutation.isPending ? "Syncing..." : "Sync from Zest Portal"}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const zestContacts = profileContacts.filter(c => c.role?.startsWith('Zest '));
                            const primaryContact = zestContacts.find(c => c.role === 'Zest Primary');
                            const billingContact = zestContacts.find(c => c.role === 'Zest Billing');
                            const reservationsContact = zestContacts.find(c => c.role === 'Zest Reservations');

                            return (
                              <Tabs defaultValue="primary" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4">
                                  <TabsTrigger value="primary" data-testid="tab-contact-primary">
                                    <User className="h-3 w-3 mr-1" />
                                    Primary
                                  </TabsTrigger>
                                  <TabsTrigger value="reservations" data-testid="tab-contact-reservations">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    Reservations
                                  </TabsTrigger>
                                  <TabsTrigger value="billing" data-testid="tab-contact-billing">
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Billing
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent value="primary" className="mt-0" data-testid="content-contact-primary">
                                  <ContactFormTab 
                                    contact={primaryContact}
                                    role="Zest Primary"
                                    label="Primary"
                                    courseId={selectedCourseProfile?.id || ""}
                                    color="bg-green-50 dark:bg-green-900/20"
                                  />
                                </TabsContent>
                                <TabsContent value="reservations" className="mt-0" data-testid="content-contact-reservations">
                                  <ContactFormTab 
                                    contact={reservationsContact}
                                    role="Zest Reservations"
                                    label="Reservations"
                                    courseId={selectedCourseProfile?.id || ""}
                                    color="bg-orange-50 dark:bg-orange-900/20"
                                  />
                                </TabsContent>
                                <TabsContent value="billing" className="mt-0" data-testid="content-contact-billing">
                                  <ContactFormTab 
                                    contact={billingContact}
                                    role="Zest Billing"
                                    label="Billing"
                                    courseId={selectedCourseProfile?.id || ""}
                                    color="bg-blue-50 dark:bg-blue-900/20"
                                  />
                                </TabsContent>
                              </Tabs>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Partnership Settings */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Handshake className="h-4 w-4" />
                            Partnership Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Form {...onboardingForm}>
                            <form onSubmit={onboardingForm.handleSubmit(handleSaveProfilePartnership)} className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
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
                        </CardContent>
                      </Card>

                      {/* Extracted Kickback Rates from Contracts */}
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Contract Kickback Rates
                          </CardTitle>
                          <CardDescription>
                            Seasonal rates extracted from PDF contracts via AI
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const courseRates = (allRatePeriods || []).filter(
                              (rp: RatePeriodWithCourse) => rp.courseId === selectedCourseProfile?.id
                            );
                            if (courseRates.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>No rate periods extracted yet</p>
                                  <p className="text-sm">Upload a contract in the Docs tab and click "Process with AI"</p>
                                </div>
                              );
                            }
                            return (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Season</TableHead>
                                    <TableHead>Package</TableHead>
                                    <TableHead className="text-right">Rack</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                    <TableHead className="text-right">%</TableHead>
                                    <TableHead>Includes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {courseRates.map((period: RatePeriodWithCourse) => (
                                    <TableRow key={period.id}>
                                      <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                          <Badge variant="outline">{period.seasonLabel}</Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {period.startDate} - {period.endDate}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-col gap-1">
                                          <span className="text-sm font-medium">
                                            {(period as any).packageType?.replace(/_/g, ' ') || 'Green Fee + Buggy'}
                                          </span>
                                          {(((period as any).isEarlyBird === "true" || (period as any).isEarlyBird === true) || ((period as any).isTwilight === "true" || (period as any).isTwilight === true)) && (
                                            <div className="flex gap-1">
                                              {((period as any).isEarlyBird === "true" || (period as any).isEarlyBird === true) && (
                                                <Badge variant="secondary" className="text-xs">Early Bird</Badge>
                                              )}
                                              {((period as any).isTwilight === "true" || (period as any).isTwilight === true) && (
                                                <Badge variant="secondary" className="text-xs">Twilight</Badge>
                                              )}
                                            </div>
                                          )}
                                          {(period as any).timeRestriction && (
                                            <span className="text-xs text-muted-foreground">{(period as any).timeRestriction}</span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">€{period.rackRate}</TableCell>
                                      <TableCell className="text-right">€{period.netRate}</TableCell>
                                      <TableCell className="text-right">
                                        <Badge className={period.kickbackPercent >= 20 ? "bg-green-100 text-green-700" : ""}>
                                          {period.kickbackPercent?.toFixed(0)}%
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                          {((period as any).includesBuggy === "true" || (period as any).includesBuggy === true) && (
                                            <Badge variant="outline" className="text-xs">Buggy</Badge>
                                          )}
                                          {((period as any).includesLunch === "true" || (period as any).includesLunch === true) && (
                                            <Badge variant="outline" className="text-xs">Lunch</Badge>
                                          )}
                                          {(period as any).minPlayersForDiscount && (
                                            <Badge variant="outline" className="text-xs text-green-600">
                                              {(period as any).freePlayersPerGroup || 1} free / {(period as any).minPlayersForDiscount}
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Partnership Forms Tracking */}
                      <Card className="mt-6">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Partnership Forms
                              </CardTitle>
                              <CardDescription>
                                Track forms sent to and received from this course
                              </CardDescription>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" data-testid="button-add-partnership-form">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Form
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => createPartnershipFormMutation.mutate({
                                    courseId: selectedCourseProfile!.id,
                                    formType: "COMPANY_DETAILS",
                                    formName: "Datos empresa - Company Details"
                                  })}
                                  data-testid="menu-add-company-details"
                                >
                                  Company Details Form
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => createPartnershipFormMutation.mutate({
                                    courseId: selectedCourseProfile!.id,
                                    formType: "CONTRACT",
                                    formName: "Partnership Contract"
                                  })}
                                  data-testid="menu-add-contract"
                                >
                                  Contract
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => createPartnershipFormMutation.mutate({
                                    courseId: selectedCourseProfile!.id,
                                    formType: "RATE_CARD",
                                    formName: "Rate Card / Price List"
                                  })}
                                  data-testid="menu-add-rate-card"
                                >
                                  Rate Card
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => createPartnershipFormMutation.mutate({
                                    courseId: selectedCourseProfile!.id,
                                    formType: "AGREEMENT",
                                    formName: "Collaboration Agreement"
                                  })}
                                  data-testid="menu-add-agreement"
                                >
                                  Agreement
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isLoadingPartnershipForms ? (
                            <div className="flex justify-center py-4">
                              <GolfLoader />
                            </div>
                          ) : partnershipForms.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No partnership forms tracked yet</p>
                              <p className="text-sm">Add forms to track sent/received documents</p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Form</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Sent</TableHead>
                                  <TableHead>Received</TableHead>
                                  <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {partnershipForms.map((form) => (
                                  <TableRow key={form.id} data-testid={`row-partnership-form-${form.id}`}>
                                    <TableCell>
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium text-sm">{form.formName}</span>
                                        <Badge variant="outline" className="w-fit text-xs">
                                          {form.formType.replace(/_/g, " ")}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={form.status}
                                        onValueChange={(value) => updatePartnershipFormMutation.mutate({ id: form.id, status: value })}
                                      >
                                        <SelectTrigger className="h-8 w-[120px]" data-testid={`select-form-status-${form.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PENDING">
                                            <Badge variant="secondary">Pending</Badge>
                                          </SelectItem>
                                          <SelectItem value="SENT">
                                            <Badge className="bg-blue-100 text-blue-700">Sent</Badge>
                                          </SelectItem>
                                          <SelectItem value="RECEIVED">
                                            <Badge className="bg-green-100 text-green-700">Received</Badge>
                                          </SelectItem>
                                          <SelectItem value="PROCESSED">
                                            <Badge className="bg-purple-100 text-purple-700">Processed</Badge>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {form.sentAt ? format(new Date(form.sentAt), "PP") : "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {form.receivedAt ? format(new Date(form.receivedAt), "PP") : "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => deletePartnershipFormMutation.mutate(form.id)}
                                        disabled={deletePartnershipFormMutation.isPending}
                                        data-testid={`button-delete-form-${form.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Credentials Tab */}
                    <TabsContent value="credentials" className="space-y-4 mt-4">
                      <CredentialsEditor 
                        course={selectedCourseProfile} 
                        onSave={async (credentials) => {
                          if (!selectedCourseProfile) return;
                          await updateCourseMutation.mutateAsync({
                            courseId: selectedCourseProfile.id,
                            kickbackPercent: selectedCourseProfile.kickbackPercent || 0,
                            ...credentials
                          });
                        }}
                        isSaving={updateCourseMutation.isPending}
                      />
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
                            {profileGalleryImages.length > 0 && (
                              <p className="text-xs text-muted-foreground">Drag to reorder</p>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {selectedCourseProfile.imageUrl || profileGalleryImages.length > 0 ? (
                            <DndContext
                              sensors={dndSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event: DragEndEvent) => {
                                const { active, over } = event;
                                if (over && active.id !== over.id) {
                                  const allImages: SortableImageItem[] = [
                                    ...(selectedCourseProfile.imageUrl ? [{
                                      id: 'main-image',
                                      imageUrl: selectedCourseProfile.imageUrl,
                                      isMain: true,
                                      caption: null
                                    }] : []),
                                    ...profileGalleryImages.map(img => ({
                                      id: img.id,
                                      imageUrl: img.imageUrl,
                                      isMain: false,
                                      caption: img.caption
                                    }))
                                  ];
                                  
                                  const oldIndex = allImages.findIndex(i => i.id === active.id);
                                  const newIndex = allImages.findIndex(i => i.id === over.id);
                                  const reordered = arrayMove(allImages, oldIndex, newIndex);
                                  
                                  // Check if a gallery image was moved to position 0 (becomes new main)
                                  const newFirstImage = reordered[0];
                                  const galleryImagePromotedToMain = newFirstImage && newFirstImage.id !== 'main-image';
                                  
                                  if (galleryImagePromotedToMain) {
                                    // A gallery image was dragged to position 0
                                    // Use swap mutation: old main goes to gallery, new image becomes main
                                    const promotedImageId = newFirstImage.id;
                                    const demotePosition = oldIndex - 1; // Position where the promoted image was (0-indexed in gallery)
                                    
                                    // Optimistic UI: Build new gallery with old main inserted at dragged-from position
                                    const newGallery = reordered.slice(1).map((item, idx) => {
                                      if (item.id === 'main-image') {
                                        // Create a virtual gallery entry for the old main image
                                        return {
                                          id: 'temp-demoted-' + Date.now(),
                                          courseId: selectedCourseProfile.id,
                                          imageUrl: selectedCourseProfile.imageUrl!,
                                          caption: null,
                                          sortOrder: idx,
                                        } as CourseImage;
                                      }
                                      const original = profileGalleryImages.find(img => img.id === item.id);
                                      return original ? { ...original, sortOrder: idx } : null;
                                    }).filter(Boolean) as CourseImage[];
                                    
                                    // Optimistic UI updates
                                    queryClient.setQueryData(
                                      ['/api/courses', selectedCourseProfile.id, 'images'],
                                      newGallery
                                    );
                                    setSelectedCourseProfile(prev => prev ? {
                                      ...prev,
                                      imageUrl: newFirstImage.imageUrl
                                    } : null);
                                    
                                    // Call swap endpoint
                                    swapMainImageMutation.mutate({
                                      courseId: selectedCourseProfile.id,
                                      promoteImageId: promotedImageId,
                                      demoteToPosition: demotePosition >= 0 ? demotePosition : 0,
                                    });
                                  } else {
                                    // Just reordering gallery images (main stayed in position 0)
                                    const galleryOnly = reordered.slice(1).map((item, idx) => {
                                      const original = profileGalleryImages.find(img => img.id === item.id);
                                      return original ? { ...original, sortOrder: idx } : null;
                                    }).filter(Boolean) as CourseImage[];
                                    
                                    queryClient.setQueryData(
                                      ['/api/courses', selectedCourseProfile.id, 'images'],
                                      galleryOnly
                                    );
                                    
                                    const galleryIds = galleryOnly.map(i => i.id);
                                    if (galleryIds.length > 0) {
                                      reorderGalleryImagesMutation.mutate({
                                        courseId: selectedCourseProfile.id,
                                        imageIds: galleryIds
                                      });
                                    }
                                  }
                                }
                              }}
                            >
                              <SortableContext
                                items={[
                                  ...(selectedCourseProfile.imageUrl ? ['main-image'] : []),
                                  ...profileGalleryImages.map(img => img.id)
                                ]}
                                strategy={rectSortingStrategy}
                              >
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {selectedCourseProfile.imageUrl && (
                                    <SortableImage
                                      item={{
                                        id: 'main-image',
                                        imageUrl: selectedCourseProfile.imageUrl,
                                        isMain: true,
                                        caption: null
                                      }}
                                      onDelete={() => clearMainImageMutation.mutate({ courseId: selectedCourseProfile.id })}
                                      onSetMain={() => {}}
                                      isDeleting={clearMainImageMutation.isPending}
                                    />
                                  )}
                                  {profileGalleryImages.map((image) => (
                                    <SortableImage
                                      key={image.id}
                                      item={{
                                        id: image.id,
                                        imageUrl: image.imageUrl,
                                        isMain: false,
                                        caption: image.caption
                                      }}
                                      onDelete={() => deleteGalleryImageMutation.mutate({ imageId: image.id, courseId: selectedCourseProfile!.id })}
                                      onSetMain={() => updateCourseImageMutation.mutate({ 
                                        courseId: selectedCourseProfile.id, 
                                        imageUrl: image.imageUrl 
                                      })}
                                      isDeleting={deleteGalleryImageMutation.isPending}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <Images className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No images uploaded yet</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Documents Tab */}
                    <TabsContent value="documents" className="space-y-4 mt-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Course Documents
                              </CardTitle>
                              <CardDescription>
                                Upload contracts and agreements, then process with AI to extract rates and contacts
                              </CardDescription>
                            </div>
                            <div>
                              <input
                                id="document-upload-input"
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && selectedCourseProfile) {
                                    uploadDocumentMutation.mutate({
                                      courseId: selectedCourseProfile.id,
                                      file
                                    });
                                    e.target.value = "";
                                  }
                                }}
                                data-testid="input-document-upload"
                              />
                              <Button
                                size="sm"
                                onClick={() => document.getElementById("document-upload-input")?.click()}
                                disabled={uploadDocumentMutation.isPending}
                                data-testid="button-upload-document"
                              >
                                {uploadDocumentMutation.isPending ? (
                                  <>
                                    <Clock className="h-4 w-4 mr-1 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-1" />
                                    Upload Document
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {isLoadingProfileDocuments ? (
                            <div className="py-8">
                              <GolfLoader size="sm" text="Loading documents..." />
                            </div>
                          ) : profileDocuments.length > 0 ? (
                            <div className="space-y-3">
                              {profileDocuments.map((doc) => (
                                <div 
                                  key={doc.id} 
                                  className="flex items-center justify-between p-3 border rounded-md"
                                  data-testid={`document-row-${doc.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium text-sm">{doc.fileName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {doc.category} 
                                        {doc.createdAt && ` • ${new Date(doc.createdAt).toLocaleDateString()}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      asChild
                                      data-testid={`button-download-document-${doc.id}`}
                                    >
                                      <a href={(doc as any).fileUrl} target="_blank" rel="noopener noreferrer" title="View/Download">
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                    {(doc as any).isProcessed ? (
                                      <Badge variant="secondary" className="text-green-600">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Processed
                                      </Badge>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => processContractMutation.mutate({
                                          courseId: selectedCourseProfile.id,
                                          documentId: doc.id
                                        })}
                                        disabled={processContractMutation.isPending}
                                        data-testid={`button-process-document-${doc.id}`}
                                      >
                                        {processContractMutation.isPending ? (
                                          <>
                                            <Clock className="h-3 w-3 mr-1 animate-spin" />
                                            Processing...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Process with AI
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete "${doc.fileName}"?`)) {
                                          deleteDocumentMutation.mutate({
                                            courseId: selectedCourseProfile.id,
                                            documentId: doc.id
                                          });
                                        }
                                      }}
                                      disabled={deleteDocumentMutation.isPending}
                                      data-testid={`button-delete-document-${doc.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No documents uploaded yet</p>
                              <p className="text-sm mt-1">Upload contracts to extract rates and contacts</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* AI Form Filler */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            AI Form Filler
                          </CardTitle>
                          <CardDescription>
                            Upload a PDF form from a golf course and AI will fill it with your company details
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                              isFillingForm ? "opacity-50" : "hover:border-primary cursor-pointer"
                            }`}
                            onClick={() => !isFillingForm && document.getElementById("form-filler-input")?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                              const file = e.dataTransfer.files[0];
                              if (file && file.type === "application/pdf") {
                                fillFormMutation.mutate(file);
                              }
                            }}
                          >
                            <input
                              id="form-filler-input"
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  fillFormMutation.mutate(file);
                                  e.target.value = "";
                                }
                              }}
                              data-testid="input-form-filler-upload"
                            />
                            {isFillingForm ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                                <p className="text-sm text-muted-foreground">AI is filling the form...</p>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm font-medium">Drop PDF form here or click to upload</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Form will be auto-filled with your company profile data
                                </p>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Contacts Tab */}
                    <TabsContent value="contacts" className="space-y-4 mt-4">
                      {/* Zest Portal Contacts */}
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Zest Portal Contacts
                              </CardTitle>
                              <CardDescription>
                                Primary, Billing, and Reservations contacts from Zest Golf portal
                              </CardDescription>
                            </div>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => selectedCourseProfile && syncZestContactsMutation.mutate(selectedCourseProfile.id)}
                              disabled={syncZestContactsMutation.isPending || !selectedCourseProfile}
                              data-testid="button-sync-zest-portal-contacts"
                            >
                              <RefreshCw className={`h-3 w-3 mr-1 ${syncZestContactsMutation.isPending ? 'animate-spin' : ''}`} />
                              {syncZestContactsMutation.isPending ? "Syncing..." : "Sync"}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isLoadingProfileContacts ? (
                            <div className="py-6">
                              <GolfLoader size="sm" text="Loading contacts..." />
                            </div>
                          ) : (() => {
                            const zestContacts = profileContacts.filter(c => c.role?.startsWith('Zest '));
                            const primaryContact = zestContacts.find(c => c.role === 'Zest Primary');
                            const billingContact = zestContacts.find(c => c.role === 'Zest Billing');
                            const reservationsContact = zestContacts.find(c => c.role === 'Zest Reservations');
                            
                            if (zestContacts.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <UserPlus className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No Zest contacts synced yet</p>
                                  <p className="text-xs mt-1">Click "Sync" to fetch contacts from Zest portal</p>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Primary Contact */}
                                <div className="p-3 border rounded-md bg-green-50 dark:bg-green-900/20" data-testid="contact-zest-primary">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-green-600 text-white text-xs">Primary</Badge>
                                  </div>
                                  {primaryContact ? (
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{primaryContact.name}</p>
                                      {primaryContact.email && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          <a href={`mailto:${primaryContact.email}`} className="hover:underline truncate">{primaryContact.email}</a>
                                        </div>
                                      )}
                                      {primaryContact.phone && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <PhoneCall className="h-3 w-3" />
                                          <a href={`tel:${primaryContact.phone}`} className="hover:underline">{primaryContact.phone}</a>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Not available</p>
                                  )}
                                </div>
                                
                                {/* Billing Contact */}
                                <div className="p-3 border rounded-md bg-blue-50 dark:bg-blue-900/20" data-testid="contact-zest-billing">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-blue-600 text-white text-xs">Billing</Badge>
                                  </div>
                                  {billingContact ? (
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{billingContact.name}</p>
                                      {billingContact.email && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          <a href={`mailto:${billingContact.email}`} className="hover:underline truncate">{billingContact.email}</a>
                                        </div>
                                      )}
                                      {billingContact.phone && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <PhoneCall className="h-3 w-3" />
                                          <a href={`tel:${billingContact.phone}`} className="hover:underline">{billingContact.phone}</a>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Not available</p>
                                  )}
                                </div>
                                
                                {/* Reservations Contact */}
                                <div className="p-3 border rounded-md bg-orange-50 dark:bg-orange-900/20" data-testid="contact-zest-reservations">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-orange-600 text-white text-xs">Reservations</Badge>
                                  </div>
                                  {reservationsContact ? (
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{reservationsContact.name}</p>
                                      {reservationsContact.email && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          <a href={`mailto:${reservationsContact.email}`} className="hover:underline truncate">{reservationsContact.email}</a>
                                        </div>
                                      )}
                                      {reservationsContact.phone && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <PhoneCall className="h-3 w-3" />
                                          <a href={`tel:${reservationsContact.phone}`} className="hover:underline">{reservationsContact.phone}</a>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Not available</p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Other Extracted Contacts */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Other Contacts
                          </CardTitle>
                          <CardDescription>
                            Contact information extracted from contracts and documents
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isLoadingProfileContacts ? (
                            <div className="py-6">
                              <GolfLoader size="sm" text="Loading contacts..." />
                            </div>
                          ) : (() => {
                            const otherContacts = profileContacts.filter(c => !c.role?.startsWith('Zest '));
                            if (otherContacts.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <UserPlus className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No other contacts extracted yet</p>
                                  <p className="text-xs mt-1">Process documents to extract contact information</p>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                {otherContacts.map((contact) => (
                                  <div 
                                    key={contact.id} 
                                    className="flex items-start justify-between p-3 border rounded-md"
                                    data-testid={`contact-row-${contact.id}`}
                                  >
                                    <div className="space-y-1">
                                      <p className="font-medium">{contact.name}</p>
                                      {contact.role && (
                                        <Badge variant="outline" className="text-xs">{contact.role}</Badge>
                                      )}
                                      <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                                        {contact.email && (
                                          <div className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" />
                                            <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                                          </div>
                                        )}
                                        {contact.phone && (
                                          <div className="flex items-center gap-1">
                                            <PhoneCall className="h-3 w-3" />
                                            <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {contact.extractedFrom && (
                                      <Badge variant="secondary" className="text-xs">
                                        From: {contact.extractedFrom}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
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
                    Send partnership inquiries to golf courses requesting their terms and contract drafts
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Label>
                        Select Golf Courses 
                        <span className="text-muted-foreground font-normal ml-1">
                          ({filteredEmailCourses.length} available, {excludedCount} excluded)
                        </span>
                      </Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="has-email-filter"
                            checked={hasEmailFilter}
                            onCheckedChange={setHasEmailFilter}
                            data-testid="switch-has-email-filter"
                          />
                          <Label htmlFor="has-email-filter" className="text-sm font-normal cursor-pointer">
                            Has Email
                          </Label>
                        </div>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                          <SelectTrigger className="w-[140px]" data-testid="select-city-filter">
                            <SelectValue placeholder="All Cities" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Cities</SelectItem>
                            {uniqueCities.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={emailProviderFilter} onValueChange={(v) => setEmailProviderFilter(v as typeof emailProviderFilter)}>
                          <SelectTrigger className="w-[160px]" data-testid="select-email-provider-filter">
                            <SelectValue placeholder="Filter by provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Providers</SelectItem>
                            <SelectItem value="golfmanager">Golfmanager</SelectItem>
                            <SelectItem value="teeone">TeeOne</SelectItem>
                            <SelectItem value="none">No Provider</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleToggleAll}
                          data-testid="button-toggle-all-courses"
                        >
                          {selectedCourseIds.length === filteredEmailCourses.length && filteredEmailCourses.length > 0 
                            ? "Deselect All" 
                            : `Select All (${filteredEmailCourses.length})`}
                        </Button>
                      </div>
                    </div>

                    {selectedCourseIds.length > MAX_EMAIL_BATCH && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20" data-testid="batch-limit-warning">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">
                          Too many courses selected. Maximum {MAX_EMAIL_BATCH} courses can be emailed at once.
                        </span>
                      </div>
                    )}

                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      {filteredEmailCourses.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No courses match the selected filter
                        </div>
                      ) : filteredEmailCourses.map((course) => {
                        const contactStatus = isRecentlyContacted(course);
                        return (
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{course.name}</span>
                                {getCourseProvider(course.id) === "golfmanager" && (
                                  <Badge variant="outline" className="text-xs">Golfmanager</Badge>
                                )}
                                {getCourseProvider(course.id) === "teeone" && (
                                  <Badge variant="outline" className="text-xs">TeeOne</Badge>
                                )}
                                {contactStatus.recent && (
                                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200" data-testid={`badge-recently-contacted-${course.id}`}>
                                    <Clock className="h-3 w-3 mr-1" />
                                    Sent {contactStatus.daysAgo} day{contactStatus.daysAgo !== 1 ? 's' : ''} ago
                                  </Badge>
                                )}
                                {course.emailCount > 0 && !contactStatus.recent && (
                                  <Badge variant="outline" className="text-xs">
                                    {course.emailCount} email{course.emailCount !== 1 ? 's' : ''} sent
                                  </Badge>
                                )}
                                {course.totalOpens > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200" data-testid={`badge-email-opened-${course.id}`}>
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Opened{course.totalOpens > 1 ? ` (${course.totalOpens}x)` : ''}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {course.lastOpenedAt ? `Last opened: ${new Date(course.lastOpenedAt).toLocaleDateString()}` : 'Email was opened'}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {course.email || "No email"}
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {/* Already Contacted via Zest Section */}
                    {zestContactedCourses.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Already Contacted via Zest
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({zestContactedCourses.length} course{zestContactedCourses.length !== 1 && "s"})
                          </span>
                        </div>
                        <div className="border rounded-md max-h-[200px] overflow-y-auto bg-muted/30">
                          {zestContactedCourses.map((course) => {
                            const stage = getCourseOnboardingStage(course.id);
                            const stageInfo = ONBOARDING_STAGES.find(s => s.value === stage);
                            return (
                              <div
                                key={course.id}
                                className="flex items-center justify-between gap-3 p-3 border-b last:border-b-0"
                                data-testid={`zest-contacted-course-${course.id}`}
                              >
                                <div className="flex-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-muted-foreground">{course.name}</span>
                                    {getCourseProvider(course.id) === "golfmanager" && (
                                      <Badge variant="outline" className="text-xs">Golfmanager</Badge>
                                    )}
                                    {getCourseProvider(course.id) === "teeone" && (
                                      <Badge variant="outline" className="text-xs">TeeOne</Badge>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    {course.email || "No email"}
                                  </div>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${stageInfo?.color || ''}`}
                                >
                                  {stageInfo?.label || stage}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Members Only Courses Section */}
                    {membersOnlyCourses.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Lock className="h-3 w-3 mr-1" />
                            Members Only
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ({membersOnlyCourses.length} course{membersOnlyCourses.length !== 1 && "s"} - not public)
                          </span>
                        </div>
                        <div className="border rounded-md max-h-[150px] overflow-y-auto bg-muted/30">
                          {membersOnlyCourses.map((course) => (
                            <div
                              key={course.id}
                              className="flex items-center justify-between gap-3 p-3 border-b last:border-b-0"
                              data-testid={`members-only-course-${course.id}`}
                            >
                              <div className="flex-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-muted-foreground">{course.name}</span>
                                  {getCourseProvider(course.id) === "golfmanager" && (
                                    <Badge variant="outline" className="text-xs">Golfmanager</Badge>
                                  )}
                                  {getCourseProvider(course.id) === "teeone" && (
                                    <Badge variant="outline" className="text-xs">TeeOne</Badge>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {course.email || "No email"}
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                Private
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        {selectedCourseIds.length} course{selectedCourseIds.length !== 1 && "s"} selected
                        {recentlyContactedSelected.length > 0 && (
                          <span className="text-orange-600 ml-2">
                            ({recentlyContactedSelected.length} recently contacted)
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          onClick={() => setShowPreviewDialog(true)}
                          disabled={selectedCourseIds.length === 0}
                          data-testid="button-preview-email"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Preview Email
                        </Button>
                        <Button
                          onClick={handleSendEmails}
                          disabled={selectedCourseIds.length === 0 || selectedCourseIds.length > MAX_EMAIL_BATCH || sendEmailsMutation.isPending}
                          data-testid="button-send-emails"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendEmailsMutation.isPending ? "Sending..." : "Send Partnership Emails"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Preview Dialog */}
              <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Email Preview</DialogTitle>
                    <DialogDescription>
                      Preview of the email that will be sent (using first selected course)
                    </DialogDescription>
                  </DialogHeader>
                  {(() => {
                    const previewCourse = affiliateEmailCourses?.find(c => c.id === selectedCourseIds[0]);
                    const previewSubject = emailSubject.replace(/\[COURSE_NAME\]/g, previewCourse?.name || "[COURSE_NAME]");
                    const previewBody = emailBody
                      .replace(/\[COURSE_NAME\]/g, previewCourse?.name || "[COURSE_NAME]")
                      .replace(/\[SENDER_NAME\]/g, senderName || "[SENDER_NAME]");
                    
                    return (
                      <div className="space-y-4" data-testid="email-preview-content">
                        <div>
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <p className="text-sm font-medium">{previewCourse?.email || "No email"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Subject</Label>
                          <p className="text-sm font-medium" data-testid="preview-subject">{previewSubject}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Body</Label>
                          <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap font-mono" data-testid="preview-body">
                            {previewBody}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPreviewDialog(false)} data-testid="button-close-preview">
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Email Confirmation Dialog */}
              <EmailConfirmDialog
                open={showEmailConfirmDialog}
                onOpenChange={setShowEmailConfirmDialog}
                onConfirm={confirmSendEmails}
                recipients={pendingEmailRecipients}
                subject={emailSubject.replace(/\[COURSE_NAME\]/g, "...")}
                emailType="affiliate"
                isLoading={sendEmailsMutation.isPending}
              />

              {/* Re-send Confirmation Dialog */}
              <Dialog open={showResendConfirmDialog} onOpenChange={setShowResendConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      Recently Contacted Courses
                    </DialogTitle>
                    <DialogDescription>
                      Some of the selected courses were contacted within the last 7 days. Are you sure you want to send emails to them again?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {recentlyContactedSelected.map(courseId => {
                      const course = affiliateEmailCourses?.find(c => c.id === courseId);
                      const contactStatus = course ? isRecentlyContacted(course) : { daysAgo: 0 };
                      return (
                        <div key={courseId} className="flex items-center justify-between p-2 border rounded-md" data-testid={`resend-confirm-course-${courseId}`}>
                          <span className="text-sm font-medium">{course?.name}</span>
                          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                            {contactStatus.daysAgo} day{contactStatus.daysAgo !== 1 ? 's' : ''} ago
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowResendConfirmDialog(false)} data-testid="button-cancel-resend">
                      Cancel
                    </Button>
                    <Button onClick={confirmResendEmails} data-testid="button-confirm-resend">
                      <Send className="h-4 w-4 mr-2" />
                      Send Anyway
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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

          {/* Notifications Tab - Booking Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Booking Notifications
                  {(notifications?.length ?? 0) > 0 && (
                    <Badge variant="destructive" data-testid="badge-notifications-count">
                      {notifications?.length} unread
                    </Badge>
                  )}
                </CardTitle>
                {(notifications?.length ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllNotificationsReadMutation.mutate()}
                    disabled={markAllNotificationsReadMutation.isPending}
                    data-testid="button-mark-all-read"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark All Read
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {(notifications?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No unread notifications</p>
                    <p className="text-sm mt-1">New booking notifications will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications?.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-start gap-4 p-4 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => {
                          markNotificationReadMutation.mutate(notification.id);
                          setActiveTab("bookings");
                        }}
                        data-testid={`notification-card-${notification.id}`}
                      >
                        <div className="bg-primary/10 rounded-full p-2">
                          <Bell className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">New Booking</p>
                            <Badge variant="secondary" className="text-xs">
                              {notification.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">{notification.booking?.customerName || "Unknown"}</span>
                            {" • "}
                            {notification.courseName || "Unknown course"}
                            {" • "}
                            {notification.booking?.players || 0} players
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(notification.createdAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            markNotificationReadMutation.mutate(notification.id);
                          }}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Log Tab - Track all sent booking emails */}
          <TabsContent value="email-logs">
            <EmailLogTab 
              courses={courses || []}
              emailLogFilter={emailLogFilter}
              setEmailLogFilter={setEmailLogFilter}
              emailLogPage={emailLogPage}
              setEmailLogPage={setEmailLogPage}
              emailLogLimit={emailLogLimit}
            />
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
                      {(["unanswered", "all", "open", "replied", "closed", "archived", "deleted", "sent"] as const).map((filter) => (
                        <Button
                          key={filter}
                          variant={inboxFilter === filter ? "default" : "outline"}
                          size="sm"
                          className={`text-xs lg:text-sm px-2 lg:px-3 ${filter === "deleted" ? "text-destructive border-destructive/50" : ""} ${filter === "sent" ? "border-emerald-500/50" : ""}`}
                          onClick={() => setInboxFilter(filter)}
                          data-testid={`button-filter-${filter}`}
                        >
                          {filter === "deleted" ? (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('inbox.deleted')}
                            </>
                          ) : filter === "sent" ? (
                            <>
                              <Send className="h-3 w-3 mr-1" />
                              Sendt
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
                      {/* Sent emails view */}
                      {inboxFilter === "sent" ? (
                        isLoadingSentEmails ? (
                          <div className="flex items-center justify-center p-8">
                            <GolfLoader size="md" />
                          </div>
                        ) : sentEmails.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            Ingen sendte emails endnu
                          </div>
                        ) : (
                          <div className="divide-y">
                            {sentEmails
                              .filter(email => email.status === "SENT")
                              .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
                              .map((email) => (
                              <div
                                key={email.id}
                                className={`p-3 lg:p-3 cursor-pointer hover-elevate ${
                                  selectedSentEmail?.id === email.id ? "bg-accent" : ""
                                }`}
                                onClick={() => setSelectedSentEmail(email)}
                                data-testid={`row-sent-email-${email.id}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Send className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                      <span className="text-sm font-medium truncate">
                                        {email.courseName || "Ukendt bane"}
                                      </span>
                                    </div>
                                    <p className="text-sm truncate text-muted-foreground">
                                      {email.subject}
                                    </p>
                                    {email.courseEmail && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        Til: {email.courseEmail}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-xs text-muted-foreground">
                                      {email.sentAt ? format(new Date(email.sentAt), "MMM d") : "—"}
                                    </span>
                                    {email.openCount > 0 ? (
                                      <Badge variant="default" className="text-xs bg-emerald-600">
                                        {email.openCount}x åbnet
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Ikke åbnet
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : filteredThreads.length === 0 ? (
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
                                    {thread.hasAttachments && (
                                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    )}
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
              <div className={`lg:col-span-2 ${selectedThreadId || selectedSentEmail ? 'block' : 'hidden lg:block'}`}>
                <Card className="h-[calc(100vh-200px)] lg:h-[calc(100vh-300px)]">
                  {/* Sent Email Detail View */}
                  {inboxFilter === "sent" && selectedSentEmail ? (
                    <div className="flex flex-col h-full">
                      <CardHeader className="pb-2 lg:pb-3 border-b px-3 lg:px-6">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden flex-shrink-0"
                            onClick={() => setSelectedSentEmail(null)}
                            data-testid="button-back-to-sent-list"
                          >
                            <ArrowLeft className="h-5 w-5" />
                          </Button>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base lg:text-lg truncate">
                              {selectedSentEmail.subject?.replace(/\[COURSE_NAME\]/g, selectedSentEmail.courseName || "")}
                            </CardTitle>
                            <CardDescription className="flex flex-col gap-1 mt-1">
                              <span className="text-sm">
                                <strong>Til:</strong> {selectedSentEmail.courseEmail || "Ukendt"}
                              </span>
                              <span className="text-sm">
                                <strong>Bane:</strong> {selectedSentEmail.courseName || "Ukendt"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Sendt: {selectedSentEmail.sentAt ? format(new Date(selectedSentEmail.sentAt), "PPpp") : "—"}
                              </span>
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {selectedSentEmail.openCount > 0 ? (
                              <Badge variant="default" className="bg-emerald-600">
                                Åbnet {selectedSentEmail.openCount}x
                              </Badge>
                            ) : (
                              <Badge variant="outline">Ikke åbnet</Badge>
                            )}
                            {selectedSentEmail.openedAt && (
                              <span className="text-xs text-muted-foreground">
                                Første gang: {format(new Date(selectedSentEmail.openedAt), "PP")}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <ScrollArea className="flex-1 px-3 lg:px-6 py-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                          {selectedSentEmail.body
                            ?.replace(/\[COURSE_NAME\]/g, selectedSentEmail.courseName || "")
                            .replace(/\[SENDER_NAME\]/g, user?.firstName || "Morten")}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : !selectedThreadId ? (
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
                                {/* Attachments */}
                                {msg.attachmentsJson && (() => {
                                  try {
                                    // Handle both string (from API) and already parsed object
                                    const attachments = (typeof msg.attachmentsJson === 'string' 
                                      ? JSON.parse(msg.attachmentsJson) 
                                      : msg.attachmentsJson) as { name: string; size: number; type: string; documentId?: string }[];
                                    if (!attachments || attachments.length === 0) return null;
                                    return (
                                      <div className="mt-3 pt-3 border-t border-border/50">
                                        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                          <Paperclip className="h-3 w-3" />
                                          {attachments.length} vedhæftning{attachments.length !== 1 ? 'er' : ''}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-background rounded-md px-2 py-1 text-xs border">
                                              <FileText className="h-3 w-3 text-muted-foreground" />
                                              <span className="truncate max-w-[150px]">{att.name}</span>
                                              <span className="text-muted-foreground">
                                                ({Math.round(att.size / 1024)}KB)
                                              </span>
                                              {att.documentId && (
                                                <a
                                                  href={selectedThread.courseId 
                                                    ? `/api/admin/courses/${selectedThread.courseId}/documents/${att.documentId}/download`
                                                    : `/api/admin/documents/${att.documentId}/download`}
                                                  className="text-primary hover:underline"
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  data-testid={`download-attachment-${idx}`}
                                                >
                                                  <Download className="h-3 w-3" />
                                                </a>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}
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
                              <div className="flex gap-2">
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteApiKeyMutation.mutate(apiKey.id)}
                                  disabled={deleteApiKeyMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  data-testid={`button-delete-api-key-${apiKey.id}`}
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
              <DialogContent className="max-w-[95vw] sm:max-w-xl" data-testid="dialog-api-key-created">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API credentials now. The API key will not be shown again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-medium mb-1">Important</p>
                        <p>Make sure to copy these credentials and store them securely. The API key won't be shown again.</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* API URL */}
                  <div className="space-y-2">
                    <Label>API URL (Base Endpoint)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/api/v1/external`}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-api-url"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/v1/external`);
                          toast({
                            title: "Copied!",
                            description: "API URL copied to clipboard",
                          });
                        }}
                        data-testid="button-copy-api-url"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Use this base URL for all API requests</p>
                  </div>
                  
                  {/* API Key */}
                  <div className="space-y-2">
                    <Label>API Key</Label>
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
                    <p className="text-xs text-muted-foreground">Include in request header: <code className="bg-muted px-1 rounded">X-API-Key: your-key</code></p>
                  </div>
                  
                  {/* Copy Both Button */}
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      const apiUrl = `${window.location.origin}/api/v1/external`;
                      const copyText = `API URL: ${apiUrl}\nAPI Key: ${createdApiKey}`;
                      navigator.clipboard.writeText(copyText);
                      toast({
                        title: "Copied!",
                        description: "Both API URL and API key copied to clipboard",
                      });
                    }}
                    data-testid="button-copy-both"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Both
                  </Button>
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

          <TabsContent value="rates">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Kickback Rate Periods
                  </CardTitle>
                  <CardDescription>
                    View all seasonal kickback rates extracted from contracts. Filter by course or search by season.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by course or season..."
                        value={ratePeriodsSearchQuery}
                        onChange={(e) => setRatePeriodsSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-rate-periods-search"
                      />
                    </div>
                    <Select value={ratePeriodsCourseFilter} onValueChange={setRatePeriodsCourseFilter}>
                      <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-rate-periods-course">
                        <SelectValue placeholder="Filter by course" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Courses</SelectItem>
                        {courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoadingRatePeriods ? (
                    <div className="py-12">
                      <GolfLoader size="md" text="Loading rate periods..." />
                    </div>
                  ) : groupedRatePeriods.length > 0 ? (
                    <div className="space-y-2">
                      {groupedRatePeriods.map(([courseId, { courseName, periods }]) => (
                        <div key={courseId} className="border rounded-md overflow-hidden">
                          <button
                            onClick={() => toggleRateCourseExpanded(courseId)}
                            className="w-full flex items-center justify-between p-4 bg-muted/30 hover-elevate text-left"
                            data-testid={`button-expand-course-${courseId}`}
                          >
                            <div className="flex items-center gap-3">
                              <ChevronDown 
                                className={`h-4 w-4 transition-transform ${expandedRateCourses.has(courseId) ? '' : '-rotate-90'}`} 
                              />
                              <span className="font-medium">{courseName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {periods.length} rate{periods.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="default"
                                className="bg-green-600"
                              >
                                {(periods.reduce((sum, p) => sum + p.kickbackPercent, 0) / periods.length).toFixed(1)}% avg
                              </Badge>
                            </div>
                          </button>
                          {expandedRateCourses.has(courseId) && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Season</TableHead>
                                  <TableHead>Package</TableHead>
                                  <TableHead>Date Range</TableHead>
                                  <TableHead className="text-right">Rack</TableHead>
                                  <TableHead className="text-right">Net</TableHead>
                                  <TableHead className="text-right">%</TableHead>
                                  <TableHead>Includes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {periods.map((period) => (
                                  <TableRow key={period.id} data-testid={`rate-period-row-${period.id}`}>
                                    <TableCell>
                                      <Badge variant="outline">{period.seasonLabel}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium">
                                          {(period as any).packageType?.replace(/_/g, ' ') || 'Green Fee + Buggy'}
                                        </span>
                                        {(((period as any).isEarlyBird === "true" || (period as any).isEarlyBird === true) || ((period as any).isTwilight === "true" || (period as any).isTwilight === true)) && (
                                          <div className="flex gap-1">
                                            {((period as any).isEarlyBird === "true" || (period as any).isEarlyBird === true) && (
                                              <Badge variant="secondary" className="text-xs">Early Bird</Badge>
                                            )}
                                            {((period as any).isTwilight === "true" || (period as any).isTwilight === true) && (
                                              <Badge variant="secondary" className="text-xs">Twilight</Badge>
                                            )}
                                          </div>
                                        )}
                                        {(period as any).timeRestriction && (
                                          <span className="text-xs text-muted-foreground">{(period as any).timeRestriction}</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {period.startDate} - {period.endDate}
                                      {period.year && <span className="ml-1 text-xs">({period.year})</span>}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      €{period.rackRate.toFixed(0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      €{period.netRate.toFixed(0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge 
                                        variant={period.kickbackPercent >= 20 ? "default" : "secondary"}
                                        className={period.kickbackPercent >= 20 ? "bg-green-600" : ""}
                                      >
                                        {period.kickbackPercent.toFixed(1)}%
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {((period as any).includesBuggy === "true" || (period as any).includesBuggy === true) && (
                                          <Badge variant="outline" className="text-xs">Buggy</Badge>
                                        )}
                                        {((period as any).includesLunch === "true" || (period as any).includesLunch === true) && (
                                          <Badge variant="outline" className="text-xs">Lunch</Badge>
                                        )}
                                        {(period as any).minPlayersForDiscount && (
                                          <Badge variant="outline" className="text-xs text-green-600">
                                            {(period as any).freePlayersPerGroup || 1} free / {(period as any).minPlayersForDiscount}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Percent className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-2">No Rate Periods Found</p>
                      <p className="text-sm">
                        {ratePeriodsSearchQuery || ratePeriodsCourseFilter !== "ALL" 
                          ? "Try adjusting your search or filter" 
                          : "Upload and process contracts to extract rate periods"}
                      </p>
                    </div>
                  )}

                  {filteredRatePeriods.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {groupedRatePeriods.length} course{groupedRatePeriods.length !== 1 ? 's' : ''} • {filteredRatePeriods.length} rate period{filteredRatePeriods.length !== 1 ? "s" : ""}
                      </span>
                      <span>
                        Avg Kickback: {(filteredRatePeriods.reduce((sum, p) => sum + p.kickbackPercent, 0) / filteredRatePeriods.length).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Company Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your company profile and business details for partnership forms.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/admin/settings">
                    <Button data-testid="button-company-profile">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Company Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <ZestAutomationCard />
            </div>
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

                      {/* TeeOne API Credentials Section */}
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <FormLabel className="text-base font-semibold">TeeOne API Credentials</FormLabel>
                          <span className="text-xs text-muted-foreground">(Optional)</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Add TeeOne API credentials for courses using the TeeOne booking system (El Paraíso, Marbella Golf, etc.)
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={courseForm.control}
                            name="teeoneIdEmpresa"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company ID (idEmpresa)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="e.g., 26"
                                    data-testid="input-teeone-id-empresa"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={courseForm.control}
                            name="teeoneIdTeeSheet"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tee Sheet ID (idTeeSheet)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="e.g., 1"
                                    data-testid="input-teeone-id-teesheet"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={courseForm.control}
                          name="teeoneApiUser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Username</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="text"
                                  placeholder="Enter TeeOne API username"
                                  data-testid="input-teeone-api-user"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={courseForm.control}
                          name="teeoneApiPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Enter TeeOne API password"
                                  data-testid="input-teeone-api-password"
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
          <DialogContent className="w-full max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-onboarding">
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
          <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-contact-logs">
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
