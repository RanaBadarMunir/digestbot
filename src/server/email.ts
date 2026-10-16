export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: { to: string; subject: string; html: string }, fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email delivery is not configured");
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "DigestBot <onboarding@resend.dev>",
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
