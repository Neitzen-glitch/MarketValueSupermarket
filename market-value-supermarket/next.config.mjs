/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Product photos are shrunk in the browser first, so 4 MB is plenty.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
