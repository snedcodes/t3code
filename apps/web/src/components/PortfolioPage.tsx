import { useMemo, useState } from "react";
import { AsyncResult } from "effect/unstable/reactivity";
import { RuntimeTaskId, type PortfolioChecklistItem, type PortfolioHeartbeat, type PortfolioTask, type PortfolioTarget } from "@t3tools/contracts";
import { CalendarClockIcon, CircleCheckIcon, ListTodoIcon } from "lucide-react";

import { useEnvironments, usePrimaryEnvironmentId } from "../state/environments";
import { useProjects, useThreadShells } from "../state/entities";
import { usePortfolioHeartbeats, usePortfolioTasks, portfolioEnvironment } from "../state/portfolio";
import { formatEnvironmentQueryError } from "../state/query";
import { useAtomCommand } from "../state/use-atom-command";
import { buildNativeMessageTargets } from "../nativeMessageTargets";
import { randomUUID } from "../lib/utils";

const timestamp = () => new Date().toISOString();
const emptyTarget = (target: PortfolioTarget) => target;

export function PortfolioPage() {
  const environmentId = usePrimaryEnvironmentId();
  return environmentId === null
    ? <main className="p-8"><h1 className="text-xl font-semibold">Portfolio</h1><p className="mt-3 text-muted-foreground">Connect an environment to manage Tasks and Heartbeats.</p></main>
    : <PortfolioOwnerWorkspace environmentId={environmentId} />;
}

function PortfolioOwnerWorkspace({ environmentId }: { readonly environmentId: NonNullable<ReturnType<typeof usePrimaryEnvironmentId>> }) {
  const { environments } = useEnvironments();
  const projects = useProjects();
  const threads = useThreadShells();
  const targets = useMemo(() => buildNativeMessageTargets(projects, threads), [projects, threads]);
  const labelByEnvironment = useMemo(() => new Map(environments.map((entry) => [String(entry.environmentId), entry.label])), [environments]);
  const taskResult = usePortfolioTasks(environmentId);
  const heartbeatResult = usePortfolioHeartbeats(environmentId);
  const tasks = AsyncResult.isSuccess(taskResult) ? taskResult.value.tasks : [];
  const heartbeats = AsyncResult.isSuccess(heartbeatResult) ? heartbeatResult.value.heartbeats : [];
  const writeTask = useAtomCommand(portfolioEnvironment.writeTask, { reportFailure: false });
  const writeHeartbeat = useAtomCommand(portfolioEnvironment.writeHeartbeat, { reportFailure: false });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOutcome, setTaskOutcome] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [completionCondition, setCompletionCondition] = useState("");
  const [taskStatus, setTaskStatus] = useState<PortfolioTask["status"]>("ready");
  const [taskTargetKey, setTaskTargetKey] = useState("");
  const [checklist, setChecklist] = useState<PortfolioChecklistItem[]>([]);
  const [heartbeatId, setHeartbeatId] = useState<string | null>(null);
  const [heartbeatTaskId, setHeartbeatTaskId] = useState<string | null>(null);
  const [heartbeatTargetKey, setHeartbeatTargetKey] = useState("");
  const [heartbeatMessage, setHeartbeatMessage] = useState("");
  const [cadence, setCadence] = useState("60");
  const [heartbeatStatus, setHeartbeatStatus] = useState<PortfolioHeartbeat["status"]>("active");
  const [stopConditions, setStopConditions] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const targetKey = (target: PortfolioTarget) => JSON.stringify([target.environmentId, target.projectId, target.threadId]);
  const selectedTask = tasks.find((task) => String(task.taskId) === taskId) ?? null;
  const selectedHeartbeat = heartbeats.find((entry) => entry.heartbeatId === heartbeatId) ?? null;
  const targetCaption = (target: PortfolioTarget) => {
    const item = targets.find((entry) => entry.key === targetKey(target));
    return item ? `${labelByEnvironment.get(String(target.environmentId)) ?? target.environmentId} / ${item.projectTitle} / ${item.threadTitle}` : `${target.environmentId} / ${target.projectId} / ${target.threadId}`;
  };
  const selectTask = (task: PortfolioTask) => {
    setTaskId(String(task.taskId));
    setTaskTitle(task.title);
    setTaskOutcome(task.outcome);
    setTaskPriority(task.priority);
    setCompletionCondition(task.completionCondition);
    setTaskStatus(task.status);
    setTaskTargetKey(targetKey(task.target));
    setChecklist([...task.checklistItems]);
    setFeedback(null);
  };
  const newTask = () => {
    setTaskId(null);
    setTaskTitle(""); setTaskOutcome(""); setTaskPriority("normal"); setCompletionCondition("");
    setTaskStatus("ready"); setTaskTargetKey(targets[0]?.key ?? ""); setChecklist([]); setFeedback(null);
  };
  const updateChecklist = (itemId: string, patch: Partial<PortfolioChecklistItem>) => setChecklist((current) => current.map((item) => item.itemId === itemId ? { ...item, ...patch, updatedAt: timestamp() } : item));
  const saveTask = async () => {
    const target = targets.find((item) => item.key === taskTargetKey) ?? (selectedTask && targetKey(selectedTask.target) === taskTargetKey ? selectedTask.target : null);
    if (!target || !taskTitle.trim() || !taskOutcome.trim() || !completionCondition.trim()) {
      setFeedback("Choose an exact target and complete the Task detail before saving."); return;
    }
    const now = timestamp();
    const task: PortfolioTask = {
      taskId: selectedTask?.taskId ?? RuntimeTaskId.make(randomUUID()),
      title: taskTitle.trim(), outcome: taskOutcome.trim(), target: emptyTarget(target), status: taskStatus,
      priority: taskPriority.trim() || "normal", ownerPassportId: null, ownerHost: null,
      checklistItems: checklist, completionCondition: completionCondition.trim(), planLinks: [], evidenceLinks: [],
      createdAt: selectedTask?.createdAt ?? now, updatedAt: now,
      completedAt: taskStatus === "complete" ? selectedTask?.completedAt ?? now : null,
      revision: selectedTask?.revision ?? 1, lastReceipt: selectedTask?.lastReceipt ?? null, heartbeatId: selectedTask?.heartbeatId ?? null,
    };
    setSaving(true);
    const result = await writeTask({ environmentId, input: { expectedRevision: selectedTask?.revision ?? null, task } });
    setSaving(false);
    setFeedback(result._tag === "Success" ? "Task saved with the same Task ID." : "Task save was rejected; refresh and resolve the latest owner revision.");
  };
  const selectHeartbeat = (heartbeat: PortfolioHeartbeat) => {
    setHeartbeatId(heartbeat.heartbeatId); setHeartbeatTaskId(heartbeat.taskId); setHeartbeatTargetKey(targetKey(heartbeat.target));
    setHeartbeatMessage(heartbeat.message ?? ""); setCadence(heartbeat.cadenceMinutes === null ? "" : String(heartbeat.cadenceMinutes));
    setHeartbeatStatus(heartbeat.status); setStopConditions(heartbeat.stopConditions.join("\n")); setFeedback(null);
  };
  const newHeartbeat = () => {
    setHeartbeatId(null); setHeartbeatTaskId(null); setHeartbeatTargetKey(targets[0]?.key ?? ""); setHeartbeatMessage(""); setCadence("60"); setHeartbeatStatus("active"); setStopConditions(""); setFeedback(null);
  };
  const saveHeartbeat = async () => {
    const target = heartbeatTaskId ? tasks.find((task) => String(task.taskId) === heartbeatTaskId)?.target : targets.find((entry) => entry.key === heartbeatTargetKey) ?? (selectedHeartbeat && targetKey(selectedHeartbeat.target) === heartbeatTargetKey ? selectedHeartbeat.target : null);
    if (!target) { setFeedback("Choose an exact target or linked Task before saving the Heartbeat."); return; }
    const now = timestamp();
    const id = heartbeatId ?? randomUUID();
    const task = heartbeatTaskId ? tasks.find((entry) => String(entry.taskId) === heartbeatTaskId) : null;
    if (heartbeatTaskId && task && task.heartbeatId !== id) {
      const linked = await writeTask({ environmentId, input: { expectedRevision: task.revision, task: { ...task, heartbeatId: id, updatedAt: now } } });
      if (linked._tag !== "Success") { setFeedback("Could not link the Heartbeat to its Task; refresh and retry."); return; }
    }
    const cadenceMinutes = cadence.trim() ? Math.max(1, Number(cadence)) : null;
    const heartbeat: PortfolioHeartbeat = {
      heartbeatId: id, taskId: heartbeatTaskId as PortfolioHeartbeat["taskId"], message: heartbeatMessage.trim() || null,
      target, status: heartbeatStatus, cadenceMinutes,
      nextRunAt: heartbeatStatus === "active" ? selectedHeartbeat?.nextRunAt ?? now : null,
      maxRuns: selectedHeartbeat?.maxRuns ?? null, runCount: selectedHeartbeat?.runCount ?? 0,
      expiresAt: selectedHeartbeat?.expiresAt ?? null,
      stopConditions: stopConditions.split("\n").map((item) => item.trim()).filter(Boolean),
      preventOverlap: true, stopReason: heartbeatStatus === "active" ? null : selectedHeartbeat?.stopReason ?? "Paused by operator.",
      lastReceipt: selectedHeartbeat?.lastReceipt ?? null, updatedAt: now, revision: selectedHeartbeat?.revision ?? 1,
    };
    setSaving(true);
    const result = await writeHeartbeat({ environmentId, input: { expectedRevision: selectedHeartbeat?.revision ?? null, heartbeat } });
    setSaving(false);
    setFeedback(result._tag === "Success" ? "Heartbeat saved; owner readback will refresh its cadence and receipt." : "Heartbeat save was rejected; refresh and resolve the latest owner revision.");
    if (result._tag === "Success") setHeartbeatId(id);
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-y-auto p-6">
      <header><h1 className="flex items-center gap-2 text-xl font-semibold"><ListTodoIcon className="size-5" /> Portfolio Tasks &amp; Heartbeats</h1><p className="mt-1 text-sm text-muted-foreground">Owner: {environments.find((entry) => entry.environmentId === environmentId)?.label ?? environmentId}. Assign every Task and Heartbeat to one exact environment, project, and thread.</p></header>
      {feedback ? <p role="status" className="rounded border p-3 text-sm">{feedback}</p> : null}
      {targets.length === 0 ? <p role="status" className="rounded border p-4 text-sm text-muted-foreground">No exact native thread targets are currently connected. Existing records remain visible, but new assignments need an environment/project/thread target.</p> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Tasks</h2><button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={newTask}>New Task</button></div>
          <div className="max-h-44 space-y-1 overflow-auto">{tasks.map((task) => <button key={task.taskId} className={`block w-full rounded px-2 py-1 text-left text-sm ${taskId === task.taskId ? "bg-accent" : "hover:bg-accent/50"}`} onClick={() => selectTask(task)}>{task.title} <span className="text-muted-foreground">· {task.status} · r{task.revision}</span></button>)}</div>
          {AsyncResult.isFailure(taskResult) ? <p role="alert" className="text-sm text-destructive">Tasks are unavailable: {formatEnvironmentQueryError(taskResult.cause)}</p> : null}
          <label className="grid gap-1 text-sm">Title<input className="rounded border bg-background px-2 py-1.5" value={taskTitle} onChange={(event) => setTaskTitle(event.currentTarget.value)} /></label>
          <label className="grid gap-1 text-sm">Outcome<input className="rounded border bg-background px-2 py-1.5" value={taskOutcome} onChange={(event) => setTaskOutcome(event.currentTarget.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Priority<input className="rounded border bg-background px-2 py-1.5" value={taskPriority} onChange={(event) => setTaskPriority(event.currentTarget.value)} /></label><label className="grid gap-1 text-sm">Status<select className="rounded border bg-background px-2 py-1.5" value={taskStatus} onChange={(event) => setTaskStatus(event.currentTarget.value as PortfolioTask["status"])}>{["draft","ready","in_progress","blocked","complete","cancelled"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label className="grid gap-1 text-sm">Exact assigned target<select disabled={selectedTask !== null} className="rounded border bg-background px-2 py-1.5 disabled:opacity-70" value={taskTargetKey} onChange={(event) => setTaskTargetKey(event.currentTarget.value)}><option value="">Select target</option>{selectedTask && !targets.some((target) => target.key === taskTargetKey) ? <option value={taskTargetKey}>{targetCaption(selectedTask.target)} (not currently connected)</option> : null}{targets.map((target) => <option key={target.key} value={target.key}>{labelByEnvironment.get(String(target.environmentId)) ?? target.environmentId} / {target.projectTitle} / {target.threadTitle}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Completion condition<input className="rounded border bg-background px-2 py-1.5" value={completionCondition} onChange={(event) => setCompletionCondition(event.currentTarget.value)} /></label>
          <div className="space-y-2"><div className="flex items-center justify-between text-sm font-medium">Checklist and evidence<button className="text-xs text-primary" onClick={() => setChecklist((items) => [...items, { itemId: randomUUID(), text: "", state: "open", evidence: null, updatedAt: timestamp() }])}>Add item</button></div>{checklist.map((item) => <div key={item.itemId} className="grid gap-2 rounded border p-2 sm:grid-cols-[1fr_130px]"> <input aria-label="Checklist item" className="rounded border bg-background px-2 py-1 text-sm" value={item.text} onChange={(event) => updateChecklist(item.itemId, { text: event.currentTarget.value })} /><select aria-label="Checklist progress" className="rounded border bg-background px-2 py-1 text-sm" value={item.state} onChange={(event) => updateChecklist(item.itemId, { state: event.currentTarget.value as PortfolioChecklistItem["state"] })}>{["open","in_progress","blocked","complete"].map((value) => <option key={value}>{value}</option>)}</select><input aria-label="Checklist evidence" className="rounded border bg-background px-2 py-1 text-sm sm:col-span-2" placeholder="Evidence or readback" value={item.evidence ?? ""} onChange={(event) => updateChecklist(item.itemId, { evidence: event.currentTarget.value || null })} /></div>)}</div>
          <button disabled={saving || targets.length === 0} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void saveTask()}>{saving ? "Saving…" : "Save Task"}</button>
        </section>
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><CalendarClockIcon className="size-4" /> Heartbeats</h2><button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={newHeartbeat}>New Heartbeat</button></div>
          <div className="max-h-44 space-y-1 overflow-auto">{heartbeats.map((entry) => <button key={entry.heartbeatId} className={`block w-full rounded px-2 py-1 text-left text-sm ${heartbeatId === entry.heartbeatId ? "bg-accent" : "hover:bg-accent/50"}`} onClick={() => selectHeartbeat(entry)}>{entry.heartbeatId} <span className="text-muted-foreground">· {entry.status} · {entry.runCount} runs</span></button>)}</div>
          {AsyncResult.isFailure(heartbeatResult) ? <p role="alert" className="text-sm text-destructive">Heartbeats are unavailable: {formatEnvironmentQueryError(heartbeatResult.cause)}</p> : null}
          <label className="grid gap-1 text-sm">Attach to Task<select disabled={selectedHeartbeat !== null} className="rounded border bg-background px-2 py-1.5 disabled:opacity-70" value={heartbeatTaskId ?? ""} onChange={(event) => { const value = event.currentTarget.value || null; setHeartbeatTaskId(value); const linked = tasks.find((task) => String(task.taskId) === value); if (linked) setHeartbeatTargetKey(targetKey(linked.target)); }}><option value="">Standalone Heartbeat</option>{tasks.filter((task) => !["complete","blocked","cancelled"].includes(task.status)).map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}</select></label>
          {heartbeatTaskId ? <p className="text-xs text-muted-foreground">Exact target inherited from linked Task: {tasks.find((task) => String(task.taskId) === heartbeatTaskId)?.target ? targetCaption(tasks.find((task) => String(task.taskId) === heartbeatTaskId)!.target) : "missing Task"}</p> : <label className="grid gap-1 text-sm">Exact target<select disabled={selectedHeartbeat !== null} className="rounded border bg-background px-2 py-1.5 disabled:opacity-70" value={heartbeatTargetKey} onChange={(event) => setHeartbeatTargetKey(event.currentTarget.value)}><option value="">Select target</option>{selectedHeartbeat && !targets.some((target) => target.key === heartbeatTargetKey) ? <option value={heartbeatTargetKey}>{targetCaption(selectedHeartbeat.target)} (not currently connected)</option> : null}{targets.map((target) => <option key={target.key} value={target.key}>{labelByEnvironment.get(String(target.environmentId)) ?? target.environmentId} / {target.projectTitle} / {target.threadTitle}</option>)}</select></label>}
          <label className="grid gap-1 text-sm">Custom recurring message<textarea className="min-h-20 rounded border bg-background p-2" value={heartbeatMessage} onChange={(event) => setHeartbeatMessage(event.currentTarget.value)} placeholder="Leave blank to use the linked Task or standalone fallback prompt." /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Cadence (minutes; blank = one run)<input type="number" min="1" className="rounded border bg-background px-2 py-1.5" value={cadence} onChange={(event) => setCadence(event.currentTarget.value)} /></label><label className="grid gap-1 text-sm">Lifecycle<select className="rounded border bg-background px-2 py-1.5" value={heartbeatStatus} onChange={(event) => setHeartbeatStatus(event.currentTarget.value as PortfolioHeartbeat["status"])}>{["active","paused","stopped"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label className="grid gap-1 text-sm">Stop conditions<textarea className="min-h-16 rounded border bg-background p-2" value={stopConditions} onChange={(event) => setStopConditions(event.currentTarget.value)} placeholder="One condition per line" /></label>
          <button disabled={saving || (targets.length === 0 && !heartbeatTaskId)} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void saveHeartbeat()}>{saving ? "Saving…" : "Save Heartbeat"}</button>
          {selectedHeartbeat?.lastReceipt ? <div className="rounded border p-3 text-xs"><p className="flex items-center gap-1 font-medium"><CircleCheckIcon className="size-3" />Latest receipt · {selectedHeartbeat.lastReceipt.status}</p><p>Command {selectedHeartbeat.lastReceipt.commandId} · {selectedHeartbeat.lastReceipt.observedAt}</p><p>{selectedHeartbeat.lastReceipt.detail}</p></div> : null}
          {heartbeatMessage.trim() === "" ? <p className="text-xs text-muted-foreground">Fallback: linked Task outcome, incomplete checklist and completion condition; standalone Heartbeats receive a bounded-check prompt.</p> : null}
        </section>
      </div>
    </main>
  );
}
