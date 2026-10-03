const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace("/scripts", "");

  const wasmJsPath     = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPath    = resolve(root, "src/ffprobe-wasm.mjs");
  const wasmMJsPathSav = resolve(root, "dist/ffprobe-wasm.mjs");

  const wasmBinSrc = resolve(root, "dist/ffprobe-wasm.wasm");
  const wasmBinDst = resolve(root, "src/ffprobe-wasm.wasm");

  // 1. Copy the wasm binary next to the mjs so `?url` resolves to a real file.
  await writeFile(wasmBinDst, await readFile(wasmBinSrc));

  let content = await readFile(wasmJsPath, { encoding: "utf8" });

  // 2. Prepend the wasm loader. Vite resolves `?url` to an absolute URL,
  //    and this function will be called from Module["instantiateWasm"].
  content = `\
import wasmUrl from "./ffprobe-wasm.wasm?url";
const initWasm = (info = {}) =>
  fetch(wasmUrl)
    .then((r) => r.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes, info));
${content}`;

  // 3. Hook the wasm loader into Emscripten right after Module is declared.
  //    Emscripten 6's createWasm() checks Module["instantiateWasm"] before
  //    falling back to fetch(wasmBinaryFile) — which would try to fetch a
  //    relative "ffprobe-wasm.wasm" from a blob worker URL and fail.
  const moduleDecl = `var Module=typeof Module!="undefined"?Module:{};`;
  if (!content.includes(moduleDecl)) {
    throw new Error("post-build: Module declaration not found");
  }
  content = content.replace(
    moduleDecl,
    `${moduleDecl}
Module["instantiateWasm"] = (info, receiveInstance) => {
  initWasm(info).then(({ instance }) => receiveInstance(instance));
  return {};
};`,
  );

  // 4. Default export so `import ffprobe from "./ffprobe-wasm.mjs"` works.
  if (!content.endsWith("\n")) content += "\n";
  content += "export default Module;\n";

  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
  await writeFile(wasmMJsPathSav, content, { encoding: "utf8" });
}