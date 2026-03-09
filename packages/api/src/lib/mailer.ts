/**
 * Centralized Email Service — Phase 10
 *
 * ALL transactional emails go through this module.
 * Uses SES SendEmailCommand for rich HTML + plain text.
 * Fire-and-forget by default — never blocks the calling handler.
 *
 * FROM addresses:
 *   Omni (platform):  omni@aisentinels.io
 *   Notifications:    notifications@aisentinels.io
 *   Support:          support@aisentinels.io
 *   Legal:            legal@aisentinels.io
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// ── SES Client (singleton, reused across Lambda invocations) ────────────────
const ses = new SESClient({
  region: process.env.SES_REGION ?? 'us-east-1',
});

// ── FROM addresses ──────────────────────────────────────────────────────────
export const FROM_OMNI          = process.env.OMNI_FROM_EMAIL          ?? 'omni@aisentinels.io';
export const FROM_NOTIFICATIONS = process.env.NOTIFICATIONS_FROM_EMAIL ?? 'notifications@aisentinels.io';
export const FROM_LEGAL         = process.env.LEGAL_FROM_EMAIL         ?? 'legal@aisentinels.io';
export const FROM_SUPPORT       = 'support@aisentinels.io';

// ── Default reply-to ────────────────────────────────────────────────────────
export const REPLY_SUPPORT = 'support@aisentinels.io';

// ── Team emails ─────────────────────────────────────────────────────────────
export const TEAM_JULIO   = 'julio@aisentinels.io';
export const TEAM_ROBERTO = 'roberto@aisentinels.io';
export const TEAM_GEORGE  = 'george@aisentinels.io';
export const TEAM_ALL     = [TEAM_JULIO, TEAM_ROBERTO, TEAM_GEORGE];

// ── Types ───────────────────────────────────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;        // plain text fallback always required
  from?: string;       // defaults to omni@aisentinels.io
  replyTo?: string;    // defaults to support@aisentinels.io
  cc?: string[];
}

// ── Core send function ──────────────────────────────────────────────────────

async function _send(options: EmailOptions): Promise<void> {
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
  const from = options.from ?? FROM_OMNI;
  const replyTo = options.replyTo ?? REPLY_SUPPORT;

  const command = new SendEmailCommand({
    Source: from,
    ReplyToAddresses: [replyTo],
    Destination: {
      ToAddresses: toAddresses,
      CcAddresses: options.cc ?? [],
    },
    Message: {
      Subject: { Data: options.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: options.html, Charset: 'UTF-8' },
        Text: { Data: options.text, Charset: 'UTF-8' },
      },
    },
  });

  await ses.send(command);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fire-and-forget email send.
 * Logs errors to CloudWatch but NEVER throws.
 */
export function sendEmail(options: EmailOptions): void {
  _send(options).catch((err) => {
    console.error(JSON.stringify({
      event: 'MailerError',
      to: options.to,
      subject: options.subject,
      from: options.from ?? FROM_OMNI,
      error: String(err),
    }));
  });
}

/**
 * Email send with retries (for critical emails).
 * Still fire-and-forget — never throws to caller.
 */
export function sendEmailWithRetry(options: EmailOptions, retries = 2): void {
  const attempt = async (remaining: number): Promise<void> => {
    try {
      await _send(options);
    } catch (err) {
      if (remaining > 0) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, (retries - remaining + 1) * 1000));
        return attempt(remaining - 1);
      }
      console.error(JSON.stringify({
        event: 'MailerRetryExhausted',
        to: options.to,
        subject: options.subject,
        from: options.from ?? FROM_OMNI,
        error: String(err),
        retries,
      }));
    }
  };

  attempt(retries).catch(() => {
    // Final safety net — should never reach here
  });
}
