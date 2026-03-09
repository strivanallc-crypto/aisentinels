/**
 * Ghost post published email template.
 * Kept separate from packages/api templates since Ghost is a standalone Lambda.
 */

const APP_URL = process.env.APP_URL ?? 'https://aisentinels.io';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function ghostPostPublishedTemplate(params: {
  postTitle: string;
  category: string;
  readingTime: number;
  excerpt: string;
  slug: string;
}): { subject: string; html: string; text: string } {
  const subject = `New ISO Insight Published: ${params.postTitle}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
  <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <span style="color:#ffffff;font-size:16px;font-weight:700;">AI Sentinels</span>
    <span style="color:#6b7280;font-size:11px;float:right;">Ghost Sentinel</span>
  </td></tr>
  <tr><td style="padding:32px;color:#ffffff;font-size:14px;line-height:1.65;">
    <h2 style="margin:0 0 16px;font-size:18px;color:#ffffff;">Ghost has published a new ISO intelligence post.</h2>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#ffffff;font-weight:600;">${escapeHtml(params.postTitle)}</p>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
        Category: ${escapeHtml(params.category)} &middot; Reading Time: ${params.readingTime} min
      </p>
      <p style="margin:12px 0 0;color:#d1d5db;font-size:13px;">${escapeHtml(params.excerpt)}</p>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#c2fa69;border-radius:8px;"><a href="${APP_URL}/blog/${params.slug}" target="_blank" style="display:inline-block;padding:12px 24px;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;">Read Full Article &rarr;</a></td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;color:#6b7280;font-size:11px;">AI Sentinels &middot; operated by Strivana.com LLC &middot; aisentinels.io</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `New ISO Insight Published: ${params.postTitle}

Category: ${params.category}
Reading Time: ${params.readingTime} min

${params.excerpt}

Read: ${APP_URL}/blog/${params.slug}

---
AI Sentinels · operated by Strivana.com LLC · aisentinels.io`;

  return { subject, html, text };
}
