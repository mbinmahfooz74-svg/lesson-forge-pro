import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lessonforge/db", "@lessonforge/shared"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
