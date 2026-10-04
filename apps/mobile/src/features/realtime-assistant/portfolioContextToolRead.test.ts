import { expect, it, vi } from "vite-plus/test";
import { EnvironmentId } from "@t3tools/contracts";
import { createPortfolioContextToolRead } from "./portfolioContextToolRead";

it("forwards exact numeric continuation and gives safe corrective feedback without HTTP for invalid arguments", async () => {
  const read = vi.fn(async () => ({ _tag: "Success" as const, value: { nextOffset: 16000 } }));
  const tool = createPortfolioContextToolRead(EnvironmentId.make("current"), read);
  const request = {
    operation: "read_thread",
    projectId: "project",
    threadId: "thread",
    offset: 0,
    maxChars: 16000,
  };
  expect(await tool(request)).toEqual({ nextOffset: 16000 });
  await tool({ ...request, environmentId: "chosen", offset: 16000 });
  expect(read.mock.calls).toEqual([
    [{ environmentId: "current", input: request }],
    [{ environmentId: "chosen", input: { ...request, offset: 16000 } }],
  ]);
  read.mockClear();
  for (const invalid of [
    { ...request, offset: "16000" },
    { ...request, maxChars: 60001 },
    { ...request, environmentId: null },
    { ...request, nextOffset: 16000 },
  ]) {
    const output = await tool(invalid);
    expect(output).toMatchObject({ error: { code: "invalid_arguments" } });
    expect(JSON.stringify(output)).not.toContain('"project"');
  }
  expect(read).not.toHaveBeenCalled();
  const offsetError = await tool({ ...request, offset: "16000" });
  expect(offsetError).toMatchObject({
    error: {
      invalidFields: [
        { field: "offset", expected: expect.stringContaining("nextOffset as offset") },
      ],
    },
  });
  read.mockRejectedValueOnce(new Error("secret-token and private provider body"));
  expect(await tool(request)).toMatchObject({ error: { code: "request_unavailable" } });
  read.mockRejectedValueOnce(new Error("secret-token"));
  expect(JSON.stringify(await tool(request))).not.toContain("secret-token");
});
