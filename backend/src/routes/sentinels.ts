import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { prisma } from '../lib/prisma';
import { requireAuditor } from '../middleware/rbac';

export const sentinelsRouter = Router();

const CONFIDENCE_THRESHOLD = 75; // Minimum confidence to auto-accept
const GEMINI_MODEL = 'gemini-1.5-pro';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable not set');
  return new GoogleGenerativeAI(apiKey);
}

// ==================== QMS SENTINEL (ISO 9001) ====================
sentinelsRouter.post('/qms/analyze-document', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, standard } = z.object({
      content: z.string().min(10),
      standard: z.string().default('ISO 9001:2015'),
    }).parse(req.body);

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            overallScore: { type: SchemaType.NUMBER },
            confidence: { type: SchemaType.NUMBER },
            gaps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  clause: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  severity: { type: SchemaType.STRING },
                  recommendation: { type: SchemaType.STRING },
                },
              },
            },
            citations: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  clause: { type: SchemaType.STRING },
                  requirement: { type: SchemaType.STRING },
                  status: { type: SchemaType.STRING },
                },
              },
            },
            requiresExpertReview: { type: SchemaType.BOOLEAN },
          },
        },
      },
    });

    const prompt = `You are a ${standard} compliance expert (QMS Sentinel).
Analyze the following document for compliance with ${standard}.

STRICT RULES:
1. ONLY cite actual clauses from ${standard} (e.g., "8.1", "9.1.3")
2. Provide confidence 0-100 based on evidence quality
3. Set requiresExpertReview=true if confidence < ${CONFIDENCE_THRESHOLD}
4. Do not recommend policy changes autonomously — flag for human review

Document to analyze:
---
${content.slice(0, 8000)}
---`;

    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());

    // Guardrail: enforce confidence threshold
    if (analysis.confidence < CONFIDENCE_THRESHOLD) {
      analysis.requiresExpertReview = true;
    }

    // Log sentinel activity
    await prisma.sentinelActivity.create({
      data: {
        tenantId: req.user!.tenantId,
        sentinelType: 'QMS',
        action: 'analyzeDocument',
        inputSummary: content.slice(0, 200),
        confidence: analysis.confidence,
        status: analysis.requiresExpertReview ? 'review_required' : 'completed',
        findings: analysis.gaps,
        citations: analysis.citations,
      },
    });

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// ==================== OHS SENTINEL (ISO 45001) ====================
sentinelsRouter.post('/ohs/identify-hazards', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { activityDescription, location } = z.object({
      activityDescription: z.string().min(10),
      location: z.string().optional(),
    }).parse(req.body);

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            confidence: { type: SchemaType.NUMBER },
            requiresExpertReview: { type: SchemaType.BOOLEAN },
            hazards: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  description: { type: SchemaType.STRING },
                  category: { type: SchemaType.STRING },
                  likelihood: { type: SchemaType.NUMBER },
                  severity: { type: SchemaType.NUMBER },
                  riskScore: { type: SchemaType.NUMBER },
                  recommendedControlLevel: { type: SchemaType.STRING },
                  isoClause: { type: SchemaType.STRING },
                },
              },
            },
          },
        },
      },
    });

    const prompt = `You are an ISO 45001:2018 OHS Sentinel.
Identify hazards from this workplace activity description.

RULES:
- All findings are TENTATIVE and require safety professional review
- Use hierarchy of controls (Elimination > Substitution > Engineering > Administrative > PPE)
- Likelihood and severity must be integers 1-5
- riskScore = likelihood * severity
- requiresExpertReview must be true for any riskScore >= 15

Activity: ${activityDescription}
Location: ${location ?? 'Not specified'}`;

    const result = await model.generateContent(prompt);
    const analysis = JSON.parse(result.response.text());

    // Force expert review for high-risk findings
    if (analysis.hazards?.some((h: { riskScore: number }) => h.riskScore >= 15)) {
      analysis.requiresExpertReview = true;
    }

    await prisma.sentinelActivity.create({
      data: {
        tenantId: req.user!.tenantId,
        sentinelType: 'OHS',
        action: 'identifyHazards',
        inputSummary: activityDescription.slice(0, 200),
        confidence: analysis.confidence,
        status: analysis.requiresExpertReview ? 'review_required' : 'completed',
        findings: analysis.hazards,
        citations: [],
      },
    });

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// ==================== SENTINEL ACTIVITY FEED ====================
sentinelsRouter.get('/activities', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activities = await prisma.sentinelActivity.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

// ==================== SENTINEL STATS ====================
sentinelsRouter.get('/stats', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const [total, byType, avgConfidence, reviewRequired] = await Promise.all([
      prisma.sentinelActivity.count({ where: { tenantId } }),
      prisma.sentinelActivity.groupBy({ by: ['sentinelType'], where: { tenantId }, _count: true }),
      prisma.sentinelActivity.aggregate({ where: { tenantId }, _avg: { confidence: true } }),
      prisma.sentinelActivity.count({ where: { tenantId, status: 'review_required' } }),
    ]);

    res.json({
      total,
      byType,
      averageConfidence: avgConfidence._avg.confidence ?? 0,
      reviewRequired,
    });
  } catch (err) {
    next(err);
  }
});
