/**
 * Ghost Sentinel — Type definitions for the autonomous ISO SEO Content Engine.
 *
 * Ghost (Sentinel 7) researches ISO compliance topics via Perplexity,
 * generates long-form blog content via Claude, and publishes SEO-optimised
 * articles to the aisentinels.io blog.
 */

// ── Blog Categories ─────────────────────────────────────────────────────────

export type BlogCategory =
  | 'iso-9001-quality'
  | 'iso-14001-environmental'
  | 'iso-45001-ohs'
  | 'integrated-management'
  | 'compliance-technology';

// ── Blog Post Status ────────────────────────────────────────────────────────

export type BlogPostStatus = 'draft' | 'review' | 'published' | 'archived';

// ── Blog Post ───────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;             // Markdown source
  contentHtml: string;         // Rendered HTML
  category: BlogCategory;
  tags: string[];
  author: string;              // Always "Ghost — AI Sentinels"
  status: BlogPostStatus;
  publishedAt: string | null;  // ISO 8601
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
  topicId: string;
  runId: string;
  wordCount: number;
  readingTimeMinutes: number;
  seoScore: number;            // 0–100
  schemaMarkup: string;        // Article JSON-LD
  faqSchema: string | null;    // FAQ JSON-LD
  perplexitySources: string[]; // Citation URLs from research
  claudeTokensUsed: number;
  perplexityTokensUsed: number;
}

// ── Ghost Topic ─────────────────────────────────────────────────────────────

export interface GhostTopic {
  id: string;
  title: string;
  category: BlogCategory;
  targetKeywords: string[];
  researchPrompt: string;
  contentBrief: string;
  priority: number;            // 1–10 (10 = highest)
  lastPublished: string | null;
}

// ── Research Result ─────────────────────────────────────────────────────────

export interface ResearchResult {
  topic: GhostTopic;
  perplexityResponse: string;
  sources: string[];
  keyFindings: string[];
  tokensUsed: number;
  researchedAt: string;        // ISO 8601
}

// ── Generated Content ───────────────────────────────────────────────────────

export interface GeneratedContent {
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  content: string;             // Markdown
  tags: string[];
  faqItems: FaqItem[];
  wordCount: number;
  readingTimeMinutes: number;
}

// ── FAQ Item ────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

// ── SEO Meta Tags ───────────────────────────────────────────────────────────

export interface MetaTags {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  canonicalUrl: string;
  author: string;
  articleSection: string;
  articlePublishedTime: string;
}

// ── Ghost Run Report ────────────────────────────────────────────────────────

export type GhostRunStatus = 'running' | 'completed' | 'failed';
export type GhostTriggerMode = 'eventbridge' | 'manual';

export interface GhostRunReport {
  runId: string;
  triggerMode: GhostTriggerMode;
  startedAt: string;           // ISO 8601
  completedAt: string | null;
  status: GhostRunStatus;
  topicId: string;
  topicTitle: string;
  blogPostId: string | null;
  researchTokens: number;
  contentTokens: number;
  error: string | null;
}
