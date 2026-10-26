/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Las imágenes del juego necesitan la tipografía en el servidor.
  outputFileTracingIncludes: {
    '/amigos/**': ['./assets/fonts/**'],
    '/internal/amigos/**': ['./assets/fonts/**'],
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }];
  },
};
export default nextConfig;
