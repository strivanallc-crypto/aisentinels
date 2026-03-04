import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LandingPage } from '@/components/landing/landing-page';

// Dynamic — never cache this page (auth check must run on every request)
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await auth();
  if (session) redirect('/dashboard');
  return <LandingPage />;
}
