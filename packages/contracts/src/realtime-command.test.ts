import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { OrchestrationCommand } from "./orchestration.ts";

const decode = Schema.decodeUnknownEffect(OrchestrationCommand);
const base = {
  commandId: "cmd-realtime",
  threadId: "thread-realtime",
  createdAt: "2026-08-26T00:00:00.000Z",
};

it.effect("decodes the native realtime thread command trio", () =>
  Effect.gen(function* () {
    for (const command of [
      { ...base, type: "thread.realtime.start", outputModality: "audio" },
      {
        ...base,
        type: "thread.realtime.append-audio",
        audio: { data: "AAAA", numChannels: 1, sampleRate: 24000 },
      },
      { ...base, type: "thread.realtime.stop" },
    ]) {
      const decoded = yield* decode(command);
      assert.ok("threadId" in decoded);
    }
  }),
);
