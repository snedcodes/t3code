package expo.modules.t3spokencompletions

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.speech.tts.TextToSpeech
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

class T3SpokenCompletionsModule : Module() {
  private var tts: TextToSpeech? = null
  private var focusRequest: AudioFocusRequest? = null

  override fun definition() = ModuleDefinition {
    Name("T3SpokenCompletions")
    Function("speak") { text: String ->
      val context = appContext.reactContext ?: return@Function
      val engine = tts ?: TextToSpeech(context.applicationContext) {}.also { tts = it }
      val focus = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(attrs).setOnAudioFocusChangeListener {}.build()
        focusRequest = request
        focus?.requestAudioFocus(request)
        engine.setAudioAttributes(attrs)
      }
      engine.setLanguage(Locale.getDefault())
      engine.setSpeechRate(1.0f)
      engine.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, null, "t3-completion")
    }
    Function("stop") {
      tts?.stop()
      val focus = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) focusRequest?.let { focus?.abandonAudioFocusRequest(it) }
      focusRequest = null
    }
  }

  override fun onDestroy() {
    tts?.shutdown()
    tts = null
    super.onDestroy()
  }
}
