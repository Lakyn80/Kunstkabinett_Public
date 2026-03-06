const isAdmin = process.env.NEXT_PUBLIC_APP_MODE === "admin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  ...(isAdmin && {
    basePath: "/admin",
    assetPrefix: "/admin",
  }),
};

export default nextConfig;
