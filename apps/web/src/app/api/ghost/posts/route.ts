/**
 * GET /api/ghost/posts
 *
 * Returns published blog posts from Aurora blog_posts table.
 * Query params: limit (default 12), category (optional).
 * Always returns 200 with [] on error — never 500 to client.
 *
 * TODO (P6-D): Wire to backend API or direct Aurora query.
 * Currently returns empty array until backend blog endpoint is deployed.
 */
import { NextResponse } from 'next/server';

const API_BASE = process.env.INTERNAL_API_URL ?? '';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ?? '12';
    const category = searchParams.get('category');

    // When backend API is available, proxy to it
    if (API_BASE) {
      const params = new URLSearchParams({ limit });
      if (category) params.set('category', category);

      const res = await fetch(`${API_BASE}/api/v1/ghost/posts?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const posts = await res.json();
        return NextResponse.json(posts);
      }
    }

    // Fallback: return empty array until backend is wired
    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
