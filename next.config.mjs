/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  ...(process.env.BUILD_STATIC === '1' && {
    output: 'export',
    distDir: 'out',
    images: { unoptimized: true },
    trailingSlash: true,
  }),
}

export default nextConfig
