import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cache Components hangs the worker on the Cloudflare runtime — every
  // request 500s with "your Worker's code had hung" (vercel/next.js#94880,
  // opennextjs-cloudflare#1450). Every page here is authenticated and
  // dynamic, so there is no static shell to gain by waiting for the fix.
  cacheComponents: false,
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
