import { NextResponse, type NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─────────────────────────────────────────────────
// PDP 404 gate
// Unknown product slugs must return a real HTTP 404. With streaming/PPR a
// mid-render `notFound()` can no longer change the status code (headers are
// already flushed), so the existence check runs here — in the proxy, BEFORE
// the route renders (see next/dist/docs streaming.md → "Status codes").
// The check is a fresh, indexed lookup on every request: no cache windows,
// and products added/deleted at runtime are reflected immediately.
// ─────────────────────────────────────────────────

// Lazily-created singleton (proxy modules can be re-evaluated per request
// in development — mirror src/lib/db.ts's global caching).
const globalForPrisma = globalThis as unknown as { proxyPrisma: PrismaClient | undefined };

function getDb(): PrismaClient {
  if (!globalForPrisma.proxyPrisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    globalForPrisma.proxyPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.proxyPrisma;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Not Found | VEXO</title><meta name="robots" content="noindex"></head>
<body style="margin:0;background:#fff;color:#111;font-family:ui-monospace,monospace;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <div style="text-align:center;padding:2rem">
    <p style="font-size:11px;letter-spacing:0.2em;color:#888">ERROR.404</p>
    <h1 style="font-size:48px;font-style:italic;margin:0.5rem 0">PRODUCT_NOT_FOUND</h1>
    <p style="font-size:12px;color:#666">This unit does not exist in the catalogue.</p>
    <a href="/collections" style="font-size:11px;color:#111">← BACK TO CATALOGUE</a>
  </div>
</body>
</html>`;

const NOT_FOUND_COLLECTION_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Not Found | VEXO</title><meta name="robots" content="noindex"></head>
<body style="margin:0;background:#fff;color:#111;font-family:ui-monospace,monospace;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <div style="text-align:center;padding:2rem">
    <p style="font-size:11px;letter-spacing:0.2em;color:#888">ERROR.404</p>
    <h1 style="font-size:48px;font-style:italic;margin:0.5rem 0">COLLECTION_NOT_FOUND</h1>
    <p style="font-size:12px;color:#666">This collection does not exist in the catalogue.</p>
    <a href="/collections" style="font-size:11px;color:#111">← BACK TO CATALOGUE</a>
  </div>
</body>
</html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Collection 404 gate ──────────────────────────────────────────────
  // Invalid collections must return a real HTTP 404. Like the PDP gate below,
  // this runs in the proxy BEFORE the route renders — a mid-stream `notFound()`
  // cannot change the status code once the HTML stream has started (see
  // next/dist/docs/01-app/02-guides/streaming.md → "The HTTP contract").
  // The check is a fresh lookup on every request: no cache windows, and
  // collections added/deleted at runtime are reflected immediately.
  if (pathname.startsWith('/collections/')) {
    const category = pathname.replace('/collections/', '').split('/')[0];

    let exists = false;
    try {
      const row = await getDb().product.findFirst({
        where: { category: { equals: category, mode: 'insensitive' as const } },
        select: { id: true },
      });
      exists = row !== null;
    } catch (error) {
      // Database unreachable — never hard-404 the catalogue on an infra error;
      // let the page render (its own query will surface the failure).
      console.error('[proxy /collections] existence check failed:', error);
      return NextResponse.next();
    }

    if (!exists) {
      return new NextResponse(NOT_FOUND_COLLECTION_HTML, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.next();
  }

  if (!pathname.startsWith('/product/')) {
    return NextResponse.next();
  }

  const slug = request.nextUrl.pathname.replace('/product/', '').split('/')[0];

  let exists = false;
  try {
    const row = await getDb().product.findUnique({
      where: { slug },
      select: { id: true },
    });
    exists = row !== null;
  } catch (error) {
    // Database unreachable — never hard-404 the catalogue on an infra error;
    // let the page render (its own query will surface the failure).
    console.error('[proxy /product] existence check failed:', error);
    return NextResponse.next();
  }

  if (!exists) {
    return new NextResponse(NOT_FOUND_HTML, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/product/:slug*', '/collections/:category*'],
};
