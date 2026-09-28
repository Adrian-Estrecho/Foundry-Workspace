import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let the app load at http://127.0.0.1:3000 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
