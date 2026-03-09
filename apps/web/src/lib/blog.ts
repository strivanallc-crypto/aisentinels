/**
 * Blog data fetching — server-side with Next.js revalidation.
 *
 * Reads from internal API routes (/api/ghost/posts).
 * On error: returns [] or null — never throws on frontend data fetch.
 */
import type { BlogPost } from '@/types/blog';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function getBlogPosts(options?: {
  limit?: number;
  category?: string;
}): Promise<BlogPost[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.category) params.set('category', options.category);

    const qs = params.toString();
    const url = `${BASE_URL}/api/ghost/posts${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];
    return (await res.json()) as BlogPost[];
  } catch {
    return [];
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/ghost/posts/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    return (await res.json()) as BlogPost | null;
  } catch {
    return null;
  }
}

export async function getLatestPosts(limit = 3): Promise<BlogPost[]> {
  return getBlogPosts({ limit });
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min read`;
}

export function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
