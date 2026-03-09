import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | AI Sentinels',
  description: 'AI Sentinels Privacy Policy — how we collect, use, and protect your data',
  robots: 'index, follow',
};

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0a0a0a' }} className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-20">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm font-medium" style={{ color: '#c2fa69' }}>
            &larr; Back to AI Sentinels
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
            Effective Date: 2026-03-09 &middot; Version 1.0
          </p>
          <div className="mt-4 h-px" style={{ background: '#1f2937' }} />
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none" style={{ color: '#d1d5db' }}>

          <h2>1. Introduction</h2>
          <p>This Privacy Policy describes how Strivana.com LLC (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, stores, and protects your information when you use AI Sentinels (&ldquo;the Platform&rdquo;).</p>

          <h2>2. Information We Collect</h2>
          <p>2.1. <strong>Account Information:</strong> Name, email address, organization name, and role when you register.</p>
          <p>2.2. <strong>Usage Data:</strong> Actions performed on the Platform, AI Sentinel interactions, documents created, audits conducted, and compliance activities.</p>
          <p>2.3. <strong>Technical Data:</strong> IP address, browser type, device information, and access timestamps (logged in immutable audit trail).</p>
          <p>2.4. <strong>Compliance Data:</strong> Documents, audit records, CAPA items, risk assessments, and management review data you upload or generate.</p>
          <p>2.5. <strong>AI Interaction Data:</strong> Prompts sent to and responses received from AI Sentinels, including token usage metrics.</p>

          <h2>3. How We Use Your Information</h2>
          <p>3.1. To provide, maintain, and improve the Platform and its AI capabilities.</p>
          <p>3.2. To process your compliance management activities.</p>
          <p>3.3. To generate audit trails as required by ISO standards.</p>
          <p>3.4. To send transactional emails (approvals, alerts, reports).</p>
          <p>3.5. To detect and prevent unauthorized access or security threats.</p>
          <p>3.6. To aggregate anonymized usage analytics for Platform improvement.</p>

          <h2>4. Data Storage and Security</h2>
          <p>4.1. All data is stored in AWS us-east-1 (Virginia) with replication to eu-west-1 (Ireland) for compliance evidence.</p>
          <p>4.2. Data is encrypted at rest using AWS KMS (AES-256) and in transit using TLS 1.2+.</p>
          <p>4.3. Compliance evidence is stored with S3 Object Lock (COMPLIANCE mode, 7-year retention).</p>
          <p>4.4. Database access uses IAM authentication and row-level security (RLS) for tenant isolation.</p>
          <p>4.5. Access is monitored via AWS CloudTrail, GuardDuty, and Security Hub.</p>

          <h2>5. Data Sharing</h2>
          <p>5.1. We do not sell your personal data.</p>
          <p>5.2. We share data only with: (a) AWS infrastructure services (hosting, storage, compute); (b) Anthropic/Google for AI processing (prompts are not used to train models); (c) Law enforcement when required by legal process.</p>
          <p>5.3. Your compliance data is never shared with other Tenants.</p>

          <h2>6. AI Processing</h2>
          <p>6.1. AI Sentinels process your data to provide compliance assistance.</p>
          <p>6.2. AI interactions are logged for audit purposes and quality improvement.</p>
          <p>6.3. We do not use your data to train third-party AI models.</p>
          <p>6.4. AI-generated content may be reviewed for quality assurance.</p>

          <h2>7. Data Retention</h2>
          <p>7.1. Active account data: retained while your account is active.</p>
          <p>7.2. Compliance evidence: 7-year minimum retention (ISO requirement).</p>
          <p>7.3. Audit trail logs: 7-year retention (immutable, DynamoDB).</p>
          <p>7.4. Blog content: retained indefinitely (public).</p>
          <p>7.5. Deleted data: securely purged after retention period expires.</p>

          <h2>8. Your Rights</h2>
          <p>8.1. <strong>Access:</strong> You may export your data at any time through the Platform.</p>
          <p>8.2. <strong>Correction:</strong> You may update your account information in Settings.</p>
          <p>8.3. <strong>Deletion:</strong> You may request account deletion (subject to retention requirements).</p>
          <p>8.4. <strong>Portability:</strong> You may export compliance data in standard formats.</p>
          <p>8.5. To exercise these rights, contact: privacy@aisentinels.io</p>

          <h2>9. Cookies and Tracking</h2>
          <p>9.1. We use essential cookies for authentication and session management.</p>
          <p>9.2. We do not use third-party advertising cookies.</p>
          <p>9.3. Analytics data is collected in aggregate and anonymized.</p>

          <h2>10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy. Material changes will be communicated via email and require re-acceptance through the Platform.</p>

          <h2>11. Contact</h2>
          <p>For privacy inquiries: privacy@aisentinels.io</p>
          <p>Data Protection Contact: legal@aisentinels.io</p>
          <p>Strivana.com LLC<br />Miami, Florida, United States</p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6" style={{ borderTop: '1px solid #1f2937' }}>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Last updated: 2026-03-09
          </p>
          <div className="mt-2 flex gap-4">
            <Link href="/terms" className="text-xs hover:underline" style={{ color: '#9ca3af' }}>
              Terms of Service &rarr;
            </Link>
            <Link href="/" className="text-xs hover:underline" style={{ color: '#9ca3af' }}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
