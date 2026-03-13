# Database Patterns — Aurora Serverless v2

## Stack
- Aurora Serverless v2 (PostgreSQL-compatible)
- ElastiCache Redis for caching
- Prisma ORM (see backend/prisma/)

## RPC Patterns
All database operations use RPC (Remote Procedure Call) patterns for consistency and atomicity.

### Query Pattern
```typescript
// Always use Prisma client for database operations
import { prisma } from '@/lib/prisma';

// Read operations
const result = await prisma.resource.findUnique({
  where: { id: resourceId },
  include: { relatedData: true }
});

// Write operations — use transactions for atomicity
const result = await prisma.$transaction(async (tx) => {
  const created = await tx.resource.create({ data: { ... } });
  await tx.audit.create({ data: { resourceId: created.id, action: 'CREATE' } });
  return created;
});
```

### State Machine Pattern
For sentinel operations that involve state transitions:
```typescript
// Always validate current state before transitioning
const current = await prisma.resource.findUnique({ where: { id } });
if (current.status !== expectedStatus) {
  throw new Error(`Invalid state transition: ${current.status} -> ${newStatus}`);
}
await prisma.resource.update({
  where: { id },
  data: { status: newStatus, updatedAt: new Date() }
});
```

## Connection Configuration
- Aurora Cluster: ai-sentinels-aurora.cluster-xxx.us-east-1.rds.amazonaws.com
- ElastiCache: ai-sentinels-redis.xxx.cache.amazonaws.com
- Connection string in DATABASE_URL env var

## Rules
- Never use raw SQL unless Prisma cannot express the query
- Always wrap multi-step writes in `$transaction`
- Cache frequently-read, rarely-changed data in Redis
- Use `include` for related data — avoid N+1 queries
