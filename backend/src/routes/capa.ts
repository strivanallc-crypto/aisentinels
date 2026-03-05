import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const capaRouter = Router();

const CreateCapaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(['audit', 'complaint', 'nonconformity', 'near-miss', 'self-identified']),
  severity: z.enum(['critical', 'major', 'minor']),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

// GET /api/capa
capaRouter.get('/', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, severity } = req.query;
    const capas = await prisma.capaRecord.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(status && { status: status as string }),
        ...(severity && { severity: severity as string }),
      },
      include: { actions: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(capas);
  } catch (err) {
    next(err);
  }
});

// POST /api/capa
capaRouter.post('/', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateCapaSchema.parse(req.body);
    const count = await prisma.capaRecord.count({ where: { tenantId: req.user!.tenantId } });
    const capaNumber = `CAPA-${String(count + 1).padStart(4, '0')}`;

    const capa = await prisma.capaRecord.create({
      data: {
        tenantId: req.user!.tenantId,
        capaNumber,
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
    });
    res.status(201).json(capa);
  } catch (err) {
    next(err);
  }
});

// GET /api/capa/:id
capaRouter.get('/:id', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const capa = await prisma.capaRecord.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { actions: true },
    });
    if (!capa) throw new Error('Not found');
    res.json(capa);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/capa/:id/status
capaRouter.patch('/:id/status', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({
      status: z.enum(['Open', 'Investigating', 'Implementing', 'Verifying', 'Closed']),
    }).parse(req.body);

    const capa = await prisma.capaRecord.update({
      where: { id: req.params.id },
      data: { status, ...(status === 'Closed' && { closedAt: new Date() }) },
    });
    res.json(capa);
  } catch (err) {
    next(err);
  }
});

// POST /api/capa/:id/actions
capaRouter.post('/:id/actions', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      description: z.string().min(1),
      actionType: z.enum(['corrective', 'preventive', 'containment']),
      assignedTo: z.string(),
      dueDate: z.string().datetime(),
    }).parse(req.body);

    const action = await prisma.capaAction.create({
      data: { capaId: req.params.id, ...body, dueDate: new Date(body.dueDate) },
    });
    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

// GET /api/capa/dashboard
capaRouter.get('/stats/dashboard', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const [total, byStatus, bySeverity, overdue] = await Promise.all([
      prisma.capaRecord.count({ where: { tenantId } }),
      prisma.capaRecord.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      prisma.capaRecord.groupBy({ by: ['severity'], where: { tenantId }, _count: true }),
      prisma.capaRecord.count({ where: { tenantId, status: { not: 'Closed' }, dueDate: { lt: new Date() } } }),
    ]);
    res.json({ total, byStatus, bySeverity, overdue });
  } catch (err) {
    next(err);
  }
});
