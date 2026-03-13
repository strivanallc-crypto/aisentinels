# Database Patterns — Aurora Serverless v2 + Prisma

## Stack
- Aurora Serverless v2 (PostgreSQL-compatible)
- ElastiCache Redis for caching
- Prisma ORM (schema at `backend/prisma/`)

## Connection
- Aurora Cluster: ai-sentinels-aurora.cluster-xxx.us-east-1.rds.amazonaws.com
- Redis: ai-sentinels-redis.xxx.cache.amazonaws.com
- Connection string: `DATABASE_URL` env var

## Patterns

### Read Operations
```typescript
import { prisma } from '@/lib/prisma';

// Single record with relations
const result = await prisma.resource.findUnique({
  where: { id: resourceId },
  include: { relatedData: true }
});

// List with filtering
const results = await prisma.resource.findMany({
  where: { status: 'active', organizationId },
  orderBy: { createdAt: 'desc' },
  take: 50
});
```

### Write Operations — Always Use Transactions
```typescript
const result = await prisma.$transaction(async (tx) => {
  const created = await tx.resource.create({
    data: { name, organizationId, status: 'draft' }
  });
  await tx.auditLog.create({
    data: { resourceId: created.id, action: 'CREATE', userId }
  });
  return created;
});
```

### State Machine Pattern
```typescript
// Validate state before transitioning
const current = await prisma.resource.findUnique({ where: { id } });
if (current.status !== expectedStatus) {
  throw new Error(`Invalid transition: ${current.status} -> ${newStatus}`);
}
await prisma.resource.update({
  where: { id },
  data: { status: newStatus, updatedAt: new Date() }
});
```

## Rules
- Never use raw SQL unless Prisma cannot express the query
- Always wrap multi-step writes in `$transaction`
- Cache frequently-read, rarely-changed data in Redis
- Use `include` for related data — avoid N+1 queries
- Always include audit logging in write transactions
