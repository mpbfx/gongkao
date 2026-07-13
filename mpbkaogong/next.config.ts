import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mariozechner/pi-agent-core", "@mariozechner/pi-ai"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
