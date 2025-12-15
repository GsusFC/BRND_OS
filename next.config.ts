import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Externalize Prisma for serverless compatibility
  serverExternalPackages: ['@prisma/client', '@prisma/client-write', '@prisma/client-indexer'],
  // Webpack config
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore optional wagmi connector dependencies
    config.externals = config.externals || [];
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@gemini-wallet/core': false,
        'porto': false,
      };
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
