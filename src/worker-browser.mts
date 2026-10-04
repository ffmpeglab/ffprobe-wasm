import loadFFprobe from "./ffprobe-wasm";
import { createListener, IncomingMessage } from "./worker.mjs";

const ffprobe = loadFFprobe as typeof loadFFprobe & {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
};

const ready = new Promise<typeof ffprobe>((resolve) => {
  if (ffprobe.calledRun) {
    resolve(ffprobe);
  } else {
    ffprobe.onRuntimeInitialized = () => resolve(ffprobe);
  }
});

const listener = createListener(ready as any, "WORKERFS");

self.onmessage = (event: MessageEvent<IncomingMessage>) => listener(event.data);