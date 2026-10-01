import type { FFprobeWorker as AbstractFFprobeWorker } from "./ffprobe-wasm.worker.mjs";
import type { Chapter, Disposition, FileInfo, Format, Frame, FramesInfo, Rational, Stream } from "./types.mjs";

export declare class FFprobeWorker implements AbstractFFprobeWorker {
    #private;
    constructor();
    getFileInfo(file: File): Promise<FileInfo>;
    getFrames(file: File, offset: number): Promise<FramesInfo>;
    terminate(): void;
}

export type { Chapter, Disposition, FileInfo, Format, Frame, FramesInfo, Rational, Stream, };
