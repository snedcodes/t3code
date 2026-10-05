import type { RealtimeState } from "./realtimeAssistantController";

export function voiceAudioFocusStopReason(eventCode: -1 | -2 | -3): string {
  return eventCode === -1
    ? "Audio focus was lost. The call stays connected; Android may temporarily suppress audio."
    : eventCode === -2
      ? "Audio focus was temporarily interrupted. The call stays connected."
      : "Other audio requested reduced playback. The call stays connected.";
}

/** One cue per actual active interval; stopping plays before the call route is released. */
export class RealtimeVoiceCues {
  private active = false;
  constructor(private readonly play: (active: boolean) => void) {}

  update(state: Pick<RealtimeState, "status" | "sessionId">): void {
    if (state.status === "reconnecting" || state.status === "starting") return;
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
