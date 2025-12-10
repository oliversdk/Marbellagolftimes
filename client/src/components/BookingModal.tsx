import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, ChevronRight, Car, Utensils, Sun, Sunset, Users } from "lucide-react";
import { format, addDays } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { AvailabilityDots } from "@/components/AvailabilityDots";
import type { GolfCourse, CourseWithSlots, TeeTimeSlot, User, CourseRatePeriod } from "@shared/schema";

interface SelectedPackage {
  id: string;
  packageType: string;
  rackRate: number;
  netRate: number;
  includesBuggy: boolean;
  includesLunch: boolean;
  isEarlyBird: boolean;
  isTwilight: boolean;
  timeRestriction?: string | null;
  minPlayersForDiscount?: number | null;
  freePlayersPerGroup?: number | null;
}

interface BookingModalProps {
  course: GolfCourse | null;
  selectedSlot?: TeeTimeSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    courseId: string;
    teeTime: string;
    players: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    packageType?: string;
    estimatedPrice?: number;
  }) => void;
  isPending?: boolean;
}

export function BookingModal({
  course,
  selectedSlot: preSelectedSlot,
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: BookingModalProps) {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState<'select-time' | 'select-package' | 'fill-details'>('select-time');
  const [selectedSlot, setSelectedSlot] = useState<TeeTimeSlot | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<SelectedPackage | null>(null);
  const [searchDate, setSearchDate] = useState<Date>(new Date());
  const [players, setPlayers] = useState<string>("2");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Fetch rate periods/packages for this course
  const { data: ratePeriods } = useQuery<CourseRatePeriod[]>({
    queryKey: ["/api/rate-periods", course?.id],
    enabled: !!course?.id && open,
    queryFn: async () => {
      const res = await fetch(`/api/rate-periods?courseId=${course!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Helper to handle boolean values (may come as string "true"/"false" or actual booleans)
  const toBool = (val: any): boolean => val === true || val === "true";

  // Helper to parse time string to minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d{1,2}):?(\d{2})?/);
    if (!match) return -1;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  };

  // Check if a package is valid for the given tee time
  const isPackageValidForTime = (pkg: {
    isEarlyBird: boolean;
    isTwilight: boolean;
    timeRestriction?: string | null;
  }, teeTimeDate: Date): boolean => {
    const slotHour = teeTimeDate.getHours();
    const slotMinutes = teeTimeDate.getMinutes();
    const slotTotalMinutes = slotHour * 60 + slotMinutes;

    // Early Bird is typically before 10:00 AM
    if (pkg.isEarlyBird) {
      // Parse timeRestriction if available (e.g., "8:00-9:00")
      if (pkg.timeRestriction) {
        const parts = pkg.timeRestriction.split('-');
        if (parts.length === 2) {
          const startMinutes = parseTimeToMinutes(parts[0]);
          const endMinutes = parseTimeToMinutes(parts[1]);
          if (startMinutes >= 0 && endMinutes >= 0) {
            return slotTotalMinutes >= startMinutes && slotTotalMinutes <= endMinutes;
          }
        }
      }
      // Default: Early Bird is before 10:00 AM
      return slotHour < 10;
    }

    // Twilight is typically 3:00 PM (15:00) onwards
    if (pkg.isTwilight) {
      // Parse timeRestriction if available (e.g., "from 15:00" or "15:00-20:00")
      if (pkg.timeRestriction) {
        const fromMatch = pkg.timeRestriction.match(/from\s*(\d{1,2}):?(\d{2})?/i);
        if (fromMatch) {
          const fromHour = parseInt(fromMatch[1], 10);
          const fromMinutes = parseInt(fromMatch[2] || '0', 10);
          return slotTotalMinutes >= (fromHour * 60 + fromMinutes);
        }
        // Also handle "15:00 onwards" format
        const onwardsMatch = pkg.timeRestriction.match(/(\d{1,2}):?(\d{2})?\s*onwards/i);
        if (onwardsMatch) {
          const fromHour = parseInt(onwardsMatch[1], 10);
          const fromMinutes = parseInt(onwardsMatch[2] || '0', 10);
          return slotTotalMinutes >= (fromHour * 60 + fromMinutes);
        }
        // Handle range format "15:00-20:00"
        const parts = pkg.timeRestriction.split('-');
        if (parts.length === 2) {
          const startMinutes = parseTimeToMinutes(parts[0]);
          const endMinutes = parseTimeToMinutes(parts[1]);
          if (startMinutes >= 0 && endMinutes >= 0) {
            return slotTotalMinutes >= startMinutes && slotTotalMinutes <= endMinutes;
          }
        }
      }
      // Default: Twilight is 3:00 PM (15:00) onwards
      return slotHour >= 15;
    }

    // No time restriction - package is always valid
    return true;
  };

  // Get unique packages for selection - distinguish by all package characteristics
  const allPackages = ratePeriods?.reduce((acc, rp) => {
    const packageType = (rp as any).packageType || 'GREEN_FEE_BUGGY';
    const includesBuggy = toBool((rp as any).includesBuggy);
    const includesLunch = toBool((rp as any).includesLunch);
    const isEarlyBird = toBool((rp as any).isEarlyBird);
    const isTwilight = toBool((rp as any).isTwilight);
    const timeRestriction = (rp as any).timeRestriction || '';
    const minPlayersForDiscount = (rp as any).minPlayersForDiscount || 0;
    const freePlayersPerGroup = (rp as any).freePlayersPerGroup || 0;
    
    // Create unique key based on ALL package characteristics including group discounts
    const key = `${packageType}|${includesBuggy}|${includesLunch}|${isEarlyBird}|${isTwilight}|${timeRestriction}|${minPlayersForDiscount}|${freePlayersPerGroup}`;
    
    if (!acc.find(p => {
      const pKey = `${p.packageType}|${p.includesBuggy}|${p.includesLunch}|${p.isEarlyBird}|${p.isTwilight}|${p.timeRestriction || ''}|${p.minPlayersForDiscount || 0}|${p.freePlayersPerGroup || 0}`;
      return pKey === key;
    })) {
      acc.push({
        id: rp.id,
        packageType,
        rackRate: rp.rackRate || 0,
        netRate: rp.rackRate || 0, // Use rackRate as displayed price (netRate not exposed to public)
        includesBuggy,
        includesLunch,
        isEarlyBird,
        isTwilight,
        timeRestriction: timeRestriction || undefined,
        minPlayersForDiscount: minPlayersForDiscount || undefined,
        freePlayersPerGroup: freePlayersPerGroup || undefined,
      });
    }
    return acc;
  }, [] as SelectedPackage[]) || [];

  // Filter packages based on selected slot time
  const availablePackages = selectedSlot
    ? allPackages.filter(pkg => isPackageValidForTime(pkg, new Date(selectedSlot.teeTime)))
    : allPackages;

  // Pre-fill from pre-selected slot if available (from home page)
  useEffect(() => {
    if (preSelectedSlot) {
      setSelectedSlot(preSelectedSlot);
      // Don't set step here - wait for packages to load
      setPlayers(preSelectedSlot.players.toString());
    } else {
      setStep('select-time');
      setSelectedSlot(null);
    }
  }, [preSelectedSlot, open]);

  // Navigate to correct step after packages are loaded (when slot is pre-selected)
  useEffect(() => {
    if (open && preSelectedSlot && selectedSlot && ratePeriods !== undefined) {
      // Packages have loaded, now determine the correct step
      if (availablePackages.length > 0 && !selectedPackage) {
        setStep('select-package');
      } else if (step !== 'fill-details') {
        setStep('fill-details');
      }
    }
  }, [open, preSelectedSlot, selectedSlot, ratePeriods, availablePackages.length, selectedPackage, step]);

  // Auto-fill name/email/phone for logged-in users when modal opens
  useEffect(() => {
    if (open && isAuthenticated && user) {
      const typedUser = user as User;
      setCustomerName(`${typedUser.firstName} ${typedUser.lastName}`);
      setCustomerEmail(typedUser.email || "");
      setCustomerPhone(typedUser.phoneNumber || "");
    }
  }, [open, isAuthenticated, user]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep('select-time');
      setSelectedSlot(null);
      setSelectedPackage(null);
      setSearchDate(new Date());
      setPlayers("2");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
    }
  }, [open]);

  // Fetch available slots for this course
  const { data: availableSlots, isLoading } = useQuery<CourseWithSlots[]>({
    queryKey: [
      "/api/slots/search",
      course?.lat,
      course?.lng,
      searchDate.toISOString(),
      players,
    ],
    enabled: open && step === 'select-time' && !preSelectedSlot && !!course?.lat && !!course?.lng,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (course?.lat) params.append("lat", course.lat);
      if (course?.lng) params.append("lng", course.lng);
      params.append("date", searchDate.toISOString());
      params.append("players", players);
      params.append("fromTime", "07:00");
      params.append("toTime", "20:00");
      params.append("holes", "18");

      const response = await fetch(`/api/slots/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch slots");
      return response.json();
    },
  });

  // Get slots for current course
  const courseSlots = availableSlots?.find(s => s.courseId === course?.id);

  const handleSlotSelect = (slot: TeeTimeSlot) => {
    setSelectedSlot(slot);
    // If packages are available, go to package selection; otherwise straight to details
    if (availablePackages.length > 0) {
      setStep('select-package');
    } else {
      setStep('fill-details');
    }
  };

  const handlePackageSelect = (pkg: SelectedPackage) => {
    setSelectedPackage(pkg);
    setStep('fill-details');
  };

  const handleBackToSlots = () => {
    setStep('select-time');
    setSelectedSlot(null);
    setSelectedPackage(null);
  };

  const handleBackToPackages = () => {
    setStep('select-package');
    setSelectedPackage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !selectedSlot) return;

    onSubmit({
      courseId: course.id,
      teeTime: selectedSlot.teeTime,
      players: parseInt(players),
      customerName,
      customerEmail,
      customerPhone,
      packageType: selectedPackage?.packageType,
      estimatedPrice: selectedPackage?.rackRate || selectedSlot.greenFee,
    });

    // Reset form
    setStep('select-time');
    setSelectedSlot(null);
    setSelectedPackage(null);
    setSearchDate(new Date());
    setPlayers("2");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  // Format package type for display
  const formatPackageType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/GREEN FEE/g, 'Green Fee');
  };

  const renderTimeSelection = () => (
    <>
      <DialogHeader className="pb-2">
        <DialogTitle className="font-serif text-lg sm:text-xl">{t('booking.title')}</DialogTitle>
        <DialogDescription>
          {course && (
            <span className="font-medium text-foreground block text-sm sm:text-base">
              {course.name} - {course.city}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 sm:py-4 flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={searchDate.toDateString() === new Date().toDateString() ? "default" : "outline"}
            onClick={() => setSearchDate(new Date())}
            size="default"
            className="flex-1 min-h-[44px] text-xs sm:text-sm"
            data-testid="button-date-today"
          >
            {t('common.today')}
          </Button>
          <Button
            variant={searchDate.toDateString() === addDays(new Date(), 1).toDateString() ? "default" : "outline"}
            onClick={() => setSearchDate(addDays(new Date(), 1))}
            size="default"
            className="flex-1 min-h-[44px] text-xs sm:text-sm"
            data-testid="button-date-tomorrow"
          >
            {t('common.tomorrow')}
          </Button>
          <Button
            variant={searchDate.toDateString() === addDays(new Date(), 2).toDateString() ? "default" : "outline"}
            onClick={() => setSearchDate(addDays(new Date(), 2))}
            size="default"
            className="flex-1 min-h-[44px] text-xs sm:text-sm"
            data-testid="button-date-day-after"
          >
            {format(addDays(new Date(), 2), 'EEE')}
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">{t('booking.numberOfPlayers')}</Label>
          <Select value={players} onValueChange={setPlayers}>
            <SelectTrigger data-testid="select-players-search" className="min-h-[44px] text-base sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((num) => (
                <SelectItem key={num} value={num.toString()} className="min-h-[44px]">
                  {num} {num === 1 ? t('search.player') : t('search.players')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1">
          <Label className="text-sm">{t('booking.availableTimes')}</Label>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : courseSlots && courseSlots.slots.length > 0 ? (
            <div className="max-h-[40vh] sm:max-h-[300px] overflow-y-auto space-y-2 pr-1" data-testid="list-available-slots">
              {courseSlots.slots.map((slot, index) => (
                <Card
                  key={index}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => handleSlotSelect(slot)}
                  data-testid={`slot-option-${index}`}
                >
                  <CardContent className="flex items-center justify-between p-3 sm:p-4 min-h-[56px] sm:min-h-16">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm sm:text-base">
                            {format(new Date(slot.teeTime), 'HH:mm')}
                          </span>
                          {slot.slotsAvailable !== undefined && (
                            <AvailabilityDots 
                              slotsAvailable={slot.slotsAvailable} 
                              size="sm"
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(slot.teeTime), 'PPP')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary text-sm sm:text-base">
                        €{slot.greenFee}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
                {t('home.noTeeTimesMessage')}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DialogFooter className="pt-2 sm:pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          data-testid="button-cancel-booking"
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('common.cancel')}
        </Button>
      </DialogFooter>
    </>
  );

  const renderPackageSelection = () => (
    <>
      <DialogHeader className="pb-2">
        <DialogTitle className="font-serif text-lg sm:text-xl">Select Package</DialogTitle>
        <DialogDescription>
          {course && (
            <>
              <span className="font-medium text-foreground block text-sm sm:text-base">
                {course.name} - {course.city}
              </span>
              {selectedSlot && (
                <span className="text-xs sm:text-sm text-primary mt-1 block">
                  {format(new Date(selectedSlot.teeTime), "PPp")}
                </span>
              )}
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 sm:py-4 flex-1 overflow-y-auto">
        <Label className="text-sm">Choose your package</Label>
        <div className="space-y-2" data-testid="list-packages">
          {availablePackages.map((pkg, index) => (
            <Card
              key={pkg.id}
              className="hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => handlePackageSelect(pkg)}
              data-testid={`package-option-${index}`}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm sm:text-base">
                        {formatPackageType(pkg.packageType)}
                      </span>
                      {pkg.isEarlyBird && (
                        <Badge variant="secondary" className="text-xs">
                          <Sun className="h-3 w-3 mr-1" />
                          Early Bird
                        </Badge>
                      )}
                      {pkg.isTwilight && (
                        <Badge variant="secondary" className="text-xs">
                          <Sunset className="h-3 w-3 mr-1" />
                          Twilight
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {pkg.includesBuggy && (
                        <Badge variant="outline" className="text-xs">
                          <Car className="h-3 w-3 mr-1" />
                          Buggy
                        </Badge>
                      )}
                      {pkg.includesLunch && (
                        <Badge variant="outline" className="text-xs">
                          <Utensils className="h-3 w-3 mr-1" />
                          Lunch
                        </Badge>
                      )}
                    </div>
                    {pkg.timeRestriction && (
                      <span className="text-xs text-muted-foreground block">
                        {pkg.timeRestriction}
                      </span>
                    )}
                    {pkg.minPlayersForDiscount && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {pkg.freePlayersPerGroup || 1} free per {pkg.minPlayersForDiscount} players
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary text-sm sm:text-base">
                      €{pkg.rackRate}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <DialogFooter className="pt-2 sm:pt-4 flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBackToSlots}
          data-testid="button-back-to-slots"
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('common.back')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          data-testid="button-cancel-booking"
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('common.cancel')}
        </Button>
      </DialogFooter>
    </>
  );

  const renderDetailsForm = () => (
    <>
      <DialogHeader className="pb-2">
        <DialogTitle className="font-serif text-lg sm:text-xl">{t('booking.title')}</DialogTitle>
        <DialogDescription>
          {course && (
            <>
              <span className="font-medium text-foreground block text-sm sm:text-base">
                {course.name} - {course.city}
              </span>
              {selectedSlot && (
                <span className="text-xs sm:text-sm text-primary mt-1 block">
                  {format(new Date(selectedSlot.teeTime), "PPp")} • €{selectedPackage?.rackRate || selectedSlot.greenFee}
                </span>
              )}
              {selectedPackage && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {formatPackageType(selectedPackage.packageType)}
                  </Badge>
                  {selectedPackage.includesBuggy && (
                    <Badge variant="outline" className="text-xs">
                      <Car className="h-3 w-3 mr-1" />Buggy
                    </Badge>
                  )}
                  {selectedPackage.includesLunch && (
                    <Badge variant="outline" className="text-xs">
                      <Utensils className="h-3 w-3 mr-1" />Lunch
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 py-2 sm:py-4">
        <div className="space-y-2">
          <Label htmlFor="customer-name" className="text-sm">{t('booking.name')}</Label>
          <Input
            id="customer-name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('placeholders.name')}
            required
            data-testid="input-customer-name"
            className="min-h-[44px] text-base sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-email" className="text-sm">{t('booking.email')}</Label>
          <Input
            id="customer-email"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder={t('placeholders.email')}
            required
            data-testid="input-customer-email"
            className="min-h-[44px] text-base sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-phone" className="text-sm">{t('booking.phone')}</Label>
          <Input
            id="customer-phone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder={t('placeholders.phone')}
            data-testid="input-customer-phone"
            className="min-h-[44px] text-base sm:text-sm"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 sm:pt-4">
          {!preSelectedSlot && (
            <Button
              type="button"
              variant="outline"
              onClick={availablePackages.length > 0 ? handleBackToPackages : handleBackToSlots}
              disabled={isPending}
              data-testid="button-back"
              className="w-full sm:w-auto min-h-[44px]"
            >
              {t('common.back')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel-booking"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="button-submit-booking"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isPending ? t('common.loading') : t('booking.submitBooking')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 'select-time':
        return renderTimeSelection();
      case 'select-package':
        return renderPackageSelection();
      case 'fill-details':
        return renderDetailsForm();
      default:
        return renderTimeSelection();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full h-full max-h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-[500px] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6" 
        data-testid="dialog-booking"
      >
        {renderCurrentStep()}
      </DialogContent>
    </Dialog>
  );
}
