import { format } from "date-fns";

export interface CalendarEventDetails {
  summary: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizer?: string;
}

/**
 * Generates an iCalendar (.ics) file content for a booking
 * Following RFC 5545 iCalendar specification
 */
export function generateICalendar(event: CalendarEventDetails): string {
  // Helper function to format date for iCal (YYYYMMDDTHHmmssZ)
  const formatICalDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  // Generate unique identifier
  const uid = `${Date.now()}@fridasgolf.com`;
  
  // Current timestamp for DTSTAMP
  const now = new Date();
  const dtstamp = formatICalDate(now);
  
  // Format start and end times
  const dtstart = formatICalDate(event.startTime);
  const dtend = formatICalDate(event.endTime);
  
  // Escape special characters in text fields
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  // Build iCalendar content
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fridas Golf//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    event.organizer ? `ORGANIZER:${event.organizer}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${escapeText(event.summary)} tomorrow`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line !== null);
  
  // Join with CRLF as per RFC 5545
  return lines.join('\r\n');
}

/**
 * Generates a Google Calendar URL for adding an event
 */
export function generateGoogleCalendarUrl(event: CalendarEventDetails): string {
  const formatGoogleDate = (date: Date): string => {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    details: event.description,
    location: event.location,
    dates: `${formatGoogleDate(event.startTime)}/${formatGoogleDate(event.endTime)}`
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
