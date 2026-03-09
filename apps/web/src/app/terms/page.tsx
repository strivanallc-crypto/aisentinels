import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | AI Sentinels',
  description: 'AI Sentinels Terms of Service — operated by Strivana.com LLC',
  robots: 'index, follow',
};

export default function TermsPage() {
  return (
    <div style={{ background: '#0a0a0a' }} className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-20">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm font-medium" style={{ color: '#c2fa69' }}>
            &larr; Back to AI Sentinels
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-white tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
            Effective Date: 2026-03-09 &middot; Version 1.0
          </p>
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            Operated by Strivana.com LLC
          </p>
          <div className="mt-4 h-px" style={{ background: '#1f2937' }} />
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none" style={{ color: '#d1d5db' }}>

          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using AI Sentinels (&ldquo;the Platform&rdquo;), operated by Strivana.com LLC (&ldquo;the Company&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Platform.</p>

          <h2>2. Description of Service</h2>
          <p>AI Sentinels is a multi-tenant Integrated Management System (IMS) SaaS platform for ISO 9001, ISO 14001, and ISO 45001 compliance management, powered by AI Sentinels (autonomous agents).</p>

          <h2>3. Eligibility</h2>
          <p>You must be at least 18 years old and have the authority to bind your organization to these Terms. By using the Platform, you represent that you meet these requirements.</p>

          <h2>4. Account Registration</h2>
          <p>4.1. You must provide accurate and complete information during registration.</p>
          <p>4.2. You are responsible for maintaining the security of your account credentials, including MFA configuration.</p>
          <p>4.3. You must notify us immediately of any unauthorized access to your account.</p>

          <h2>5. Multi-Tenant Architecture</h2>
          <p>5.1. Each organization (&ldquo;Tenant&rdquo;) receives an isolated data environment with row-level security.</p>
          <p>5.2. You may not attempt to access data belonging to other Tenants.</p>
          <p>5.3. Tenant administrators are responsible for managing user access within their organization.</p>

          <h2>6. AI Sentinels and Automated Processing</h2>
          <p>6.1. The Platform employs AI agents (&ldquo;Sentinels&rdquo;) including Qualy, Envi, Saffy, Doki, Audie, Nexus, Omni, and Ghost to assist with compliance management.</p>
          <p>6.2. AI-generated content (documents, audit findings, CAPA recommendations, risk assessments) is provided as guidance only and does not constitute professional certification or legal advice.</p>
          <p>6.3. You are solely responsible for reviewing, approving, and implementing any AI-generated recommendations.</p>
          <p><strong>6.4. THE PLATFORM DOES NOT GUARANTEE ISO CERTIFICATION. AI SENTINELS ARE TOOLS TO ASSIST YOUR COMPLIANCE EFFORTS, NOT REPLACEMENTS FOR QUALIFIED MANAGEMENT SYSTEM PROFESSIONALS OR CERTIFICATION BODY AUDITORS.</strong></p>

          <h2>7. Subscription Plans and Billing</h2>
          <p>7.1. The Platform offers Starter, Professional, and Enterprise subscription tiers.</p>
          <p>7.2. AI credit usage is metered and limited per plan tier.</p>
          <p>7.3. Payment is processed through Wise Business API. All fees are quoted in USD.</p>
          <p>7.4. Subscriptions renew automatically unless cancelled before the renewal date.</p>

          <h2>8. Data Ownership and Retention</h2>
          <p>8.1. You retain ownership of all data you upload to the Platform.</p>
          <p>8.2. Compliance evidence stored in the Records Vault is retained with Object Lock (COMPLIANCE mode, 7-year retention) as required by ISO standards.</p>
          <p>8.3. Upon account termination, your data will be retained for the legally required retention period, after which it will be securely deleted.</p>
          <p>8.4. Export functionality is available to download your data at any time.</p>

          <h2>9. Acceptable Use</h2>
          <p>You agree not to: (a) reverse engineer, decompile, or disassemble the Platform; (b) use the Platform for any unlawful purpose; (c) attempt to circumvent security controls, RLS policies, or access controls; (d) upload malicious content or attempt to compromise the AI Sentinels; (e) resell or redistribute access to the Platform without authorization.</p>

          <h2>10. Intellectual Property</h2>
          <p>10.1. The Platform, including its AI models, Sentinel personas, and interface design, is the intellectual property of Strivana.com LLC.</p>
          <p>10.2. Blog content generated by Ghost Sentinel is owned by Strivana.com LLC.</p>
          <p><strong>10.3. YOU MAY NOT USE AI SENTINELS OUTPUT TO TRAIN COMPETING AI MODELS OR SERVICES.</strong></p>

          <h2>11. Limitation of Liability</h2>
          <p><strong>11.1. THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</strong></p>
          <p><strong>11.2. IN NO EVENT SHALL STRIVANA.COM LLC BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO FAILED AUDITS, LOST CERTIFICATIONS, REGULATORY PENALTIES, OR BUSINESS LOSSES.</strong></p>
          <p>11.3. Our total liability shall not exceed the amount you paid for the Platform in the 12 months preceding the claim.</p>

          <h2>12. Indemnification</h2>
          <p>You agree to indemnify and hold harmless Strivana.com LLC from any claims, damages, or expenses arising from your use of the Platform or violation of these Terms.</p>

          <h2>13. Security and Compliance</h2>
          <p>13.1. The Platform implements encryption at rest (KMS) and in transit (TLS 1.2+).</p>
          <p>13.2. All actions are logged in an immutable audit trail (DynamoDB, 7-year retention).</p>
          <p>13.3. Multi-factor authentication (MFA) is available and recommended for all users.</p>
          <p>13.4. We maintain AWS GuardDuty, Security Hub, and CloudTrail monitoring.</p>

          <h2>14. Service Availability</h2>
          <p>14.1. We target 99.9% uptime but do not guarantee uninterrupted service.</p>
          <p>14.2. Scheduled maintenance will be communicated in advance.</p>
          <p>14.3. We are not liable for downtime caused by AWS infrastructure issues, force majeure, or your internet connectivity.</p>

          <h2>15. Modifications to Terms</h2>
          <p>We may update these Terms at any time. Material changes will be communicated via email and in-platform notification. Continued use after notification constitutes acceptance of updated Terms.</p>

          <h2>16. Termination</h2>
          <p>16.1. You may terminate your account at any time through Settings.</p>
          <p>16.2. We may suspend or terminate accounts for Terms violations.</p>
          <p>16.3. Upon termination, your access ceases immediately. Data retention per Section 8 applies.</p>

          <h2>17. Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Florida, United States. Any disputes shall be resolved in the courts of Miami-Dade County, Florida.</p>

          <h2>18. Contact</h2>
          <p>For questions about these Terms, contact: legal@aisentinels.io</p>
          <p>Strivana.com LLC<br />Miami, Florida, United States</p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6" style={{ borderTop: '1px solid #1f2937' }}>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Last updated: 2026-03-09
          </p>
          <div className="mt-2 flex gap-4">
            <Link href="/privacy" className="text-xs hover:underline" style={{ color: '#9ca3af' }}>
              Privacy Policy &rarr;
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
