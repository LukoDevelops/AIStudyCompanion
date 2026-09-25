import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Relative asset paths let the same static build work on localhost and
  // under a GitHub Pages project URL.
  base: "./",
  publicDir: "public",
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
