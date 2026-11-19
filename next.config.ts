import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests build into their own folder, so they never clash with a running `npm run dev` (which uses .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Let the dev server serve its assets/HMR to the Cloudflare quick tunnel and devices on the local network.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.*.*"],
  experimental: {
    // Notebook photos are downscaled in the browser first; this allows up to ~10 pages per note.
    serverActions: { bodySizeLimit: "45mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
