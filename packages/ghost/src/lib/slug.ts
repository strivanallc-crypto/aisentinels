/**
 * Slug & ID utilities for Ghost Sentinel.
 *
 * - generateSlug: URL-safe kebab-case slug from article title
 * - generateRunId: unique run identifier for Ghost pipeline execution
 * - generatePostId: unique blog post identifier
 */

// ── Slug Generator ──────────────────────────────────────────────────────────

/**
 * Generate a URL-safe kebab-case slug from a title string.
 *
 * Rules:
 *   - Lowercase
 *   - Replace spaces and underscores with hyphens
 *   - Remove non-alphanumeric characters (except hyphens)
 *   - Collapse multiple hyphens
 *   - Trim leading/trailing hyphens
 *   - Max 80 characters (truncate at word boundary)
 *
 * @example
 *   generateSlug("ISO 9001:2015 — A Complete Guide to Quality Management")
 *   // → "iso-9001-2015-a-complete-guide-to-quality-management"
 */
export function generateSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')      // remove non-alphanumeric
    .replace(/[\s_]+/g, '-')           // spaces/underscores → hyphens
    .replace(/-{2,}/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');            // trim leading/trailing hyphens

  // Truncate at word boundary if over 80 chars
  if (slug.length > 80) {
    slug = slug.substring(0, 80);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 40) {
      slug = slug.substring(0, lastHyphen);
    }
  }

  return slug;
}

// ── Run ID Generator ────────────────────────────────────────────────────────

/**
 * Generate a unique Ghost run identifier.
 *
 * Format: ghost-run-{YYYYMMDD}-{random8}
 *
 * @example "ghost-run-20260307-a1b2c3d4"
 */
export function generateRunId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = randomAlphanumeric(8);
  return `ghost-run-${date}-${random}`;
}

// ── Post ID Generator ───────────────────────────────────────────────────────

/**
 * Generate a unique blog post identifier.
 *
 * Format: ghost-post-{random12}
 *
 * @example "ghost-post-a1b2c3d4e5f6"
 */
export function generatePostId(): string {
  return `ghost-post-${randomAlphanumeric(12)}`;
}

// ── Internal helpers ────────────────────────────────────────────────────────

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomAlphanumeric(length: number): string {
  let id = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}
