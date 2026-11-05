/// <reference types="vitest/config" />
// Dedicated test config: vitest prefers this file over vite.config.ts and does
// not merge them. It leaves out the nitro and tanstackStart plugins, which
// break module loading in tests and keep the Vite server from closing.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/**", "node_modules/**"],
  },
});
