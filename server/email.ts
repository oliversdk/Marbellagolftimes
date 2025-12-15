import nodemailer from "nodemailer";
import type { GolfCourse } from "@shared/schema";

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function getEmailConfig(): EmailConfig | null {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    FROM_EMAIL,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: FROM_EMAIL,
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Get Reply-To email for routing replies through SendGrid
function getReplyToEmail(): string {
  return process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL || "info@reply.marbellagolftimes.com";
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const config = getEmailConfig();
  if (!config) {
    console.log("[Email] SMTP not configured, skipping email send to:", options.to);
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const replyTo = getReplyToEmail();
    
    await transporter.sendMail({
      from: config.from,
      replyTo: replyTo,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log("[Email] Sent email to:", options.to, "Subject:", options.subject, "Reply-To:", replyTo);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Email] Failed to send email:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendAffiliateEmail(
  course: GolfCourse,
  subject: string,
  body: string,
  senderName: string,
  config: EmailConfig,
  trackingToken?: string
): Promise<{ success: boolean; error?: string }> {
  if (!course.email) {
    return { success: false, error: "Course has no email address" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    // Replace placeholders in subject and body
    const personalizedSubject = subject.replace(/\[COURSE_NAME\]/g, course.name);
    const personalizedBody = body
      .replace(/\[COURSE_NAME\]/g, course.name)
      .replace(/\[SENDER_NAME\]/g, senderName);

    const replyTo = getReplyToEmail();

    // Build HTML body with tracking pixel if token provided
    const trackingPixel = trackingToken 
      ? `<img src="https://${process.env.REPLIT_SLUG || 'marbellagolftimes'}.repl.co/api/email/track/${trackingToken}" width="1" height="1" style="display:block" alt="" />`
      : '';
    const htmlBody = `<pre style="font-family: inherit; white-space: pre-wrap;">${personalizedBody}</pre>${trackingPixel}`;

    await transporter.sendMail({
      from: config.from,
      replyTo: replyTo,
      to: course.email,
      subject: personalizedSubject,
      text: personalizedBody,
      html: htmlBody,
    });

    console.log("[Email] Sent affiliate email to:", course.email, "Reply-To:", replyTo, trackingToken ? `Tracking: ${trackingToken}` : '');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
