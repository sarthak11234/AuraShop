import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next 16: Partial Prerendering (PPR) was merged into `cacheComponents`.
  // `experimental.ppr` hard-fails on v16 — this is its supported replacement.
  // Static shell streams instantly; uncached reads (DB) must sit inside
  // <Suspense> boundaries so they stream.
  cacheComponents: true,
  partialPrefetching: true,
  // ─── Security headers ─────────────────────────────────────────────────────
  async headers() {
    const list = [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent MIME-type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // Frame protection (sameorigin prevents framing by other domains)
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // Permissions-Policy: restrict camera, microphone, geolocation, etc.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // Remove X-Powered-By (Next.js default)
          {
            key: 'X-Powered-By',
            value: '',
          },
        ],
      },
    ];

    if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
      list.push({
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      });
    }

    return list;
  },
  // ──────────────────────────────────────────────────────────────────────────
  images: {
    // Allow external image domains when real product imagery is added
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'cdn.vexo.store' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/the-edit',
        destination: '/',
        permanent: true,
      },
      {
        source: '/products',
        destination: '/collections',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
