import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Spreadsheet imports post the whole file to a server action; the default cap is 1 MB.
    // Vercel's request limit is 4.5 MB, so stay just under it.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
