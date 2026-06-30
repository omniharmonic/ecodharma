/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pg is a server-only dependency; keep it external to the bundle (Next 14.2).
    serverComponentsExternalPackages: ["pg"],
    serverActions: { bodySizeLimit: "2mb" },
    // The interpreter reads the framework artifact + voice from disk at runtime.
    // They have no static import, so force them into the serverless function
    // bundle — otherwise production silently falls back to the built-in stub.
    outputFileTracingIncludes: {
      "/**": ["./framework/**/*"],
    },
  },
};

export default nextConfig;
