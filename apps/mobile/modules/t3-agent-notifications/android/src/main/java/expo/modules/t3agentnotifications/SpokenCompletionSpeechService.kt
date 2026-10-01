package expo.modules.t3agentnotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/** Foreground only for the bounded initialization/playback of a completion cue. */
class SpokenCompletionSpeechService : Service() {
  private var promoted = false
  private var latestStartId = 0

  override fun onCreate() {
    super.onCreate()
    promote()
  }

  private fun promote() {
    try {
      val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel(
          CHANNEL, "Spoken completions", NotificationManager.IMPORTANCE_LOW
        ).apply {
          setSound(null, null)
          enableVibration(false)
        })
      }
      val notification = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info)
        .setContentTitle("Spoken completion")
        .setContentText("Reading an agent completion")
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .setSilent(true)
        .build()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      promoted = true
    } catch (_: RuntimeException) {
      SpokenCompletionSpeech.serviceStartFailed()
      stopSelf()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    latestStartId = startId
    // A start can arrive after stopSelfResult but before onDestroy.
    if (!promoted) promote()
    if (!promoted || intent == null) {
      finishSpeech()
    } else {
      SpokenCompletionSpeech.serviceStarted(this)
    }
    return START_NOT_STICKY
  }

  internal fun finishSpeech() {
    // A newer start must not be stopped by a previous utterance's completion.
    if (stopSelfResult(latestStartId)) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
      promoted = false
    }
  }

  override fun onDestroy() {
    SpokenCompletionSpeech.serviceDestroyed(this)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL = "agent-spoken-completions"
    private const val NOTIFICATION_ID = 73003
  }
}
