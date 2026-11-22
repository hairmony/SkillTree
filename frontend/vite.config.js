import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.SKILLTREE_BACKEND || "http://127.0.0.1:8000",
      changeOrigin: true,
      rewrite: (path) => path.slice(4),
    },
  };
  return { server: { proxy, allowedHosts: true }, preview: { proxy } };
});
