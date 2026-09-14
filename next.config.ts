import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  poweredByHeader: false,

  images: {
    // Sleeper's CDN already serves small thumbnails; skipping the optimizer
    // avoids running image processing (and its cache) on the server.
    unoptimized: true,
  },
};

export default nextConfig;
