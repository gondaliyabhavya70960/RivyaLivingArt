import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // The Playwright harness drives the dev server over 127.0.0.1 rather than localhost, and
  // Next treats that as a cross-origin dev request. Declaring it keeps the e2e log free of
  // a warning that would otherwise train people to ignore dev-server output.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
