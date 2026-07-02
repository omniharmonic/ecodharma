import "server-only";
import { Resend } from "resend";

// Transactional email via Resend — env-gated. With no RESEND_API_KEY the app
// still runs (and tests pass); sends simply no-op and report false.
const FROM = process.env.EMAIL_FROM || "EcoDharma <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
