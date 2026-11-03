import { defineConfig } from 'prisma/config';

// Load .env.local / .env into process.env for the Prisma CLI.
// (Next.js does this automatically for the app; the standalone CLI does not.)
// Node >= 20.12 — no dotenv dependency needed.
try {
  process.loadEnvFile('.env.local');
} catch {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No env file present — rely on already-exported environment variables.
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Migrations should run against the direct (non-pooler) URL when set —
    // e.g. Supabase session-mode URL on port 5432 without pgbouncer.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
