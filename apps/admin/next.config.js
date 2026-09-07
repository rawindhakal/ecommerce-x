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
  async headers() {
    return [
      {
        // The admin panel is the highest-privilege surface in the system —
        // it must never be embeddable in a third-party iframe (clickjacking).
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
