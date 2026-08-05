/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  // Standalone output required for Azure Static Web Apps' Node function host
  output: 'standalone',
  // Native modules that must not be bundled by the Next.js server compiler
  serverExternalPackages: ['pg', '@azure/storage-blob', '@azure/identity'],
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

module.exports = withNextIntl(nextConfig);
