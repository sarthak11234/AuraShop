import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// Prisma v7 connects through @prisma/adapter-pg (node-postgres), which needs
// the Node.js runtime. The previous `runtime = 'edge'` export could never
// work with the Prisma adapter — the auth route now runs on Node (default).
