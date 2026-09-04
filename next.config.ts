import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The logo is a small, already-optimized PNG with fine detail (engraved
    // text on a crest) — Next's lossy re-encode (WebP q75) visibly blurs it.
    unoptimized: true,
  },
};

export default nextConfig;
