/**
 * Ghost Mailer — lightweight SES email for Ghost Sentinel.
 *
 * Fire-and-forget only. Uses SES v1 (same pattern as packages/api/src/lib/mailer.ts).
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.SES_REGION ?? 'us-east-1' });

const FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? 'notifications@aisentinels.io';
const REPLY_TO = 'roberto@aisentinels.io';
const TEAM_ALL = [
  'julio@aisentinels.io',
  'roberto@aisentinels.io',
  'george@aisentinels.io',
];

export function sendGhostNotification(params: {
  subject: string;
  html: string;
  text: string;
}): void {
  const command = new SendEmailCommand({
    Source: FROM,
    ReplyToAddresses: [REPLY_TO],
    Destination: { ToAddresses: TEAM_ALL },
    Message: {
      Subject: { Data: params.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: params.html, Charset: 'UTF-8' },
        Text: { Data: params.text, Charset: 'UTF-8' },
      },
    },
  });

  ses.send(command).catch((err) => {
    console.error(JSON.stringify({
      event: 'GhostMailerError',
      subject: params.subject,
      error: String(err),
    }));
  });
}
