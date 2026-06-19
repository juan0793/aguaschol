import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const devApiTarget = process.env.VITE_API_URL || "http://127.0.0.1:4000";
const devWsTarget = devApiTarget.replace(/^http/i, "ws");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true
      },
      "/uploads": {
        target: devApiTarget,
        changeOrigin: true
      },
      "/ws": {
        target: devWsTarget,
        ws: true,
        changeOrigin: true
      }
    }
  }
});
