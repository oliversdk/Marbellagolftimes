import type { TeeTimeSlot } from "@shared/schema";

export type TimePeriod = 'morning' | 'midday' | 'afternoon' | 'twilight';

export function getCheapestSlot(slots: TeeTimeSlot[]): TeeTimeSlot | null {
  if (slots.length === 0) return null;
  return slots.reduce((cheapest, current) => 
    current.greenFee < cheapest.greenFee ? current : cheapest
  );
}

export function getTimePeriod(teeTime: Date): TimePeriod {
  const hour = teeTime.getHours();
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  return 'twilight';
}

export function groupSlotsByPeriod(slots: TeeTimeSlot[]): Record<TimePeriod, TeeTimeSlot[]> {
  const groups: Record<TimePeriod, TeeTimeSlot[]> = {
    morning: [],
    midday: [],
    afternoon: [],
    twilight: []
  };
  
  slots.forEach(slot => {
    const period = getTimePeriod(new Date(slot.teeTime));
    groups[period].push(slot);
  });
  
  Object.values(groups).forEach(group => 
    group.sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime())
  );
  
  return groups;
}

export function groupSlotsByDate(slots: TeeTimeSlot[]): Map<string, TeeTimeSlot[]> {
  const groups = new Map<string, TeeTimeSlot[]>();
  
  slots.forEach(slot => {
    const date = new Date(slot.teeTime);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(slot);
  });
  
  groups.forEach(group => 
    group.sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime())
  );
  
  return groups;
}

export function getAvailableDates(slots: TeeTimeSlot[]): Set<string> {
  const dates = new Set<string>();
  
  slots.forEach(slot => {
    const date = new Date(slot.teeTime);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dates.add(dateKey);
  });
  
  return dates;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function getTimePeriodLabel(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    morning: "Morning",
    midday: "Midday",
    afternoon: "Afternoon",
    twilight: "Twilight"
  };
  return labels[period];
}
