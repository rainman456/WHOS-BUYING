import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  server: {
    port: 5173,
    proxy: {
      // During dev, proxies /ws to the FastAPI backend
      // so the frontend doesn't need to know the backend URL
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
      "/health": {
        target: "http://localhost:8000",
      },
    },
  },
});
