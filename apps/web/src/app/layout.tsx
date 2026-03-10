import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'AI Sentinels – ISO Compliance Platform',
  description:
    'Six AI Sentinels eliminate the paperwork, the guesswork, and the audit anxiety — delivering ISO 9001, 14001 & 45001 certification-ready compliance.',
  keywords: [
    'ISO 9001',
    'ISO 14001',
    'ISO 45001',
    'compliance',
    'AI',
    'quality management',
    'IMS',
  ],
  openGraph: {
    title: 'AI Sentinels – ISO Compliance Platform',
    description:
      'Six AI Sentinels automate ISO certification. Quality, Environmental & Safety — one platform.',
    siteName: 'AI Sentinels',
    type: 'website',
    url: 'https://aisentinels.io',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
