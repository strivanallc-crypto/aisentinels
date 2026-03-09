/**
 * SEO Builder — structured data and meta tag generation for Ghost Sentinel.
 *
 * Generates:
 *   - Article JSON-LD (Schema.org/Article)
 *   - FAQ JSON-LD (Schema.org/FAQPage)
 *   - OpenGraph + standard meta tags
 *
 * All output follows Google's structured data guidelines for rich results.
 */
import type { BlogPost, FaqItem, MetaTags } from '../types/blog.ts';

// ── Constants ───────────────────────────────────────────────────────────────

const SITE_URL = 'https://aisentinels.io';
const SITE_NAME = 'AI Sentinels';
const LOGO_URL = `${SITE_URL}/logo.png`;
const AUTHOR_NAME = 'Ghost — AI Sentinels';

// ── Category → Section mapping ──────────────────────────────────────────────

const CATEGORY_SECTIONS: Record<string, string> = {
  'iso-9001-quality': 'ISO 9001 Quality Management',
  'iso-14001-environmental': 'ISO 14001 Environmental Management',
  'iso-45001-ohs': 'ISO 45001 Occupational Health & Safety',
  'integrated-management': 'Integrated Management Systems',
  'compliance-technology': 'Compliance Technology',
};

// ── Article JSON-LD ─────────────────────────────────────────────────────────

/**
 * Build Article structured data (JSON-LD) for a blog post.
 *
 * Conforms to Schema.org/Article spec for Google rich results.
 * Returns a stringified JSON-LD script block.
 */
export function buildArticleSchema(post: BlogPost): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.metaTitle || post.title,
    description: post.metaDescription,
    image: `${SITE_URL}/blog/${post.slug}/og-image.png`,
    author: {
      '@type': 'Organization',
      name: AUTHOR_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
    },
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
    articleSection: CATEGORY_SECTIONS[post.category] ?? post.category,
    keywords: post.tags.join(', '),
    wordCount: post.wordCount,
    inLanguage: 'en-GB',
  };

  return JSON.stringify(schema, null, 2);
}

// ── FAQ JSON-LD ─────────────────────────────────────────────────────────────

/**
 * Build FAQPage structured data (JSON-LD) from FAQ items.
 *
 * Returns null if no FAQ items are provided.
 * Conforms to Schema.org/FAQPage spec for Google rich results.
 */
export function buildFAQSchema(faqItems: FaqItem[]): string | null {
  if (faqItems.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return JSON.stringify(schema, null, 2);
}

// ── Meta Tags ───────────────────────────────────────────────────────────────

/**
 * Build complete meta tags for a blog post.
 *
 * Includes standard SEO meta tags + OpenGraph properties.
 */
export function buildMetaTags(post: BlogPost): MetaTags {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const section = CATEGORY_SECTIONS[post.category] ?? post.category;

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription,
    keywords: post.tags.join(', '),
    ogTitle: post.metaTitle || post.title,
    ogDescription: post.metaDescription,
    ogType: 'article',
    canonicalUrl,
    author: AUTHOR_NAME,
    articleSection: section,
    articlePublishedTime: post.publishedAt ?? post.createdAt,
  };
}

// ── SEO Score Calculator ────────────────────────────────────────────────────

/**
 * Calculate a basic SEO score (0–100) for a blog post.
 *
 * Checks:
 *   - Title length (50–60 chars ideal)          → 15 points
 *   - Meta description length (150–160 chars)    → 15 points
 *   - Content length (1500+ words)               → 20 points
 *   - Has FAQ items                              → 10 points
 *   - Has tags (4+)                              → 10 points
 *   - Has excerpt                                → 10 points
 *   - Keyword presence in title                  → 10 points
 *   - Has schema markup                          → 10 points
 */
export function calculateSeoScore(post: {
  metaTitle: string;
  metaDescription: string;
  content: string;
  faqItems: FaqItem[];
  tags: string[];
  excerpt: string;
  title: string;
  targetKeywords: string[];
  schemaMarkup?: string;
}): number {
  let score = 0;

  // Title length (50–60 chars ideal)
  const titleLen = post.metaTitle.length;
  if (titleLen >= 50 && titleLen <= 60) score += 15;
  else if (titleLen >= 40 && titleLen <= 70) score += 10;
  else if (titleLen > 0) score += 5;

  // Meta description length (150–160 chars ideal)
  const descLen = post.metaDescription.length;
  if (descLen >= 150 && descLen <= 160) score += 15;
  else if (descLen >= 120 && descLen <= 180) score += 10;
  else if (descLen > 0) score += 5;

  // Content length (1500+ words)
  const wordCount = post.content.split(/\s+/).length;
  if (wordCount >= 2000) score += 20;
  else if (wordCount >= 1500) score += 15;
  else if (wordCount >= 1000) score += 10;
  else if (wordCount >= 500) score += 5;

  // Has FAQ items
  if (post.faqItems.length >= 3) score += 10;
  else if (post.faqItems.length >= 1) score += 5;

  // Has tags (4+)
  if (post.tags.length >= 4) score += 10;
  else if (post.tags.length >= 2) score += 5;

  // Has excerpt
  if (post.excerpt.length >= 50) score += 10;
  else if (post.excerpt.length > 0) score += 5;

  // Keyword presence in title
  const titleLower = post.title.toLowerCase();
  const keywordInTitle = post.targetKeywords.some((kw) =>
    titleLower.includes(kw.toLowerCase()),
  );
  if (keywordInTitle) score += 10;

  // Has schema markup
  if (post.schemaMarkup && post.schemaMarkup.length > 10) score += 10;

  return Math.min(score, 100);
}
