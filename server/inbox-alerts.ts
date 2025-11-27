import { storage } from "./storage";
import { sendEmail } from "./email";
import type { InboundEmailThread, AdminAlertSettings } from "@shared/schema";

const DEFAULT_SLA_HOURS = 2;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
// Track when we last sent alert for each admin+thread combination (key: "adminId:threadId")
const LAST_ALERT_SENT = new Map<string, number>();
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // Don't re-alert for same admin+thread within 4 hours

function getAlertKey(adminId: string, threadId: string): string {
  return `${adminId}:${threadId}`;
}

interface AdminWithSettings {
  userId: string;
  email: string;
  alertEmail?: string | null;
  slaHours: number;
}

async function getAdminsWithSettings(): Promise<AdminWithSettings[]> {
  const admins = await storage.getAdminsForAlerts();
  
  const adminsWithSettings = await Promise.all(
    admins.map(async (admin) => {
      const settings = await storage.getAdminAlertSettings(admin.userId);
      return {
        userId: admin.userId,
        email: admin.email,
        alertEmail: admin.alertEmail,
        slaHours: settings?.slaHours ?? DEFAULT_SLA_HOURS,
      };
    })
  );
  
  return adminsWithSettings;
}

export async function checkAndSendAlerts(): Promise<{ sent: number; errors: number }> {
  console.log("[InboxAlerts] Checking for overdue email threads...");
  
  try {
    // Get all admins who have alerts enabled with their SLA settings
    const admins = await getAdminsWithSettings();
    
    if (admins.length === 0) {
      console.log("[InboxAlerts] No admins with alerts enabled, skipping");
      return { sent: 0, errors: 0 };
    }

    let totalSent = 0;
    let totalErrors = 0;
    const now = Date.now();

    // Process each admin with their individual SLA threshold
    for (const admin of admins) {
      try {
        // Get overdue threads using this admin's SLA threshold
        const overdueThreads = await storage.getOverdueThreads(admin.slaHours);
        
        if (overdueThreads.length === 0) {
          continue;
        }

        // Filter out threads we've recently alerted THIS admin about (per-admin cooldown)
        const threadsToAlert = overdueThreads.filter(thread => {
          // Skip threads with null lastActivityAt
          if (!thread.lastActivityAt) {
            return false;
          }
          
          // Check cooldown per admin+thread combination
          const alertKey = getAlertKey(admin.userId, thread.id);
          const lastAlert = LAST_ALERT_SENT.get(alertKey);
          if (lastAlert && (now - lastAlert) < ALERT_COOLDOWN_MS) {
            return false;
          }
          return true;
        });

        if (threadsToAlert.length === 0) {
          continue;
        }

        console.log(`[InboxAlerts] Found ${threadsToAlert.length} threads for admin ${admin.email} (SLA: ${admin.slaHours}h)`);

        const emailTo = admin.alertEmail || admin.email;
        const result = await sendAlertEmail(emailTo, threadsToAlert);
        
        if (result.success) {
          totalSent++;
          console.log(`[InboxAlerts] Sent alert to ${emailTo}`);
          
          // Mark threads as alerted for THIS admin (per-admin cooldown)
          threadsToAlert.forEach(thread => {
            const alertKey = getAlertKey(admin.userId, thread.id);
            LAST_ALERT_SENT.set(alertKey, now);
          });
        } else {
          totalErrors++;
          console.log(`[InboxAlerts] Failed to send alert to ${emailTo}: ${result.error}`);
        }
      } catch (error) {
        totalErrors++;
        console.error(`[InboxAlerts] Error processing alerts for admin ${admin.email}:`, error);
      }
    }

    if (totalSent > 0 || totalErrors > 0) {
      console.log(`[InboxAlerts] Completed: ${totalSent} alerts sent, ${totalErrors} errors`);
    } else {
      console.log("[InboxAlerts] No overdue threads found");
    }
    
    return { sent: totalSent, errors: totalErrors };
  } catch (error) {
    console.error("[InboxAlerts] Error checking for overdue threads:", error);
    return { sent: 0, errors: 1 };
  }
}

function formatHoursAgo(lastActivityAt: Date | string | null): number {
  if (!lastActivityAt) return 0;
  const activityTime = typeof lastActivityAt === 'string' 
    ? new Date(lastActivityAt).getTime() 
    : lastActivityAt.getTime();
  return Math.max(0, Math.round((Date.now() - activityTime) / (1000 * 60 * 60)));
}

async function sendAlertEmail(
  to: string, 
  threads: InboundEmailThread[]
): Promise<{ success: boolean; error?: string }> {
  const count = threads.length;
  const subject = `Unanswered Emails Alert: ${count} email${count > 1 ? 's' : ''} need attention - Marbella Golf Times`;
  
  // Format thread list with null-safe handling
  const threadList = threads.map(thread => {
    const hoursAgo = formatHoursAgo(thread.lastActivityAt);
    const safeSubject = thread.subject || '(No subject)';
    const safeFrom = thread.fromEmail || 'Unknown sender';
    return `- ${safeSubject} - From: ${safeFrom} (${hoursAgo}h ago)`;
  }).join('\n');

  const text = `
Hello,

You have ${count} unanswered email${count > 1 ? 's' : ''} that ${count > 1 ? 'have' : 'has'} exceeded the SLA threshold:

${threadList}

Please log in to your Admin dashboard to respond to these emails.

Best regards,
Marbella Golf Times Inbox System

---
This is an automated alert. You can adjust alert settings in the Admin Inbox.
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: linear-gradient(135deg, #1a5f2a 0%, #0d3f1a 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
    .thread-list { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .thread-item { padding: 10px; border-bottom: 1px solid #eee; }
    .thread-item:last-child { border-bottom: none; }
    .subject { font-weight: bold; color: #1a5f2a; }
    .from { color: #666; font-size: 14px; }
    .time { color: #c41e3a; font-weight: bold; font-size: 12px; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
    .cta { display: inline-block; background: #1a5f2a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">Unanswered Emails Alert</h2>
    <p style="margin: 10px 0 0; opacity: 0.9;">${count} email${count > 1 ? 's' : ''} need${count > 1 ? '' : 's'} your attention</p>
  </div>
  <div class="content">
    <p>Hello,</p>
    <p>The following email${count > 1 ? 's have' : ' has'} exceeded the SLA response threshold:</p>
    
    <div class="thread-list">
      ${threads.map(thread => {
        const hoursAgo = formatHoursAgo(thread.lastActivityAt);
        const safeSubject = escapeHtml(thread.subject || '(No subject)');
        const safeFrom = escapeHtml(thread.fromEmail || 'Unknown sender');
        return `
          <div class="thread-item">
            <div class="subject">${safeSubject}</div>
            <div class="from">From: ${safeFrom}</div>
            <div class="time">Waiting: ${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''}</div>
          </div>
        `;
      }).join('')}
    </div>
    
    <p>Please log in to your Admin dashboard to respond to these emails promptly.</p>
    
    <a href="https://marbellagolftimes.com/admin" class="cta">Open Admin Dashboard</a>
    
    <div class="footer">
      <p>This is an automated alert from Marbella Golf Times.<br>
      You can adjust your alert settings in the Admin Inbox.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  return sendEmail({ to, subject, text, html });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let alertInterval: NodeJS.Timeout | null = null;
let initialTimeout: NodeJS.Timeout | null = null;

export function startAlertScheduler(): void {
  if (alertInterval) {
    console.log("[InboxAlerts] Scheduler already running");
    return;
  }

  console.log(`[InboxAlerts] Starting scheduler (check every ${CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  
  // Run initial check after 1 minute (let the server warm up)
  initialTimeout = setTimeout(() => {
    checkAndSendAlerts().catch(console.error);
    initialTimeout = null;
  }, 60 * 1000);

  // Then run on interval
  alertInterval = setInterval(() => {
    checkAndSendAlerts().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

export function stopAlertScheduler(): void {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
    console.log("[InboxAlerts] Scheduler stopped");
  }
}

export function clearAlertHistory(): void {
  LAST_ALERT_SENT.clear();
  console.log("[InboxAlerts] Alert history cleared");
}
