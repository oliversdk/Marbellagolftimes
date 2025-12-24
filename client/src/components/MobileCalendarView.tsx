import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  startOfWeek, 
  endOfWeek,
  addDays,
  isBefore,
  isAfter,
  startOfDay
} from "date-fns";
import { enUS, es, da, sv, ru } from "date-fns/locale";
import type { Locale } from "date-fns";

const getLocale = (lang: string): Locale => {
  const locales: Record<string, Locale> = { en: enUS, es, da, sv, ru };
  return locales[lang] || enUS;
};

interface MobileCalendarViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  availableDates?: Date[];
}

export function MobileCalendarView({
  selectedDate,
  onDateSelect,
  availableDates = [],
}: MobileCalendarViewProps) {
  const { t, language } = useI18n();
  const locale = getLocale(language);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const availableDateSet = useMemo(() => {
    return new Set(availableDates.map(d => format(d, 'yyyy-MM-dd')));
  }, [availableDates]);

  const hasAvailability = (date: Date) => {
    return availableDateSet.has(format(date, 'yyyy-MM-dd'));
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      return format(day, 'EEE', { locale });
    });
  }, [locale]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    if (!isBefore(endOfMonth(prevMonth), today)) {
      setCurrentMonth(prevMonth);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const canGoPrev = !isBefore(endOfMonth(subMonths(currentMonth, 1)), today);

  const handleDateClick = (date: Date) => {
    if (isBefore(date, today)) return;
    onDateSelect(date);
  };

  const isSelected = (date: Date) => isSameDay(date, selectedDate);
  const isToday = (date: Date) => isSameDay(date, today);
  const isPast = (date: Date) => isBefore(date, today);
  const isCurrentMonth = (date: Date) => isSameMonth(date, currentMonth);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm" data-testid="mobile-calendar-view">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground" data-testid="calendar-title">
          {t('mobile.selectDate')}
        </h3>
      </div>

      <div className="flex gap-2 mb-4" data-testid="quick-select-buttons">
        <Button
          variant={isSameDay(selectedDate, today) ? "default" : "outline"}
          className="flex-1 h-11 rounded-xl font-medium"
          onClick={() => onDateSelect(today)}
          data-testid="button-today"
        >
          {t('mobile.today')}
        </Button>
        <Button
          variant={isSameDay(selectedDate, tomorrow) ? "default" : "outline"}
          className="flex-1 h-11 rounded-xl font-medium"
          onClick={() => onDateSelect(tomorrow)}
          data-testid="button-tomorrow"
        >
          {t('mobile.tomorrow')}
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className="h-10 w-10 rounded-full"
          data-testid="button-prev-month"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold text-foreground" data-testid="current-month">
          {format(currentMonth, 'MMMM yyyy', { locale })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-10 w-10 rounded-full"
          data-testid="button-next-month"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2" data-testid="weekday-headers">
        {weekDays.map((day) => (
          <div 
            key={day} 
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
        {calendarDays.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const selected = isSelected(date);
          const todayDate = isToday(date);
          const past = isPast(date);
          const currentMo = isCurrentMonth(date);
          const available = hasAvailability(date);

          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(date)}
              disabled={past}
              className={`
                relative flex flex-col items-center justify-center
                h-12 w-full rounded-full
                transition-all duration-150
                ${selected 
                  ? 'bg-primary text-primary-foreground font-semibold' 
                  : todayDate && !selected
                    ? 'bg-primary/10 text-primary font-medium'
                    : past 
                      ? 'text-muted-foreground/40 cursor-not-allowed' 
                      : currentMo 
                        ? 'text-foreground hover-elevate' 
                        : 'text-muted-foreground/50'
                }
              `}
              data-testid={`calendar-day-${dateKey}`}
            >
              <span className="text-sm">{format(date, 'd')}</span>
              {available && !past && (
                <span 
                  className={`
                    absolute bottom-1.5 w-1.5 h-1.5 rounded-full
                    ${selected ? 'bg-primary-foreground' : 'bg-primary'}
                  `}
                  data-testid={`availability-dot-${dateKey}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>{t('mobile.availableTimes')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
