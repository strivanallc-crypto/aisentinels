/**
 * AI Orchestrator service entrypoint.
 *
 * Fastify server on port 8080:
 *   GET  /health              — ALB health check (no auth)
 *   POST /api/v1/ai/chat      — RAG chat (JWT required)
 *   POST /api/v1/ai/embed     — Document embedding (JWT required)
 *
 * On startup, ensures the AOSS index exists before accepting requests.
 */
import Fastify, { type FastifyError } from 'fastify';
import { healthRoute } from './routes/health.ts';
import { chatRoute } from './routes/chat.ts';
import { embedRoute } from './routes/embed.ts';
import { ensureAossIndex } from './lib/opensearch.ts';

const PORT = 8080;
const HOST = '0.0.0.0';

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
    // Structured JSON logs for CloudWatch Logs Insights
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
  trustProxy: true, // ALB sets X-Forwarded-For
});

// ── Routes ────────────────────────────────────────────────────────────────────

await server.register(healthRoute);
await server.register(chatRoute, { prefix: '/api/v1/ai' });
await server.register(embedRoute, { prefix: '/api/v1/ai' });

// ── Global error handler ──────────────────────────────────────────────────────

server.setErrorHandler((error: FastifyError, _request, reply) => {
  server.log.error({ err: error }, 'Unhandled error');
  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────

server.log.info('Ensuring AOSS index exists...');
await ensureAossIndex();
server.log.info('AOSS index ready');

await server.listen({ port: PORT, host: HOST });
server.log.info(`ai-orchestrator listening on ${HOST}:${PORT}`);
