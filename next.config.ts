import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Allow images served from our own Drive proxy API route
    localPatterns: [
      {
        pathname: "/api/drive/image/**",
      },
    ],
  },
};

export default nextConfig;
