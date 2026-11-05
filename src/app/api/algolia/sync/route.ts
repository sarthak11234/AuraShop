import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminClient, INDEX_NAME } from '@/lib/algolia';

// POST /api/algolia/sync
// Secured with CRON_SECRET header — call via Vercel Cron or curl
export async function POST(request: Request) {
  const MAX_PAYLOAD_SIZE = 1_000_000; // 1MB limit
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Protect against oversized request bodies
  const body = await request.text();
  if (body.length > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413 }
    );
  }

  try {
    const client = getAdminClient();
    if (!client) {
      // Configured-but-not-operational: never pretend a sync happened.
      return NextResponse.json(
        { error: 'Algolia is not configured (NEXT_PUBLIC_ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY missing)' },
        { status: 503 }
      );
    }

    const products = await db.product.findMany({
      where: {
        inStock: true,
        isPublished: true,
        archivedAt: null,
        categoryRecord: { isPublished: true },
      },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });

    const records = products.map((p) => ({
      objectID: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      price: Number(p.price),
      category: p.category,
      categoryCode: p.categoryCode,
      isNew: p.isNew,
      sizes: p.variants.map((v) => v.size),
      inStock: p.inStock,
    }));

    await client.saveObjects({ indexName: INDEX_NAME, objects: records });

    return NextResponse.json({ synced: records.length });
  } catch (error) {
    console.error('[POST /api/algolia/sync]', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
