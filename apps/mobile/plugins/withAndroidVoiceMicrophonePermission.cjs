const { withAndroidManifest } = require("expo/config-plugins");

const MICROPHONE_PERMISSION = "android.permission.RECORD_AUDIO";

module.exports = function withAndroidVoiceMicrophonePermission(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];

    // Voice input needs an unrestricted declaration, including when image-picker
    // has emitted a tools:node="remove" entry for its own microphone opt-out.
    manifest["uses-permission"] = [
      ...permissions.filter(
        (permission) => permission.$?.["android:name"] !== MICROPHONE_PERMISSION,
      ),
      { $: { "android:name": MICROPHONE_PERMISSION } },
    ];

    return nextConfig;
  });
};
