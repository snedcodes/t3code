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

class T3AgentNotificationsModule : Module() {
  private val cueLock = Any()
  private val cueHandler = Handler(Looper.getMainLooper())
  private var voiceCue: ToneGenerator? = null
  private val releaseVoiceCue = Runnable {
    synchronized(cueLock) {
      voiceCue?.release()
      voiceCue = null
    }
  }

  // The existing call owns focus/routing. A finite tone only mixes into its stream.
  private fun playVoiceCue(active: Boolean): Boolean = synchronized(cueLock) {
    cueHandler.removeCallbacks(releaseVoiceCue)
    voiceCue?.release()
    voiceCue = null
    try {
      // This gain does not change the user's call-stream volume.
      val tone = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 50)
      voiceCue = tone
      val duration = if (active) 300 else 180
      val started = tone.startTone(
        if (active) ToneGenerator.TONE_PROP_ACK else ToneGenerator.TONE_PROP_NACK,
        duration
      )
      if (started) {
        // startTone bounds playback; this callback only releases native resources.
        cueHandler.postDelayed(releaseVoiceCue, (duration + 50).toLong())
      } else {
        tone.release()
        voiceCue = null
      }
      started
    } catch (_: RuntimeException) {
      voiceCue?.release()
      voiceCue = null
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("T3AgentNotifications")
    Events("onSpokenCompletionStatus", "onDirectCompletionStatus")

    OnCreate {
      SpokenCompletionSpeech.observe { event -> sendEvent("onSpokenCompletionStatus", event) }
      DirectCompletionBackground.observe { event -> sendEvent("onDirectCompletionStatus", event) }
    }
    OnDestroy {
      cueHandler.removeCallbacks(releaseVoiceCue)
      releaseVoiceCue.run()
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
