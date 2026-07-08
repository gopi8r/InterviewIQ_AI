import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

//Vite is a frontend build tool and development server.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
