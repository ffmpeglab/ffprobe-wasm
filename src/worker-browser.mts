import loadFFprobe from "./ffprobe-wasm";
import { createListener, IncomingMessage } from "./worker.mjs";

const listener = createListener(new Promise(res=>res(loadFFprobe)), "WORKERFS");

self.onmessage = (event: MessageEvent<IncomingMessage>) => listener(event.data);