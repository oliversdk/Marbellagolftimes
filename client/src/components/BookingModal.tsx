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
import { CalendarIcon, Clock, ChevronRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import type { GolfCourse, CourseWithSlots, TeeTimeSlot, User } from "@shared/schema";

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
  const [step, setStep] = useState<'select-time' | 'fill-details'>('select-time');
  const [selectedSlot, setSelectedSlot] = useState<TeeTimeSlot | null>(null);
  const [searchDate, setSearchDate] = useState<Date>(new Date());
  const [players, setPlayers] = useState<string>("2");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Pre-fill from pre-selected slot if available (from home page)
  useEffect(() => {
    if (preSelectedSlot) {
      setSelectedSlot(preSelectedSlot);
      setStep('fill-details');
      setPlayers(preSelectedSlot.players.toString());
    } else {
      setStep('select-time');
      setSelectedSlot(null);
    }
  }, [preSelectedSlot, open]);

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
    setStep('fill-details');
  };

  const handleBackToSlots = () => {
    setStep('select-time');
    setSelectedSlot(null);
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
    });

    // Reset form
    setStep('select-time');
    setSelectedSlot(null);
    setSearchDate(new Date());
    setPlayers("2");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
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
                        <div className="font-medium text-sm sm:text-base">
                          {format(new Date(slot.teeTime), 'HH:mm')}
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
                  {format(new Date(selectedSlot.teeTime), "PPp")} • €{selectedSlot.greenFee}
                </span>
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
              onClick={handleBackToSlots}
              disabled={isPending}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full h-full max-h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-[500px] rounded-none sm:rounded-lg overflow-y-auto p-4 sm:p-6" 
        data-testid="dialog-booking"
      >
        {step === 'select-time' ? renderTimeSelection() : renderDetailsForm()}
      </DialogContent>
    </Dialog>
  );
}
