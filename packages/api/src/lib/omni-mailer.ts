/**
 * Omni Mailer — SES email communication layer for the Virtual Quality Manager.
 *
 * Every email Omni sends has:
 *   From: "Omni | AI Sentinels <omni@aisentinels.io>"
 *   Professional, ISO-aware tone
 *   Annex SL clause reference where relevant
 *   Footer: "Omni — Virtual Quality Manager | AI Sentinels | aisentinels.io"
 *
 * Fire-and-forget: notifications are non-blocking (catch + log errors).
 * Awaited: approval requests block until email is confirmed sent.
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// ── SES Client (singleton, reused across Lambda invocations) ────────────────
const sesClient = new SESClient({
  region: process.env.SES_REGION ?? 'us-east-1',
});

const FROM_EMAIL = process.env.OMNI_FROM_EMAIL ?? 'omni@aisentinels.io';
const REPLY_TO  = process.env.OMNI_REPLY_TO  ?? 'support@aisentinels.io';
const APP_URL   = process.env.APP_URL ?? 'https://app.aisentinels.io';

// ── HTML Template ───────────────────────────────────────────────────────────

function buildEmailHtml(params: {
  subject: string;
  bodyHtml: string;
  accentColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  clauseRef?: string;
  standard?: string;
}): string {
  const accent = params.accentColor ?? '#8B5CF6'; // Nexus purple default

  const clauseBadge = params.clauseRef
    ? `<span style="display:inline-block;font-family:'Courier New',monospace;font-size:11px;color:${accent};border:1px solid ${accent}33;border-radius:4px;padding:2px 8px;margin:0 4px;">${params.standard ? params.standard.replace('_', ' ').toUpperCase() + ' ' : ''}${params.clauseRef}</span>`
    : '';

  const ctaButton = params.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${accent};border-radius:6px;"><a href="${params.ctaUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-family:Inter,system-ui,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">${params.ctaLabel ?? 'View in Platform'}</a></td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <!-- Header -->
  <tr><td style="background:#0f0f0f;padding:20px 24px;border-radius:12px 12px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="color:#ffffff;font-family:Inter,system-ui,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Omni</td>
      <td align="right" style="color:#71717a;font-size:12px;font-family:Inter,system-ui,sans-serif;">AI Sentinels</td>
    </tr>
    </table>
  </td></tr>
  <!-- Accent bar -->
  <tr><td style="background:${accent};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px 24px;">
    ${clauseBadge ? `<div style="margin-bottom:16px;">${clauseBadge}</div>` : ''}
    <div style="color:#1a1a1a;font-size:14px;line-height:1.65;font-family:Inter,system-ui,sans-serif;">
      ${params.bodyHtml}
    </div>
    ${ctaButton}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#fafafa;padding:20px 24px;border-radius:0 0 12px 12px;border-top:1px solid #e4e4e7;">
    <p style="margin:0;color:#a1a1aa;font-size:11px;font-family:Inter,system-ui,sans-serif;line-height:1.5;">
      Omni &mdash; Virtual Quality Manager<br>
      <a href="https://aisentinels.io" style="color:#a1a1aa;text-decoration:underline;">AI Sentinels</a> &middot; aisentinels.io
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildPlainText(bodyText: string): string {
  return `${bodyText}\n\n---\nOmni — Virtual Quality Manager\nAI Sentinels | aisentinels.io`;
}

// ── Core send function ──────────────────────────────────────────────────────

async function sendEmail(params: {
  toEmail: string;
  subject: string;
  html: string;
  textBody: string;
}): Promise<void> {
  const command = new SendEmailCommand({
    Source: `Omni | AI Sentinels <${FROM_EMAIL}>`,
    ReplyToAddresses: [REPLY_TO],
    Destination: {
      ToAddresses: [params.toEmail],
    },
    Message: {
      Subject: { Data: params.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: params.html, Charset: 'UTF-8' },
        Text: { Data: params.textBody, Charset: 'UTF-8' },
      },
    },
  });

  await sesClient.send(command);
}

// ── 1. Document Approval Request (AWAITED) ──────────────────────────────────

export async function sendApprovalRequest(params: {
  toEmail: string;
  toName: string;
  documentTitle: string;
  documentId: string;
  requesterName: string;
  clauseRef: string;
  standard: string;
  tenantId: string;
  approvalToken: string;
}): Promise<void> {
  const approveUrl = `${APP_URL}/api/v1/omni/approve?token=${params.approvalToken}&decision=approve`;
  const rejectUrl  = `${APP_URL}/api/v1/omni/approve?token=${params.approvalToken}&decision=reject`;

  const subject = `[Action Required] Document Approval: ${params.documentTitle}`;

  const html = buildEmailHtml({
    subject,
    accentColor: '#3B82F6', // Doki blue
    clauseRef: params.clauseRef,
    standard: params.standard,
    bodyHtml: `
      <p>Hello ${params.toName},</p>
      <p><strong>${params.requesterName}</strong> has submitted <strong>${params.documentTitle}</strong> for your approval.</p>
      <p>This document addresses <strong>${params.standard.replace('_', ' ').toUpperCase()} ${params.clauseRef}</strong> requirements and requires your review as a designated approver.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#22C55E;border-radius:6px;margin-right:12px;">
            <a href="${approveUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Approve</a>
          </td>
          <td style="width:12px;">&nbsp;</td>
          <td style="background:#EF4444;border-radius:6px;">
            <a href="${rejectUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Reject</a>
          </td>
        </tr>
      </table>
      <p style="color:#71717a;font-size:12px;">This link expires in 48 hours. You can also review this document in the platform.</p>
    `,
    ctaLabel: 'View Document',
    ctaUrl: `${APP_URL}/document-studio/${params.documentId}`,
  });

  const textBody = buildPlainText(
    `Hello ${params.toName},\n\n${params.requesterName} has submitted "${params.documentTitle}" for your approval.\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}\n\nThis link expires in 48 hours.`
  );

  // AWAITED — approval flow depends on email delivery
  await sendEmail({ toEmail: params.toEmail, subject, html, textBody });
}

// ── 2. CAPA Overdue Alert (FIRE-AND-FORGET) ─────────────────────────────────

export async function sendCapaOverdueAlert(params: {
  toEmail: string;
  toName: string;
  capaTitle: string;
  capaId: string;
  dueDate: string;
  daysOverdue: number;
  ownerName: string;
  clauseRef: string;
  tenantId: string;
}): Promise<void> {
  const subject = `[Overdue] CAPA: ${params.capaTitle} — ${params.daysOverdue} days past due`;

  const html = buildEmailHtml({
    subject,
    accentColor: '#EF4444', // red alert
    clauseRef: params.clauseRef,
    bodyHtml: `
      <p>Hello ${params.toName},</p>
      <p>The following Corrective/Preventive Action is <strong>${params.daysOverdue} days overdue</strong>:</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:#991b1b;">${params.capaTitle}</p>
        <p style="margin:0;color:#71717a;font-size:12px;">Owner: ${params.ownerName} &middot; Due: ${params.dueDate}</p>
      </div>
      <p>Per ISO requirements, overdue corrective actions must be escalated. Please update the status or contact the owner.</p>
    `,
    ctaLabel: 'View CAPA',
    ctaUrl: `${APP_URL}/capa/${params.capaId}`,
  });

  const textBody = buildPlainText(
    `Hello ${params.toName},\n\nCAPA "${params.capaTitle}" is ${params.daysOverdue} days overdue.\nOwner: ${params.ownerName}\nDue: ${params.dueDate}\n\nView: ${APP_URL}/capa/${params.capaId}`
  );

  // FIRE-AND-FORGET
  sendEmail({ toEmail: params.toEmail, subject, html, textBody }).catch((err) => {
    console.error(JSON.stringify({ event: 'OmniMailerError', type: 'capa-overdue', capaId: params.capaId, error: String(err) }));
  });
}

// ── 3. Audit Finding Notification (FIRE-AND-FORGET) ─────────────────────────

export async function sendFindingNotification(params: {
  toEmail: string;
  toName: string;
  findingType: 'Major NC' | 'Minor NC' | 'Observation';
  findingDescription: string;
  auditId: string;
  clauseRef: string;
  standard: string;
  tenantId: string;
}): Promise<void> {
  const severityColor = params.findingType === 'Major NC' ? '#EF4444' : params.findingType === 'Minor NC' ? '#F59E0B' : '#3B82F6';
  const subject = `[${params.findingType}] Audit Finding — ${params.standard.replace('_', ' ').toUpperCase()} ${params.clauseRef}`;

  const html = buildEmailHtml({
    subject,
    accentColor: severityColor,
    clauseRef: params.clauseRef,
    standard: params.standard,
    bodyHtml: `
      <p>Hello ${params.toName},</p>
      <p>An audit finding has been raised:</p>
      <div style="background:#f9fafb;border-left:4px solid ${severityColor};padding:16px;margin:16px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 4px;font-weight:600;color:${severityColor};">${params.findingType}</p>
        <p style="margin:0;color:#374151;font-size:13px;">${params.findingDescription}</p>
      </div>
      <p>This finding requires ${params.findingType === 'Major NC' ? 'immediate corrective action' : params.findingType === 'Minor NC' ? 'corrective action within the agreed timeframe' : 'review at the next management meeting'}.</p>
    `,
    ctaLabel: 'View Audit',
    ctaUrl: `${APP_URL}/audits/${params.auditId}`,
  });

  const textBody = buildPlainText(
    `Hello ${params.toName},\n\n[${params.findingType}] ${params.standard.replace('_', ' ').toUpperCase()} ${params.clauseRef}\n\n${params.findingDescription}\n\nView: ${APP_URL}/audits/${params.auditId}`
  );

  // FIRE-AND-FORGET
  sendEmail({ toEmail: params.toEmail, subject, html, textBody }).catch((err) => {
    console.error(JSON.stringify({ event: 'OmniMailerError', type: 'finding-notification', auditId: params.auditId, error: String(err) }));
  });
}

// ── 4. Omni Workflow Status Update (FIRE-AND-FORGET) ────────────────────────

export async function sendWorkflowUpdate(params: {
  toEmail: string;
  toName: string;
  workflowSummary: string;
  workflowId: string;
  involvedSentinels: string[];
  tenantId: string;
}): Promise<void> {
  const sentinelList = params.involvedSentinels.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
  const subject = `Omni Workflow Complete — ${sentinelList}`;

  const html = buildEmailHtml({
    subject,
    accentColor: '#8B5CF6', // Nexus purple / Omni
    bodyHtml: `
      <p>Hello ${params.toName},</p>
      <p>Omni has completed a multi-sentinel workflow. Here is the summary:</p>
      <div style="background:#f5f3ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;white-space:pre-wrap;">${params.workflowSummary}</p>
      </div>
      <p style="color:#71717a;font-size:12px;">Sentinels involved: ${sentinelList}<br>Workflow ID: <code style="font-size:11px;">${params.workflowId}</code></p>
    `,
    ctaLabel: 'Open Platform',
    ctaUrl: APP_URL,
  });

  const textBody = buildPlainText(
    `Hello ${params.toName},\n\nOmni workflow complete.\n\n${params.workflowSummary}\n\nSentinels: ${sentinelList}\nWorkflow ID: ${params.workflowId}`
  );

  // FIRE-AND-FORGET
  sendEmail({ toEmail: params.toEmail, subject, html, textBody }).catch((err) => {
    console.error(JSON.stringify({ event: 'OmniMailerError', type: 'workflow-update', workflowId: params.workflowId, error: String(err) }));
  });
}

// ── 5. Generic Omni Message (FIRE-AND-FORGET by default) ────────────────────

export async function sendOmniMessage(params: {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  tenantId: string;
}): Promise<void> {
  const html = buildEmailHtml({
    subject: params.subject,
    bodyHtml: params.bodyHtml,
  });

  const textBody = buildPlainText(
    params.bodyHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  );

  await sendEmail({ toEmail: params.toEmail, subject: params.subject, html, textBody });
}
