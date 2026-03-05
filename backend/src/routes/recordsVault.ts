import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const recordsVaultRouter = Router();

const CreateRecordSchema = z.object({
  recordType: z.string().min(1),
  classification: z.enum(['QMS', 'EMS', 'OHS', 'Integrated']),
  title: z.string().min(1),
  contentSummary: z.string().optional(),
  fileStoragePath: z.string().optional(),
  retentionCategory: z.enum(['A', 'B', 'C', 'Permanent']).default('B'),
});

// GET /api/records-vault/records
recordsVaultRouter.get('/records', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classification, status, legalHold } = req.query;
    const records = await prisma.record.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(classification && { classification: classification as string }),
        ...(legalHold !== undefined && { legalHold: legalHold === 'true' }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// POST /api/records-vault/records
recordsVaultRouter.post('/records', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateRecordSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    let fileHashSHA256: string | undefined;
    if (body.contentSummary) {
      fileHashSHA256 = crypto.createHash('sha256').update(body.contentSummary).digest('hex');
    }

    const record = await prisma.record.create({
      data: {
        tenantId,
        ...body,
        fileHashSHA256,
        hashStatus: fileHashSHA256 ? 'valid' : 'pending',
        hashVerifiedAt: fileHashSHA256 ? new Date() : undefined,
      },
    });

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// POST /api/records-vault/records/:id/verify-integrity
recordsVaultRouter.post('/records/:id/verify-integrity', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.record.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!record) throw new Error('Not found');

    if (!record.fileHashSHA256 || !record.contentSummary) {
      res.json({ status: 'skipped', reason: 'No content to verify' });
      return;
    }

    const currentHash = crypto.createHash('sha256').update(record.contentSummary).digest('hex');
    const isValid = currentHash === record.fileHashSHA256;

    await prisma.record.update({
      where: { id: record.id },
      data: { hashStatus: isValid ? 'valid' : 'invalid', hashVerifiedAt: new Date() },
    });

    res.json({ status: isValid ? 'valid' : 'TAMPERED', recordId: record.id, verifiedAt: new Date() });
  } catch (err) {
    next(err);
  }
});

// POST /api/records-vault/records/:id/legal-hold
recordsVaultRouter.post('/records/:id/legal-hold', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const record = await prisma.record.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!record) throw new Error('Not found');

    await prisma.record.update({
      where: { id: record.id },
      data: { legalHold: true, legalHoldReason: reason, legalHoldBy: req.user!.sub, legalHoldDate: new Date() },
    });

    res.json({ message: 'Legal hold applied' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/records-vault/records/:id/legal-hold
recordsVaultRouter.delete('/records/:id/legal-hold', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.record.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!record) throw new Error('Not found');

    await prisma.record.update({
      where: { id: record.id },
      data: { legalHold: false, legalHoldReason: null, legalHoldBy: null, legalHoldDate: null },
    });

    res.json({ message: 'Legal hold released' });
  } catch (err) {
    next(err);
  }
});
