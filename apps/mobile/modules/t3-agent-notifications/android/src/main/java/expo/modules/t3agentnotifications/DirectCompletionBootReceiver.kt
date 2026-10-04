package expo.modules.t3agentnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class DirectCompletionBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in listOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED) ||
      !DirectCompletionBackground.prefs(context).getBoolean("enabled", false)) return
    try {
      ContextCompat.startForegroundService(context, Intent(context, DirectCompletionService::class.java))
    } catch (_: RuntimeException) {
      DirectCompletionBackground.report(context, "open-app-to-resume")
    }
  }
}
