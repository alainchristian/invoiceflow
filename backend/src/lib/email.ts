import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

// No-ops (with a console warning) when RESEND_API_KEY isn't configured yet, so the
// rest of the app keeps working during setup instead of every send-path 500ing.
export async function sendEmail({ to, subject, html, attachments }: SendEmailInput): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set -- skipping email to ${to}: "${subject}"`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "ServicePilot <onboarding@resend.dev>",
    to,
    subject,
    html,
    attachments,
  });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
