/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/health": "http://localhost:4000",
      "/vitals": "http://localhost:4000",
      "/alerts": "http://localhost:4000",
      "/medications": "http://localhost:4000",
      "/api": "http://localhost:4000",
      "/simulator": "http://localhost:4000",
    },
  },
  test: {
    environment: "node",
  },
});
