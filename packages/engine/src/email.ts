/**
 * Minimal email sender (Resend REST API, no SDK). Key-gated: without RESEND_API_KEY it
 * returns { sent: false } so callers degrade gracefully. Set EMAIL_FROM to a verified
 * sender domain in production; Resend's onboarding sender works for testing.
 */
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<{ sent: boolean; detail: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, detail: "RESEND_API_KEY not set" };
  const from = process.env.EMAIL_FROM || "Lesson Forge <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
  });
  if (!res.ok) return { sent: false, detail: `resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { sent: true, detail: "ok" };
}
