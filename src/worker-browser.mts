import * as loadFFprobe from "./ffprobe-wasm";
import { createListener, IncomingMessage } from "./worker.mjs";

const listener = createListener(new Promise(res=>res(loadFFprobe as any as loadFFprobe.FFprobe)), "WORKERFS");

self.onmessage = (event: MessageEvent<IncomingMessage>) => listener(event.data);