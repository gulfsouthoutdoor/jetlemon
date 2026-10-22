import type { NextConfig } from "next";

// Browser security headers. CSP is tight enough to block injected scripts and framing but still
// lets Next.js, Supabase auth and the Stripe/Facebook redirects work. Only applied in production.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "form-action 'self' https://*.stripe.com https://*.facebook.com https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Spreadsheet imports post the whole file to a server action; the default cap is 1 MB.
    // Vercel's request limit is 4.5 MB, so stay just under it.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      // The hosted lead form may be embedded in a business's own website, so it can be framed.
      {
        source: "/lead/:path*",
        headers: [...common, { key: "Content-Security-Policy", value: csp.replace("frame-ancestors 'none'", "frame-ancestors *") }],
      },
      {
        source: "/((?!lead/).*)",
        headers: [...common, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
