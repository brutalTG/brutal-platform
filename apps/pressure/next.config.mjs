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
        // Fuentes de Google (las mismas de Drops) e imágenes/videos de la ráfaga desde el almacenamiento de Supabase.
        { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; connect-src 'self' ${api}; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'` },
      ],
    }];
  },
};
export default nextConfig;
