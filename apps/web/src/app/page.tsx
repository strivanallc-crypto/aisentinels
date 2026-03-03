import { redirect } from 'next/navigation';

// Root → redirect to the main dashboard
export default function RootPage() {
  redirect('/dashboard');
}
