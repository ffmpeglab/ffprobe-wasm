const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace('/scripts', '');

  const wasmJsPath = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPath = resolve(root, "dist/ffprobe-wasm.mjs");

  let content = await readFile(wasmJsPath, { encoding: "utf8" });

  content = `\
import initWasmInstance from "./ffprobe-wasm.wasm";
const initWasm = (info) =>
  initWasmInstance(info).then((exports) => ({ instance: { exports } }));
${content}`;

  content = content.replace(`import.meta.url`, `''`);

  content = content.replace(
    `instantiateAsync().catch(readyPromiseReject)`,
    `initWasm(info).then(receiveInstantiatedSource, readyPromiseReject)`
  );

  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
}