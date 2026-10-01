import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: resolve(__dirname, "dist"),
    lib: {
      entry: resolve(__dirname, "dist/browser-vite.mjs"),
      formats: ["es"],
      fileName: () => "browser.mjs",
    },
    rollupOptions:{
      external:[ '/ffprobe-wasm.wasm' ]
    },
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
  },
  worker: {
    rollupOptions: {
      external: [ '/ffprobe-wasm.wasm' ]
    },
    plugins: [
      {
        name: "append-source-url",
        generateBundle(options, bundle) {
          Object.entries(bundle).forEach(([file, output]) => {
            if (output.type === "chunk") {
              output.code += `\n//# sourceURL=${file}`;
            }
          });
        },
      },
    ],
  },
});