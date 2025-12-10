import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Empty turbopack config to satisfy Next.js 16 requirement
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Patch global.localStorage for server-side rendering
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        if (entries['main-app']) {
          if (!Array.isArray(entries['main-app'])) {
            entries['main-app'] = [entries['main-app']];
          }
          entries['main-app'].unshift('./src/instrumentation.ts');
        }
        return entries;
      };
    }
    return config;
  },
};

export default nextConfig;
