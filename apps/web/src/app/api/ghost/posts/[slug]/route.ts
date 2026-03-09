/**
 * GET /api/ghost/posts/[slug]
 *
 * Returns a single blog post by slug.
 * Returns 404 if not found.
 *
 * TODO (P6-D): Wire to backend API or direct Aurora query.
 */
import { NextResponse } from 'next/server';

const API_BASE = process.env.INTERNAL_API_URL ?? '';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (API_BASE) {
      const res = await fetch(`${API_BASE}/api/v1/ghost/posts/${slug}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const post = await res.json();
        return NextResponse.json(post);
      }

      if (res.status === 404) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
    }

    // Fallback: not found until backend is wired
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
}
