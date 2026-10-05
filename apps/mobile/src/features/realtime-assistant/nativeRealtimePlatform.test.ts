// oxlint-disable unicorn/prefer-add-event-listener -- Test the adapter's exclusively owned native callback properties.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeVM from "node:vm";
import { describe, expect, it, vi } from "vite-plus/test";
import type { AndroidRealtimePlatform } from "./nativeRealtimePlatform";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function fixture() {
  const operations: string[] = [];
  const focusListeners = new Set<(event: unknown) => void>();
  const stopped = deferred<void>();
  const captureRequested = deferred<void>();
  class Track {
    enabled = true;
    kind = "audio";
    constructor(readonly remote = false) {}
    stop = vi.fn(() => {
      this.enabled = false;
      operations.push("track-stop");
    });
    release = vi.fn(() => {
      operations.push("track-release");
    });
  }
  class Stream {
    constructor(private tracks: Track[]) {}
    getTracks() {
      return [...this.tracks];
    }
    getAudioTracks() {
      return this.getTracks();
    }
    removeTrack = vi.fn((track: Track) => {
      this.tracks = this.tracks.filter((item) => item !== track);
    });
    release = vi.fn((_releaseTracks: boolean) => {
      operations.push("stream-release");
    });
  }
  class Channel {
    readyState = "open";
    onmessage: ((event: unknown) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    send = vi.fn();
    close = vi.fn();
  }
  const channels: Channel[] = [];
  const peers: Peer[] = [];
  class Peer {
    connectionState = "new";
    ontrack: ((event: unknown) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    constructor() {
      peers.push(this);
    }
    addTrack = vi.fn();
    createDataChannel = vi.fn(() => {
      const channel = new Channel();
      channels.push(channel);
      return channel;
    });
    createOffer = vi.fn(async () => ({ type: "offer", sdp: "native-offer" }));
    setLocalDescription = vi.fn(async () => {});
    setRemoteDescription = vi.fn(async () => {});
    close = vi.fn(() => {
      operations.push("peer-close");
    });
  }
  const localTrack = new Track();
  const local = new Stream([localTrack]);
  const mediaDevices = {
    getUserMedia: vi.fn(async (_constraints: { audio: true; video: false }) => {
      operations.push("capture");
      captureRequested.resolve();
      return local;
    }),
  };
  const call = {
    start: vi.fn(() => {
      operations.push("audio-start");
    }),
    requestAudioFocus: vi.fn(async () => {
      operations.push("focus-granted");
      return "AUDIOFOCUS_REQUEST_GRANTED";
    }),
    abandonAudioFocus: vi.fn(async () => {
      operations.push("focus-release");
    }),
    stop: vi.fn(() => {
      operations.push("audio-stop");
      stopped.resolve();
    }),
    setForceSpeakerphoneOn: vi.fn(),
  };
  const nativeModules = {
    WebRTCModule: { peerConnectionInit: vi.fn(), getUserMedia: vi.fn() },
    InCallManager: {
      start: vi.fn(),
      stop: vi.fn(),
      requestAudioFocusJS: vi.fn(),
      abandonAudioFocusJS: vi.fn(),
      setForceSpeakerphoneOn: vi.fn(),
    },
  };
  const permissions = {
    PERMISSIONS: { BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT" },
    RESULTS: { GRANTED: "granted" },
    check: vi.fn(async (_permission: string) => false),
    request: vi.fn(async (_permission: string) => {
      operations.push("bluetooth-permission");
      return "granted";
    }),
  };
  const rn = {
    Platform: { OS: "android", Version: 30 },
    PermissionsAndroid: permissions,
    NativeModules: nativeModules,
    DeviceEventEmitter: {
      addListener: vi.fn((name: string, listener: (event: unknown) => void) => {
        expect(name).toBe("onAudioFocusChange");
        focusListeners.add(listener);
        return {
          remove() {
            focusListeners.delete(listener);
          },
        };
      }),
    },
  };
  const loadRTC = vi.fn(async () => ({
    RTCPeerConnection: Peer,
    MediaStream: Stream,
    MediaStreamTrack: Track,
    mediaDevices,
  }));
  const loadCall = vi.fn(async () => ({ default: call }));
  // Run the actual adapter while replacing only native import boundaries. No native
  // package is installed or loaded; published declarations are checked separately.
  const source = NodeFS.readFileSync(
    new URL("./nativeRealtimePlatform.ts", import.meta.url),
    "utf8",
  );
  const js = NodeModule.stripTypeScriptTypes(source, { mode: "transform" })
    .replace(
      /^import .* from "react-native";/m,
      "const { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } = rn;",
    )
    .replaceAll('import("react-native-webrtc")', "loadRTC()")
    .replaceAll('import("react-native-incall-manager")', "loadCall()")
    .replaceAll("export function ", "function ");
  const sandbox = {
    rn,
    loadRTC,
    loadCall,
    fetch: vi.fn(),
    factory: undefined,
    available: undefined,
  };
  NodeVM.runInNewContext(
    js +
      "\nglobalThis.factory = createAndroidRealtimePlatform; globalThis.available = isAndroidRealtimePlatformAvailable;",
    sandbox,
  );
  const factory = sandbox.factory as unknown as (options?: {
    onAudioFocusLost?: () => void;
    onBluetoothPermissionDenied?: () => void;
  }) => AndroidRealtimePlatform;
  const available = sandbox.available as unknown as () => boolean;
  const focus = (eventCode: number) =>
    focusListeners.forEach((listener) => listener({ eventCode, eventText: "from-native" }));
  return {
    factory,
    available,
    rn,
    permissions,
    operations,
    focusListeners,
    focus,
    loadRTC,
    loadCall,
    call,
    mediaDevices,
    local,
    localTrack,
    Track,
    Stream,
    peers,
    channels,
    stopped,
    captureRequested,
  };
}

describe("Android native realtime platform", () => {
  it("requests Bluetooth before routing, retains automatic fallback and cancels pending permission safely", async () => {
    const f = fixture();
    f.rn.Platform.Version = 31;
    const platform = f.factory();
    await platform.getUserMedia({ audio: true });
    expect(f.permissions.request).toHaveBeenCalledWith("android.permission.BLUETOOTH_CONNECT");
    expect(f.operations.indexOf("bluetooth-permission")).toBeLessThan(f.operations.indexOf("audio-start"));
    expect(f.call.start).toHaveBeenCalledWith({ media: "audio", auto: true });
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(null);
    platform.setSpeakerphone(true);
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(true);
    platform.setSpeakerphone(false);
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(null);
    platform.playback.setRemoteStream(null);
    await f.stopped.promise;
    expect(f.localTrack.release).toHaveBeenCalledOnce();
    expect(f.call.stop).toHaveBeenCalledOnce();

    const denied = fixture();
    denied.rn.Platform.Version = 31;
    denied.permissions.request.mockResolvedValueOnce("denied");
    const warning = vi.fn();
    const fallback = denied.factory({ onBluetoothPermissionDenied: warning });
    await fallback.getUserMedia({ audio: true });
    expect(warning).toHaveBeenCalledOnce();
    expect(denied.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(null);
    fallback.playback.setRemoteStream(null);
    await denied.stopped.promise;

    const cancelled = fixture();
    cancelled.rn.Platform.Version = 31;
    const permission = deferred<string>();
    const requested = deferred<void>();
    cancelled.permissions.request.mockImplementationOnce(() => {
      requested.resolve();
      return permission.promise;
    });
    const pending = cancelled.factory();
    const capture = pending.getUserMedia({ audio: true });
    const rejected = expect(capture).rejects.toThrow("Could not acquire");
    await requested.promise;
    pending.playback.setRemoteStream(null);
    permission.resolve("granted");
    await rejected;
    expect(cancelled.call.start).not.toHaveBeenCalled();
    expect(cancelled.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(cancelled.focusListeners.size).toBe(0);

    const checking = fixture();
    checking.rn.Platform.Version = 31;
    const checked = deferred<boolean>();
    const checkStarted = deferred<void>();
    checking.permissions.check.mockImplementationOnce(() => {
      checkStarted.resolve();
      return checked.promise;
    });
    const cancelledBeforePrompt = checking.factory();
    const checkingCapture = cancelledBeforePrompt.getUserMedia({ audio: true });
    const checkingRejected = expect(checkingCapture).rejects.toThrow("Could not acquire");
    await checkStarted.promise;
    cancelledBeforePrompt.playback.setRemoteStream(null);
    checked.resolve(false);
    await checkingRejected;
    expect(checking.permissions.request).not.toHaveBeenCalled();
    expect(checking.call.start).not.toHaveBeenCalled();
    expect(checking.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("probes older/non-Android builds without loading native packages", () => {
    const f = fixture();
    expect(f.available()).toBe(true);
    f.rn.Platform.OS = "ios";
    expect(f.available()).toBe(false);
    expect(() => f.factory()).toThrow("newer native build");
    f.rn.Platform.OS = "android";
    Reflect.deleteProperty(f.rn.NativeModules, "WebRTCModule");
    expect(f.available()).toBe(false);
    expect(() => f.factory()).toThrow("newer native build");
    expect(f.loadRTC).not.toHaveBeenCalled();
    expect(f.loadCall).not.toHaveBeenCalled();
  });

  it("acquires focus before capture, wraps actual media/events and releases before routing", async () => {
    const f = fixture();
    const platform = f.factory();
    expect(f.loadRTC).not.toHaveBeenCalled();
    const stream = await platform.getUserMedia({ audio: true });
    expect(f.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(f.operations.slice(0, 3)).toEqual(["audio-start", "focus-granted", "capture"]);
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(null);
    const peer = platform.createPeerConnection();
    const track = stream.getAudioTracks()[0]!;
    track.enabled = false;
    expect(f.localTrack.enabled).toBe(false);
    track.enabled = true;
    peer.addTrack(track, stream);
    expect(f.peers[0]!.addTrack).toHaveBeenCalledWith(f.localTrack, f.local);
    expect(await peer.createOffer()).toEqual({ type: "offer", sdp: "native-offer" });
    await peer.setLocalDescription({ type: "offer", sdp: "offer" });
    await peer.setRemoteDescription({ type: "answer", sdp: "answer" });
    const channel = peer.createDataChannel("oai-events");
    const onMessage = vi.fn();
    channel.onmessage = onMessage;
    f.channels[0]!.onmessage?.({ data: "event" });
    expect(onMessage).toHaveBeenCalledWith({ data: "event" });
    channel.send("outbound");
    expect(f.channels[0]!.send).toHaveBeenCalledWith("outbound");
    const remoteTrack = new f.Track(true);
    const nativeRemote = new f.Stream([remoteTrack]);
    let received = false;
    peer.ontrack = (event) => {
      received = true;
      platform.playback.setRemoteStream(event.streams[0]!);
    };
    f.peers[0]!.ontrack?.({ streams: [nativeRemote] });
    expect(received).toBe(true);
    platform.playback.setMuted(true);
    expect(remoteTrack.enabled).toBe(false);
    platform.playback.setMuted(false);
    expect(remoteTrack.enabled).toBe(true);
    const beforeClear = f.operations.length;
    platform.playback.clear();
    expect(f.operations).toHaveLength(beforeClear);
    expect(remoteTrack.enabled).toBe(true); // No fake local-buffer flush or toggle.
    platform.setSpeakerphone(true);
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(true);
    platform.setSpeakerphone(false);
    expect(f.call.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(null);
    const stale = f.channels[0]!.onmessage!;
    peer.close();
    track.stop();
    track.stop();
    platform.playback.setRemoteStream(null);
    await f.stopped.promise;
    expect(f.localTrack.release).toHaveBeenCalledOnce();
    expect(f.local.release).toHaveBeenCalledWith(false);
    expect(f.operations.indexOf("stream-release")).toBeLessThan(
      f.operations.indexOf("focus-release"),
    );
    expect(f.peers[0]!.ontrack).toBeNull();
    expect(f.channels[0]!.onmessage).toBeNull();
    expect(f.focusListeners.size).toBe(0);
    stale({ data: "late" });
    expect(onMessage).toHaveBeenCalledOnce();
  });

  it.each([-1, -2, -3])(
    "cleans late capture and notifies on native focus loss %s",
    async (code) => {
      const f = fixture();
      const capture = deferred<typeof f.local>();
      f.mediaDevices.getUserMedia.mockImplementationOnce(() => {
        f.captureRequested.resolve();
        return capture.promise;
      });
      const onLost = vi.fn();
      const platform = f.factory({ onAudioFocusLost: onLost });
      const acquisition = platform.getUserMedia({ audio: true });
      const rejected = expect(acquisition).rejects.toThrow("Could not acquire");
      await f.captureRequested.promise;
      f.focus(code);
      expect(onLost).toHaveBeenCalledOnce();
      expect(f.focusListeners.size).toBe(0);
      await f.stopped.promise;
      capture.resolve(f.local);
      await rejected;
      expect(f.localTrack.release).toHaveBeenCalledOnce();
      expect(f.local.release).toHaveBeenCalledWith(false);
    },
  );

  it("stops late capture after transport cleanup during permissions", async () => {
    const f = fixture();
    const capture = deferred<typeof f.local>();
    f.mediaDevices.getUserMedia.mockImplementationOnce(() => {
      f.captureRequested.resolve();
      return capture.promise;
    });
    const platform = f.factory();
    const acquisition = platform.getUserMedia({ audio: true });
    const rejected = expect(acquisition).rejects.toThrow("Could not acquire");
    await f.captureRequested.promise;
    platform.playback.setRemoteStream(null);
    await f.stopped.promise;
    capture.resolve(f.local);
    await rejected;
    expect(f.localTrack.release).toHaveBeenCalledOnce();
  });

  it("serializes global route release before another factory starts", async () => {
    const f = fixture();
    const first = f.factory();
    const second = f.factory();
    await first.getUserMedia({ audio: true });
    await expect(second.getUserMedia({ audio: true })).rejects.toThrow("Could not acquire");
    expect(f.call.stop).not.toHaveBeenCalled();
    const abandoned = deferred<void>();
    const releaseEntered = deferred<void>();
    f.call.abandonAudioFocus.mockImplementationOnce(() => {
      releaseEntered.resolve();
      return abandoned.promise;
    });
    first.playback.setRemoteStream(null);
    await releaseEntered.promise;
    const next = second.getUserMedia({ audio: true });
    expect(f.call.start).toHaveBeenCalledOnce();
    abandoned.resolve();
    await next;
    expect(f.operations.indexOf("audio-stop")).toBeLessThan(
      f.operations.lastIndexOf("audio-start"),
    );
    first.playback.setRemoteStream(null);
    second.playback.setRemoteStream(null);
    // Await the queued second release before asserting stale first release did nothing.
    const third = f.factory();
    await third.getUserMedia({ audio: true });
    expect(f.call.stop).toHaveBeenCalledTimes(2);
    third.playback.setRemoteStream(null);
  });

  it.each(["permission", "focus"])(
    "sanitizes %s denial and balances the audio lease",
    async (failure) => {
      const f = fixture();
      if (failure === "permission")
        f.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error("private-native-detail"));
      else f.call.requestAudioFocus.mockResolvedValueOnce("AUDIOFOCUS_REQUEST_FAILED");
      const platform = f.factory();
      await expect(platform.getUserMedia({ audio: true })).rejects.toThrow(
        "Could not acquire voice microphone and audio focus.",
      );
      await f.stopped.promise;
      expect(f.focusListeners.size).toBe(0);
      expect(f.call.abandonAudioFocus).toHaveBeenCalledOnce();
      expect(f.call.stop).toHaveBeenCalledOnce();
      if (failure === "focus") expect(f.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    },
  );
});
