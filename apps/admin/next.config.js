/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100";
const apiOrigin = new URL(apiUrl);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ecommerce-x/shared"],
  images: {
    remotePatterns: [
      { protocol: apiOrigin.protocol.replace(":", ""), hostname: apiOrigin.hostname, port: apiOrigin.port || undefined, pathname: "/uploads/**" },
    ],
  },
};

module.exports = nextConfig;
