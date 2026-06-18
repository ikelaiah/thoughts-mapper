import { defineConfig } from "vite";

export default defineConfig({
  base: "/thoughts-mapper/",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
