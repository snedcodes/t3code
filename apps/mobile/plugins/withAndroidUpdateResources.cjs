const { withAppBuildGradle } = require("expo/config-plugins");

const begin = "// @generated begin t3-update-resources";
const end = "// @generated end t3-update-resources";
const block = `${begin}
// Expo SDK 57 declares paths, but not source contents, as inputs to this task.
// Refresh the embedded manifest and native fingerprint on incremental builds.
tasks.configureEach { task ->
    if (task.name.startsWith("create") && task.name.endsWith("UpdatesResources")) {
        task.outputs.upToDateWhen { false }
    }
}
${end}`;

module.exports = function withAndroidUpdateResources(config) {
  return withAppBuildGradle(config, (result) => {
    if (result.modResults.language !== "groovy") {
      throw new Error("withAndroidUpdateResources requires the Expo Groovy app build.gradle.");
    }
    const contents = result.modResults.contents;
    const first = contents.indexOf(begin);
    const last = contents.indexOf(end);
    if (first < 0 !== last < 0 || (first >= 0 && last < first)) {
      throw new Error("Incomplete generated T3 updates resource block.");
    }
    result.modResults.contents =
      first < 0
        ? `${contents.trimEnd()}\n\n${block}\n`
        : `${contents.slice(0, first)}${block}${contents.slice(last + end.length)}`;
    return result;
  });
};
