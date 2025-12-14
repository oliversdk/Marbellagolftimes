import type { GolfCourse } from "@shared/schema";
import { format } from "date-fns";

export interface BookingDetails {
  id: string;
  courseName: string;
  courseCity: string;
  customerName: string;
  teeTime: Date;
  players: number;
  courseLat?: string | null;
  courseLng?: string | null;
  totalAmountCents?: number | null;
}

export function bookingConfirmationEmail(booking: BookingDetails) {
  const formattedDate = format(booking.teeTime, "EEEE, MMMM d, yyyy");
  const formattedTime = format(booking.teeTime, "h:mm a");
  
  const latStr = booking.courseLat ? String(booking.courseLat) : null;
  const lngStr = booking.courseLng ? String(booking.courseLng) : null;
  const hasCoordinates = latStr && lngStr && latStr !== '' && lngStr !== '';
  const googleMapsUrl = hasCoordinates 
    ? `https://www.google.com/maps/dir/?api=1&destination=${latStr},${lngStr}`
    : null;
  
  const totalAmount = booking.totalAmountCents 
    ? `€${(booking.totalAmountCents / 100).toFixed(2)}`
    : null;

  const directionsHtml = googleMapsUrl ? `
            <div class="detail-item">
              <span class="detail-label">Directions:</span>
              <span class="detail-value"><a href="${googleMapsUrl}" style="color: #2F4C3A; text-decoration: underline;">Get Driving Directions</a></span>
            </div>` : '';
  
  const totalAmountHtml = totalAmount ? `
            <div class="detail-item">
              <span class="detail-label">Total Paid:</span>
              <span class="detail-value" style="font-weight: 600; color: #2F4C3A;">${totalAmount}</span>
            </div>` : '';

  const directionsText = googleMapsUrl ? `Driving Directions: ${googleMapsUrl}` : '';
  const totalAmountText = totalAmount ? `Total Paid: ${totalAmount}` : '';

  return {
    subject: `Booking Confirmed - ${booking.courseName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e1e1e;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #2F4C3A 0%, #8FAE8D 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .booking-details {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .detail-item {
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #2F4C3A;
            display: inline-block;
            width: 120px;
          }
          .detail-value {
            color: #1e1e1e;
          }
          .reference {
            background: #D8C4A3;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: center;
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .success-badge {
            background: #dcfce7;
            color: #166534;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #22c55e;
            margin: 20px 0;
          }
          .directions-button {
            display: inline-block;
            background: #2F4C3A;
            color: white !important;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            margin: 15px 0;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Booking Confirmed!</h1>
        </div>
        
        <div class="content">
          <p>Dear ${booking.customerName},</p>
          
          <div class="success-badge">
            <strong>Your tee time is confirmed!</strong>
            <p style="margin: 10px 0 0 0;">We look forward to seeing you on the course. Please arrive at least 30 minutes before your tee time.</p>
          </div>
          
          <div class="booking-details">
            <div class="detail-item">
              <span class="detail-label">Course:</span>
              <span class="detail-value">${booking.courseName}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${booking.courseCity}, Costa del Sol, Spain</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${formattedTime}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Players:</span>
              <span class="detail-value">${booking.players} ${booking.players === 1 ? 'player' : 'players'}</span>
            </div>${totalAmountHtml}${directionsHtml}
          </div>
          
          ${googleMapsUrl ? `<div style="text-align: center;">
            <a href="${googleMapsUrl}" class="directions-button">Get Driving Directions</a>
          </div>` : ''}
          
          <div class="reference">
            <div style="font-size: 12px; color: #6b7280;">Booking Reference</div>
            <div style="font-size: 18px; margin-top: 5px;">${booking.id}</div>
          </div>
          
          <p><strong>Important:</strong> Please remember to bring this booking confirmation and a valid ID. If you need to make any changes or have questions, please reply to this email with your booking reference.</p>
          
          <div class="footer">
            <p><strong>Marbella Golf Times</strong><br>
            Your Personal Guide to Costa del Sol Golf</p>
            <p style="font-size: 12px; color: #9ca3af;">Thank you for choosing Marbella Golf Times. We hope you have a wonderful round!</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Booking Confirmed - ${booking.courseName}

Dear ${booking.customerName},

YOUR TEE TIME IS CONFIRMED!
We look forward to seeing you on the course. Please arrive at least 30 minutes before your tee time.

BOOKING DETAILS:
Course: ${booking.courseName}
Location: ${booking.courseCity}, Costa del Sol, Spain
Date: ${formattedDate}
Time: ${formattedTime}
Players: ${booking.players} ${booking.players === 1 ? 'player' : 'players'}
${totalAmountText ? totalAmountText + '\n' : ''}${directionsText ? directionsText + '\n' : ''}
Booking Reference: ${booking.id}

IMPORTANT:
Please remember to bring this booking confirmation and a valid ID. If you need to make any changes or have questions, please reply to this email with your booking reference.

---
Marbella Golf Times
Your Personal Guide to Costa del Sol Golf

Thank you for choosing Marbella Golf Times. We hope you have a wonderful round!
    `.trim()
  };
}
