/** @type {import('next').NextConfig} */
const api = process.env.NEXT_PUBLIC_API_URL ?? 'https://test-api.brutal.lat';
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        // El micrófono solo para esta página; nada de cámara ni ubicación.
        { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ${api}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'` },
      ],
    }];
  },
};
export default nextConfig;
