import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone-Build fuer Docker/Coolify: erzeugt .next/standalone mit server.js
  output: 'standalone',
}

export default nextConfig
