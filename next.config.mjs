/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.BUILD_STATIC === '1' && {
    output: 'export',
    distDir: 'out',
    images: { unoptimized: true },
    trailingSlash: true,
  }),
}

export default nextConfig
