/**
 * BlogCard — renders a single blog post in the listing grid.
 *
 * Features:
 *   • Category badge (colored per CATEGORY_COLORS)
 *   • Related sentinel dots
 *   • Reading time + publish date
 *   • Hover lift effect (CSS only, no JS)
 *   • Links to /blog/[slug]
 */
import Link from 'next/link';
import type { BlogPost } from '@/types/blog';
import { CATEGORY_COLORS, SENTINEL_COLORS } from '@/types/blog';
import { formatReadingTime, formatPublishDate } from '@/lib/blog';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const badgeColor = CATEGORY_COLORS[post.category] ?? '#6B7280';

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1"
      style={{
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: badgeColor }} />

      <div className="flex flex-1 flex-col p-6">
        {/* Category badge */}
        <span
          className="mb-4 inline-block w-fit rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: `${badgeColor}15`,
            color: badgeColor,
            border: `1px solid ${badgeColor}30`,
          }}
        >
          {post.category}
        </span>

        {/* Title */}
        <h3
          className="mb-2 line-clamp-2 text-lg font-semibold leading-snug text-white transition-colors group-hover:text-blue-400"
        >
          {post.title}
        </h3>

        {/* Excerpt */}
        <p
          className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed"
          style={{ color: '#9CA3AF' }}
        >
          {post.excerpt}
        </p>

        {/* Footer: sentinel dots + meta */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Sentinel dots */}
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

          {/* Date + reading time */}
          <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
            <span>{formatPublishDate(post.publishedAt)}</span>
            <span>·</span>
            <span>{formatReadingTime(post.readingTime)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
