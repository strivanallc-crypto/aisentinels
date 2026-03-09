/**
 * Blog types — frontend-facing subset of Ghost Sentinel types.
 * No generation internals (tokens, run reports) — only display fields.
 */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  category: string;
  tags: string[];
  seoMeta: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    jsonLd: {
      faqSchema?: Array<{ question: string; answer: string }>;
      articleSchema: Record<string, unknown>;
    };
  };
  relatedSentinels: string[];
  readingTime: number;
  status: 'draft' | 'published' | 'archived';
}

export type BlogCategory =
  | 'All'
  | '2026 Updates'
  | 'Triple Credit'
  | 'Engineering'
  | 'AI + ISO'
  | 'Records';

export const BLOG_CATEGORIES: BlogCategory[] = [
  'All',
  '2026 Updates',
  'Triple Credit',
  'Engineering',
  'AI + ISO',
  'Records',
];

/** Sentinel color map — used for "Related Sentinels" dots on cards */
export const SENTINEL_COLORS: Record<string, string> = {
  Qualy: '#3B82F6',
  Envi: '#22C55E',
  Saffy: '#F97316',
  Doki: '#6366F1',
  Audie: '#F43F5E',
  Nexus: '#8B5CF6',
  Omni: '#A1A1AA',
  Ghost: '#6B7280',
};

/** Category color map — badge colors */
export const CATEGORY_COLORS: Record<string, string> = {
  '2026 Updates': '#F43F5E',
  'Triple Credit': '#F97316',
  Engineering: '#8B5CF6',
  'AI + ISO': '#3B82F6',
  Records: '#22C55E',
};
