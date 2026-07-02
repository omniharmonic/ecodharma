import "server-only";
import { Resend } from "resend";

// Transactional email via Resend — env-gated. With no RESEND_API_KEY the app
// still runs (and tests pass); sends simply no-op and report false.
const FROM = process.env.EMAIL_FROM || "EcoDharma <onboarding@resend.dev>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send one email. Returns true ONLY when Resend accepts it (we inspect the
 * response error, not just the absence of a throw). `html` + `listUnsubscribe`
 * materially improve inbox placement.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** URL or mailto for the List-Unsubscribe header (bulk-sender best practice). */
  listUnsubscribe?: string;
  headers?: Record<string, string>;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.listUnsubscribe) {
    headers["List-Unsubscribe"] = `<${opts.listUnsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    });
    if (error) {
      console.error("[email] resend rejected:", error);
      return false;
    }
    return !!data?.id;
  } catch (e) {
    console.error("[email] send threw:", e);
    return false;
  }
}

/** Minimal, on-brand HTML wrapper for a plain-text body (helps deliverability). */
export function htmlEmail(opts: { heading: string; body: string; siteUrl?: string; unsubscribeUrl?: string }): string {
  const paras = opts.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const footer = [
    opts.siteUrl ? `<a href="${opts.siteUrl}" style="color:#E8A13A;text-decoration:none;">Reflect any time →</a>` : "",
    opts.unsubscribeUrl ? `<a href="${opts.unsubscribeUrl}" style="color:#8EB2B2;">Unsubscribe from weekly nudges</a>` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  return `<!doctype html><html><body style="margin:0;background:#0A272B;padding:32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0D2E32;border:1px solid rgba(79,163,184,0.25);">
      <tr><td style="padding:28px 32px 8px;">
        <div style="font:600 12px/1.4 ui-monospace,monospace;letter-spacing:3px;text-transform:uppercase;color:#4FA3B8;">EcoDharma · Field manual</div>
        <h1 style="margin:12px 0 20px;font:600 26px/1.25 Georgia,serif;color:#DCE8E0;">${escapeHtml(opts.heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 32px 24px;font:400 16px/1.6 -apple-system,Segoe UI,sans-serif;color:#DCE8E0;">${paras}</td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(79,163,184,0.2);font:400 13px/1.6 -apple-system,sans-serif;color:#8EB2B2;">
        ${footer}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
