import { Resend } from "resend";

// Resend is only configured when RESEND_API_KEY is present (e.g. local dev
// without a key). Sends degrade to a logged skip so the rest of the app and
// tests work without email infrastructure.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_EMAIL_FROM || "ScholarAtlas <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DeadlineAlertEmailProps {
  to: string;
  userName?: string | null;
  scholarshipTitle: string;
  deadline: Date;
  daysLeft: number;
  scholarshipUrl: string;
  unsubscribeUrl: string;
}

function deadlineAlertHtml(p: DeadlineAlertEmailProps): string {
  const title = escapeHtml(p.scholarshipTitle);
  const name = p.userName ? escapeHtml(p.userName) : "there";
  const date = p.deadline.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const days = p.daysLeft > 0 ? `${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}` : "today";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f9fc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px 32px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;letter-spacing:0.02em;">ScholarAtlas</p>
              <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;">⏳ Deadline approaching</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1e293b;line-height:1.6;">Hi ${name},</p>
              <p style="margin:0 0 20px;font-size:16px;color:#1e293b;line-height:1.6;">
                The application deadline for <strong>${title}</strong> is <strong>${date}</strong> — that's <strong>${days}</strong> away.
                Don't let the deadline slip past.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:#2563eb;">
                    <a href="${p.scholarshipUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View Scholarship</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;line-height:1.5;">You're receiving this because you saved this scholarship and enabled deadline reminders on ScholarAtlas.</p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">
                <a href="${p.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from all deadline reminders</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface SendResult {
  sent: boolean;
  skippedReason?: string;
}

/**
 * Sends a deadline-reminder email. Returns { sent: false, skippedReason }
 * without throwing when Resend is not configured, so the daily cron degrades
 * gracefully in environments without an API key.
 */
export async function sendDeadlineAlertEmail(p: DeadlineAlertEmailProps): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, skippedReason: "RESEND_API_KEY not set" };
  }
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: p.to,
    subject: `⏳ Deadline approaching: ${p.scholarshipTitle.slice(0, 80)}`,
    html: deadlineAlertHtml(p),
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
  return { sent: true };
}
