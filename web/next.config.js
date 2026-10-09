/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/stream/:path*',
        destination: 'http://go2rtc:1984/:path*',
      },
      {
        source: '/ai-api/:path*',
        destination: 'http://ai:5050/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
