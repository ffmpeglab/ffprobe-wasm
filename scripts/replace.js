const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace("/scripts", "");

  const wasmJsPath  = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPath = resolve(root, "src/ffprobe-wasm.mjs");
  const wasm2JsPath  = resolve(root, "dist/ffprobe-wasm.worker.js");
  const wasm2MJsPath = resolve(root, "src/ffprobe-wasm.worker.mjs");

  // pthread helper — unchanged
  const content2 = await readFile(wasm2JsPath, { encoding: "utf8" });
  await writeFile(wasm2MJsPath, content2, { encoding: "utf8" });

  let content = await readFile(wasmJsPath, { encoding: "utf8" });

  // 1) Prepend the wasm-plugin import + helper. Unchanged.
  content = `\
import initWasmInstance from "./ffprobe-wasm.wasm";
const initWasm = (info) =>
  initWasmInstance(info).then((exports) => ({ instance: { exports } }));
${content}`;

  // 2) Emscripten derives scriptDirectory from import.meta.url; blank it.
  content = content.replace(`import.meta.url`, `''`);

  // 3) NEW: hook the Vite-supplied wasm module into Emscripten.
  const MODULE_DECL = `var Module = typeof Module != "undefined" ? Module : {};`;
  const HOOK = `
Module["instantiateWasm"] = (info, receiveInstance) => {
  initWasm(info).then(({ instance }) => receiveInstance(instance));
  return {};
};`;

  if (!content.includes(MODULE_DECL)) {
    throw new Error(
      "Could not find `var Module = ...` in dist/ffprobe-wasm.js — " +
      "Emscripten output shape changed, update the post-build script.",
    );
  }
  content = content.replace(MODULE_DECL, MODULE_DECL + HOOK);

  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
}