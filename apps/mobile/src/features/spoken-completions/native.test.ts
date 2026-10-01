import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  os: "android",
  native: null as {
    configureSpokenCompletions?: ReturnType<typeof vi.fn>;
    stopSpokenCompletions?: ReturnType<typeof vi.fn>;
  } | null,
  requireModule: vi.fn(),
}));

vi.mock("expo", () => ({ requireOptionalNativeModule: mocks.requireModule }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mocks.os;
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.os = "android";
  mocks.native = null;
  mocks.requireModule.mockReset().mockImplementation(() => mocks.native);
});

describe("Android spoken completion native boundary", () => {
  it.each([null, {}, { configureSpokenCompletions: vi.fn() }, { stopSpokenCompletions: vi.fn() }])(
    "safely disables speech on missing or older native modules (%j)",
    async (native) => {
      mocks.native = native;
      const { nativeSpeech } = await import("./native");
      expect(nativeSpeech.available).toBe(false);
      expect(() => nativeSpeech.configure({ enabled: true })).not.toThrow();
      expect(() => nativeSpeech.configure({ enabled: false })).not.toThrow();
      expect(() => nativeSpeech.stop()).not.toThrow();
      expect(() => nativeSpeech.addListener(() => {}).remove()).not.toThrow();
      if (mocks.native?.configureSpokenCompletions) {
        expect(mocks.native.configureSpokenCompletions).not.toHaveBeenCalled();
      }
      if (mocks.native?.stopSpokenCompletions) {
        expect(mocks.native.stopSpokenCompletions).not.toHaveBeenCalled();
      }
    },
  );

  it("forwards default and selected settings, including Off, and explicit stop", async () => {
    const configure = vi.fn();
    const stop = vi.fn();
    mocks.native = { configureSpokenCompletions: configure, stopSpokenCompletions: stop };
    const { nativeSpeech } = await import("./native");
    expect(nativeSpeech.available).toBe(true);
    expect(mocks.requireModule).toHaveBeenCalledWith("T3AgentNotifications");
    nativeSpeech.configure({ enabled: true });
    expect(configure).toHaveBeenLastCalledWith(true, 1, 1, 1, null);
    nativeSpeech.configure({
      enabled: true,
      volume: 0.4,
      rate: 1.2,
      pitch: 0.8,
      voice: "voice-id",
    });
    expect(configure).toHaveBeenLastCalledWith(true, 0.4, 1.2, 0.8, "voice-id");
    nativeSpeech.configure({ enabled: false });
    expect(configure).toHaveBeenLastCalledWith(false, 1, 1, 1, null);
    nativeSpeech.stop();
    expect(stop).toHaveBeenCalledOnce();
  });
});
