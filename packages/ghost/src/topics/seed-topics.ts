/**
 * Seed Topics — initial content topics for Ghost Sentinel.
 *
 * 8 topics across 5 categories. Ghost cycles through these on a schedule,
 * selecting the next topic based on priority and last-published date.
 *
 * Categories:
 *   1. iso-9001-quality          (2 topics)
 *   2. iso-14001-environmental   (1 topic)
 *   3. iso-45001-ohs             (1 topic)
 *   4. integrated-management     (2 topics)
 *   5. compliance-technology     (2 topics)
 */
import type { GhostTopic } from '../types/blog.ts';

// ── Seed Topics ─────────────────────────────────────────────────────────────

export const SEED_TOPICS: GhostTopic[] = [
  // ── ISO 9001 Quality (2) ────────────────────────────────────────────────
  {
    id: 'topic-9001-risk-based-thinking',
    title: 'Risk-Based Thinking in ISO 9001:2015 — From Clause 6.1 to Competitive Advantage',
    category: 'iso-9001-quality',
    targetKeywords: [
      'risk-based thinking ISO 9001',
      'ISO 9001 clause 6.1',
      'quality risk management',
      'risk opportunity assessment',
    ],
    researchPrompt:
      'Research how organisations implement risk-based thinking per ISO 9001:2015 clause 6.1. Cover practical risk assessment methodologies (FMEA, risk matrices), integration with strategic planning, and how leading organisations turn risk management into a competitive advantage. Include 2024-2026 trends in AI-assisted risk identification.',
    contentBrief:
      'Write a comprehensive guide on implementing risk-based thinking across the QMS. Cover the shift from preventive action to risk-based thinking, practical tools, real-world implementation examples, and how AI is transforming risk identification and assessment.',
    priority: 9,
    lastPublished: null,
  },
  {
    id: 'topic-9001-internal-audit',
    title: 'Internal Audit Excellence — Beyond Compliance Checklists with ISO 19011:2018',
    category: 'iso-9001-quality',
    targetKeywords: [
      'ISO 19011 internal audit',
      'internal audit best practices',
      'audit programme management',
      'ISO 9001 clause 9.2',
    ],
    researchPrompt:
      'Research best practices for internal audit programmes per ISO 19011:2018 and ISO 9001:2015 clause 9.2. Cover audit planning, competence requirements for auditors, risk-based audit approaches, remote/hybrid audit techniques, and how organisations are moving from compliance-focused to value-adding audits.',
    contentBrief:
      'Write about transforming internal audits from checkbox exercises into value-adding activities. Cover auditor competence, risk-based audit planning, remote audit techniques, and how AI tools like Audie are changing the audit landscape.',
    priority: 8,
    lastPublished: null,
  },

  // ── ISO 14001 Environmental (1) ─────────────────────────────────────────
  {
    id: 'topic-14001-lifecycle-perspective',
    title: 'Life Cycle Perspective in ISO 14001:2015 — Mapping Environmental Impact from Cradle to Gate',
    category: 'iso-14001-environmental',
    targetKeywords: [
      'ISO 14001 life cycle perspective',
      'environmental aspect lifecycle',
      'ISO 14001 clause 6.1.2',
      'cradle to gate assessment',
    ],
    researchPrompt:
      'Research how organisations implement the life cycle perspective required by ISO 14001:2015. Cover clause 6.1.2 environmental aspects, life cycle assessment (LCA) methodologies, supply chain environmental management, Scope 3 emissions tracking, and circular economy integration. Include regulatory developments in EU/UK environmental reporting.',
    contentBrief:
      'Write about implementing life cycle thinking within an EMS. Cover the difference between full LCA and the life cycle perspective required by ISO 14001, practical approaches to mapping environmental impacts, and how digital tools are enabling better lifecycle data collection.',
    priority: 7,
    lastPublished: null,
  },

  // ── ISO 45001 OH&S (1) ──────────────────────────────────────────────────
  {
    id: 'topic-45001-worker-participation',
    title: 'Worker Participation & Consultation in ISO 45001:2018 — Building a Safety Culture That Works',
    category: 'iso-45001-ohs',
    targetKeywords: [
      'ISO 45001 worker participation',
      'ISO 45001 clause 5.4',
      'safety culture workplace',
      'OH&S consultation requirements',
    ],
    researchPrompt:
      'Research how organisations implement effective worker participation and consultation per ISO 45001:2018 clause 5.4. Cover the difference between participation and consultation, practical mechanisms for worker engagement, psychological safety in reporting, leading indicators vs lagging indicators, and how digital platforms enable real-time safety participation.',
    contentBrief:
      'Write about building genuine worker participation beyond suggestion boxes. Cover the ISO 45001 requirements, practical engagement mechanisms, overcoming barriers to reporting, and how technology is enabling real-time safety culture measurement.',
    priority: 7,
    lastPublished: null,
  },

  // ── Integrated Management Systems (2) ───────────────────────────────────
  {
    id: 'topic-ims-annex-sl-integration',
    title: 'The Annex SL Advantage — How to Build a Truly Integrated Management System in 2026',
    category: 'integrated-management',
    targetKeywords: [
      'integrated management system',
      'Annex SL harmonised structure',
      'IMS implementation guide',
      'ISO integration benefits',
    ],
    researchPrompt:
      'Research the current state of integrated management system (IMS) implementation using Annex SL harmonised structure. Cover benefits vs single-standard certification, integration strategies, common pitfalls, cost savings data, and how AI/automation is reducing the burden of managing multiple standards simultaneously. Include 2024-2026 certification trends and upcoming ISO standard revisions.',
    contentBrief:
      'Write a practical guide to building an IMS using the Annex SL common structure. Cover the business case, implementation roadmap, how to handle standard-specific requirements within a unified framework, and the role of AI orchestration in managing cross-standard compliance.',
    priority: 10,
    lastPublished: null,
  },
  {
    id: 'topic-ims-management-review',
    title: 'Management Review Done Right — Clause 9.3 Across ISO 9001, 14001 & 45001',
    category: 'integrated-management',
    targetKeywords: [
      'management review ISO',
      'ISO clause 9.3',
      'management review inputs outputs',
      'integrated management review',
    ],
    researchPrompt:
      'Research best practices for conducting management reviews across ISO 9001, 14001, and 45001. Cover the required inputs and outputs per clause 9.3 of each standard, how to conduct integrated reviews efficiently, data-driven decision making, KPI dashboards, and how AI can synthesise management review inputs from multiple data sources.',
    contentBrief:
      'Write about transforming management reviews from tedious presentations into strategic decision-making sessions. Cover integrated review agendas, data visualisation for leadership, required inputs/outputs comparison across standards, and how Platform sentinel automates review input preparation.',
    priority: 8,
    lastPublished: null,
  },

  // ── Compliance Technology (2) ───────────────────────────────────────────
  {
    id: 'topic-tech-ai-iso-compliance',
    title: 'AI-Powered ISO Compliance — How Intelligent Automation Is Transforming Quality Management',
    category: 'compliance-technology',
    targetKeywords: [
      'AI ISO compliance',
      'AI quality management',
      'automated compliance',
      'intelligent QMS',
    ],
    researchPrompt:
      'Research how AI and intelligent automation are being applied to ISO compliance and quality management. Cover document generation, automated audit planning, root cause analysis with AI, predictive nonconformity detection, NLP for document classification, and the emerging category of AI-powered IMS platforms. Include analyst reports, market data, and real deployment examples from 2024-2026.',
    contentBrief:
      'Write about the AI revolution in ISO compliance. Cover the sentinel model (specialised AI agents for different QMS functions), specific use cases with before/after comparisons, ROI data, and how organisations can adopt AI incrementally without disrupting existing processes.',
    priority: 10,
    lastPublished: null,
  },
  {
    id: 'topic-tech-document-control',
    title: 'Document Control in the Digital Age — From Filing Cabinets to AI-Generated Documented Information',
    category: 'compliance-technology',
    targetKeywords: [
      'ISO document control',
      'documented information ISO 9001',
      'digital document management',
      'ISO 9001 clause 7.5',
    ],
    researchPrompt:
      'Research the evolution of document control from traditional paper-based systems to AI-powered digital platforms. Cover ISO 9001:2015 clause 7.5 requirements, version control best practices, approval workflows, retention policies, metadata standards, and how AI is being used to generate, classify, and maintain documented information. Include common audit findings related to document control.',
    contentBrief:
      'Write about modernising document control for ISO compliance. Cover the clause 7.5 requirements, common audit failures, digital transformation strategies, and how Doki sentinel automates document generation and classification while maintaining full audit trail compliance.',
    priority: 9,
    lastPublished: null,
  },
];

// ── Topic Selection ─────────────────────────────────────────────────────────

/**
 * Get the next topic to publish based on priority and recency.
 *
 * Selection logic:
 *   1. Never-published topics get priority (sorted by priority desc)
 *   2. If all published, pick the one with oldest lastPublished date
 *   3. Within same priority/recency tier, select randomly
 *
 * @param publishedTopicIds - Set of topic IDs that have been published
 * @param lastPublishedMap  - Map of topicId → last published ISO date
 */
export function getNextTopic(
  publishedTopicIds: Set<string>,
  lastPublishedMap: Map<string, string>,
): GhostTopic {
  // 1. Never-published topics (highest priority first)
  const unpublished = SEED_TOPICS
    .filter((t) => !publishedTopicIds.has(t.id))
    .sort((a, b) => b.priority - a.priority);

  if (unpublished.length > 0) {
    return unpublished[0]!;
  }

  // 2. All topics published — pick oldest
  const byOldest = [...SEED_TOPICS].sort((a, b) => {
    const aDate = lastPublishedMap.get(a.id) ?? '1970-01-01';
    const bDate = lastPublishedMap.get(b.id) ?? '1970-01-01';
    if (aDate === bDate) return b.priority - a.priority; // tiebreak: higher priority
    return aDate.localeCompare(bDate); // oldest first
  });

  return byOldest[0]!;
}

/**
 * Get a specific topic by ID.
 * Returns undefined if not found.
 */
export function getTopicById(topicId: string): GhostTopic | undefined {
  return SEED_TOPICS.find((t) => t.id === topicId);
}
