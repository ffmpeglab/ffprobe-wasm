import { resolve } from "path";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const sourceUrlPlugin = {
  name: "append-source-url",
  generateBundle(_o, bundle) {
    for (const [file, output] of Object.entries(bundle)) {
      if (output.type === "chunk") output.code += `\n//# sourceURL=${file}`;
    }
  },
};

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  worker: {
    format: "es",
    plugins: [wasm(), topLevelAwait(), sourceUrlPlugin],
  },
  build: {
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