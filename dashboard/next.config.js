/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  trailingSlash: false,
  // Let Vercel auto-detect the best output format
  // This allows dynamic routes to work properly with App Router
}

module.exports = nextConfig