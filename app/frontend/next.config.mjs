/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
    minimumCacheTTL: 60,
  },

  output: 'standalone',

  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const connectSrc = [
      "'self'",
      'https://api.vercel.com',
      'https://*.vercel.app',
      'https://*.railway.app',
    ];

    if (apiUrl) {
      try {
        const url = new URL(apiUrl);
        const origin = `${url.protocol}//${url.hostname}`;
        if (!connectSrc.includes(origin)) {
          connectSrc.push(origin);
        }
      } catch {
        /* invalid URL */
      }
    }

    if (!isProduction) {
      connectSrc.push('http://localhost:8000', 'http://localhost:3000');
    }

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              `connect-src ${connectSrc.join(' ')}`,
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'interest-cohort=()',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
