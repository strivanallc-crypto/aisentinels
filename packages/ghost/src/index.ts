/**
 * Ghost Sentinel — Lambda Entry Point.
 *
 * Sentinel 7: The autonomous ISO SEO Content Engine.
 *
 * Trigger modes:
 *   1. EventBridge scheduled rule → picks next topic automatically
 *   2. Manual invocation → topicId in event payload
 *
 * Pipeline:
 *   Research (Perplexity) → Generate (Claude) → SEO (schema/meta) → Store (Aurora)
 *
 * Fire-and-forget audit logging via DynamoDB.
 */
import type { ScheduledEvent } from 'aws-lambda';
import { researchTopic } from './lib/perplexity.ts';
import { generateBlogPost } from './lib/content-gen.ts';
import { buildArticleSchema, buildFAQSchema, calculateSeoScore } from './lib/seo-builder.ts';
import { generateSlug, generateRunId, generatePostId } from './lib/slug.ts';
import { getNextTopic, getTopicById } from './topics/seed-topics.ts';
import {
  insertBlogPost,
  insertRunReport,
  completeRunReport,
  getPublishedTopicInfo,
} from './db/client.ts';
import type { BlogPost, GhostTopic } from './types/blog.ts';
import { sendGhostNotification } from './lib/ghost-mailer.ts';
import { ghostPostPublishedTemplate } from './lib/ghost-email-template.ts';

// ── Event Shape ─────────────────────────────────────────────────────────────

interface ManualEvent {
  source: 'manual';
  topicId: string;
}

type GhostEvent = ScheduledEvent | ManualEvent;

function isManualEvent(event: unknown): event is ManualEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'source' in event &&
    (event as ManualEvent).source === 'manual' &&
    'topicId' in event &&
    typeof (event as ManualEvent).topicId === 'string'
  );
}

function isEventBridgeEvent(event: unknown): event is ScheduledEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'source' in event &&
    (event as ScheduledEvent).source === 'aws.events'
  );
}

// ── Simple Markdown → HTML converter ────────────────────────────────────────

function markdownToHtml(md: string): string {
  return md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (non-empty lines not already wrapped)
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, '<p>$1</p>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks
    .replace(/\n{2,}/g, '\n');
}

// ── Main Handler ────────────────────────────────────────────────────────────

export const handler = async (event: GhostEvent): Promise<{
  statusCode: number;
  body: string;
}> => {
  const runId = generateRunId();
  let topic: GhostTopic | undefined;
  let triggerMode: 'eventbridge' | 'manual' = 'eventbridge';

  console.log(JSON.stringify({
    event: 'GhostPipelineStart',
    runId,
    rawEvent: JSON.stringify(event).slice(0, 500),
  }));

  try {
    // ── 1. Resolve topic ──────────────────────────────────────────────────
    if (isManualEvent(event)) {
      triggerMode = 'manual';
      topic = getTopicById(event.topicId);
      if (!topic) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Topic not found: ${event.topicId}` }),
        };
      }
    } else if (isEventBridgeEvent(event)) {
      triggerMode = 'eventbridge';
      const { publishedIds, lastPublishedMap } = await getPublishedTopicInfo();
      topic = getNextTopic(publishedIds, lastPublishedMap);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid event: expected EventBridge schedule or manual { source: "manual", topicId }' }),
      };
    }

    console.log(JSON.stringify({
      event: 'GhostTopicSelected',
      runId,
      triggerMode,
      topicId: topic.id,
      topicTitle: topic.title,
    }));

    // ── 2. Record run start ───────────────────────────────────────────────
    await insertRunReport({
      runId,
      triggerMode,
      topicId: topic.id,
      topicTitle: topic.title,
    });

    // ── 3. Research (Perplexity) ──────────────────────────────────────────
    console.log(JSON.stringify({ event: 'GhostResearchStart', runId, topicId: topic.id }));
    const research = await researchTopic(topic);
    console.log(JSON.stringify({
      event: 'GhostResearchComplete',
      runId,
      tokensUsed: research.tokensUsed,
      sourcesCount: research.sources.length,
    }));

    // ── 4. Generate content (Claude) ──────────────────────────────────────
    console.log(JSON.stringify({ event: 'GhostContentStart', runId, topicId: topic.id }));
    const { generated, tokensUsed: contentTokens } = await generateBlogPost(research);
    console.log(JSON.stringify({
      event: 'GhostContentComplete',
      runId,
      wordCount: generated.wordCount,
      tokensUsed: contentTokens,
    }));

    // ── 5. Build SEO artefacts ────────────────────────────────────────────
    const postId = generatePostId();
    const slug = generateSlug(generated.title);
    const contentHtml = markdownToHtml(generated.content);
    const now = new Date().toISOString();

    const blogPost: BlogPost = {
      id: postId,
      slug,
      title: generated.title,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      excerpt: generated.excerpt,
      content: generated.content,
      contentHtml,
      category: topic.category,
      tags: generated.tags,
      author: 'Ghost — AI Sentinels',
      status: 'draft',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      topicId: topic.id,
      runId,
      wordCount: generated.wordCount,
      readingTimeMinutes: generated.readingTimeMinutes,
      seoScore: 0, // calculated below
      schemaMarkup: '',
      faqSchema: null,
      perplexitySources: research.sources,
      claudeTokensUsed: contentTokens,
      perplexityTokensUsed: research.tokensUsed,
    };

    // Build structured data
    blogPost.schemaMarkup = buildArticleSchema(blogPost);
    blogPost.faqSchema = buildFAQSchema(generated.faqItems);

    // Calculate SEO score
    blogPost.seoScore = calculateSeoScore({
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
      content: generated.content,
      faqItems: generated.faqItems,
      tags: generated.tags,
      excerpt: generated.excerpt,
      title: generated.title,
      targetKeywords: topic.targetKeywords,
      schemaMarkup: blogPost.schemaMarkup,
    });

    console.log(JSON.stringify({
      event: 'GhostSeoComplete',
      runId,
      postId,
      slug,
      seoScore: blogPost.seoScore,
    }));

    // ── 6. Store in Aurora ────────────────────────────────────────────────
    await insertBlogPost(blogPost);

    // ── 7. Complete run report ────────────────────────────────────────────
    await completeRunReport({
      runId,
      status: 'completed',
      blogPostId: postId,
      researchTokens: research.tokensUsed,
      contentTokens,
      error: null,
    });

    console.log(JSON.stringify({
      event: 'GhostPipelineComplete',
      runId,
      postId,
      slug,
      seoScore: blogPost.seoScore,
      wordCount: generated.wordCount,
      researchTokens: research.tokensUsed,
      contentTokens,
    }));

    // Fire-and-forget: notify team of new blog post
    const emailData = ghostPostPublishedTemplate({
      postTitle: generated.title,
      category: topic.category,
      readingTime: generated.readingTimeMinutes,
      excerpt: generated.excerpt,
      slug,
    });
    sendGhostNotification(emailData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        runId,
        postId,
        slug,
        title: generated.title,
        seoScore: blogPost.seoScore,
        wordCount: generated.wordCount,
        readingTimeMinutes: generated.readingTimeMinutes,
        status: 'draft',
      }),
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error(JSON.stringify({
      event: 'GhostPipelineError',
      runId,
      topicId: topic?.id ?? 'unknown',
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    }));

    // Best-effort: update run report with failure
    try {
      await completeRunReport({
        runId,
        status: 'failed',
        blogPostId: null,
        researchTokens: 0,
        contentTokens: 0,
        error: errorMessage.slice(0, 1000),
      });
    } catch {
      // Run report update failed — already logged pipeline error above
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        runId,
        error: errorMessage,
      }),
    };
  }
};
