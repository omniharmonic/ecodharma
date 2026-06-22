/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pg is a server-only dependency; keep it external to the bundle (Next 14.2).
    serverComponentsExternalPackages: ["pg"],
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
