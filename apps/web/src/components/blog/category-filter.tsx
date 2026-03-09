'use client';

/**
 * CategoryFilter — horizontal pill toggle for blog category filtering.
 *
 * 'use client' because it manages local state (selected category).
 * Updates URL search params so the blog page re-renders server-side.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { BLOG_CATEGORIES, CATEGORY_COLORS, type BlogCategory } from '@/types/blog';

export function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = (searchParams.get('category') as BlogCategory) ?? 'All';

  function handleSelect(category: BlogCategory) {
    const params = new URLSearchParams(searchParams.toString());
    if (category === 'All') {
      params.delete('category');
    } else {
      params.set('category', category);
    }
    const qs = params.toString();
    router.push(`/blog${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {BLOG_CATEGORIES.map((cat) => {
        const isActive = cat === active;
        const color = cat === 'All' ? '#3B82F6' : (CATEGORY_COLORS[cat] ?? '#6B7280');

        return (
          <button
            key={cat}
            onClick={() => handleSelect(cat)}
            className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-200"
            style={{
              background: isActive ? `${color}20` : 'transparent',
              color: isActive ? color : '#9CA3AF',
              border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
