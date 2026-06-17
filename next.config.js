/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? (await import("@next/bundle-analyzer")).default({ enabled: true })
    : (x) => x;

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/settings/profile",
        destination: "/settings/account",
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer(config);
