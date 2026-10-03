import { resolve } from "path";
import { defineConfig } from "vite";

const sourceUrlPlugin = {
  name: "append-source-url",
  generateBundle(_o, bundle) {
    for (const [file, output] of Object.entries(bundle)) {
      if (output.type === "chunk") output.code += `\n//# sourceURL=${file}`;
    }
  },
};

export default defineConfig({
  worker: {
    rollupOptions: {
      external: [ './ffprobe-wasm.wasm' ]
    },
    format: "es",
    plugins: [sourceUrlPlugin],
  },
  esbuild: {
    target: "es2020",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2020",
    },
  },
  build: {
    target: "es2020",
    outDir: resolve(__dirname, "dist"),
    lib: {
      entry: resolve(__dirname, "dist/browser-vite.mjs"),
      formats: ["es"],
      fileName: () => "browser.mjs",
    },
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
  },
});