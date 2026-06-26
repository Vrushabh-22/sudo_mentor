import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// @ts-ignore
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ command, mode }) => {
  const plugins: any[] = [react()];
  if (command === "serve" && mode === "development") {
    plugins.push(componentTagger());
  }
  return {
    server: { host: "::", port: 8080 },
    plugins,
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: {
      chunkSizeWarningLimit: 2000,
      sourcemap: false,
      target: "esnext",
    },
  };
});
