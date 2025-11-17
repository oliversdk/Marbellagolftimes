import type { GolfCourse } from "@shared/schema";
import { format } from "date-fns";

export interface BookingDetails {
  id: string;
  courseName: string;
  courseCity: string;
  customerName: string;
  teeTime: Date;
  players: number;
}

export function bookingConfirmationEmail(booking: BookingDetails) {
  const formattedDate = format(booking.teeTime, "EEEE, MMMM d, yyyy");
  const formattedTime = format(booking.teeTime, "h:mm a");

  return {
    subject: `Booking Confirmation - ${booking.courseName}`,
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
          .note {
            background: #fef3c7;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #f59e0b;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Booking Confirmation</h1>
        </div>
        
        <div class="content">
          <p>Dear ${booking.customerName},</p>
          
          <p>Thank you for choosing Fridas Golf! Your tee time booking request has been received and is being processed.</p>
          
          <div class="booking-details">
            <div class="detail-item">
              <span class="detail-label">Course:</span>
              <span class="detail-value">${booking.courseName}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${booking.courseCity}</span>
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
            </div>
          </div>
          
          <div class="reference">
            <div style="font-size: 12px; color: #6b7280;">Booking Reference</div>
            <div style="font-size: 18px; margin-top: 5px;">${booking.id}</div>
          </div>
          
          <div class="note">
            <strong>What's Next?</strong>
            <p style="margin: 10px 0 0 0;">We're working on confirming your tee time with the course. You'll receive a confirmation email once your booking is confirmed. Please keep this reference number for your records.</p>
          </div>
          
          <p>If you have any questions or need to make changes to your booking, please reply to this email or contact us with your booking reference.</p>
          
          <div class="footer">
            <p><strong>Fridas Golf</strong><br>
            Your Personal Guide to Costa del Sol Golf</p>
            <p style="font-size: 12px; color: #9ca3af;">This is an automated confirmation email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Booking Confirmation - ${booking.courseName}

Dear ${booking.customerName},

Thank you for choosing Fridas Golf! Your tee time booking request has been received and is being processed.

BOOKING DETAILS:
Course: ${booking.courseName}
Location: ${booking.courseCity}
Date: ${formattedDate}
Time: ${formattedTime}
Players: ${booking.players} ${booking.players === 1 ? 'player' : 'players'}

Booking Reference: ${booking.id}

WHAT'S NEXT?
We're working on confirming your tee time with the course. You'll receive a confirmation email once your booking is confirmed. Please keep this reference number for your records.

If you have any questions or need to make changes to your booking, please reply to this email or contact us with your booking reference.

---
Fridas Golf
Your Personal Guide to Costa del Sol Golf
    `.trim()
  };
}
