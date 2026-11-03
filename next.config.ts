import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next 16: Partial Prerendering (PPR) was merged into `cacheComponents`.
  // `experimental.ppr` hard-fails on v16 — this is its supported replacement.
  // Static shell streams instantly; uncached reads (DB) must sit inside
  // <Suspense> boundaries so they stream.
  cacheComponents: true,
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
