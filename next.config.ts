import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.58.126.228"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
