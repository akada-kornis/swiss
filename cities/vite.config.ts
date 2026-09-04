import { defineConfig } from "vite";

// Prime Communes 1.1 is currently shipped as the static dashboard rooted at
// index.html. Keep the production build intentionally boring: no legacy
// Site-Creator/OpenAI hosting config, no Cloudflare worker and no React runtime
// are required to reproduce the published 1.1 application.
export default defineConfig({
  publicDir: "public",
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
