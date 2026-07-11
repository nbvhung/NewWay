import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy all /api/* requests to the backend server.
    // This makes cookies same-origin from the browser's perspective,
    // fixing Safari ITP / incognito mode cookie blocking.
    const backendUrl = process.env.BACKEND_URL
      || (process.env.NODE_ENV === 'production'
          ? 'https://newway-backend-production.up.railway.app'
          : 'http://localhost:4000');
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
