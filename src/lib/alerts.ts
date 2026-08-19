import { prisma } from "./prisma";
import { getStaticBaseUrl } from "./app-url";
import { sendDeadlineAlertEmail } from "./email";

export interface AlertRunResult {
  due: number; // alerts whose deadline is inside the reminder window
  sent: number; // emails successfully sent (and alerts marked lastSentAt)
  skipped: number; // alerts that fired but no email was configured
  failed: number; // send errors
}

/**
 * Finds every unsent alert whose deadline has entered its reminder window and
 * emails the owner once (lastSentAt marks it so the daily cron never re-sends).
 *
 * Works without Resend configured: sends are skipped and logged so the
 * pipeline can be tested end-to-end locally.
 */
export async function runDueAlerts(opts?: { dryRun?: boolean }): Promise<AlertRunResult> {
  const now = new Date();
  const result: AlertRunResult = { due: 0, sent: 0, skipped: 0, failed: 0 };

  const alerts = await prisma.alert.findMany({
    where: { lastSentAt: null },
    include: { scholarship: true, user: true },
  });

  for (const alert of alerts) {
    const { scholarship, user } = alert;
    if (user.alertUnsubscribed) continue;
    if (!scholarship.deadline) continue;

    const deadline = new Date(scholarship.deadline);
    if (deadline <= now) continue; // expired — the hygiene cron flips status
    const windowStart = new Date(deadline.getTime() - alert.daysBefore * 86_400_000);
    if (now < windowStart) continue; // not in the reminder window yet

    result.due++;
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000));
    const base = getStaticBaseUrl();

    try {
      if (opts?.dryRun) {
        console.log(
          `[alerts] dry-run would email ${user.email} about "${scholarship.title}" (${daysLeft}d left)`
        );
        result.sent++;
      } else {
        const sent = await sendDeadlineAlertEmail({
          to: user.email,
          userName: user.name,
          scholarshipTitle: scholarship.title,
          deadline,
          daysLeft,
          scholarshipUrl: `${base}/scholarships/${scholarship.slug}`,
          unsubscribeUrl: `${base}/alerts/unsubscribe/${user.unsubscribeToken ?? "invalid"}`,
        });
        if (sent.sent) {
          result.sent++;
        } else {
          result.skipped++;
          console.warn(`[alerts] email skipped for ${user.email}: ${sent.skippedReason}`);
        }
      }
      // Mark as sent even when the send was skipped (no key configured) — the
      // alert already fired for this deadline; re-running must not nag again.
      await prisma.alert.update({ where: { id: alert.id }, data: { lastSentAt: new Date() } });
    } catch (err) {
      result.failed++;
      console.error(`[alerts] send failed for alert ${alert.id}:`, err);
    }
  }

  return result;
}
