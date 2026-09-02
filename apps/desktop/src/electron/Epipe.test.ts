import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";

import { installEpipeHandlers } from "./Epipe.ts";

function makeStream(): EventEmitter & NodeJS.WritableStream {
  return new EventEmitter() as EventEmitter & NodeJS.WritableStream;
}

describe("installEpipeHandlers", () => {
  it("swallows EPIPE on Electron stdout and stderr streams", () => {
    const stdout = makeStream();
    const stderr = makeStream();

    installEpipeHandlers([stdout, stderr]);

    expect(() =>
      stdout.emit("error", Object.assign(new Error("stdout closed"), { code: "EPIPE" })),
    ).not.toThrow();
    expect(() =>
      stderr.emit("error", Object.assign(new Error("stderr closed"), { code: "EPIPE" })),
    ).not.toThrow();
  });

  it("rethrows non-EPIPE stream errors", () => {
    const stdout = makeStream();
    installEpipeHandlers([stdout]);

    expect(() => stdout.emit("error", new Error("unexpected stream failure"))).toThrow(
      "unexpected stream failure",
    );
  });
});
