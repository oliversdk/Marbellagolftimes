import { useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import type { GolfCourse } from "@shared/schema";

interface BookingModalProps {
  course: GolfCourse | null;
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
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: BookingModalProps) {
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>("09:00");
  const [players, setPlayers] = useState<string>("2");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !date) return;

    const teeTime = new Date(date);
    const [hours, minutes] = time.split(":");
    teeTime.setHours(parseInt(hours), parseInt(minutes));

    onSubmit({
      courseId: course.id,
      teeTime: teeTime.toISOString(),
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
          <DialogTitle className="font-serif">Book Tee Time</DialogTitle>
          <DialogDescription>
            {course && (
              <span className="font-medium text-foreground">
                {course.name} - {course.city}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="booking-date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="booking-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-time">Time</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="booking-time" data-testid="select-time">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
                    <SelectItem key={hour} value={`${hour.toString().padStart(2, "0")}:00`}>
                      {hour.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-players">Number of Players</Label>
            <Select value={players} onValueChange={setPlayers}>
              <SelectTrigger id="booking-players" data-testid="select-players">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? "Player" : "Players"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-name">Your Name</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe"
              required
              data-testid="input-customer-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              required
              data-testid="input-customer-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone (Optional)</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+34 600 000 000"
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!date || isPending}
              data-testid="button-submit-booking"
            >
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
