/**
 * GET /health
 *
 * Public route — no authentication required.
 * Used by ALB health checker and the container-level HEALTHCHECK command.
 */
import type { FastifyPluginAsync } from 'fastify';

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'ai-orchestrator',
      version: '1.0.0',
      ts: new Date().toISOString(),
    });
  });
};
