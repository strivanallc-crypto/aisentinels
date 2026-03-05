import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const riskRouter = Router();

const CreateRiskSchema = z.object({
  referenceCode: z.string(),
  registerType: z.enum(['QMS_Risk', 'EMS_Aspect', 'OHS_Hazard']),
  description: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  severity: z.number().int().min(1).max(5),
  reviewDate: z.string().datetime().optional(),
});

// GET /api/risks
riskRouter.get('/', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const risks = await prisma.riskRegister.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { riskScore: 'desc' },
    });
    res.json(risks);
  } catch (err) {
    next(err);
  }
});

// POST /api/risks
riskRouter.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateRiskSchema.parse(req.body);
    const riskScore = body.likelihood * body.severity;

    const risk = await prisma.riskRegister.create({
      data: {
        tenantId: req.user!.tenantId,
        ...body,
        riskScore,
        treatmentRequired: riskScore >= 15,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
      },
    });
    res.status(201).json(risk);
  } catch (err) {
    next(err);
  }
});

// GET /api/risks/matrix — returns 5x5 grid with risk counts per cell
riskRouter.get('/matrix', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const risks = await prisma.riskRegister.findMany({ where: { tenantId: req.user!.tenantId } });

    // Build 5x5 matrix
    const matrix: { likelihood: number; severity: number; count: number; color: string }[] = [];
    for (let l = 1; l <= 5; l++) {
      for (let s = 1; s <= 5; s++) {
        const score = l * s;
        const count = risks.filter(r => r.likelihood === l && r.severity === s).length;
        matrix.push({
          likelihood: l,
          severity: s,
          count,
          color: score >= 20 ? 'red' : score >= 12 ? 'orange' : score >= 6 ? 'yellow' : 'green',
        });
      }
    }
    res.json({ matrix, total: risks.length });
  } catch (err) {
    next(err);
  }
});
