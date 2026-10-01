package expo.modules.t3agentnotifications

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.UUID

/** Process-wide speech owner, usable by FCM without a React/Expo runtime. */
object SpokenCompletionSpeech {
  private const val STORE = "t3-spoken-completions"
  private const val INIT_TIMEOUT_MS = 10_000L
  private const val SPEECH_TIMEOUT_MS = 120_000L
  private val main = Handler(Looper.getMainLooper())
  private var engine: TextToSpeech? = null
  private var ready = false
  private var generation = 0L
  private var active: Request? = null
  private var pending: Request? = null
  private var service: SpokenCompletionSpeechService? = null
  private var manager: AudioManager? = null
  private var focus: AudioFocusRequest? = null
  private var focusListener: AudioManager.OnAudioFocusChangeListener? = null
  private var hasFocus = false
  private var deadline: Runnable? = null
  private var observer: ((Map<String, Any>) -> Unit)? = null
  private val attributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

  private data class SpeechSettings(
    val enabled: Boolean,
    val volume: Float,
    val rate: Float,
    val pitch: Float,
    val voice: String?
  )
  private data class Request(
    val identity: String,
    val text: String,
    val settings: SpeechSettings,
    val utteranceId: String = UUID.randomUUID().toString()
  )

  fun configure(
    context: Context,
    enabled: Boolean,
    volume: Double,
    rate: Double,
    pitch: Double,
    voice: String?
  ) {
    require(volume.isFinite() && volume in 0.0..1.0) { "Volume must be between 0 and 1" }
    require(rate.isFinite() && rate > 0 && rate.toFloat().isFinite() && rate.toFloat() > 0) { "Invalid speech rate" }
    require(pitch.isFinite() && pitch > 0 && pitch.toFloat().isFinite() && pitch.toFloat() > 0) { "Invalid speech pitch" }
    val app = context.applicationContext
    main.post {
      val prefs = app.getSharedPreferences(STORE, Context.MODE_PRIVATE)
      val selectedVoice = voice?.takeIf { it.isNotBlank() }
      val changed = prefs.getBoolean("enabled", false) != enabled ||
        prefs.getFloat("volume", 1f) != volume.toFloat() ||
        prefs.getFloat("rate", 1f) != rate.toFloat() ||
        prefs.getFloat("pitch", 1f) != pitch.toFloat() ||
        prefs.getString("voice", null) != selectedVoice
      prefs.edit()
        .putBoolean("enabled", enabled)
        .putFloat("volume", volume.toFloat())
        .putFloat("rate", rate.toFloat())
        .putFloat("pitch", pitch.toFloat())
        .putString("voice", selectedVoice)
        .apply()
      // Re-syncing identical preferences must not interrupt a running cue.
      if (!enabled || changed) stopAll()
    }
  }

  fun speak(context: Context, text: String, identity: String, highPriority: Boolean = true) {
    val app = context.applicationContext
    main.post {
      val prefs = app.getSharedPreferences(STORE, Context.MODE_PRIVATE)
      val settings = SpeechSettings(
        prefs.getBoolean("enabled", false),
        prefs.getFloat("volume", 1f),
        prefs.getFloat("rate", 1f),
        prefs.getFloat("pitch", 1f),
        prefs.getString("voice", null)
      )
      if (!settings.enabled) {
        stopAll()
        return@post
      }
      val request = Request(identity, text.trim(), settings)
      val process = ActivityManager.RunningAppProcessInfo()
      ActivityManager.getMyMemoryState(process)
      if (!highPriority && process.importance > ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
        emit(request, "error", "background-start-not-eligible")
        return@post
      }
      pending?.let { emit(it, "stopped") }
      pending = request
      try {
        ContextCompat.startForegroundService(app, Intent(app, SpokenCompletionSpeechService::class.java))
      } catch (_: RuntimeException) {
        // FCM priority can be downgraded and Android may deny a background start.
        pending = null
        emit(request, "error", "foreground-service-start-denied")
      }
    }
  }

  fun stop() { main.post { stopAll() } }

  // Called only after the service has successfully entered the foreground.
  internal fun serviceStarted(owner: SpokenCompletionSpeechService) {
    service = owner
    val request = pending
    pending = null
    if (request == null) {
      if (active == null) owner.finishSpeech()
      return
    }
    stopCurrent()
    active = request
    when {
      request.text.isEmpty() -> finish(request, "error", "empty-text")
      request.text.length > TextToSpeech.getMaxSpeechInputLength() ->
        finish(request, "error", "text-too-long")
      ready -> speakReady(request)
      engine == null -> initialize(owner.applicationContext)
    }
  }

  internal fun serviceStartFailed() {
    pending?.let { emit(it, "error", "foreground-service-promotion-denied") }
    pending = null
    stopAll()
  }

  internal fun serviceDestroyed(owner: SpokenCompletionSpeechService) {
    if (service !== owner) return
    service = null
    stopCurrent()
    shutdownEngine()
  }

  private fun stopAll() {
    pending?.let { emit(it, "stopped") }
    pending = null
    stopCurrent()
    shutdownEngine()
    service?.finishSpeech()
  }

  // Expo observes real callbacks when present; FCM speech does not depend on it.
  fun observe(listener: ((Map<String, Any>) -> Unit)?) {
    main.post { observer = listener }
  }

  private fun initialize(context: Context) {
    manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    val token = ++generation
    setDeadline(INIT_TIMEOUT_MS) {
      if (generation == token) active?.let { finish(it, "error", "initialization-timeout") }
    }
    try {
      engine = TextToSpeech(context) { status ->
        main.post {
          if (generation == token) {
            clearDeadline()
            if (status != TextToSpeech.SUCCESS) {
              active?.let { finish(it, "error", "initialization-failed") }
            } else {
              val tts = engine
              if (tts != null) {
                try {
                  tts.setAudioAttributes(attributes)
                  tts.setOnUtteranceProgressListener(progressListener())
                  ready = true
                  active?.let { speakReady(it) }
                } catch (_: RuntimeException) {
                  active?.let { finish(it, "error", "initialization-failed") }
                }
              }
            }
          }
        }
      }
    } catch (_: RuntimeException) {
      active?.let { finish(it, "error", "initialization-failed") }
    }
  }

  private fun speakReady(request: Request) {
    val tts = engine ?: return
    try {
      val language = tts.setLanguage(Locale.getDefault())
      val voiceName = request.settings.voice
      if (voiceName != null) {
        val voice = tts.voices?.firstOrNull { it.name == voiceName }
        if (voice == null || tts.setVoice(voice) == TextToSpeech.ERROR) {
          finish(request, "error", "voice-unavailable")
          return
        }
      } else if (language == TextToSpeech.LANG_MISSING_DATA ||
        language == TextToSpeech.LANG_NOT_SUPPORTED) {
        finish(request, "error", "language-unavailable")
        return
      }
      if (tts.setSpeechRate(request.settings.rate) == TextToSpeech.ERROR ||
        tts.setPitch(request.settings.pitch) == TextToSpeech.ERROR) {
        finish(request, "error", "settings-rejected")
        return
      }
      if (!requestFocus(request)) {
        finish(request, "error", "audio-focus-denied")
        return
      }
      val params = Bundle().apply {
        putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, request.settings.volume)
      }
      setDeadline(SPEECH_TIMEOUT_MS) {
        if (active === request) {
          stopEngineAudio()
          finish(request, "error", "speech-timeout")
        }
      }
      if (tts.speak(request.text, TextToSpeech.QUEUE_FLUSH, params,
          request.utteranceId) == TextToSpeech.ERROR) {
        finish(request, "error", "speak-rejected")
      }
    } catch (_: RuntimeException) {
      finish(request, "error", "engine-error")
    }
  }

  private fun progressListener() = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) {
      main.post {
        active?.takeIf { it.utteranceId == utteranceId }?.let { emit(it, "start") }
      }
    }
    override fun onDone(utteranceId: String?) = terminal(utteranceId, "done")
    @Deprecated("Android TTS legacy callback")
    override fun onError(utteranceId: String?) = terminal(utteranceId, "error", "tts-error")
    override fun onError(utteranceId: String?, errorCode: Int) =
      terminal(utteranceId, "error", "tts-error:$errorCode")
    override fun onStop(utteranceId: String?, interrupted: Boolean) =
      terminal(utteranceId, "stopped")
  }

  private fun terminal(utteranceId: String?, status: String, error: String? = null) {
    main.post {
      active?.takeIf { it.utteranceId == utteranceId }?.let { finish(it, status, error) }
    }
  }

  @Suppress("DEPRECATION")
  private fun requestFocus(request: Request): Boolean {
    val audioManager = manager ?: return false
    val listener = AudioManager.OnAudioFocusChangeListener { change ->
      main.post {
        if (active === request && (change == AudioManager.AUDIOFOCUS_LOSS ||
          change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
          change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)) {
          stopAll()
        }
      }
    }
    focusListener = listener
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attributes)
        .setWillPauseWhenDucked(true)
        .setOnAudioFocusChangeListener(listener, main)
        .build()
      focus = focusRequest
      audioManager.requestAudioFocus(focusRequest)
    } else {
      audioManager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
    }
    hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    return hasFocus
  }

  @Suppress("DEPRECATION")
  private fun releaseFocus() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focus?.let { manager?.abandonAudioFocusRequest(it) }
      } else if (hasFocus) {
        focusListener?.let { manager?.abandonAudioFocus(it) }
      }
    } catch (_: RuntimeException) {
      // The system service may be gone; local ownership still has to clear.
    } finally {
      focus = null
      focusListener = null
      hasFocus = false
    }
  }

  private fun stopEngineAudio() {
    try {
      engine?.stop()
    } catch (_: RuntimeException) {
      // A disconnected engine must not prevent focus and timeout cleanup.
    }
  }

  private fun stopCurrent() {
    val request = active
    active = null
    stopEngineAudio()
    releaseFocus()
    // Preserve the initialization deadline when replacing pending speech.
    if (ready) clearDeadline()
    if (request != null) emit(request, "stopped")
  }

  private fun finish(request: Request, status: String, error: String? = null) {
    if (active !== request) return
    active = null
    releaseFocus()
    shutdownEngine()
    emit(request, status, error)
    service?.finishSpeech()
  }

  private fun shutdownEngine() {
    ++generation
    clearDeadline()
    try {
      engine?.shutdown()
    } catch (_: RuntimeException) {
      // Cleanup remains complete even if the engine disconnected.
    } finally {
      engine = null
      ready = false
      manager = null
    }
  }

  private fun setDeadline(delay: Long, action: () -> Unit) {
    clearDeadline()
    deadline = Runnable { action() }.also { main.postDelayed(it, delay) }
  }

  private fun clearDeadline() {
    deadline?.let { main.removeCallbacks(it) }
    deadline = null
  }

  private fun emit(request: Request, status: String, error: String? = null) {
    // Locked-phone verification must not require JS or expose the spoken text.
    Log.i("T3SpokenCompletion", "identity=${request.identity} status=$status error=${error ?: "none"}")
    val event = mutableMapOf<String, Any>("identity" to request.identity, "status" to status)
    if (error != null) event["error"] = error
    try {
      observer?.invoke(event)
    } catch (_: RuntimeException) {
      // A dead JS observer must never disrupt native notification handling.
    }
  }
}
