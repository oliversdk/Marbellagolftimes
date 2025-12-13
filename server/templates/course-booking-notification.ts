import { format } from "date-fns";

export interface CourseBookingNotificationDetails {
  bookingId: string;
  courseName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  teeTime: Date;
  players: number;
  totalAmountCents?: number;
}

export function courseBookingNotificationEmail(details: CourseBookingNotificationDetails) {
  const formattedDate = format(details.teeTime, "EEEE, MMMM d, yyyy");
  const formattedTime = format(details.teeTime, "h:mm a");
  
  const totalAmount = details.totalAmountCents 
    ? `€${(details.totalAmountCents / 100).toFixed(2)}`
    : "N/A";

  return {
    subject: `New Booking: ${details.courseName} - ${formattedDate} at ${formattedTime}`,
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
            padding: 25px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            background: #ffffff;
            padding: 25px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .booking-details {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
          }
          .detail-item {
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #2F4C3A;
            display: inline-block;
            width: 130px;
          }
          .detail-value {
            color: #1e1e1e;
          }
          .reference {
            background: #D8C4A3;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            text-align: center;
            font-weight: 600;
          }
          .customer-section {
            background: #e8f4ea;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #2F4C3A;
          }
          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>New Booking Notification</h1>
        </div>
        
        <div class="content">
          <p>A new tee time booking has been confirmed for <strong>${details.courseName}</strong>.</p>
          
          <div class="reference">
            <div style="font-size: 11px; color: #6b7280;">Booking Reference</div>
            <div style="font-size: 16px; margin-top: 3px;">${details.bookingId}</div>
          </div>
          
          <div class="booking-details">
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
              <span class="detail-value">${details.players} ${details.players === 1 ? 'player' : 'players'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Total Amount:</span>
              <span class="detail-value">${totalAmount}</span>
            </div>
          </div>
          
          <div class="customer-section">
            <strong style="color: #2F4C3A;">Customer Details</strong>
            <div style="margin-top: 10px;">
              <div><strong>Name:</strong> ${details.customerName}</div>
              <div><strong>Email:</strong> ${details.customerEmail}</div>
              ${details.customerPhone ? `<div><strong>Phone:</strong> ${details.customerPhone}</div>` : ''}
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Marbella Golf Times</strong><br>
            Booking Partner Portal</p>
            <p style="font-size: 11px; color: #9ca3af;">This is an automated notification from Marbella Golf Times.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
New Booking Notification - ${details.courseName}

Booking Reference: ${details.bookingId}

BOOKING DETAILS:
Date: ${formattedDate}
Time: ${formattedTime}
Players: ${details.players} ${details.players === 1 ? 'player' : 'players'}
Total Amount: ${totalAmount}

CUSTOMER DETAILS:
Name: ${details.customerName}
Email: ${details.customerEmail}
${details.customerPhone ? `Phone: ${details.customerPhone}` : ''}

---
Marbella Golf Times
Booking Partner Portal
    `.trim()
  };
}
