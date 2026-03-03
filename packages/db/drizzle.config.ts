import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  // Connection used only for drizzle-kit studio/push — migrations use migrate.ts
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/aisentinels',
  },
  // Verbose migration output
  verbose: true,
  strict: true,
});
