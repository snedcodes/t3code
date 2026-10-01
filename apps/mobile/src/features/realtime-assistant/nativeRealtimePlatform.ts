// oxlint-disable unicorn/prefer-add-event-listener -- Fresh native peer/channel callback properties are owned exclusively by this adapter and cleared on teardown.
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import type {
  RealtimeVoicePlatform,
  VoiceDataChannel,
  VoicePeer,
  VoiceStream,
  VoiceTrack,
} from "./realtimeAssistantTransport";
import type { MediaStream, MediaStreamTrack } from "react-native-webrtc";

type WebRTC = typeof import("react-native-webrtc");
type InCallManager = (typeof import("react-native-incall-manager"))["default"];

// InCallManager routing/focus is process-global, including across sheet factories.
let audioQueue = Promise.resolve();
let audioOwner: symbol | null = null;

export function isAndroidRealtimePlatformAvailable(): boolean {
  return (
    Platform.OS === "android" &&
    typeof NativeModules.WebRTCModule?.peerConnectionInit === "function" &&
    typeof NativeModules.WebRTCModule?.getUserMedia === "function" &&
    typeof NativeModules.InCallManager?.start === "function" &&
    typeof NativeModules.InCallManager?.stop === "function" &&
    typeof NativeModules.InCallManager?.requestAudioFocusJS === "function" &&
    typeof NativeModules.InCallManager?.abandonAudioFocusJS === "function" &&
    typeof NativeModules.InCallManager?.setForceSpeakerphoneOn === "function"
  );
}

export type AndroidRealtimePlatform = RealtimeVoicePlatform & {
  /** false restores automatic handset/wired/headset selection. */
  setSpeakerphone(enabled: boolean): void;
};

/** Packages load on microphone start, never while probing an older native build. */
export function createAndroidRealtimePlatform(
  options: { onAudioFocusLost?: () => void } = {},
): AndroidRealtimePlatform {
  if (!isAndroidRealtimePlatformAvailable()) {
    throw new Error("Android voice requires a newer native build.");
  }
  type LoadedModules = { rtc: WebRTC; call: InCallManager };
  let modules: LoadedModules | null = null;
  let loading: Promise<LoadedModules> | null = null;
  let generation = 0;
  let audioOwned = false;
  let speakerphone = false;
  let assistantMuted = false;
  let remote: NativeStream | null = null;
  const owner = Symbol("realtime-audio-owner");
  let focusSubscription: ReturnType<typeof DeviceEventEmitter.addListener> | null = null;
  const peers = new Set<VoicePeer>();
  const localStreams = new Set<NativeStream>();
  const streams = new WeakMap<MediaStream, NativeStream>();

  const safely = <T>(action: () => T, message: string): T => {
    try {
      return action();
    } catch {
      throw new Error(message);
    }
  };
  const bestEffort = (action: () => void) => {
    try {
      action();
    } catch {
      /* Release remaining owned resources. */
    }
  };
  const enqueueAudio = (action: () => Promise<void> | void): Promise<void> => {
    const task = audioQueue.then(action, action);
    audioQueue = task.catch(() => {});
    return task;
  };
  async function load() {
    if (!loading) {
      loading = Promise.all([import("react-native-webrtc"), import("react-native-incall-manager")])
        .then(([rtc, call]) => {
          modules = { rtc, call: call.default };
          return modules;
        })
        .catch(() => {
          loading = null;
          throw new Error("Android voice native packages are unavailable. Rebuild the app.");
        });
    }
    return loading;
  }
  function route() {
    const call = modules?.call;
    if (!call || !audioOwned) return;
    // 4.3.0 JS accepts null (native flag 0 = automatic); its .d.ts says boolean.
    const forceSpeaker = call.setForceSpeakerphoneOn as (flag: boolean | null) => void;
    safely(
      () => forceSpeaker.call(call, speakerphone ? true : null),
      "Unable to change voice audio route.",
    );
  }
  function releaseAudio(): Promise<void> {
    return enqueueAudio(async () => {
      if (!audioOwned || !modules || audioOwner !== owner) return;
      audioOwned = false;
      try {
        await modules.call.abandonAudioFocus();
      } catch {
        /* stop still restores the call route. */
      } finally {
        bestEffort(() => modules?.call.stop());
        audioOwner = null;
      }
    });
  }

  class NativeTrack implements VoiceTrack {
    stopped = false;
    constructor(
      readonly raw: MediaStreamTrack,
      private readonly owner: NativeStream,
    ) {}
    get enabled() {
      return this.raw.enabled;
    }
    set enabled(value: boolean) {
      safely(() => {
        this.raw.enabled = value;
      }, "Unable to change voice track mute.");
    }
    stop() {
      if (this.stopped) return;
      this.stopped = true;
      let failed = false;
      try {
        this.raw.stop();
      } catch {
        failed = true;
      }
      // Upstream stop() only disables. Local release() disposes capture/listeners.
      if (this.owner.local) {
        try {
          this.owner.raw.removeTrack(this.raw);
        } catch {
          failed = true;
        }
        try {
          this.raw.release();
        } catch {
          failed = true;
        }
      }
      this.owner.trackStopped();
      if (failed) throw new Error("Unable to release voice audio track.");
    }
  }
  class NativeStream implements VoiceStream {
    private readonly tracks: NativeTrack[];
    private released = false;
    constructor(
      readonly raw: MediaStream,
      readonly local: boolean,
      private readonly ownsContainer: boolean,
    ) {
      this.tracks = raw.getTracks().map((track) => new NativeTrack(track, this));
      if (local) localStreams.add(this);
    }
    getTracks() {
      return [...this.tracks];
    }
    getAudioTracks() {
      return this.tracks.filter((track) => track.raw.kind === "audio");
    }
    trackStopped() {
      if (this.released || !this.tracks.every((track) => track.stopped)) return;
      this.released = true;
      localStreams.delete(this);
      if (this.ownsContainer) {
        safely(() => this.raw.release(false), "Unable to release voice stream.");
      }
    }
    release() {
      this.tracks.forEach((track) => bestEffort(() => track.stop()));
      this.trackStopped();
    }
  }
  function wrapStream(raw: MediaStream, local = false, ownsContainer = local): NativeStream {
    const existing = streams.get(raw);
    if (existing) return existing;
    const stream = new NativeStream(raw, local, ownsContainer);
    streams.set(raw, stream);
    return stream;
  }

  function wrapPeer(raw: InstanceType<WebRTC["RTCPeerConnection"]>): VoicePeer {
    let closed = false;
    const channels = new Set<VoiceDataChannel>();
    const peer: VoicePeer = {
      get connectionState() {
        return closed ? "closed" : raw.connectionState;
      },
      ontrack: null,
      onconnectionstatechange: null,
      addTrack(track, stream) {
        if (!(track instanceof NativeTrack) || !(stream instanceof NativeStream)) {
          throw new Error("Voice media belongs to another platform.");
        }
        return safely(
          () => raw.addTrack(track.raw, stream.raw),
          "Unable to attach voice microphone.",
        );
      },
      createDataChannel(label) {
        const native = safely(
          () => raw.createDataChannel(label),
          "Unable to open voice event channel.",
        );
        let detached = false;
        const channel: VoiceDataChannel = {
          get readyState() {
            return detached ? "closed" : native.readyState;
          },
          onmessage: null,
          onclose: null,
          onerror: null,
          send(data) {
            safely(() => native.send(data), "Unable to send voice event.");
          },
          close() {
            if (detached) return;
            detached = true;
            native.onmessage = null;
            native.onclose = null;
            native.onerror = null;
            channel.onmessage = null;
            channel.onclose = null;
            channel.onerror = null;
            channels.delete(channel);
            safely(() => native.close(), "Unable to close voice event channel.");
          },
        };
        const onMessage = (event: unknown) => {
          if (
            !detached &&
            !closed &&
            typeof event === "object" &&
            event !== null &&
            "data" in event
          ) {
            channel.onmessage?.({ data: event.data });
          }
        };
        const onClose = () => {
          if (!detached && !closed) channel.onclose?.();
        };
        const onError = () => {
          if (!detached && !closed) channel.onerror?.();
        };
        native.onmessage = onMessage;
        native.onclose = onClose;
        native.onerror = onError;
        channels.add(channel);
        return channel;
      },
      async createOffer() {
        try {
          // Published createOffer returns any; narrow the actual SDP payload here.
          const offer: unknown = await raw.createOffer();
          if (
            typeof offer !== "object" ||
            offer === null ||
            !("type" in offer) ||
            offer.type !== "offer" ||
            !("sdp" in offer) ||
            typeof offer.sdp !== "string"
          ) {
            throw new Error();
          }
          return { type: "offer", sdp: offer.sdp };
        } catch {
          throw new Error("Unable to create voice SDP offer.");
        }
      },
      async setLocalDescription(description) {
        try {
          await raw.setLocalDescription(description);
        } catch {
          throw new Error("Unable to set local voice description.");
        }
      },
      async setRemoteDescription(description) {
        try {
          await raw.setRemoteDescription(description);
        } catch {
          throw new Error("Unable to set remote voice description.");
        }
      },
      close() {
        if (closed) return;
        closed = true;
        raw.ontrack = null;
        raw.onconnectionstatechange = null;
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        channels.forEach((channel) => bestEffort(() => channel.close()));
        peers.delete(peer);
        safely(() => raw.close(), "Unable to close voice peer.");
      },
    };
    const onTrack = (event: unknown) => {
      if (closed || !modules || typeof event !== "object" || event === null) return;
      const rtc = modules.rtc;
      const nativeStreams =
        "streams" in event && Array.isArray(event.streams)
          ? event.streams.filter(
              (stream): stream is MediaStream => stream instanceof rtc.MediaStream,
            )
          : [];
      if (nativeStreams.length) {
        peer.ontrack?.({ streams: nativeStreams.map((stream) => wrapStream(stream)) });
      } else if ("track" in event && event.track instanceof rtc.MediaStreamTrack) {
        // Native streamless receiver tracks still play; own only the new container.
        const container = new rtc.MediaStream([event.track]);
        peer.ontrack?.({ streams: [wrapStream(container, false, true)] });
      }
    };
    const onConnection = () => {
      if (!closed) peer.onconnectionstatechange?.();
    };
    raw.ontrack = onTrack;
    raw.onconnectionstatechange = onConnection;
    peers.add(peer);
    return peer;
  }

  function releaseOwnedMedia() {
    ++generation;
    focusSubscription?.remove();
    focusSubscription = null;
    peers.forEach((peer) => bestEffort(() => peer.close()));
    localStreams.forEach((stream) => bestEffort(() => stream.release()));
    if (remote) bestEffort(() => remote?.release());
    remote = null;
    // Route/focus release follows track/container release, including late capture.
    void releaseAudio();
  }
  function observeFocus(ticket: number) {
    focusSubscription?.remove();
    focusSubscription = DeviceEventEmitter.addListener("onAudioFocusChange", (event: unknown) => {
      if (!audioOwned || ticket !== generation || typeof event !== "object" || event === null)
        return;
      const code = "eventCode" in event ? event.eventCode : null;
      if (code === -1 || code === -2 || code === -3) {
        releaseOwnedMedia();
        bestEffort(() => options.onAudioFocusLost?.());
      }
    });
  }

  return {
    createPeerConnection() {
      if (!modules) throw new Error("Start the voice microphone before creating a peer.");
      return wrapPeer(
        safely(() => new modules!.rtc.RTCPeerConnection(), "Unable to create voice peer."),
      );
    },
    async getUserMedia() {
      const ticket = ++generation;
      let stream: NativeStream | null = null;
      try {
        const loaded = await load();
        if (ticket !== generation) throw new Error();
        await enqueueAudio(async () => {
          if (ticket !== generation) throw new Error();
          if (audioOwner !== null && audioOwner !== owner) throw new Error();
          audioOwner = owner;
          audioOwned = true;
          observeFocus(ticket);
          loaded.call.start({ media: "audio", auto: true });
          const result: unknown = await loaded.call.requestAudioFocus();
          if (result !== "AUDIOFOCUS_REQUEST_GRANTED" || ticket !== generation) throw new Error();
          route();
        });
        if (ticket !== generation) throw new Error();
        const raw = await loaded.rtc.mediaDevices.getUserMedia({ audio: true, video: false });
        stream = wrapStream(raw, true);
        if (ticket !== generation) throw new Error();
        return stream;
      } catch {
        if (stream) bestEffort(() => stream?.release());
        if (ticket === generation) releaseOwnedMedia();
        throw new Error(
          "Could not acquire voice microphone and audio focus. Check microphone permission.",
        );
      }
    },
    async fetch(url, init) {
      try {
        return await globalThis.fetch(url, init);
      } catch {
        throw new Error("Unable to exchange voice SDP.");
      }
    },
    playback: {
      setRemoteStream(stream) {
        if (stream === null) {
          releaseOwnedMedia();
          return;
        }
        if (!(stream instanceof NativeStream))
          throw new Error("Voice playback belongs to another platform.");
        remote = stream;
        // Remote WebRTC audio plays natively without a video RTCView.
        remote.getAudioTracks().forEach((track) => {
          track.enabled = !assistantMuted;
        });
      },
      setMuted(muted) {
        assistantMuted = muted;
        remote?.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      },
      clear() {
        // 124.0.8 exposes no native playout-buffer flush. The transport sends
        // output_audio_buffer.clear; Android may retain a short native audio tail.
      },
    },
    setSpeakerphone(enabled) {
      speakerphone = enabled;
      route();
    },
  };
}
