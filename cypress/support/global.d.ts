import type { FFprobeWorker } from "../../src/ffprobe-wasm.worker.d.mts";

declare global {
  interface Window {
    FFprobeWorker: new () => FFprobeWorker;
    __ready: boolean;
  }
}

export {};