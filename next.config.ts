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

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  serverExternalPackages: ["@mariozechner/pi-agent-core", "@mariozechner/pi-ai"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
