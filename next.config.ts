import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const authUrl = process.env.AUTH_URL;

  if (!authUrl) {
    return [];
  }

  try {
    return [new URL(authUrl).hostname];
  } catch {
    return [];
  }
}

/**
 * 与请求无关的安全响应头。依赖 nonce 的 CSP 在 src/middleware.ts 中逐请求下发。
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  serverExternalPackages: ["@mariozechner/pi-agent-core", "@mariozechner/pi-ai", "bullmq", "ioredis"],
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
