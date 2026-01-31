import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sleepercdn.com',
        pathname: '/content/nfl/players/**',
      },
      {
        protocol: 'https',
        hostname: 'sleepercdn.com',
        pathname: '/avatars/**',
      },
      {
        protocol: 'https',
        hostname: 'sleepercdn.com',
        pathname: '/images/team_logos/**',
      },
    ],
  },
};

export default nextConfig;
