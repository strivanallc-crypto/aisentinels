/**
 * API Documentation Lambda — Phase 14.
 *
 * Routes:
 *   GET /api/v1/docs      → Swagger UI HTML page
 *   GET /api/v1/docs/spec → OpenAPI 3.0 JSON spec
 *
 * Public — no JWT required (docs are world-readable).
 */
import type {
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

// ── OpenAPI 3.0 Spec ─────────────────────────────────────────────────────────
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AI Sentinels API',
    version: '1.0.0',
    description: 'Multi-tenant IMS SaaS API for ISO 9001, 14001, 45001 compliance management.',
    contact: { name: 'AI Sentinels', url: 'https://aisentinels.io', email: 'support@aisentinels.io' },
  },
  servers: [
    { url: 'https://api.aisentinels.io', description: 'Production' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cognito JWT access token',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Tenant-scoped API key (prefix: ask_live_)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          name:      { type: 'string' },
          prefix:    { type: 'string', example: 'ask_live' },
          last4:     { type: 'string', example: 'Ab3x' },
          scopes:    { type: 'array', items: { type: 'string' } },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          revoked:   { type: 'boolean' },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookEndpoint: {
        type: 'object',
        properties: {
          id:              { type: 'string', format: 'uuid' },
          url:             { type: 'string', format: 'uri' },
          description:     { type: 'string', nullable: true },
          eventTypes:      { type: 'array', items: { type: 'string' } },
          status:          { type: 'string', enum: ['active', 'paused', 'disabled'] },
          failureCount:    { type: 'integer' },
          lastDeliveredAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt:       { type: 'string', format: 'date-time' },
        },
      },
      WebhookDelivery: {
        type: 'object',
        properties: {
          id:             { type: 'string', format: 'uuid' },
          eventType:      { type: 'string' },
          status:         { type: 'string', enum: ['pending', 'success', 'failed'] },
          responseStatus: { type: 'integer', nullable: true },
          durationMs:     { type: 'integer', nullable: true },
          attempt:        { type: 'integer' },
          createdAt:      { type: 'string', format: 'date-time' },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          title:     { type: 'string' },
          type:      { type: 'string' },
          status:    { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'Service is healthy' } },
      },
    },
    // ── Document Studio ────────────────────────────────────────────────────
    '/api/v1/document-studio/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List documents',
        responses: { '200': { description: 'List of documents' } },
      },
      post: {
        tags: ['Documents'],
        summary: 'Create a document',
        responses: { '201': { description: 'Document created' } },
      },
    },
    '/api/v1/document-studio/documents/{id}': {
      get: {
        tags: ['Documents'],
        summary: 'Get document by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Document details' } },
      },
    },
    // ── Audits ─────────────────────────────────────────────────────────────
    '/api/v1/audits': {
      get: { tags: ['Audits'], summary: 'List audits', responses: { '200': { description: 'List of audits' } } },
      post: { tags: ['Audits'], summary: 'Create an audit', responses: { '201': { description: 'Audit created' } } },
    },
    '/api/v1/audits/{id}': {
      get: {
        tags: ['Audits'],
        summary: 'Get audit by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Audit details' } },
      },
    },
    // ── CAPA ───────────────────────────────────────────────────────────────
    '/api/v1/capa': {
      get: { tags: ['CAPA'], summary: 'List CAPAs', responses: { '200': { description: 'List of CAPAs' } } },
      post: { tags: ['CAPA'], summary: 'Create a CAPA', responses: { '201': { description: 'CAPA created' } } },
    },
    // ── Records Vault ──────────────────────────────────────────────────────
    '/api/v1/records-vault/records': {
      get: { tags: ['Records'], summary: 'List records', responses: { '200': { description: 'List of records' } } },
      post: { tags: ['Records'], summary: 'Create a record', responses: { '201': { description: 'Record created' } } },
    },
    // ── AI Sentinels ───────────────────────────────────────────────────────
    '/api/v1/ai/document-generate': {
      post: { tags: ['AI'], summary: 'Generate ISO document', responses: { '200': { description: 'Generated document' } } },
    },
    '/api/v1/ai/clause-classify': {
      post: { tags: ['AI'], summary: 'Classify document by ISO clause', responses: { '200': { description: 'Classification result' } } },
    },
    '/api/v1/ai/audit-plan': {
      post: { tags: ['AI'], summary: 'Generate audit plan (ISO 19011)', responses: { '200': { description: 'Audit plan' } } },
    },
    '/api/v1/ai/root-cause': {
      post: { tags: ['AI'], summary: 'Root cause analysis (5-Why / Fishbone / 8D)', responses: { '200': { description: 'Analysis result' } } },
    },
    '/api/v1/ai/gap-detect': {
      post: { tags: ['AI'], summary: 'Detect compliance gaps', responses: { '200': { description: 'Gap analysis' } } },
    },
    // ── API Keys ───────────────────────────────────────────────────────────
    '/api/v1/settings/api-keys': {
      post: {
        tags: ['API Keys'],
        summary: 'Create an API key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', maxLength: 100 },
                  scopes: { type: 'array', items: { type: 'string' }, default: [] },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API key created (raw key shown once)' },
          '403': { description: 'Forbidden — admin or owner role required' },
        },
      },
      get: {
        tags: ['API Keys'],
        summary: 'List API keys',
        responses: {
          '200': {
            description: 'List of API keys (secrets redacted)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKeys: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/settings/api-keys/{keyId}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        parameters: [{ name: 'keyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Key revoked' }, '404': { description: 'Key not found' } },
      },
    },
    // ── Webhooks ───────────────────────────────────────────────────────────
    '/api/v1/settings/webhooks': {
      post: {
        tags: ['Webhooks'],
        summary: 'Create a webhook endpoint',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'eventTypes'],
                properties: {
                  url: { type: 'string', format: 'uri' },
                  description: { type: 'string', maxLength: 500 },
                  eventTypes: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: [
                        'document.created', 'document.approved', 'document.rejected',
                        'audit.created', 'audit.completed',
                        'capa.created', 'capa.closed',
                        'finding.created',
                        'record.created', 'record.verified',
                        'compliance.check_completed',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Webhook created (signing secret shown once)' },
          '403': { description: 'Forbidden' },
        },
      },
      get: {
        tags: ['Webhooks'],
        summary: 'List webhook endpoints',
        responses: {
          '200': {
            description: 'List of webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    webhooks: { type: 'array', items: { $ref: '#/components/schemas/WebhookEndpoint' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/settings/webhooks/{id}': {
      get: {
        tags: ['Webhooks'],
        summary: 'Get webhook details + recent deliveries',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Webhook details with delivery log' } },
      },
      put: {
        tags: ['Webhooks'],
        summary: 'Update a webhook endpoint',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Webhook updated' } },
      },
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete a webhook endpoint',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Webhook deleted' } },
      },
    },
    '/api/v1/settings/webhooks/{id}/test': {
      post: {
        tags: ['Webhooks'],
        summary: 'Send a test webhook delivery',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Test delivery result' } },
      },
    },
    // ── Billing ────────────────────────────────────────────────────────────
    '/api/v1/billing/subscription': {
      get: { tags: ['Billing'], summary: 'Get subscription status', responses: { '200': { description: 'Subscription details' } } },
    },
    '/api/v1/billing/usage': {
      get: { tags: ['Billing'], summary: 'Get usage metrics', responses: { '200': { description: 'Usage data' } } },
    },
    // ── Audit Trail ────────────────────────────────────────────────────────
    '/api/v1/audit-trail': {
      get: {
        tags: ['Audit Trail'],
        summary: 'Query audit events',
        parameters: [
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
        ],
        responses: { '200': { description: 'Audit events (newest first)' } },
      },
    },
    // ── Settings ───────────────────────────────────────────────────────────
    '/api/v1/settings/org': {
      get: { tags: ['Settings'], summary: 'Get organization context', responses: { '200': { description: 'Org context' } } },
      put: { tags: ['Settings'], summary: 'Update organization context', responses: { '200': { description: 'Updated' } } },
    },
  },
  tags: [
    { name: 'System', description: 'Health and status endpoints' },
    { name: 'Documents', description: 'Document Studio — ISO document management' },
    { name: 'Audits', description: 'Audit Studio — internal audit management (ISO 19011)' },
    { name: 'CAPA', description: 'Corrective and Preventive Actions' },
    { name: 'Records', description: 'Records Vault — tamper-evident record storage' },
    { name: 'AI', description: 'AI Sentinels — Gemini-powered document/audit/CAPA intelligence' },
    { name: 'API Keys', description: 'Manage tenant API keys for external integrations' },
    { name: 'Webhooks', description: 'Manage webhook endpoints for event notifications' },
    { name: 'Billing', description: 'Subscription and usage management' },
    { name: 'Audit Trail', description: 'ISO 15489 compliant audit event log' },
    { name: 'Settings', description: 'Organization, standards, users, and brain configuration' },
  ],
};

// ── Swagger UI HTML ───────────────────────────────────────────────────────────
function swaggerHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Sentinels API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0A0F1E; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { max-width: 1200px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
}

// ── Lambda handler ───────────────────────────────────────────────────────────
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const path = event.rawPath;

  if (path === '/api/v1/docs/spec') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify(openApiSpec),
    } as APIGatewayProxyResultV2;
  }

  if (path === '/api/v1/docs') {
    // Derive spec URL from the request's host
    const host = event.requestContext?.domainName ?? 'localhost:3001';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const specUrl = `${protocol}://${host}/api/v1/docs/spec`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' },
      body: swaggerHtml(specUrl),
    } as APIGatewayProxyResultV2;
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: `Not found: ${path}` }),
  };
};
