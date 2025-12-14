import { format } from "date-fns";

export interface ReviewRequestDetails {
  bookingId: string;
  customerName: string;
  courseName: string;
  courseCity: string;
  teeTime: Date;
  players: number;
}

export function reviewRequestEmail(details: ReviewRequestDetails, baseUrl: string) {
  const formattedDate = format(details.teeTime, "EEEE, MMMM d, yyyy");
  const formattedTime = format(details.teeTime, "h:mm a");
  const reviewUrl = `${baseUrl}/review/${details.bookingId}`;

  return {
    subject: `How was your round at ${details.courseName}?`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e1e1e;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #2F4C3A 0%, #8FAE8D 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .header p {
            margin: 10px 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .booking-summary {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2F4C3A;
          }
          .booking-summary h3 {
            margin: 0 0 15px;
            color: #2F4C3A;
          }
          .detail-item {
            padding: 8px 0;
            display: flex;
            justify-content: space-between;
          }
          .detail-label {
            color: #666;
          }
          .detail-value {
            font-weight: 500;
          }
          .rating-section {
            text-align: center;
            margin: 30px 0;
          }
          .rating-section h2 {
            color: #2F4C3A;
            margin-bottom: 15px;
          }
          .rating-criteria {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
          }
          .criteria-item {
            background: #f0f4f0;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 14px;
            color: #2F4C3A;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #2F4C3A 0%, #3d6349 100%);
            color: white !important;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s;
          }
          .cta-button:hover {
            transform: scale(1.02);
          }
          .benefits {
            background: #fffbeb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .benefits h4 {
            color: #D4A853;
            margin: 0 0 10px;
          }
          .benefits ul {
            margin: 0;
            padding-left: 20px;
          }
          .benefits li {
            margin: 5px 0;
            color: #666;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
          }
          .footer a {
            color: #2F4C3A;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>We'd Love Your Feedback!</h1>
            <p>Share your experience at ${details.courseName}</p>
          </div>
          
          <div class="content">
            <p class="greeting">Dear ${details.customerName},</p>
            
            <p>We hope you had a fantastic round of golf! Your feedback helps other golfers discover great courses and helps us improve our service.</p>
            
            <div class="booking-summary">
              <h3>Your Round</h3>
              <div class="detail-item">
                <span class="detail-label">Course:</span>
                <span class="detail-value">${details.courseName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${details.courseCity}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Tee Time:</span>
                <span class="detail-value">${formattedTime}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Players:</span>
                <span class="detail-value">${details.players}</span>
              </div>
            </div>
            
            <div class="rating-section">
              <h2>Rate Your Experience</h2>
              <p>Tell us about your round in just a few clicks:</p>
              
              <div class="rating-criteria">
                <span class="criteria-item">Course Condition</span>
                <span class="criteria-item">Service Quality</span>
                <span class="criteria-item">Value for Money</span>
                <span class="criteria-item">Facilities</span>
                <span class="criteria-item">Overall Experience</span>
              </div>
              
              <a href="${reviewUrl}" class="cta-button">
                Leave Your Review
              </a>
            </div>
            
            <div class="benefits">
              <h4>Why Leave a Review?</h4>
              <ul>
                <li>Help fellow golfers find the best courses</li>
                <li>Share what made your experience special</li>
                <li>Provide valuable feedback to the course</li>
              </ul>
            </div>
            
            <p>Thank you for choosing Marbella Golf Times for your Costa del Sol golf experience. We look forward to helping you book your next round!</p>
          </div>
          
          <div class="footer">
            <p>
              <strong>Marbella Golf Times</strong><br>
              Your Personal Guide to Costa del Sol Golf
            </p>
            <p>
              <a href="${baseUrl}">Visit our website</a> | 
              <a href="${baseUrl}/courses">Browse Courses</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Dear ${details.customerName},

We hope you had a fantastic round of golf at ${details.courseName}!

YOUR ROUND
-----------
Course: ${details.courseName}
Location: ${details.courseCity}
Date: ${formattedDate}
Tee Time: ${formattedTime}
Players: ${details.players}

SHARE YOUR EXPERIENCE
---------------------
Your feedback helps other golfers discover great courses and helps us improve our service.

Please take a moment to rate your experience:
${reviewUrl}

Rate:
- Course Condition
- Service Quality  
- Value for Money
- Facilities
- Overall Experience

WHY LEAVE A REVIEW?
- Help fellow golfers find the best courses
- Share what made your experience special
- Provide valuable feedback to the course

Thank you for choosing Marbella Golf Times!

---
Marbella Golf Times
Your Personal Guide to Costa del Sol Golf
${baseUrl}
    `.trim()
  };
}
