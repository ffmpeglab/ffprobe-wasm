const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace("/scripts", "");

  const wasmJsPath     = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPath    = resolve(root, "src/ffprobe-wasm.mjs");
  const wasmMJsPathSav = resolve(root, "dist/ffprobe-wasm.mjs");
  const wasm2JsPath    = resolve(root, "dist/ffprobe-wasm.worker.js");
  const wasm2MJsPath   = resolve(root, "src/ffprobe-wasm.worker.mjs");

  // pthread helper: copy verbatim
  const content2 = await readFile(wasm2JsPath, { encoding: "utf8" });
  await writeFile(wasm2MJsPath, content2, { encoding: "utf8" });

  let content = await readFile(wasmJsPath, { encoding: "utf8" });

  // 1) Prepend a ?url-based wasm loader. No plugin needed.
  content = `\
import wasmUrl from "./ffprobe-wasm.wasm?url";
const initWasm = (info = {}) =>
  fetch(wasmUrl)
    .then((r) => r.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes, info));
${content}`;

  // 2) Kill any base-URL derivation from import.meta.url
  content = content.replace(`import.meta.url`, `''`);

  // 3) Hand the instance to Emscripten instead of fetching by name
  const from = `instantiateAsync();`;
  const to   = `initWasm(info).then(receiveInstantiationResult);`;
  if (!content.includes(from)) {
    throw new Error("post-build: `instantiateAsync();` not found");
  }
  content = content.replace(from, to);

  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
  await writeFile(wasmMJsPathSav, content, { encoding: "utf8" });
}