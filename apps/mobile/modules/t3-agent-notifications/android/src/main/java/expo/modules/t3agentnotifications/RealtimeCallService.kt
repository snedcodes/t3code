package expo.modules.t3agentnotifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner

/** Protects an already user-started microphone call; never recreates a call. */
class RealtimeCallService : Service() {
  private var callOwner: String? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val token = intent?.getStringExtra(OWNER)
    if (intent?.action == END) {
      if (token != null && token == owner) {
        observer?.invoke(token, "user-stop")
        release(this, token)
      } else if (owner == null) stopSelf()
      return START_NOT_STICKY
    }
    if (token == null || token != owner) {
      if (owner == null) stopSelf()
      return START_NOT_STICKY
    }
    try {
      val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel(
          CHANNEL, "Voice assistant calls", NotificationManager.IMPORTANCE_LOW
        ).apply { setSound(null, null); enableVibration(false) })
      }
      val end = PendingIntent.getService(this, 73004,
        Intent(this, RealtimeCallService::class.java).setAction(END)
          .setData(Uri.parse("t3-realtime-call://end/$token")).putExtra(OWNER, token),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
        PendingIntent.getActivity(this, 73004, it.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      }
      val notification = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_btn_speak_now)
        .setContentTitle("Voice assistant call")
        .setContentText("Call continues in the background. End call to disconnect.")
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setOngoing(true).setSilent(true)
        .setContentIntent(launch)
        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End call", end)
        .build()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else startForeground(NOTIFICATION_ID, notification)
      callOwner = token
      activeOwner = token
      pending?.invoke(true)
      pending = null
      pendingContext = null
      main.removeCallbacks(startTimeout)
    } catch (_: RuntimeException) {
      pending?.invoke(false)
      pending = null
      pendingContext = null
      owner = null
      activeOwner = null
      main.removeCallbacks(startTimeout)
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    val token = callOwner
    if (token != null && owner == token) {
      owner = null
      activeOwner = null
      observer?.invoke(token, "service-ended")
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL = "realtime-assistant-call"
    private const val NOTIFICATION_ID = 73004
    private const val OWNER = "owner"
    private const val END = "expo.modules.t3agentnotifications.END_REALTIME_CALL"
    private val main = Handler(Looper.getMainLooper())
    private var owner: String? = null
    @Volatile private var activeOwner: String? = null
    private var pending: ((Boolean) -> Unit)? = null
    private var pendingContext: Context? = null
    @Volatile private var observer: ((String, String) -> Unit)? = null
    private val startTimeout = Runnable {
      val context = pendingContext
      val token = owner
      if (context != null && token != null && pending != null) release(context, token)
    }

    fun observe(listener: ((String, String) -> Unit)?) { observer = listener }
    fun isActive(context: Context, token: String): Boolean = activeOwner == token &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    fun releaseCurrent(context: Context) { main.post { owner?.let { release(context, it) } } }

    fun acquire(context: Context, token: String, ready: (Boolean) -> Unit) {
      main.post {
        if (token.isBlank() || token.length > 128 || owner != null ||
          ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
          !ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
          ready(false)
          return@post
        }
        owner = token
        pending = ready
        pendingContext = context.applicationContext
        main.postDelayed(startTimeout, 5_000)
        try {
          ContextCompat.startForegroundService(context,
            Intent(context, RealtimeCallService::class.java).putExtra(OWNER, token))
        } catch (_: RuntimeException) {
          release(context, token)
        }
      }
    }

    fun release(context: Context, token: String) {
      main.post {
        if (owner != token) return@post
        owner = null
        activeOwner = null
        main.removeCallbacks(startTimeout)
        pending?.invoke(false)
        pending = null
        pendingContext = null
        context.stopService(Intent(context, RealtimeCallService::class.java))
      }
    }
  }
}
