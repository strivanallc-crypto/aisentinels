import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { healthRouter } from './routes/health';
import { documentStudioRouter } from './routes/documentStudio';
import { recordsVaultRouter } from './routes/recordsVault';
import { sentinelsRouter } from './routes/sentinels';
import { capaRouter } from './routes/capa';
import { riskRouter } from './routes/risk';
import { auditRouter } from './routes/audit';
import { managementReviewRouter } from './routes/managementReview';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { prisma, initializePrisma } from './lib/prisma';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ==================== PUBLIC ROUTES ====================
app.use('/health', healthRouter);

// ==================== AUTHENTICATED ROUTES ====================
app.use('/api', authenticate);
app.use('/api/document-studio', documentStudioRouter);
app.use('/api/records-vault', recordsVaultRouter);
app.use('/api/sentinels', sentinelsRouter);
app.use('/api/capa', capaRouter);
app.use('/api/risks', riskRouter);
app.use('/api/audits', auditRouter);
app.use('/api/management-reviews', managementReviewRouter);

// ==================== ERROR HANDLING ====================
app.use(errorHandler);

// ==================== STARTUP ====================
async function start() {
  try {
    // Step 1: Fetch DB secret and initialize Prisma client
    console.log('Initializing database connection...');
    await initializePrisma();

    // Step 2: Verify DB connection
    await prisma.$connect();
    console.log('✓ Database connected');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ AI Sentinels backend running on port ${PORT}`);
      console.log(`  Region: ${process.env.AWS_REGION ?? 'local'}`);
      console.log(`  Cognito Pool: ${process.env.COGNITO_USER_POOL_ID ?? 'not set'}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();

export default app;
