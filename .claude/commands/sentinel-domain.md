# Sentinel Domain Architecture

## Overview
AI Sentinels is a SaaS platform with six specialized AI sentinels, each handling a distinct compliance/quality domain.

## Sentinels

| Sentinel | Domain | Port | Color | Description |
|----------|--------|------|-------|-------------|
| **Qualy** | Quality Management | 9001 | #3B82F6 (Blue) | ISO 9001 quality management automation |
| **Envi** | Environmental | 14001 | #22C55E (Green) | ISO 14001 environmental management |
| **Saffy** | Safety | 45001 | #F59E0B (Amber) | ISO 45001 occupational health & safety |
| **Doki** | Doc Studio | — | #6366F1 (Indigo) | Document generation and management |
| **Audie** | Audit Room | — | #F43F5E (Rose) | Audit planning and execution |
| **Nexus** | CAPA | — | #8B5CF6 (Violet) | Corrective & Preventive Actions |

## AI Engine
- Gemini 2.5 Pro is the AI engine powering all sentinel operations
- All sentinel API calls MUST include JWT authorization header

## API Pattern
```typescript
const session = await getSession();
const response = await fetch(`${API_BASE}/sentinel-endpoint`, {
  headers: {
    Authorization: `Bearer ${session?.accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

## Architecture Rules
- NEVER modify /src/sentinels/* without reading full architecture first
- Each sentinel operates independently but shares the common auth layer
- Sentinel-specific UI uses the designated brand color
- SVG shield icons only — no mascots, no illustrations
- NEVER reference "ISO 27001" or "ISO 50001" in the product
- NEVER use the word "unlimited" in any sentinel feature description

## API Endpoint
- Base: https://4w9qshl20f.execute-api.us-east-1.amazonaws.com
- NEVER reintroduce ANY /api/v1/{proxy+} catch-all route
