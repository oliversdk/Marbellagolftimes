import { useState, useEffect } from "react";
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
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import type { GolfCourse } from "@shared/schema";

interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  source: string;
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
  }) => void;
  isPending?: boolean;
}

export function BookingModal({
  course,
  selectedSlot,
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: BookingModalProps) {
  const { t } = useI18n();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>("09:00");
  const [players, setPlayers] = useState<string>("2");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Pre-fill from selected slot if available
  useEffect(() => {
    if (selectedSlot) {
      const slotDate = new Date(selectedSlot.teeTime);
      setDate(slotDate);
      setTime(format(slotDate, "HH:mm"));
      setPlayers(selectedSlot.players.toString());
    }
  }, [selectedSlot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;

    let teeTime: string;
    if (selectedSlot) {
      // Use the exact slot time
      teeTime = selectedSlot.teeTime;
    } else if (date) {
      // Manual time selection
      const teeTimeDate = new Date(date);
      const [hours, minutes] = time.split(":");
      teeTimeDate.setHours(parseInt(hours), parseInt(minutes));
      teeTime = teeTimeDate.toISOString();
    } else {
      return;
    }

    onSubmit({
      courseId: course.id,
      teeTime,
      players: parseInt(players),
      customerName,
      customerEmail,
      customerPhone,
    });

    // Reset form
    setDate(undefined);
    setTime("09:00");
    setPlayers("2");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-booking">
        <DialogHeader>
          <DialogTitle className="font-serif">{t('booking.title')}</DialogTitle>
          <DialogDescription>
            {course && (
              <>
                <span className="font-medium text-foreground block">
                  {course.name} - {course.city}
                </span>
                {selectedSlot && (
                  <span className="text-sm text-primary mt-1 block">
                    {format(new Date(selectedSlot.teeTime), "PPp")} • €{selectedSlot.greenFee}
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="booking-date">{t('search.date')}</Label>
              <Button
                id="booking-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid="button-select-date"
                disabled
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : t('booking.selectDate')}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-time">{t('admin.time')}</Label>
              <Button
                id="booking-time"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid="select-time"
                disabled
              >
                <Clock className="mr-2 h-4 w-4" />
                {time}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-players">{t('booking.numberOfPlayers')}</Label>
            <Select value={players} onValueChange={setPlayers}>
              <SelectTrigger id="booking-players" data-testid="select-players">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? t('search.player') : t('search.players')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-name">{t('booking.name')}</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('placeholders.name')}
              required
              data-testid="input-customer-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">{t('booking.email')}</Label>
            <Input
              id="customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder={t('placeholders.email')}
              required
              data-testid="input-customer-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">{t('booking.phone')}</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t('placeholders.phone')}
              data-testid="input-customer-phone"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel-booking"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={(!date && !selectedSlot) || isPending}
              data-testid="button-submit-booking"
            >
              {isPending ? t('common.loading') : t('booking.submitBooking')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
