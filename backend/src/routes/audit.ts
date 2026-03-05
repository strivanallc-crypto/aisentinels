import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const auditRouter = Router();

// GET /api/audits
auditRouter.get('/', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audits = await prisma.auditProgramme.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { plannedDate: 'asc' },
    });
    res.json(audits);
  } catch (err) {
    next(err);
  }
});

// POST /api/audits
auditRouter.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      title: z.string().min(1),
      standard: z.string(),
      auditType: z.enum(['Internal', 'Surveillance', 'Certification']),
      plannedDate: z.string().datetime(),
      auditor: z.string(),
    }).parse(req.body);

    const audit = await prisma.auditProgramme.create({
      data: { tenantId: req.user!.tenantId, ...body, plannedDate: new Date(body.plannedDate) },
    });
    res.status(201).json(audit);
  } catch (err) {
    next(err);
  }
});

// GET /api/audits/:id
auditRouter.get('/:id', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audit = await prisma.auditProgramme.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!audit) throw new Error('Not found');
    res.json(audit);
  } catch (err) {
    next(err);
  }
});

// POST /api/audits/:id/findings
auditRouter.post('/:id/findings', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const finding = z.object({
      type: z.enum(['Major', 'Minor', 'Observation', 'Opportunity']),
      clause: z.string(),
      description: z.string().min(1),
      evidence: z.string().optional(),
    }).parse(req.body);

    const audit = await prisma.auditProgramme.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!audit) throw new Error('Not found');

    const existing = Array.isArray(audit.findings) ? (audit.findings as object[]) : [];
    const findings = [...existing, { ...finding, id: crypto.randomUUID(), createdAt: new Date().toISOString() }];
    await prisma.auditProgramme.update({ where: { id: audit.id }, data: { findings: findings as object[] } });

    res.status(201).json({ message: 'Finding added', finding });
  } catch (err) {
    next(err);
  }
});
