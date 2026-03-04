import { LandingPage } from '@/components/landing/landing-page';

// Static page — always renders the public landing page.
// Authenticated users are redirected to /dashboard client-side
// via useSession() in the LandingPage component.
export default function RootPage() {
  return <LandingPage />;
}
