import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma v7: the Rust query engine was removed — the client connects through
// a driver adapter. `@prisma/adapter-pg` (node-postgres) wraps DATABASE_URL.
// Passing `datasources: { db: { url } }` (the v6 approach) is silently
// ignored in v7 and leaves the client with no connection at all.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let clientInstance: PrismaClient | null = null;

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error('Database connection string is missing. Please set DATABASE_URL or DIRECT_URL.');
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

/**
 * Returns the PrismaClient singleton, creating it on first access.
 * This lazy initialization allows importing db-backed modules during
 * Next.js build without a DATABASE_URL — the client is only created
 * when a database operation is actually requested.
 */
function getOrCreateClient(): PrismaClient {
  if (clientInstance) return clientInstance;

  // Dev: reuse global singleton across hot reloads
  if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
    clientInstance = globalForPrisma.prisma;
    return clientInstance;
  }

  clientInstance = createClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = clientInstance;
  }
  return clientInstance;
}

/**
 * Lazy db proxy — property access defers PrismaClient creation until
 * a database operation is actually performed. Importing this module
 * does not require DATABASE_URL or DIRECT_URL. The client is created
 * on first property access (e.g. `db.address.findMany()`) and cached
 * for subsequent use.
 */
const db = new Proxy({} as PrismaClient, {
  get(_target, prop: PropertyKey) {
    const client = getOrCreateClient();
    return (client as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export { db };
