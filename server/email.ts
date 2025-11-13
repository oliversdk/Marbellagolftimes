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

export async function sendAffiliateEmail(
  course: GolfCourse,
  subject: string,
  body: string,
  senderName: string,
  config: EmailConfig
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

    await transporter.sendMail({
      from: config.from,
      to: course.email,
      subject: personalizedSubject,
      text: personalizedBody,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
