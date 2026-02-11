import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Solo reescribe en producción (Netlify)
    if (process.env.NODE_ENV !== "production") return [];

    const api = process.env.NEXT_PUBLIC_API_URL;
    if (!api) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${api}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
