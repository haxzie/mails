import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  cacheComponents: true,
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

// Makes the D1 and Queue bindings from wrangler.jsonc available to
// `next dev` through getCloudflareContext(). The shared persist path is the
// same one the API worker uses, so both see one local database.
void initOpenNextCloudflareForDev({
  persist: { path: "../../.wrangler/state/v3" },
});

export default nextConfig;
