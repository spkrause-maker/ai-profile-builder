import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api/anthropic/* to the Anthropic API and attaches
// the key from .env, so the key is never bundled into browser code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("x-api-key", env.ANTHROPIC_API_KEY || "");
              proxyReq.setHeader("anthropic-version", "2023-06-01");
            });
          },
        },
      },
    },
  };
});
