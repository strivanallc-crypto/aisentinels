import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const managementReviewRouter = Router();

// GET /api/management-reviews
managementReviewRouter.get('/', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviews = await prisma.managementReview.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { reviewDate: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

// POST /api/management-reviews
managementReviewRouter.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      title: z.string().min(1),
      reviewDate: z.string().datetime(),
      reviewType: z.enum(['Scheduled', 'Special', 'Extraordinary']).default('Scheduled'),
      attendees: z.array(z.string()).default([]),
    }).parse(req.body);

    // Auto-populate inputs from DB
    const tenantId = req.user!.tenantId;
    const [openCapas, overdueCapas, recentAudits] = await Promise.all([
      prisma.capaRecord.count({ where: { tenantId, status: { not: 'Closed' } } }),
      prisma.capaRecord.count({ where: { tenantId, status: { not: 'Closed' }, dueDate: { lt: new Date() } } }),
      prisma.auditProgramme.count({ where: { tenantId, status: 'Completed' } }),
    ]);

    const review = await prisma.managementReview.create({
      data: {
        tenantId,
        title: body.title,
        reviewDate: new Date(body.reviewDate),
        reviewType: body.reviewType,
        attendees: body.attendees,
        inputs: { openCapas, overdueCapas, recentAudits, generatedAt: new Date().toISOString() },
      },
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});

// GET /api/management-reviews/:id
managementReviewRouter.get('/:id', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.managementReview.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!review) throw new Error('Not found');
    res.json(review);
  } catch (err) {
    next(err);
  }
});
