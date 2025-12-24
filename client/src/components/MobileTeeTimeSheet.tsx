import { useState, useMemo } from "react";
import { X, Clock, Calendar, Sun, Sunset, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { format, startOfDay, addDays, isSameDay, type Locale } from "date-fns";
import { enGB, es, da, de, sv } from "date-fns/locale";
import type { CourseWithSlots, TeeTimeSlot, GolfCourse } from "@shared/schema";
import { groupSlotsByDate, groupSlotsByPeriod, formatTime, type TimePeriod } from "@/lib/teeTimeUtils";

interface MobileTeeTimeSheetProps {
  course: CourseWithSlots;
  open: boolean;
  onClose: () => void;
  onSelectSlot: (course: GolfCourse, slot: TeeTimeSlot) => void;
}

const localeMap: Record<string, Locale> = {
  en: enGB,
  es: es,
  da: da,
  de: de,
  sv: sv,
};

const periodIcons: Record<TimePeriod, typeof Sun> = {
  morning: Sun,
  midday: Sun,
  afternoon: Sunset,
  twilight: Sunset,
};

export function MobileTeeTimeSheet({ course, open, onClose, onSelectSlot }: MobileTeeTimeSheetProps) {
  const { t, language } = useI18n();
  const locale = localeMap[language] || enGB;
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (course.slots.length > 0) {
      return startOfDay(new Date(course.slots[0].teeTime));
    }
    return startOfDay(new Date());
  });
  
  const slotsByDate = useMemo(() => groupSlotsByDate(course.slots), [course.slots]);
  
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    slotsByDate.forEach((_, dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      dates.push(new Date(year, month - 1, day));
    });
    return dates.sort((a, b) => a.getTime() - b.getTime());
  }, [slotsByDate]);
  
  const slotsForSelectedDate = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return slotsByDate.get(dateKey) || [];
  }, [slotsByDate, selectedDate]);
  
  const groupedSlots = useMemo(() => groupSlotsByPeriod(slotsForSelectedDate), [slotsForSelectedDate]);
  
  const handleSelectSlot = (slot: TeeTimeSlot) => {
    if (course.course) {
      onSelectSlot(course.course, slot);
    }
  };
  
  if (!open) return null;
  
  const periodLabels: Record<TimePeriod, string> = {
    morning: t('mobile.calendar.morning') || 'Morning',
    midday: t('mobile.calendar.midday') || 'Midday',
    afternoon: t('mobile.calendar.afternoon') || 'Afternoon',
    twilight: t('mobile.calendar.twilight') || 'Twilight',
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-primary text-white">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
          data-testid="sheet-close-button"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg truncate">{course.courseName}</h2>
          <p className="text-sm text-white/80">{t('mobile.selectTime')}</p>
        </div>
      </header>
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="font-medium">{t('mobile.selectDate')}</span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {availableDates.map((date, idx) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const dateKey = format(date, 'yyyy-MM-dd');
              const slotCount = slotsByDate.get(dateKey)?.length || 0;
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition-all min-w-[70px] ${
                    isSelected
                      ? "bg-primary text-white shadow-md"
                      : "bg-white dark:bg-card border border-border hover:border-primary/50"
                  }`}
                  data-testid={`date-button-${dateKey}`}
                >
                  <span className={`text-xs uppercase ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {format(date, 'EEE', { locale })}
                  </span>
                  <span className={`text-xl font-bold ${isSelected ? "" : ""}`}>
                    {format(date, 'd')}
                  </span>
                  <span className={`text-xs ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {format(date, 'MMM', { locale })}
                  </span>
                  {isToday && !isSelected && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-1">
                      {t('mobile.calendar.today')}
                    </Badge>
                  )}
                  <span className={`text-[10px] mt-1 ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                    {slotCount} {t('mobile.times')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-medium">
              {format(selectedDate, 'EEEE, d MMMM', { locale })}
            </span>
          </div>
          
          {slotsForSelectedDate.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('mobile.noTimesAvailable')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(['morning', 'midday', 'afternoon', 'twilight'] as TimePeriod[]).map(period => {
                const slots = groupedSlots[period];
                if (slots.length === 0) return null;
                
                const Icon = periodIcons[period];
                
                return (
                  <div key={period}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {periodLabels[period]}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {slots.length}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot, idx) => {
                        const time = new Date(slot.teeTime);
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectSlot(slot)}
                            className="flex flex-col items-center p-3 rounded-xl border border-border bg-white dark:bg-card hover:border-primary hover:shadow-md transition-all"
                            data-testid={`slot-button-${period}-${idx}`}
                          >
                            <span className="text-lg font-semibold">
                              {formatTime(time)}
                            </span>
                            <span className="text-sm font-medium text-primary">
                              €{slot.greenFee}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {slot.players || 4} {t('mobile.players')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
