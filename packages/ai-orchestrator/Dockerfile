##
## Builder stage — installs workspace deps and bundles the service
##
FROM public.ecr.aws/docker/library/node:22-alpine AS builder
RUN apk add --no-cache python3 make g++ curl
RUN npm install -g pnpm@9.15.0

WORKDIR /workspace

# Layer 1: workspace manifests (cache-busted only on lockfile change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ai-orchestrator/package.json packages/ai-orchestrator/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

# Layer 2: source
COPY packages packages

# esbuild bundle — single-file, tree-shaken, no devDeps in output
RUN pnpm --filter @aisentinels/ai-orchestrator run build

##
## Runtime stage — minimal Alpine image, no build tools
##
FROM public.ecr.aws/docker/library/node:22-alpine AS runtime
RUN apk add --no-cache curl

WORKDIR /app

# Copy bundled output only — no node_modules in runtime image
COPY --from=builder /workspace/packages/ai-orchestrator/dist/index.js ./index.js

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

USER node

CMD ["node", "index.js"]
