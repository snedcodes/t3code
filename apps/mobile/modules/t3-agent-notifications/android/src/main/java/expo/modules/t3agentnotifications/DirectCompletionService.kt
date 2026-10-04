package expo.modules.t3agentnotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit

/** Keeps canonical completion messages available on the handset while JS is suspended. */
class DirectCompletionService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS).pingInterval(30, TimeUnit.SECONDS)
    .followRedirects(false).followSslRedirects(false).build()
  private val owners = mutableMapOf<String, Connection>()
  private var alive = false
  private val manager get() = getSystemService(NotificationManager::class.java)
  private val prefs get() = DirectCompletionBackground.prefs(this)
  private val channel = "agent-direct-background"
  private val notificationId = 73004

  override fun onCreate() {
    super.onCreate()
    alive = true
    try {
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
        NotificationChannel(channel, "Background agent connections", NotificationManager.IMPORTANCE_LOW))
      if (Build.VERSION.SDK_INT >= 34) startForeground(notificationId, ongoing(), ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
      else startForeground(notificationId, ongoing())
    } catch (_: RuntimeException) {
      DirectCompletionBackground.report(this, "foreground-service-denied")
      alive = false
      stopSelf()
    }
  }

  private fun ongoing() = NotificationCompat.Builder(this, channel)
    .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("T3 background completions")
    .setContentText("${owners.values.count { it.connected }}/${owners.size} paired environments connected")
    .setContentIntent(AgentNotifications.contentIntent(this, prefs.getString("scheme", "t3code-dev")!!, "/", notificationId))
    .setOngoing(true).setSilent(true).setOnlyAlertOnce(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!alive || !prefs.getBoolean("enabled", false)) { stopSelf(); return START_NOT_STICKY }
    val configurations = DirectCompletionBackground.connections(this)
    val ids = mutableSetOf<String>()
    for (i in 0 until configurations.length()) {
      val config = configurations.getJSONObject(i)
      val id = config.getString("environmentId")
      ids.add(id)
      val existing = owners[id]
      if (existing?.config?.toString() == config.toString() && !existing.blocked) continue
      existing?.close()
      val owner = Connection(config)
      owners[id] = owner
      owner.connect()
    }
    for (id in owners.keys.toList()) if (id !in ids) owners.remove(id)?.close()
    if (owners.isEmpty()) { stopSelf(); return START_NOT_STICKY }
    update()
    return START_STICKY
  }

  private fun update() {
    if (!alive) return
    val connected = owners.values.count { it.connected }
    val blocked = owners.values.any { it.blocked }
    DirectCompletionBackground.report(this, if (blocked) "connection-needs-attention" else if (connected > 0) "connected" else "reconnecting", connected, owners.size)
    manager.notify(notificationId, ongoing())
  }

  private inner class Connection(val config: JSONObject) {
    val id = config.getString("environmentId")
    var connected = false
    var blocked = false
    private var socket: WebSocket? = null
    private var lookup: Call? = null
    private var attempt = 0L
    private var retryMs = 2_000L
    private var retry: Runnable? = null
    private var sequence = prefs.getLong("sequence:$id", -1)
    private val seen = prefs.getString("seen:$id", "").orEmpty().split('\n').filter { it.isNotEmpty() }.toMutableSet()
    // One terminal identity per thread also protects quiet startup records after
    // the short retry history rolls over. Canonical shell replay reads latestTurn.
    private val seenTurns = JSONObject(prefs.getString("seenTurns:$id", "{}") ?: "{}")
    private val projects = mutableMapOf<String, String>().apply {
      val saved = JSONObject(prefs.getString("projects:$id", "{}") ?: "{}")
      saved.keys().forEach { key -> put(key, saved.getString(key)) }
    }
    private val requestId = "1"
    private fun current(generation: Long) = alive && owners[id] === this && generation == attempt

    fun close() {
      ++attempt
      retry?.let { main.removeCallbacks(it) }
      retry = null
      lookup?.cancel(); lookup = null
      socket?.cancel(); socket = null
      connected = false
    }

    fun connect() {
      if (!alive || owners[id] !== this || blocked) return
      val generation = ++attempt
      try {
        val base = config.getString("httpBaseUrl").trimEnd('/')
        val uri = URI(base)
        require(uri.scheme in listOf("http", "https") && uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null)
        val request = Request.Builder().url("$base/.well-known/t3/environment").build()
        lookup = client.newCall(request)
        lookup!!.enqueue(object : Callback {
          override fun onFailure(call: Call, error: IOException) { main.post { if (current(generation)) failed() } }
          override fun onResponse(call: Call, response: Response) {
            val matched = response.use {
              try { it.isSuccessful && JSONObject(it.body?.string().orEmpty()).getString("environmentId") == id }
              catch (_: Exception) { false }
            }
            main.post {
              if (!current(generation)) return@post
              lookup = null
              // Network/HTTP errors retry; a reachable different identity never substitutes.
              if (!matched) { failed(); return@post }
              open(generation, base.replaceFirst("http", "ws") + "/ws")
            }
          }
        })
      } catch (_: Exception) { blocked = true; update() }
    }

    private fun open(generation: Long, url: String) {
      val request = Request.Builder().url(url).header("Authorization", "Bearer ${config.getString("bearerToken")}").build()
      socket = client.newWebSocket(request, object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) { main.post {
          if (!current(generation)) { webSocket.cancel(); return@post }
          val payload = JSONObject().put("requestCompletionMarker", true)
          if (prefs.contains("sequence:$id")) payload.put("afterSequence", prefs.getLong("sequence:$id", 0))
          webSocket.send(JSONObject().put("_tag", "Request").put("id", requestId)
            .put("tag", "orchestration.subscribeShell").put("headers", JSONArray()).put("payload", payload).toString())
        } }
        override fun onMessage(webSocket: WebSocket, text: String) { main.post {
          if (!current(generation)) return@post
          try {
            val messages = if (text.trimStart().startsWith("[")) JSONArray(text) else JSONArray().put(JSONObject(text))
            for (i in 0 until messages.length()) {
              val message = messages.getJSONObject(i)
              when (message.getString("_tag")) {
                "Chunk" -> {
                  if (message.optString("requestId") != requestId) continue
                  val items = message.getJSONArray("values")
                  for (j in 0 until items.length()) consume(items.getJSONObject(j))
                  // One durable checkpoint per RPC chunk, before acknowledgement.
                  check(prefs.edit().putLong("sequence:$id", sequence)
                    .putString("projects:$id", JSONObject(projects as Map<*, *>).toString())
                    .putString("seenTurns:$id", seenTurns.toString())
                    .putString("seen:$id", seen.toList().takeLast(512).joinToString("\n")).commit())
                  while (seen.size > 512) seen.remove(seen.first())
                  webSocket.send(JSONObject().put("_tag", "Ack").put("requestId", requestId).toString())
                }
                "Exit", "Defect" -> { blocked = true; failed(); return@post }
              }
            }
          } catch (_: Exception) { blocked = true; failed() }
        } }
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { main.post {
          if (!current(generation)) return@post
          if (response?.code == 401 || response?.code == 403) blocked = true
          failed()
        } }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { main.post { if (current(generation)) failed() } }
        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, null) }
      })
    }

    private fun failed() {
      ++attempt
      connected = false
      socket?.cancel(); socket = null
      update()
      if (blocked || !alive || owners[id] !== this) return
      retry?.let { main.removeCallbacks(it) }
      retry = Runnable { retry = null; connect() }.also { main.postDelayed(it, retryMs) }
      retryMs = (retryMs * 2).coerceAtMost(60_000)
    }

    private fun consume(item: JSONObject) {
      when (item.getString("kind")) {
        "snapshot" -> {
          val snapshot = item.getJSONObject("snapshot")
          val initial = sequence < 0
          val rows = snapshot.getJSONArray("projects")
          projects.clear()
          for (i in 0 until rows.length()) {
            val p = rows.getJSONObject(i); projects[p.getString("id")] = p.getString("title")
          }
          val threads = snapshot.getJSONArray("threads")
          for (i in 0 until threads.length()) thread(threads.getJSONObject(i), initial)
          sequence = snapshot.getLong("snapshotSequence")
          connected = true; retryMs = 2_000; update()
        }
        "synchronized" -> { connected = true; retryMs = 2_000; update() }
        else -> {
          val nextSequence = item.getLong("sequence")
          if (nextSequence <= sequence) return
          when (item.getString("kind")) {
            "project-upserted" -> { val p = item.getJSONObject("project"); projects[p.getString("id")] = p.getString("title") }
            "project-removed" -> projects.remove(item.getString("projectId"))
            "thread-upserted" -> thread(item.getJSONObject("thread"), false)
          }
          sequence = nextSequence
        }
      }
    }

    private fun thread(thread: JSONObject, baseline: Boolean) {
      if (!thread.isNull("archivedAt")) return
      val turn = thread.optJSONObject("latestTurn") ?: return
      val state = turn.getString("state")
      if (state != "completed" && state != "error") return
      val threadId = thread.getString("id")
      val identity = "direct:$id:$threadId:${turn.getString("turnId")}"
      if (identity in seen || seenTurns.optString(threadId) == turn.getString("turnId")) return
      val background = !ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
      if (!baseline && background) {
        if (!NotificationManagerCompat.from(this@DirectCompletionService).areNotificationsEnabled()) {
          DirectCompletionBackground.receipt(this@DirectCompletionService, identity, "notifications-disabled")
        } else {
          val title = thread.getString("title").take(120)
          val outcome = if (state == "completed") "Completed" else "Failed"
          val body = "$outcome: ${projects[thread.getString("projectId")] ?: config.getString("label")}".take(608)
          AgentNotifications.showDirectCompletion(this@DirectCompletionService, prefs.getString("scheme", "t3code-dev")!!,
            "/threads/$id/$threadId", identity, title, body)
          DirectCompletionBackground.receipt(this@DirectCompletionService, identity, "notification-posted")
          // This process already owns a foreground remote-messaging service.
          SpokenCompletionSpeech.speakFromForegroundOwner(this@DirectCompletionService, "$title. $body", identity)
        }
      }
      // The chunk commits this before ACK and queued speech callbacks.
      seen.add(identity)
      seenTurns.put(threadId, turn.getString("turnId"))
    }
  }

  override fun onDestroy() {
    alive = false
    owners.values.forEach { it.close() }; owners.clear()
    client.dispatcher.executorService.shutdown()
    client.connectionPool.evictAll()
    DirectCompletionBackground.report(this, if (prefs.getBoolean("enabled", false)) "stopped" else "off")
    super.onDestroy()
  }
  override fun onBind(intent: Intent?): IBinder? = null
}
