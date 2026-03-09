/**
 * Email Templates — Phase 10
 *
 * All 9 transactional email templates for AI Sentinels.
 * Each returns { subject, html, text } ready for mailer.ts sendEmail().
 *
 * HTML uses inline CSS only — no external stylesheets.
 * All templates share a dark-themed base layout matching the SaaSLeek design.
 */

const APP_URL = process.env.APP_URL ?? 'https://aisentinels.io';
const YEAR = new Date().getFullYear();

// ── Shared base layout ──────────────────────────────────────────────────────

function baseLayout(params: {
  body: string;
  fromLabel?: string;
}): string {
  const fromLabel = params.fromLabel ?? 'Omni';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:10px;">
          <path d="M20 2L4 10v10c0 11 7 18 16 20 9-2 16-9 16-20V10L20 2z" fill="#c2fa69" fill-opacity="0.12" stroke="#c2fa69" stroke-width="1.5"/>
          <text x="20" y="26" text-anchor="middle" fill="#c2fa69" font-family="monospace" font-size="16" font-weight="700">S</text>
        </svg>
        <span style="color:#ffffff;font-size:16px;font-weight:700;vertical-align:middle;">AI Sentinels</span>
      </td>
      <td align="right" style="color:#6b7280;font-size:11px;">${fromLabel}</td>
    </tr>
    </table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;color:#ffffff;font-size:14px;line-height:1.65;">
    ${params.body}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">
      AI Sentinels &middot; operated by Strivana.com LLC<br>
      &copy; ${YEAR} Strivana.com LLC &middot; <a href="https://aisentinels.io" style="color:#6b7280;text-decoration:underline;">aisentinels.io</a>
    </p>
    <p style="margin:8px 0 0;color:#4b5563;font-size:10px;">
      <a href="${APP_URL}/settings" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a> from non-essential notifications
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#c2fa69;border-radius:8px;"><a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;font-family:Inter,system-ui,sans-serif;">${label}</a></td></tr></table>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── TEMPLATE 1: Welcome Email ───────────────────────────────────────────────

export function welcomeTemplate(params: {
  orgName: string;
  userEmail: string;
}) {
  const subject = 'Welcome to AI Sentinels \u2014 Your Sentinels are Ready';
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:20px;color:#ffffff;">Welcome to AI Sentinels, ${escapeHtml(params.orgName)}</h2>
      <p>Your Integrated Management System is ready. Six AI Sentinels are standing by to help you achieve and maintain ISO compliance.</p>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">Your Sentinel Roster</p>
        <table role="presentation" cellpadding="4" cellspacing="0" style="font-size:13px;color:#d1d5db;">
          <tr><td>\ud83d\udfe6</td><td><strong>Qualy</strong> \u2014 ISO 9001 Quality Expert</td></tr>
          <tr><td>\ud83d\udfe2</td><td><strong>Envi</strong> \u2014 ISO 14001 Environmental Expert</td></tr>
          <tr><td>\ud83d\udfe0</td><td><strong>Saffy</strong> \u2014 ISO 45001 Health &amp; Safety Expert</td></tr>
          <tr><td>\ud83d\udfe3</td><td><strong>Doki</strong> \u2014 Document Studio AI</td></tr>
          <tr><td>\ud83d\udd34</td><td><strong>Audie</strong> \u2014 Lead Auditor AI</td></tr>
          <tr><td>\ud83d\udfe3</td><td><strong>Nexus</strong> \u2014 CAPA &amp; Root Cause Analyst</td></tr>
        </table>
      </div>

      <p>Your first step: <strong>Activate your ISO standards in Settings</strong>, then let Doki draft your first document.</p>

      ${ctaButton('Access Your Platform \u2192', `${APP_URL}/dashboard`)}

      <p style="color:#9ca3af;font-size:12px;">Questions? Reply to this email or contact support@aisentinels.io</p>
    `,
  });

  const text = `Welcome to AI Sentinels, ${params.orgName}

Your Integrated Management System is ready.

Your Sentinel Roster:
- Qualy — ISO 9001 Quality Expert
- Envi — ISO 14001 Environmental Expert
- Saffy — ISO 45001 Health & Safety Expert
- Doki — Document Studio AI
- Audie — Lead Auditor AI
- Nexus — CAPA & Root Cause Analyst

Your first step: Activate your ISO standards in Settings, then let Doki draft your first document.

Access Your Platform: ${APP_URL}/dashboard

Questions? Contact support@aisentinels.io

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 2: Document Approval Request ───────────────────────────────────

export function approvalRequestTemplate(params: {
  documentTitle: string;
  submitterName: string;
  isoStandard: string;
  submittedAt: string;
  documentId: string;
  approvalToken: string;
}) {
  const approveUrl = `${APP_URL}/api/v1/omni/approve?token=${params.approvalToken}&decision=approve`;
  const rejectUrl = `${APP_URL}/api/v1/omni/approve?token=${params.approvalToken}&decision=reject`;

  const subject = `Action Required: ${params.documentTitle} awaiting your approval`;
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">A document requires your review and approval.</h2>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#ffffff;font-weight:600;">${escapeHtml(params.documentTitle)}</p>
        <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
          Submitted by: ${escapeHtml(params.submitterName)}<br>
          Standard: ${escapeHtml(params.isoStandard)}<br>
          Date: ${escapeHtml(params.submittedAt)}
        </p>
      </div>

      ${ctaButton('Review Document \u2192', `${APP_URL}/document-studio/${params.documentId}`)}

      <p style="color:#9ca3af;font-size:12px;">This document was drafted with assistance from Doki, AI Sentinels Document Studio Sentinel. Please review carefully before approving.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr>
          <td style="background:#22C55E;border-radius:6px;">
            <a href="${approveUrl}" target="_blank" style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Approve</a>
          </td>
          <td style="width:12px;">&nbsp;</td>
          <td style="background:#EF4444;border-radius:6px;">
            <a href="${rejectUrl}" target="_blank" style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Request Changes</a>
          </td>
        </tr>
      </table>

      <p style="color:#6b7280;font-size:11px;">Token-based links expire in 48 hours.</p>
    `,
  });

  const text = `Action Required: ${params.documentTitle} awaiting your approval

Document: ${params.documentTitle}
Submitted by: ${params.submitterName}
Standard: ${params.isoStandard}
Date: ${params.submittedAt}

Review: ${APP_URL}/document-studio/${params.documentId}

Approve: ${approveUrl}
Request Changes: ${rejectUrl}

Token-based links expire in 48 hours.

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 3: CAPA Overdue Alert ──────────────────────────────────────────

export function capaOverdueTemplate(params: {
  capaTitle: string;
  capaId: string;
  isoStandard: string;
  dueDate: string;
  daysOverdue: number;
  assigneeName: string;
  severity: string;
}) {
  const subject = `\u26a0\ufe0f Overdue CAPA: ${params.capaTitle} \u2014 ${params.daysOverdue} days overdue`;
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">A corrective action requires immediate attention.</h2>

      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#ffffff;font-weight:600;">${escapeHtml(params.capaTitle)}</p>
        <p style="margin:8px 0 0;color:#fca5a5;font-size:12px;">
          Standard: ${escapeHtml(params.isoStandard)}<br>
          Due Date: ${escapeHtml(params.dueDate)}<br>
          Days Overdue: <strong>${params.daysOverdue}</strong><br>
          Assigned To: ${escapeHtml(params.assigneeName)}<br>
          Severity: ${escapeHtml(params.severity)}
        </p>
      </div>

      <p>Nexus has flagged this as a priority item. Unresolved CAPAs may impact your compliance score and audit readiness.</p>

      ${ctaButton('View CAPA \u2192', `${APP_URL}/capa/${params.capaId}`)}
    `,
  });

  const text = `Overdue CAPA: ${params.capaTitle} — ${params.daysOverdue} days overdue

CAPA: ${params.capaTitle}
Standard: ${params.isoStandard}
Due Date: ${params.dueDate}
Days Overdue: ${params.daysOverdue}
Assigned To: ${params.assigneeName}
Severity: ${params.severity}

Nexus has flagged this as a priority item.

View CAPA: ${APP_URL}/capa/${params.capaId}

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 4: Audit Finding Notification ──────────────────────────────────

export function auditFindingTemplate(params: {
  findingType: string;
  clauseRef: string;
  isoStandard: string;
  auditTitle: string;
  auditId: string;
  findingSummary: string;
}) {
  const subject = `${params.findingType} Finding Raised: ${params.clauseRef} \u2014 ${params.isoStandard}`;
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Audie has raised a ${escapeHtml(params.findingType)} finding during audit.</h2>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          Audit: ${escapeHtml(params.auditTitle)}<br>
          Clause: ${escapeHtml(params.clauseRef)}<br>
          Standard: ${escapeHtml(params.isoStandard)}<br>
          Raised by: Audie &middot; AI Lead Auditor
        </p>
        <p style="margin:12px 0 0;color:#ffffff;">${escapeHtml(params.findingSummary)}</p>
      </div>

      <p>A CAPA has been automatically created in Nexus.</p>

      ${ctaButton('View Finding \u2192', `${APP_URL}/audit/${params.auditId}`)}
    `,
  });

  const text = `${params.findingType} Finding Raised: ${params.clauseRef} — ${params.isoStandard}

Audit: ${params.auditTitle}
Clause: ${params.clauseRef}
Standard: ${params.isoStandard}
Finding: ${params.findingSummary}
Raised by: Audie · AI Lead Auditor

A CAPA has been automatically created in Nexus.

View Finding: ${APP_URL}/audit/${params.auditId}

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 5: Board Report Ready ──────────────────────────────────────────

export function boardReportReadyTemplate(params: {
  periodLabel: string;
  presignedUrl: string;
}) {
  const subject = `Board Report Ready: ${params.periodLabel} ISO Compliance Summary`;
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Your ${escapeHtml(params.periodLabel)} board performance report is ready.</h2>

      <p>Omni has compiled your compliance data including:</p>
      <ul style="color:#d1d5db;font-size:13px;line-height:1.8;padding-left:20px;">
        <li>Compliance scores across active ISO standards</li>
        <li>Open CAPA summary and overdue items</li>
        <li>Audit findings trend (last 3 months)</li>
        <li>Document completion rate</li>
        <li>Sentinel activity summary</li>
      </ul>

      ${ctaButton('Download PDF Report \u2192', params.presignedUrl)}

      <p style="color:#6b7280;font-size:11px;">This link expires in 24 hours. Log in to generate a new link.</p>
    `,
  });

  const text = `Board Report Ready: ${params.periodLabel} ISO Compliance Summary

Your ${params.periodLabel} board performance report is ready.

Omni has compiled your compliance data including:
- Compliance scores across active ISO standards
- Open CAPA summary and overdue items
- Audit findings trend (last 3 months)
- Document completion rate
- Sentinel activity summary

Download: ${params.presignedUrl}

This link expires in 24 hours.

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 6: Legal Acceptance Confirmation ───────────────────────────────

export function legalConfirmationTemplate(params: {
  userEmail: string;
  orgName: string;
  acceptedAt: string;
  ipAddress: string;
}) {
  const subject = 'Your AI Sentinels Agreement Acceptance \u2014 Confirmation';
  const html = baseLayout({
    fromLabel: 'Legal',
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Agreement Acceptance Confirmation</h2>

      <p>This email confirms your acceptance of the following AI Sentinels legal agreements:</p>

      <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#22C55E;font-size:13px;">
          \u2713 Terms of Service \u2014 Version 1.0<br>
          \u2713 Privacy Policy \u2014 Version 1.0
        </p>
      </div>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          <strong style="color:#d1d5db;">Recorded:</strong><br>
          Date/Time: ${escapeHtml(params.acceptedAt)} UTC<br>
          IP Address: ${escapeHtml(params.ipAddress)}<br>
          User: ${escapeHtml(params.userEmail)}<br>
          Organization: ${escapeHtml(params.orgName)}
        </p>
      </div>

      <p style="color:#9ca3af;font-size:12px;">Please retain this email as your record of acceptance.</p>
      <p style="color:#6b7280;font-size:12px;">Questions about these agreements? Contact legal@aisentinels.io</p>
    `,
  });

  const text = `AI Sentinels Agreement Acceptance — Confirmation

This confirms your acceptance of:
- Terms of Service — Version 1.0
- Privacy Policy — Version 1.0

Recorded:
Date/Time: ${params.acceptedAt} UTC
IP Address: ${params.ipAddress}
User: ${params.userEmail}
Organization: ${params.orgName}

Please retain this email as your record of acceptance.
Questions? Contact legal@aisentinels.io

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 7: Subscription Upgrade Confirmation ───────────────────────────

export function subscriptionUpgradeTemplate(params: {
  previousTier: string;
  newTier: string;
  credits: number;
  effectiveDate: string;
}) {
  const subject = `Subscription Upgraded: Welcome to ${params.newTier}`;
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Your AI Sentinels subscription has been upgraded.</h2>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          Previous Plan: ${escapeHtml(params.previousTier)}<br>
          New Plan: <strong style="color:#c2fa69;">${escapeHtml(params.newTier)}</strong><br>
          New AI Credits: ${params.credits}/month<br>
          Effective: ${escapeHtml(params.effectiveDate)}
        </p>
      </div>

      <p>All Sentinels have been updated with your new capabilities.</p>

      ${ctaButton('Explore Your New Plan \u2192', `${APP_URL}/dashboard`)}

      <p style="color:#6b7280;font-size:11px;">Note: All subscription fees are non-refundable per our Terms of Service.</p>
    `,
  });

  const text = `Subscription Upgraded: Welcome to ${params.newTier}

Previous Plan: ${params.previousTier}
New Plan: ${params.newTier}
New AI Credits: ${params.credits}/month
Effective: ${params.effectiveDate}

All Sentinels have been updated with your new capabilities.

Explore: ${APP_URL}/dashboard

Note: All subscription fees are non-refundable per our Terms of Service.

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 8: Ghost Blog Post Published ───────────────────────────────────

export function ghostPostPublishedTemplate(params: {
  postTitle: string;
  category: string;
  readingTime: number;
  excerpt: string;
  slug: string;
}) {
  const subject = `New ISO Insight Published: ${params.postTitle}`;
  const html = baseLayout({
    fromLabel: 'Notifications',
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Ghost has published a new ISO intelligence post.</h2>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#ffffff;font-weight:600;">${escapeHtml(params.postTitle)}</p>
        <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
          Category: ${escapeHtml(params.category)} &middot; Reading Time: ${params.readingTime} min
        </p>
        <p style="margin:12px 0 0;color:#d1d5db;font-size:13px;">${escapeHtml(params.excerpt)}</p>
      </div>

      ${ctaButton('Read Full Article \u2192', `${APP_URL}/blog/${params.slug}`)}
    `,
  });

  const text = `New ISO Insight Published: ${params.postTitle}

Category: ${params.category}
Reading Time: ${params.readingTime} min

${params.excerpt}

Read: ${APP_URL}/blog/${params.slug}

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}

// ── TEMPLATE 9: Security Alert ──────────────────────────────────────────────

export function securityAlertTemplate(params: {
  signInTime: string;
  deviceInfo: string;
  ipAddress: string;
  location: string;
}) {
  const subject = 'Security Alert: New sign-in to your AI Sentinels account';
  const html = baseLayout({
    body: `
      <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">A new sign-in was detected for your account.</h2>

      <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          Time: ${escapeHtml(params.signInTime)} UTC<br>
          Device: ${escapeHtml(params.deviceInfo)}<br>
          IP: ${escapeHtml(params.ipAddress)}<br>
          Location: ${escapeHtml(params.location)}
        </p>
      </div>

      <p>If this was you, no action is needed.</p>
      <p><strong style="color:#EF4444;">If this was NOT you</strong>, secure your account immediately:</p>

      ${ctaButton('Secure My Account \u2192', `${APP_URL}/settings`)}
    `,
  });

  const text = `Security Alert: New sign-in to your AI Sentinels account

A new sign-in was detected for your account.

Time: ${params.signInTime} UTC
Device: ${params.deviceInfo}
IP: ${params.ipAddress}
Location: ${params.location}

If this was you, no action is needed.
If this was NOT you, secure your account immediately: ${APP_URL}/settings

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}
