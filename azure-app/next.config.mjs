/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Azure Static Web Apps expects the standalone output for its
  // Node function host. Keep this on so `swa deploy` picks up the
  // right build artefacts.
  output: 'standalone',
  serverExternalPackages: ['pg', '@azure/storage-blob', '@azure/identity'],
};

export default nextConfig;
