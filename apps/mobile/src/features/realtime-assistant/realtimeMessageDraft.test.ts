import { expect, it, vi } from "vite-plus/test";
import { RealtimeMessageDraft } from "./realtimeMessageDraft";

it("sends only the current attached-thread draft and retains identity across queue failure and repeated sends", async () => {
  let revision = 0;
  const enqueue = vi
    .fn<ConstructorParameters<typeof RealtimeMessageDraft>[0]["enqueue"]>()
    .mockRejectedValueOnce(new Error("private platform details"))
    .mockResolvedValue(undefined);
  const target = {
    environmentId: "exact-env",
    projectId: "exact-project",
    threadId: "main-thread",
  };
  const tools = new RealtimeMessageDraft({
    target,
    enqueue,
    identity: () => ({
      draftId: `draft-${++revision}`,
      messageId: `message-${revision}`,
      commandId: `command-${revision}`,
      createdAt: "2026-10-05T00:18:00Z",
    }),
  });
  expect(await tools.draft({ text: "First draft" })).toMatchObject({ ...target, status: "draft" });
  expect(enqueue).not.toHaveBeenCalled();
  await tools.draft({ text: "Revised text" });
  expect(await tools.send({ draftId: "draft-1" })).toMatchObject({ error: "stale_draft" });
  expect(await tools.send({ draftId: "draft-2" })).toMatchObject({ error: "queue_failed" });
  expect(JSON.stringify(await tools.get())).not.toContain("private platform details");
  const queued = await tools.send({ draftId: "draft-2" });
  expect(queued).toMatchObject({
    ...target,
    status: "queued",
    messageId: "message-2",
    commandId: "command-2",
    text: "Revised text",
  });
  expect(await tools.send({ draftId: "draft-2" })).toEqual(queued);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls[0]?.[0]).toBe(enqueue.mock.calls[1]?.[0]);
  tools.edit("Edited again");
  expect(await tools.send({ draftId: "draft-2" })).toMatchObject({ error: "stale_draft" });
  expect(await tools.draft({ text: "x".repeat(60001) })).toMatchObject({ error: "invalid_text" });
  tools.discard();
  expect(await tools.get()).toMatchObject({ ...target, status: "empty" });
});
