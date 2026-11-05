import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SEED_PRODUCTS } from './seed-data';

// Load .env.local / .env when run standalone (`npx tsx prisma/seed.ts`).
// When invoked by `prisma migrate dev`, env is already inherited — loading is
// harmless and idempotent for our purposes.
try {
  process.loadEnvFile('.env.local');
} catch {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Rely on already-exported environment variables.
  }
}

// Prisma v7: connect through a driver adapter (same approach as src/lib/db.ts)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/**
 * Idempotent seed — upserts catalogue rows by slug.
 *
 * NEVER runs `deleteMany()`: existing products, orders and order items are
 * preserved. Products present in the database but absent from SEED_PRODUCTS
 * are left untouched (manual/admin-created products survive re-seeding).
 * Variant rows are reconciled per (product, size): sizes in the seed are
 * upserted with fresh stock figures; sizes only in the DB are kept.
 */
async function main() {
  console.log('🌱 Seeding VEXO products (upsert, no deletes)…');

  for (const p of SEED_PRODUCTS) {
    const categorySlug = p.categoryCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const category = await db.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: {
        name: p.category,
        slug: categorySlug,
        isPublished: true,
      },
    });

    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        subtitle: p.subtitle,
        price: p.priceRaw,
        category: category.name,
        categoryCode: category.slug.toUpperCase(),
        categoryId: category.id,
        description: p.description,
        details: p.details,
        images: p.images,
        version: p.version,
        isNew: p.isNew ?? false,
        inStock: p.inStock ?? true,
      },
      create: {
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        price: p.priceRaw,
        category: category.name,
        categoryCode: category.slug.toUpperCase(),
        categoryId: category.id,
        description: p.description,
        details: p.details,
        images: p.images,
        version: p.version,
        isNew: p.isNew ?? false,
        inStock: p.inStock ?? true,
      },
    });

    for (const v of p.variants) {
      await db.productVariant.upsert({
        where: { productId_size: { productId: product.id, size: v.size } },
        update: { stock: v.stock },
        create: { productId: product.id, size: v.size, stock: v.stock },
      });
    }

    console.log(`  ✓ ${p.title} (${p.variants.length} variant${p.variants.length === 1 ? '' : 's'})`);
  }

  console.log(`\n✅ Seeded ${SEED_PRODUCTS.length} products (idempotent upsert).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
