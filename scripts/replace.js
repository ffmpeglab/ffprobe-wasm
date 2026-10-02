const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace('/scripts', '');

  const wasmJsPath = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPathSave = resolve(root, "dist/ffprobe-wasm.mjs");
  const wasmMJsPath = resolve(root, "src/ffprobe-wasm.mjs");
  const wasm2JsPath = resolve(root, "dist/ffprobe-wasm.worker.js");
  const wasm2MJsPath = resolve(root, "src/ffprobe-wasm.worker.mjs");
  const content2 = await readFile(wasm2JsPath, { encoding: "utf8" });
  await writeFile(wasm2MJsPath, content2, { encoding: "utf8" });

  let content = await readFile(wasmJsPath, { encoding: "utf8" });

  content = `\
import initWasmInstance from "./ffprobe-wasm.wasm";
const initWasm = (info) =>
  initWasmInstance(info).then((exports) => ({ instance: { exports } }));
${content}`;

  content = content.replace(`import.meta.url`, `''`);

  content = content.replace(
    `instantiateAsync();`,
    `initWasm(info);`
  );

  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
  await writeFile(wasmMJsPathSave, content, { encoding: "utf8" });
}