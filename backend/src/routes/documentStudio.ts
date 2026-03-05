import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireManager, requireAuditor } from '../middleware/rbac';

export const documentStudioRouter = Router();

// ==================== VALIDATION SCHEMAS ====================
const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  standard: z.enum(['ISO9001', 'ISO14001', 'ISO45001', 'Integrated']),
  templateId: z.string().optional(),
  clauseMappings: z.array(z.string()).optional(),
});

const ApprovalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

const SignatureSchema = z.object({
  documentId: z.string(),
  meaning: z.string().min(1),
});

// ==================== DOCUMENTS CRUD ====================

// GET /api/document-studio/documents
documentStudioRouter.get('/documents', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, standard, page = '1', limit = '20' } = req.query;
    const tenantId = req.user!.tenantId;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = {
      tenantId,
      ...(status && { status: status as string }),
      ...(standard && { standard: standard as string }),
    };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: { approvals: { include: { approver: { select: { firstName: true, lastName: true, email: true } } } } },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({ documents, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    next(err);
  }
});

// POST /api/document-studio/documents
documentStudioRouter.post('/documents', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateDocumentSchema.parse(req.body);
    const tenantId = req.user!.tenantId;
    const userId = req.user!.sub;

    const document = await prisma.document.create({
      data: {
        tenantId,
        title: body.title,
        content: body.content,
        standard: body.standard,
        templateId: body.templateId,
        status: 'DRAFT',
        version: '1.0.0',
        createdBy: userId,
      },
    });

    // Create initial version
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: '1.0.0',
        content: body.content,
        changedBy: userId,
        changeNote: 'Initial version',
      },
    });

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

// GET /api/document-studio/documents/:id
documentStudioRouter.get('/documents/:id', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        versions: { orderBy: { createdAt: 'desc' } },
        approvals: { include: { approver: { select: { firstName: true, lastName: true, email: true } } } },
        signatures: true,
      },
    });

    if (!document) throw new Error('Not found: document does not exist');
    res.json(document);
  } catch (err) {
    next(err);
  }
});

// POST /api/document-studio/documents/:id/submit-for-approval
documentStudioRouter.post('/documents/:id/submit-for-approval', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverIds } = z.object({ approverIds: z.array(z.string()).min(1) }).parse(req.body);
    const tenantId = req.user!.tenantId;

    const document = await prisma.document.findFirst({ where: { id: req.params.id, tenantId } });
    if (!document) throw new Error('Not found: document does not exist');
    if (document.status !== 'DRAFT') throw new Error(`Cannot submit document in status ${document.status}`);

    // Create approval chain
    await prisma.$transaction([
      prisma.document.update({ where: { id: document.id }, data: { status: 'UNDER_REVIEW', updatedBy: req.user!.sub } }),
      ...approverIds.map((approverId, index) =>
        prisma.documentApproval.create({
          data: {
            documentId: document.id,
            approverId,
            order: index + 1,
            status: index === 0 ? 'PENDING' : 'WAITING', // only first approver is active
            dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h deadline
          },
        })
      ),
    ]);

    res.json({ message: 'Submitted for approval', documentId: document.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/document-studio/approvals/:id/decide
documentStudioRouter.post('/approvals/:id/decide', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, comments } = ApprovalDecisionSchema.parse(req.body);
    const userId = req.user!.sub;

    const approval = await prisma.documentApproval.findFirst({
      where: { id: req.params.id, approverId: userId, status: 'PENDING' },
      include: { document: true },
    });

    if (!approval) throw new Error('Not found: approval not found or not assigned to you');

    await prisma.$transaction(async (tx) => {
      // Update this approval
      await tx.documentApproval.update({
        where: { id: approval.id },
        data: { status: decision, comments, decidedAt: new Date() },
      });

      if (decision === 'REJECTED') {
        // Reject the document
        await tx.document.update({ where: { id: approval.documentId }, data: { status: 'DRAFT' } });
      } else {
        // Check if all approvals are done
        const remaining = await tx.documentApproval.count({
          where: { documentId: approval.documentId, status: { in: ['PENDING', 'WAITING'] } },
        });
        if (remaining === 0) {
          await tx.document.update({
            where: { id: approval.documentId },
            data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
          });
        } else {
          // Activate next approver
          const nextApproval = await tx.documentApproval.findFirst({
            where: { documentId: approval.documentId, status: 'WAITING' },
            orderBy: { order: 'asc' },
          });
          if (nextApproval) {
            await tx.documentApproval.update({ where: { id: nextApproval.id }, data: { status: 'PENDING' } });
          }
        }
      }
    });

    res.json({ message: `Approval ${decision.toLowerCase()}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/document-studio/signatures
documentStudioRouter.post('/signatures', requireAuditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentId, meaning } = SignatureSchema.parse(req.body);
    const userId = req.user!.sub;

    const document = await prisma.document.findFirst({ where: { id: documentId, tenantId: req.user!.tenantId } });
    if (!document) throw new Error('Not found: document does not exist');

    const documentHash = crypto.createHash('sha256').update(document.content).digest('hex');

    const signature = await prisma.electronicSignature.create({
      data: {
        documentId,
        signerId: userId,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? '',
        documentHash,
        meaning,
      },
    });

    res.status(201).json(signature);
  } catch (err) {
    next(err);
  }
});
