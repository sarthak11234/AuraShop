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

function notFoundHtml(code: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="dark">
  <title>${code} | VEXO</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px; background: #0B0B0D; color: #F4F2F0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background-image:
        linear-gradient(rgba(244,242,240,0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(244,242,240,0.035) 1px, transparent 1px);
      background-size: 72px 72px;
    }
    .panel {
      width: 100%; max-width: 640px; border: 1px solid #29292E; background: #18181C;
      padding: clamp(28px, 6vw, 56px);
    }
    .meta {
      display: flex; justify-content: space-between; gap: 16px; padding-bottom: 16px;
      border-bottom: 1px solid #29292E; font: 700 9px/1.4 ui-monospace, monospace;
      letter-spacing: 0.22em; text-transform: uppercase; color: #77747A;
    }
    .meta strong { color: #FF454F; font-weight: 700; }
    .wordmark {
      display: flex; align-items: baseline; gap: 6px; margin-top: 32px;
      font-size: 18px; font-weight: 800; letter-spacing: 0.32em;
    }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: #FF454F; }
    .tagline {
      margin: 8px 0 0; font: 400 9px/1.4 ui-monospace, monospace;
      letter-spacing: 0.2em; color: #A6A3A3; text-transform: uppercase;
    }
    h1 {
      margin: 40px 0 0; font-size: clamp(36px, 8vw, 56px); line-height: 0.95;
      font-style: italic; letter-spacing: -0.04em; text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    p {
      margin: 18px 0 0; max-width: 44ch; font-size: 14px; line-height: 1.7; color: #A6A3A3;
    }
    a {
      display: inline-flex; align-items: center; min-height: 46px; margin-top: 36px;
      padding: 0 22px; border: 1px solid #FF454F; background: #FF454F;
      color: #0B0B0D; text-decoration: none; font: 700 10px/1 ui-monospace, monospace;
      letter-spacing: 0.16em; text-transform: uppercase;
    }
    a:hover, a:focus-visible { background: #E8323D; border-color: #E8323D; outline: 2px solid #F4F2F0; outline-offset: 3px; }
  </style>
</head>
<body>
  <main class="panel">
    <div class="meta"><span>ERROR.404</span><strong>${code}</strong></div>
    <div class="wordmark"><span>VEXO</span><span class="dot" aria-hidden="true"></span></div>
    <p class="tagline">FUTURE IS WEARABLE.</p>
    <h1>${code.replaceAll('_', ' ')}</h1>
    <p>${message}</p>
    <a href="/collections">← Back to catalogue</a>
  </main>
</body>
</html>`;
}

const NOT_FOUND_HTML = notFoundHtml(
  'PRODUCT_NOT_FOUND',
  'This unit does not exist in the catalogue. Check the address or return to the catalogue to continue exploring.',
);

const NOT_FOUND_COLLECTION_HTML = notFoundHtml(
  'COLLECTION_NOT_FOUND',
  'This collection does not exist in the current VEXO release. Return to the catalogue to browse every available collection.',
);

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
    let canonicalCategory: string | null = null;
    try {
      const row = await getDb().product.findFirst({
        where: { category: { equals: category, mode: 'insensitive' as const } },
        select: { id: true, category: true },
      });
      exists = row !== null;
      canonicalCategory = row?.category ?? null;
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

    // One canonical casing per collection: /collections/tech redirects to
    // /collections/TECH. Besides SEO hygiene, this keeps requests on the
    // prerendered param variants instead of the dynamic fallback shell.
    if (canonicalCategory && canonicalCategory !== category) {
      const url = request.nextUrl.clone();
      url.pathname = `/collections/${encodeURIComponent(canonicalCategory)}`;
      return NextResponse.redirect(url, 308);
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
