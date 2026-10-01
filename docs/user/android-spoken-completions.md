# Spoken agent completions on Android

In Settings, turn on **Device Notifications**, then **Speak agent completions**.
Speech is Off by default. Volume, rate and pitch are saved on this handset.
It uses the Android text-to-speech voice and reads the existing completion or
failure notification title and message. Grouped completions are read together.

Speech follows background notification delivery. Opening an old completed
thread does not speak it. Approval and input requests stay ordinary
notifications. Foreground alerts remain suppressed. Repeated delivery of the
same notification is consumed once, including a delivery suppressed while
T3 Code is open. Tapping the normal notification still opens its thread.

Turning speech Off stops current playback. Notification permission, device
registration and an eligible background delivery are required. If Android
refuses playback, the ordinary notification remains available. Check Android
media volume and installed text-to-speech voice if no sound is heard.

An older app build without speech support shows the setting as unavailable.
Speech requires an updated Android app and compatible notification delivery
service; a web-only update cannot add native Android playback.
