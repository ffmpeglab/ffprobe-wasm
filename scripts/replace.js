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

  content = `\
import wasmUrl from "./ffprobe-wasm.wasm?url";
const initWasm = (info = {}) =>
  fetch(wasmUrl)
    .then((r) => r.arrayBuffer())
    .then((bytes) => WebAssembly.instantiate(bytes, info));
${content}`;

  content = content.replace(`import.meta.url`, `''`);

  const from = `instantiateAsync();`;
  const to   = `initWasm(info).then(receiveInstantiationResult);`;
  if (!content.includes(from)) {
    throw new Error("post-build: `instantiateAsync();` not found");
  }
  content = content.replace(from, to);
  const finalRun = `run();`;
  if (!content.includes(finalRun)) {
    throw new Error("post-build: final `run();` not found");
  }
  content = content.replace(
    finalRun,
    `${finalRun}\nexport default Module;`,
  );
  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
  await writeFile(wasmMJsPathSav, content, { encoding: "utf8" });
}