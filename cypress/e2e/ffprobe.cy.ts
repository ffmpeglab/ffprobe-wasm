import type { FFprobeWorker } from "../../src/ffprobe-wasm.worker.d.mts";

describe("ffprobe-wasm", function () {
    this.timeout(60_000);

    let worker: FFprobeWorker;

    beforeEach(() => {
        cy.visit("/cypress.html");
        cy.window().should("have.property", "__ready", true);
        cy.window().then((win) => {
            worker = new win.FFprobeWorker();
        });
    });

    afterEach(() => {
        worker?.terminate();
    });

    describe("getFileInfo", () => {
        it("reads JPEG metadata", () => {
            cy.loadFFprobeFile("sample.jpg", "sample.jpg", "image/jpeg").then(
                (file) => {
                    cy.wrap(worker.getFileInfo(file)).then((info) => {
                        expect(info.format.format_name).to.equal("image2");
                        // image2 synthesizes a bogus duration/bit_rate for stills —
                        // the wrapper zeroes them out.
                        expect(info.format.duration).to.equal("0");
                        expect(info.format.bit_rate).to.equal("0");
                        expect(info.streams).to.have.length(1);

                        const stream = info.streams[0];
                        expect(stream.codec_type).to.equal(0);
                        expect(stream.codec_name).to.equal("mjpeg");
                        expect(stream.width).to.be.greaterThan(0);
                        expect(stream.height).to.be.greaterThan(0);
                    });
                },
            );
        });

        it("reads PNG metadata", () => {
            cy.loadFFprobeFile("sample.png", "sample.png", "image/png").then(
                (file) => {
                    cy.wrap(worker.getFileInfo(file)).then((info) => {
                        expect(info.format.format_name).to.equal("image2");
                        const stream = info.streams[0];
                        expect(stream.codec_name).to.equal("png");
                        expect(stream.width).to.be.greaterThan(0);
                        expect(stream.height).to.be.greaterThan(0);
                    });
                },
            );
        });

        it("reads MP4 metadata", () => {
            cy.loadFFprobeFile("sample.mp4", "sample.mp4", "video/mp4").then(
                (file) => {
                    cy.wrap(worker.getFileInfo(file)).then((info) => {
                        expect(info.format.format_name).to.include("mp4");
                        expect(info.streams.length).to.be.greaterThan(0);

                        const video = info.streams.find((s) =>
                            s.codec_type === 0
                        );
                        expect(video, "has a video stream").to.exist;
                        expect(video!.codec_name).to.equal("h264");
                        expect(video!.width).to.be.greaterThan(0);
                        expect(video!.height).to.be.greaterThan(0);
                    });
                },
            );
        });

        it("reads MP3 metadata", () => {
            cy.loadFFprobeFile("sample.mp3", "sample.mp3", "audio/mpeg").then(
                (file) => {
                    cy.wrap(worker.getFileInfo(file)).then((info) => {
                        expect(info.streams.length).to.be.greaterThan(0);
                        const audio = info.streams.find((s) =>
                            s.codec_type === 1
                        );
                        expect(audio, "has an audio stream").to.exist;
                        expect(audio!.codec_name).to.equal("mp3");
                        expect(audio!.channels).to.be.greaterThan(0);
                        expect(audio!.sample_rate).to.be.greaterThan(0);
                    });
                },
            );
        });
    });

    describe("getFrames", () => {
        it("returns frames for a video", () => {
    cy.loadFFProbeFile("sample.mp4", "sample.mp4", "video/mp4").then((file) => {
        cy.wrap(worker.getFrames(file, 0)).then((info) => {
            expect(info.frames.length).to.be.greaterThan(0);
            expect(info.nb_frames).to.be.greaterThan(0);

            const first = info.frames[0];
            // pict_type is the ASCII code of the character ffprobe would print:
            // 73 = 'I' (keyframe), 80 = 'P', 66 = 'B'.
            expect(String.fromCharCode(first.pict_type)).to.match(/^[IPB]$/);
            expect(first.pts).to.be.a("number");
        });
    });
});
    });

    describe("validation", () => {
        it("rejects a string argument", async () => {
            let caught: Error | undefined;
            try {
                await worker.getFileInfo("not-a-file" as unknown as File);
            } catch (e) {
                caught = e as Error;
            }
            expect(caught, "an error was thrown").to.exist;
            expect(caught!.message).to.match(/File/);
        });
    });
});
