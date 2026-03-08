import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['dash.vincechew.me'],
  compress: true,           // gzip JS/CSS at Next.js level
  poweredByHeader: false,
  // Bundle analyzer friendly - split chunks better
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

export default nextConfig;
