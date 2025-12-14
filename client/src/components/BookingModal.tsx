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
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Clock, ChevronRight, Car, Utensils, Sun, Sunset, Users, ShoppingBag } from "lucide-react";
import { format, addDays } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { AvailabilityDots } from "@/components/AvailabilityDots";
import type { GolfCourse, CourseWithSlots, TeeTimeSlot, User, CourseRatePeriod, CourseAddOn } from "@shared/schema";

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
    addOns?: { id: string; name: string; type: string; priceCents: number }[];
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
  const [step, setStep] = useState<'select-time' | 'customize-booking' | 'fill-details'>('select-time');
  const [selectedSlot, setSelectedSlot] = useState<TeeTimeSlot | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<SelectedPackage | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [searchDate, setSearchDate] = useState<Date>(new Date());
  const [players, setPlayers] = useState<number>(2);
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

  // Fetch course add-ons (buggy, clubs, trolley, etc.)
  const { data: courseAddOns = [] } = useQuery<CourseAddOn[]>({
    queryKey: ['/api/courses', course?.id, 'add-ons'],
    enabled: !!course?.id && open,
    queryFn: async () => {
      const res = await fetch(`/api/courses/${course!.id}/add-ons`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Calculate total price including add-ons
  const calculateTotal = () => {
    // If package selected, use package rate; otherwise use slot greenFee
    const baseRate = selectedPackage ? selectedPackage.rackRate : (selectedSlot?.greenFee || 0);
    let addOnsTotal = 0;
    
    courseAddOns.forEach(addon => {
      if (selectedAddOns.has(addon.id)) {
        const price = addon.priceCents / 100;
        if (addon.type === 'buggy_shared') {
          addOnsTotal += price * Math.ceil(players / 2);
        } else if (addon.perPlayer === 'true') {
          addOnsTotal += price * players;
        } else {
          addOnsTotal += price;
        }
      }
    });
    
    return (baseRate * players) + addOnsTotal;
  };

  // Toggle add-on selection
  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns(prev => {
      const next = new Set(prev);
      if (next.has(addOnId)) {
        next.delete(addOnId);
      } else {
        next.add(addOnId);
      }
      return next;
    });
  };

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
      // Don't set step here - wait for data to load
      setPlayers(preSelectedSlot.players || 2);
    } else {
      setStep('select-time');
      setSelectedSlot(null);
    }
  }, [preSelectedSlot, open]);

  // Navigate to customize-booking step after data is loaded (when slot is pre-selected)
  useEffect(() => {
    if (open && preSelectedSlot && selectedSlot && ratePeriods !== undefined) {
      // Data has loaded, always go to customize-booking step
      if (step !== 'fill-details') {
        setStep('customize-booking');
      }
    }
  }, [open, preSelectedSlot, selectedSlot, ratePeriods, step]);

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
      setSelectedAddOns(new Set());
      setSearchDate(new Date());
      setPlayers(2);
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
      params.append("players", String(players));
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
    // Always go to customize-booking step to allow players/add-ons selection
    setStep('customize-booking');
    // Adjust player count if it exceeds available slots
    const maxSlots = slot.slotsAvailable || 4;
    if (players > maxSlots) {
      setPlayers(maxSlots);
    }
  };

  const handlePackageSelect = (pkg: SelectedPackage) => {
    setSelectedPackage(pkg);
  };

  const handleBackToSlots = () => {
    setStep('select-time');
    setSelectedSlot(null);
    setSelectedPackage(null);
    setSelectedAddOns(new Set());
  };

  const handleContinueToDetails = () => {
    setStep('fill-details');
  };

  const handleBackToCustomize = () => {
    setStep('customize-booking');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !selectedSlot) return;

    // Build add-ons data for submission
    const addOnsData = courseAddOns
      .filter(addon => selectedAddOns.has(addon.id))
      .map(addon => ({
        id: addon.id,
        name: addon.name,
        type: addon.type,
        priceCents: addon.priceCents,
      }));

    onSubmit({
      courseId: course.id,
      teeTime: selectedSlot.teeTime,
      players,
      customerName,
      customerEmail,
      customerPhone,
      packageType: selectedPackage?.packageType,
      estimatedPrice: calculateTotal(),
      addOns: addOnsData,
    });

    // Reset form
    setStep('select-time');
    setSelectedSlot(null);
    setSelectedPackage(null);
    setSelectedAddOns(new Set());
    setSearchDate(new Date());
    setPlayers(2);
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
          <Select value={String(players)} onValueChange={(val) => {
            const n = parseInt(val, 10);
            if (!isNaN(n)) setPlayers(n);
          }}>
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

  const renderCustomizeBooking = () => {
    const maxSlots = selectedSlot?.slotsAvailable || 4;
    const basePrice = selectedPackage?.rackRate || selectedSlot?.greenFee || 0;

    return (
      <>
        <DialogHeader className="pb-2">
          <DialogTitle className="font-serif text-lg sm:text-xl">Customize Your Booking</DialogTitle>
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

        <div className="space-y-4 py-2 sm:py-4 flex-1 overflow-y-auto max-h-[50vh]">
          {/* Number of Players */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Number of Players
            </Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((num) => {
                const isDisabled = num > maxSlots;
                return (
                  <Button
                    key={num}
                    variant={players === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlayers(num)}
                    disabled={isDisabled}
                    data-testid={`button-players-${num}`}
                    title={isDisabled ? `Only ${maxSlots} ${maxSlots === 1 ? 'spot' : 'spots'} available` : undefined}
                  >
                    {num}
                  </Button>
                );
              })}
            </div>
            {maxSlots < 4 && (
              <p className="text-xs text-muted-foreground">
                {maxSlots} {maxSlots === 1 ? 'spot' : 'spots'} available for this tee time
              </p>
            )}
          </div>

          {/* Green Fee Summary */}
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm">Green Fee ({players}x €{basePrice})</span>
              <span className="font-medium">€{basePrice * players}</span>
            </div>
          </div>

          {/* Rate Period Packages (if available) */}
          {availablePackages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Special Packages (Optional)</Label>
              <div className="space-y-2" data-testid="list-packages">
                {availablePackages.map((pkg, index) => {
                  const isSelected = selectedPackage?.id === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPackage(isSelected ? null : pkg)}
                      data-testid={`package-option-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => setSelectedPackage(isSelected ? null : pkg)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
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
                          <div className="flex gap-1 flex-wrap items-center">
                            {pkg.includesBuggy && (
                              <Badge variant="outline" className="text-xs">
                                <Car className="h-3 w-3 mr-1" />Buggy
                              </Badge>
                            )}
                            {pkg.includesLunch && (
                              <Badge variant="outline" className="text-xs">
                                <Utensils className="h-3 w-3 mr-1" />Lunch
                              </Badge>
                            )}
                          </div>
                          {pkg.minPlayersForDiscount && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              {pkg.freePlayersPerGroup || 1} free per {pkg.minPlayersForDiscount} players
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-medium text-sm text-primary">€{pkg.rackRate}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {courseAddOns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Optional Add-ons</Label>
              <div className="space-y-2" data-testid="list-addons">
                {courseAddOns.map((addon) => {
                  const isSelected = selectedAddOns.has(addon.id);
                  const price = addon.priceCents / 100;
                  let displayPrice = price;
                  let priceLabel = "";
                  
                  if (addon.type === 'buggy_shared') {
                    displayPrice = price * Math.ceil(players / 2);
                    priceLabel = `€${price}/buggy`;
                  } else if (addon.perPlayer === 'true') {
                    displayPrice = price * players;
                    priceLabel = `€${price}/player`;
                  } else {
                    priceLabel = `€${price}`;
                  }

                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleAddOn(addon.id)}
                      data-testid={`addon-${addon.type}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAddOn(addon.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            {addon.type === 'buggy_shared' || addon.type === 'buggy_individual' ? (
                              <Car className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">{addon.name}</span>
                          </div>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground">{addon.description}</p>
                          )}
                          <span className="text-xs text-muted-foreground">{priceLabel}</span>
                        </div>
                      </div>
                      <span className="font-medium text-sm">
                        {isSelected ? `+€${displayPrice.toFixed(0)}` : `€${displayPrice.toFixed(0)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="p-4 bg-primary/10 rounded-md">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold text-primary">€{calculateTotal().toFixed(0)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Includes green fee for {players} player{players > 1 ? 's' : ''}{selectedAddOns.size > 0 ? ` + ${selectedAddOns.size} add-on${selectedAddOns.size > 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2 sm:pt-4 flex-col sm:flex-row gap-2">
          {!preSelectedSlot && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToSlots}
              data-testid="button-back-to-slots"
              className="w-full sm:w-auto min-h-[44px]"
            >
              {t('common.back')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-booking"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleContinueToDetails}
            data-testid="button-continue-booking"
            className="w-full sm:w-auto min-h-[44px]"
          >
            Continue - €{calculateTotal().toFixed(0)}
          </Button>
        </DialogFooter>
      </>
    );
  };

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
                  {format(new Date(selectedSlot.teeTime), "PPp")} • {players} player{players > 1 ? 's' : ''} • €{calculateTotal().toFixed(0)}
                </span>
              )}
              <span className="flex gap-1 mt-2 flex-wrap items-center">
                {selectedPackage && (
                  <Badge variant="secondary" className="text-xs">
                    {formatPackageType(selectedPackage.packageType)}
                  </Badge>
                )}
                {(selectedPackage?.includesBuggy || selectedAddOns.size > 0) && (
                  <>
                    {selectedPackage?.includesBuggy && (
                      <Badge variant="outline" className="text-xs">
                        <Car className="h-3 w-3 mr-1" />Buggy
                      </Badge>
                    )}
                    {selectedPackage?.includesLunch && (
                      <Badge variant="outline" className="text-xs">
                        <Utensils className="h-3 w-3 mr-1" />Lunch
                      </Badge>
                    )}
                    {selectedAddOns.size > 0 && (
                      <Badge variant="outline" className="text-xs">
                        +{selectedAddOns.size} add-on{selectedAddOns.size > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </>
                )}
              </span>
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
          <Button
            type="button"
            variant="outline"
            onClick={handleBackToCustomize}
            disabled={isPending}
            data-testid="button-back"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {t('common.back')}
          </Button>
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
      case 'customize-booking':
        return renderCustomizeBooking();
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
