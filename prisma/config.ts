import { PrismaConfig } from '@prisma/cli';

export default {
  // The relative path of your prisma schema
  schema: './prisma/schema.prisma',
  // The output directory for generated Prisma Client
  emit: {
    // Used for both `prisma generate` and `prisma migrate make`/`prisma migrate reset`
    prismain: './node_modules/.prisma/client/',
    // Used only for `prisma migrate make` and `prisma migrate reset`
    migration: './prisma/migrations/',
  },
  // Provide the connection URL for the database
  // This is read from the .env file
  connectionString: process.env.DATABASE_URL,
  secret: process.env.PRISMA_SECRET,
} as PrismaConfig;
