import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // forward chat to our grounded FastAPI agent (src/agent/api.py on :8000)
    proxy: {
      "/api/chat": {
        target: process.env.AGENT_BACKEND_URL || "http://localhost:8000",
        changeOrigin: true,
      },
      "/api/telegram": {
        target: process.env.AGENT_BACKEND_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
