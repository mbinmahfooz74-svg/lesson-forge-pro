import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lessonforge/db", "@lessonforge/shared", "@lessonforge/engine"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pg-boss"],
  webpack: (config) => {
    // Workspace packages are TS source using ESM `.js` import specifiers; let webpack
    // resolve `./x.js` to `./x.ts` so they can be imported by the app.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
