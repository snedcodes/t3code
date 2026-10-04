# Mobile notifications

Sign in to T3 Connect, link your environments, and enable **Device Notifications** in Settings to receive alerts when an agent finishes, fails, needs approval, or asks for input. Tap a notification to open its thread. Your environment must have agent activity publishing enabled.

Enable **Ongoing Agent Activity** on Android or **Live Activity Updates** on iOS to follow work without opening the app. Finished results remain visible for up to 15 minutes. You can dismiss an Android activity card without disabling alerts; turn off ongoing activity in Settings to stop future cards.

Ordinary alerts stay quiet while the mobile app is in the foreground. Ongoing activity continues to update. Viewing a thread on another device does not silence your phone's alerts.

Android notifications require Android 7.0 or newer and Google Play services. Android 16 and newer can promote ongoing activity to a Live Update, subject to system settings and device support. Other devices show a regular ongoing notification. Android 7's battery-saving modes can delay removal of expired cards.

Notification permission and Android notification channels are controlled in system Settings. Cloud push delivery requires T3 Connect and does not require a maintained direct connection. Force-stopping the Android app in system Settings prevents delivery until you open it again.

## Spoken completions on Android

Enable **Speak agent completions** to hear completion and failure alerts. Adjust volume, rate and pitch in the same section. Alerts remain quiet while the app is visible. Turning speech Off stops current speech and the direct background connections.

Android builds with **Background connections** can also receive completions directly from saved, enabled environments, including over Tailscale and mobile data. Open the app once after pairing or enabling speech; an ongoing **T3 background completions** notification shows how many environments are connected. Keep Tailscale running for tailnet addresses and allow Android notifications. This direct path does not need T3 Connect or Google push configuration; relay connections continue to use T3 Connect.

The direct listener runs natively when the app is in the background. It resumes saved connections after a normal reboot when Android permits it, and reconnects after network interruptions. Initial connection and re-enabling speech skip existing finished work. A reconnect resumes the server's canonical completion state and avoids repeating consumed turns. A long offline interval may only recover the latest turn in each thread, rather than every intervening completion. Tap a completion notification to open its exact environment and thread. Android battery restrictions and force-stop can prevent background operation; open the app to resume it.
