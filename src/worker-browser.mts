import loadFFprobe from "./ffprobe-wasm.worker.js";
import { createListener, IncomingMessage } from "./worker.mjs";

const listener = createListener(loadFFprobe(), "WORKERFS");

self.onmessage = (event: MessageEvent<IncomingMessage>) => listener(event.data);