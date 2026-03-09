/**
 * /blog/[slug] — Individual blog post page (server component).
 *
 * Features:
 *   • generateMetadata for per-post SEO (title, description, OG)
 *   • JSON-LD Article + FAQ schemas from seoMeta
 *   • Prose styling via @tailwindcss/typography
 *   • Category badge, sentinel dots, reading time, publish date
 *   • "Back to Blog" breadcrumb
 *   • 404 via notFound() when slug not matched
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowLeft, Clock, Calendar } from 'lucide-react';
import { getBlogPost } from '@/lib/blog';
import { formatReadingTime, formatPublishDate } from '@/lib/blog';
import { CATEGORY_COLORS, SENTINEL_COLORS } from '@/types/blog';

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return { title: 'Post Not Found — AI Sentinels' };
  }

  return {
    title: post.seoMeta.metaTitle || post.title,
    description: post.seoMeta.metaDescription || post.excerpt,
    alternates: {
      canonical: post.seoMeta.canonicalUrl || `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.seoMeta.metaTitle || post.title,
      description: post.seoMeta.metaDescription || post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const badgeColor = CATEGORY_COLORS[post.category] ?? '#6B7280';

  // Build JSON-LD scripts
  const articleJsonLd = post.seoMeta.jsonLd.articleSchema;
  const faqJsonLd =
    post.seoMeta.jsonLd.faqSchema && post.seoMeta.jsonLd.faqSchema.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.seoMeta.jsonLd.faqSchema.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <div className="min-h-screen" style={{ background: '#0A0F1E' }}>
      {/* JSON-LD */}
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      )}
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* ── Nav bar (mini) ─────────────────────────────────────────────── */}
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
            href="/blog"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#9CA3AF' }}
          >
            <ArrowLeft size={14} />
            Back to Blog
          </Link>
        </div>
      </nav>

      {/* ── Article ────────────────────────────────────────────────────── */}
      <article className="px-6 pb-24 pt-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
            <Link href="/blog" className="transition-colors hover:text-white">
              Blog
            </Link>
            <span>/</span>
            <span style={{ color: '#9CA3AF' }}>{post.category}</span>
          </div>

          {/* Category badge */}
          <span
            className="mb-6 inline-block rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `${badgeColor}15`,
              color: badgeColor,
              border: `1px solid ${badgeColor}30`,
            }}
          >
            {post.category}
          </span>

          {/* Title */}
          <h1
            className="mb-6 font-bold text-white"
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {post.title}
          </h1>

          {/* Meta row */}
          <div
            className="mb-10 flex flex-wrap items-center gap-4 pb-8 text-sm"
            style={{ color: '#9CA3AF', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{formatPublishDate(post.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>{formatReadingTime(post.readingTime)}</span>
            </div>

            {/* Sentinel dots */}
            {post.relatedSentinels.length > 0 && (
              <div className="flex items-center gap-1.5">
                {post.relatedSentinels.map((name) => (
                  <div
                    key={name}
                    title={name}
                    className="rounded-full"
                    style={{
                      width: '8px',
                      height: '8px',
                      background: SENTINEL_COLORS[name] ?? '#6B7280',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md px-2 py-0.5 text-xs"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#6B7280' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Post body (prose) */}
          <div
            className="prose prose-invert max-w-none
              prose-headings:text-white prose-headings:font-semibold
              prose-p:leading-relaxed prose-p:text-gray-300
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white
              prose-ul:text-gray-300 prose-ol:text-gray-300
              prose-blockquote:border-blue-500 prose-blockquote:text-gray-400
              prose-code:text-blue-300 prose-code:bg-white/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
              prose-pre:bg-[#111827] prose-pre:border prose-pre:border-white/10"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* ── FAQ section ─────────────────────────────────────────────── */}
          {post.seoMeta.jsonLd.faqSchema && post.seoMeta.jsonLd.faqSchema.length > 0 && (
            <section className="mt-16">
              <h2
                className="mb-6 text-2xl font-bold text-white"
                style={{ letterSpacing: '-0.01em' }}
              >
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {post.seoMeta.jsonLd.faqSchema.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-5"
                    style={{
                      background: '#111827',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <h3 className="mb-2 text-sm font-semibold text-white">
                      {item.question}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>

      {/* ── Footer (mini) ─────────────────────────────────────────────── */}
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
