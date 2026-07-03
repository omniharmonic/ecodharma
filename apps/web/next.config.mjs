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
      // The OG share-card route reads these TTFs off disk at runtime.
      "/api/og/**": ["./public/fonts/**/*"],
    },
  },
  // OAuth discovery lives at well-known URLs (RFC 8414 / RFC 9728). Serve the
  // metadata from normal API routes but keep the canonical /.well-known paths —
  // MCP clients probe both the bare path and a resource-suffixed variant.
  async rewrites() {
    return [
      // Browsers auto-probe /favicon.ico; serve the app's SVG icon so it 200s.
      { source: "/favicon.ico", destination: "/icon.svg" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/authorization-server" },
    ];
  },
};

export default nextConfig;
