/**
 * /blog — Blog listing page (server component).
 *
 * Features:
 *   • Server-side data fetch (getBlogPosts)
 *   • Category filter (client component)
 *   • Responsive grid: 1 col mobile, 2 col md, 3 col lg
 *   • Empty state when no posts
 *   • Dark theme matching landing page
 *   • Static metadata for SEO
 */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import { getBlogPosts } from '@/lib/blog';
import { BlogCard } from '@/components/blog/blog-card';
import { CategoryFilter } from '@/components/blog/category-filter';

export const metadata: Metadata = {
  title: 'Blog — AI Sentinels | ISO Compliance Insights',
  description:
    'Expert insights on ISO 9001, 14001, 45001 compliance, IMS integration, and AI-powered audit automation.',
  openGraph: {
    title: 'AI Sentinels Blog',
    description:
      'Expert insights on ISO compliance, IMS integration, and AI-powered audit automation.',
    type: 'website',
  },
};

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;
  const posts = await getBlogPosts({
    category: category && category !== 'All' ? category : undefined,
    limit: 24,
  });

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
      {/* ── Nav bar (mini) ───────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(10,15,30,0.96)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Shield size={22} className="text-blue-500" />
            <span className="text-base font-bold tracking-tight text-white">
              AI Sentinels
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#9CA3AF' }}
          >
            <ArrowLeft size={14} />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="px-6 pb-8 pt-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-wider"
            style={{ color: '#3B82F6' }}
          >
            Blog
          </p>
          <h1
            className="font-bold text-white"
            style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            ISO Compliance Insights
          </h1>
          <p
            className="mt-4 max-w-2xl text-lg"
            style={{ color: '#9CA3AF', lineHeight: '1.7' }}
          >
            Expert analysis on ISO 9001, 14001, 45001 standards, IMS integration
            strategies, and AI-powered compliance automation.
          </p>
        </div>
      </header>

      {/* ── Filter + Grid ─────────────────────────────────────────────── */}
      <main className="px-6 pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Category filter */}
          <div className="mb-10">
            <Suspense fallback={null}>
              <CategoryFilter />
            </Suspense>
          </div>

          {/* Post grid */}
          {posts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(59,130,246,0.1)' }}
              >
                <Shield size={28} className="text-blue-500" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-white">
                No posts yet
              </h2>
              <p className="max-w-md text-sm" style={{ color: '#9CA3AF' }}>
                Ghost Sentinel is researching and writing new ISO compliance
                content. Check back soon for expert insights.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer (mini) ────────────────────────────────────────────────── */}
      <footer
        className="py-8"
        style={{ background: '#0A0A0A', borderTop: '1px solid #1F2937' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Shield size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-white">AI Sentinels</span>
          </Link>
          <p className="text-xs" style={{ color: '#4B5563' }}>
            © 2026 AI Sentinels. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
