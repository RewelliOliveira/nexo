import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Native bindings (DuckDB, used by Mastra observability) must be loaded by
  // Node at runtime, not bundled by Turbopack
  serverExternalPackages: ["@mastra/duckdb", "@duckdb/node-api", "@duckdb/node-bindings"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
