package expo.modules.t3agentnotifications

import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class T3AgentNotificationsModule : Module() {
  private val cueLock = Any()
  private val cueHandler = Handler(Looper.getMainLooper())
  private var voiceCue: ToneGenerator? = null
  private var endCuePlaying = false
  private val cueWaiters = mutableListOf<Promise>()
  private var releaseVoiceCue: Runnable? = null

  private fun releaseVoiceCueLocked() {
    releaseVoiceCue?.let { cueHandler.removeCallbacks(it) }
    releaseVoiceCue = null
    val tone = voiceCue
    voiceCue = null
    endCuePlaying = false
    try {
      tone?.release()
    } catch (_: RuntimeException) {
      // Failed feedback must not prevent the call's focus/routing release.
    } finally {
      val waiters = cueWaiters.toList()
      cueWaiters.clear()
      waiters.forEach { it.resolve(true) }
    }
  }

  // The existing call owns focus/routing. A finite tone only mixes into its stream.
  private fun playVoiceCue(active: Boolean): Boolean = synchronized(cueLock) {
    releaseVoiceCueLocked()
    try {
      // This gain does not change the user's call-stream volume.
      val tone = ToneGenerator(AudioManager.STREAM_VOICE_CALL, if (active) 50 else 65)
      voiceCue = tone
      val duration = if (active) 300 else 450
      val started = tone.startTone(
        if (active) ToneGenerator.TONE_PROP_ACK else ToneGenerator.TONE_PROP_NACK,
        duration
      )
      if (started) {
        endCuePlaying = !active
        // startTone bounds playback; this callback only releases native resources.
        val release = Runnable {
          synchronized(cueLock) {
            if (voiceCue === tone) releaseVoiceCueLocked()
          }
        }
        releaseVoiceCue = release
        if (!cueHandler.postDelayed(release, (duration + 50).toLong())) {
          releaseVoiceCueLocked()
          return@synchronized false
        }
      } else {
        releaseVoiceCueLocked()
      }
      started
    } catch (_: RuntimeException) {
      releaseVoiceCueLocked()
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("T3AgentNotifications")
    Events("onSpokenCompletionStatus", "onDirectCompletionStatus", "onRealtimeCallControl")

    OnCreate {
      RealtimeCallService.observe { owner, reason ->
        sendEvent("onRealtimeCallControl", mapOf("ownerId" to owner, "reason" to reason))
      }
      SpokenCompletionSpeech.observe { event -> sendEvent("onSpokenCompletionStatus", event) }
      DirectCompletionBackground.observe { event -> sendEvent("onDirectCompletionStatus", event) }
    }
    OnDestroy {
      appContext.reactContext?.let { RealtimeCallService.releaseCurrent(it) }
      RealtimeCallService.observe(null)
      synchronized(cueLock) { releaseVoiceCueLocked() }
      SpokenCompletionSpeech.observe(null)
      DirectCompletionBackground.observe(null)
    }

    Function("configureDirectCompletions") { enabled: Boolean, scheme: String, connections: String ->
      appContext.reactContext?.let { DirectCompletionBackground.configure(it, enabled, scheme, connections) }
    }
    Function("getDirectCompletionStatus") {
      appContext.reactContext?.let { DirectCompletionBackground.status(it) }
    }

    Function("configureSpokenCompletions") {
        enabled: Boolean, volume: Double, rate: Double, pitch: Double, voice: String? ->
      appContext.reactContext?.let {
        SpokenCompletionSpeech.configure(it, enabled, volume, rate, pitch, voice)
      }
    }
    Function("stopSpokenCompletions") { SpokenCompletionSpeech.stop() }
    Function("playRealtimeVoiceCue") { active: Boolean -> playVoiceCue(active) }
    AsyncFunction("waitForRealtimeVoiceCue") { promise: Promise ->
      synchronized(cueLock) {
        if (endCuePlaying && voiceCue != null) cueWaiters.add(promise)
        else promise.resolve(true)
      }
    }
    AsyncFunction("startRealtimeCall") { ownerId: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) promise.resolve(false)
      else RealtimeCallService.acquire(context, ownerId) { started -> promise.resolve(started) }
    }
    Function("stopRealtimeCall") { ownerId: String ->
      appContext.reactContext?.let { RealtimeCallService.release(it, ownerId) }
    }
    Function("isRealtimeCallActive") { ownerId: String ->
      appContext.reactContext?.let { RealtimeCallService.isActive(it, ownerId) } ?: false
    }

    Function("configure") {
        deviceId: String,
        userId: String,
        scheme: String,
        ongoingEnabled: Boolean
      ->
      appContext.reactContext?.let {
        AgentNotifications.configure(it, deviceId, userId, scheme, ongoingEnabled)
      }
    }

    Function("clear") {
      appContext.reactContext?.let { AgentNotifications.clear(it) }
    }

    Function("openLiveUpdateSettings") {
      val context = appContext.reactContext
      if (context == null || Build.VERSION.SDK_INT < 36) {
        false
      } else {
        try {
          context.startActivity(
            Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS)
              .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
          true
        } catch (_: ActivityNotFoundException) {
          false
        }
      }
    }
  }
}
