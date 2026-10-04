package expo.modules.t3agentnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class DirectCompletionBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED ||
      !DirectCompletionBackground.prefs(context).getBoolean("enabled", false)) return
    try {
      ContextCompat.startForegroundService(context, Intent(context, DirectCompletionService::class.java))
    } catch (_: RuntimeException) {
      DirectCompletionBackground.report(context, "open-app-to-resume")
    }
  }
}
