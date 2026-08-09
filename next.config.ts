import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos se sirven desde /api/fotos/<archivo> (local) o desde el CDN de
  // Vercel Blob (producción). No usamos next/image para no atarnos a un loader.
  images: { unoptimized: true },
};

export default nextConfig;
