package expo.modules.t3agentnotifications

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Native continuation of the device's saved direct connections, independent of JS. */
internal object DirectCompletionBackground {
  private const val STORE = "t3-direct-completions"
  private const val KEY = "t3-direct-completion-connections"
  private val main = Handler(Looper.getMainLooper())
  private var observer: ((Map<String, Any>) -> Unit)? = null

  fun prefs(context: Context) = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)

  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(KEY, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }

  fun connections(context: Context): JSONArray {
    val encoded = prefs(context).getString("connections", null) ?: return JSONArray()
    return try {
      val envelope = JSONObject(encoded)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)))
      JSONArray(String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
    } catch (_: Exception) {
      report(context, "credential-storage-unavailable")
      JSONArray()
    }
  }

  fun configure(context: Context, enabled: Boolean, scheme: String, encoded: String) {
    val app = context.applicationContext
    main.post {
      try {
        val old = connections(app)
        val input = JSONArray(encoded)
        val next = JSONArray()
        for (i in 0 until input.length()) {
          val item = input.getJSONObject(i)
          val id = item.getString("environmentId")
          // A temporary JS disconnection does not revoke a saved native bearer.
          if (item.isNull("bearerToken")) {
            for (j in 0 until old.length()) {
              val prior = old.getJSONObject(j)
              if (prior.getString("environmentId") == id && prior.getString("httpBaseUrl") == item.getString("httpBaseUrl")) {
                item.put("bearerToken", prior.getString("bearerToken"))
                break
              }
            }
          }
          if (!item.isNull("bearerToken") && item.getString("bearerToken").isNotBlank()) next.put(item)
        }
        val previousEnabled = prefs(app).getBoolean("enabled", false)
        val changed = old.toString() != next.toString() || previousEnabled != enabled ||
          prefs(app).getString("scheme", null) != scheme
        if (changed) {
          val cipher = Cipher.getInstance("AES/GCM/NoPadding")
          cipher.init(Cipher.ENCRYPT_MODE, key())
          val encrypted = cipher.doFinal(next.toString().toByteArray(Charsets.UTF_8))
          val envelope = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
          val edit = prefs(app).edit().putString("connections", envelope.toString())
            .putBoolean("enabled", enabled).putString("scheme", scheme)
          val retained = (0 until next.length()).map { next.getJSONObject(it).getString("environmentId") }.toSet()
          for (j in 0 until old.length()) {
            val id = old.getJSONObject(j).getString("environmentId")
            if (id !in retained) edit.remove("sequence:$id").remove("seen:$id").remove("projects:$id")
          }
          // Every explicit Off -> On starts a fresh baseline; don't replay the Off interval.
          if (!previousEnabled && enabled) {
            for (j in 0 until next.length()) {
              val id = next.getJSONObject(j).getString("environmentId")
              edit.remove("sequence:$id").remove("seen:$id")
            }
          }
          check(edit.commit())
        }
        if (!enabled || next.length() == 0) {
          app.stopService(Intent(app, DirectCompletionService::class.java))
          report(app, if (enabled) "no-direct-environments" else "off")
        } else {
          // Called from a visible app. Repeated preference syncs do not restart sockets.
          ContextCompat.startForegroundService(app, Intent(app, DirectCompletionService::class.java))
        }
      } catch (_: Exception) { report(app, "background-start-unavailable") }
    }
  }

  fun observe(listener: ((Map<String, Any>) -> Unit)?) { observer = listener }

  fun status(context: Context): Map<String, Any> {
    val p = prefs(context)
    return mapOf("status" to (p.getString("status", "off") ?: "off"),
      "connected" to p.getInt("connected", 0), "total" to p.getInt("total", 0),
      "lastIdentity" to (p.getString("lastIdentity", "") ?: ""),
      "lastReceipt" to (p.getString("lastReceipt", "") ?: ""))
  }

  fun report(context: Context, status: String, connected: Int = 0, total: Int = 0) {
    prefs(context).edit().putString("status", status).putInt("connected", connected).putInt("total", total).apply()
    Log.i("T3DirectCompletion", "status=$status connected=$connected total=$total")
    try { observer?.invoke(DirectCompletionBackground.status(context)) } catch (_: RuntimeException) { }
  }

  fun receipt(context: Context, identity: String, receipt: String) {
    prefs(context).edit().putString("lastIdentity", identity).putString("lastReceipt", receipt).apply()
    Log.i("T3DirectCompletion", "identity=$identity receipt=$receipt")
  }
}
