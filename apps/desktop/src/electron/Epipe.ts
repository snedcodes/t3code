/**
 * Electron can outlive the pipe that launched it (for example, when a
 * development terminal closes). Treat that expected broken-pipe signal as a
 * clean shutdown path while preserving every other stream error.
 */
export function installEpipeHandlers(streams: ReadonlyArray<NodeJS.WritableStream>): void {
  for (const stream of streams) {
    stream.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") throw error;
    });
  }
}
