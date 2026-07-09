import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const viteConfig = {
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
    watch: {
      ignored: ["**/.next/**"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
};

export default viteConfig;
