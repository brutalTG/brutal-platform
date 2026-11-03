/** @type {import('next').NextConfig} */
const isTest = process.env.BRUTAL_ENV !== 'production';
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    // En test nadie indexa. En producción cada página decide.
    if (isTest) base.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    return [{ source: '/:path*', headers: base }];
  },
};
export default nextConfig;
