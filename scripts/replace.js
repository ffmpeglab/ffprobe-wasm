const { readFile, writeFile } = require("fs/promises");
const { resolve } = require("path");

main();

async function main() {
  const root = __dirname.replace("/scripts", "");

  const wasmJsPath     = resolve(root, "dist/ffprobe-wasm.js");
  const wasmMJsPath    = resolve(root, "src/ffprobe-wasm.mjs");
  const wasmMJsPathSav = resolve(root, "dist/ffprobe-wasm.mjs");

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
  const marker = "run();";
  const lastIdx = content.lastIndexOf(marker);
  if (lastIdx === -1) {
    throw new Error("post-build: `run();` not found");
  }
  content =
    content.slice(0, lastIdx + marker.length) +
    "\nexport default Module;\n" +
    content.slice(lastIdx + marker.length);
    
  await writeFile(wasmMJsPath, content, { encoding: "utf8" });
  await writeFile(wasmMJsPathSav, content, { encoding: "utf8" });
}