import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS image sources
      },
      {
        protocol: 'http',
        hostname: '**', // Allow all HTTP image sources
      },
    ],
  },
  // Webpack config for WalletConnect/Reown compatibility
  // WalletConnect uses pino which has issues with Turbopack
  webpack: (config) => {
    config.externals.push(
      'pino-pretty', 
      'lokijs', 
      'encoding', 
      'porto',
      'porto/internal',
      '@gemini-wallet/core',
      '@react-native-async-storage/async-storage'
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  // Transpile WalletConnect packages
  transpilePackages: [
    '@reown/appkit',
    '@reown/appkit-adapter-wagmi',
    '@walletconnect/universal-provider',
    '@walletconnect/utils',
  ],
};

export default nextConfig;
