/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Evita chunks rotos tipo `vendor-chunks/@opentelemetry.js` en dev/build (Firebase Admin / trazas). */
  serverExternalPackages: ['@opentelemetry/api'],
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/logo-andina.png', permanent: false },
    ];
  },
  images: {
    /** Desactiva Image Optimization de Vercel en toda la app (evita error 402 por cuota). */
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
    ],
  },
  // Permite que el build de producción no falle por configuraciones
  // de ESLint mientras se termina de ajustar el linter de TypeScript/Next.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
