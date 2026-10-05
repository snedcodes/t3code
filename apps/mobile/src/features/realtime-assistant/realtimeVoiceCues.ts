import type { RealtimeState } from "./realtimeAssistantController";

export function voiceAudioFocusStopReason(eventCode: -1 | -2 | -3): string {
  return eventCode === -1
    ? "Voice stopped because audio focus was lost."
    : eventCode === -2
      ? "Voice stopped because audio focus was temporarily interrupted."
      : "Voice stopped because other audio requested reduced playback.";
}

/** One cue per actual active interval; stopping plays before the call route is released. */
export class RealtimeVoiceCues {
  private active = false;
  constructor(private readonly play: (active: boolean) => void) {}

  update(state: Pick<RealtimeState, "status" | "sessionId">): void {
    const active = state.status === "active" && Boolean(state.sessionId);
    if (active === this.active) return;
    this.active = active;
    this.emit(active);
  }
  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.emit(false);
  }
  private emit(active: boolean): void {
    try {
      this.play(active);
    } catch {
      /* Optional feedback must not affect voice cleanup. */
    }
  }
}
