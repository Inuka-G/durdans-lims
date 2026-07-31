import type { NextConfig } from "next";

// Security headers for a PHI-handling app. The CSP is intentionally conservative
// (frame-ancestors/object-src/base-uri) so it hardens clickjacking + base-tag +
// plugin injection without breaking Next's inline scripts/styles; tighten to a
// nonce-based script-src as a follow-up.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image ships only the traced runtime deps, not the full node_modules.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
