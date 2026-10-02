const { withAppBuildGradle } = require("expo/config-plugins");

const START = "// @generated begin t3-fbjni-cxx-runtime";
const END = "// @generated end t3-fbjni-cxx-runtime";

// React Native's AAR can win libc++_shared.so pickFirst while a newer resolved
// fbjni needs symbols it does not export. Package the C++ runtime from the exact
// resolved fbjni AAR as a generated app source, which has higher merge priority.
const GRADLE = String.raw`
${START}
abstract class T3FbjniCxxRuntime extends DefaultTask {
    @InputFiles
    @PathSensitive(PathSensitivity.NONE)
    abstract ConfigurableFileCollection getFbjniArchives()

    @OutputDirectory
    abstract DirectoryProperty getOutputDirectory()

    @TaskAction
    void extractRuntime() {
        def archive = fbjniArchives.singleFile
        def output = outputDirectory.get().asFile
        int count = 0
        new java.util.zip.ZipFile(archive).withCloseable { zip ->
            zip.entries().each { entry ->
                def match = entry.name =~ /^jni\/([A-Za-z0-9_-]+)\/libc\+\+_shared\.so$/
                if (match.matches()) {
                    def target = new File(output, match[0][1] + "/libc++_shared.so")
                    target.parentFile.mkdirs()
                    zip.getInputStream(entry).withCloseable { stream ->
                        java.nio.file.Files.copy(stream, target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
                    }
                    count++
                }
            }
        }
        if (count == 0) {
            throw new GradleException("Resolved fbjni AAR contains no shared C++ runtime: " + archive.name)
        }
    }
}

androidComponents.onVariants(androidComponents.selector().all()) { variant ->
    def fbjniArchives = variant.runtimeConfiguration.incoming.artifactView {
        componentFilter { id ->
            id instanceof org.gradle.api.artifacts.component.ModuleComponentIdentifier &&
                id.group == "com.facebook.fbjni" && id.module == "fbjni"
        }
        attributes {
            attribute(org.gradle.api.artifacts.type.ArtifactTypeDefinition.ARTIFACT_TYPE_ATTRIBUTE, "aar")
        }
    }.files
    def runtimeTask = tasks.register("prepareT3FbjniCxxRuntime" + variant.name.capitalize(), T3FbjniCxxRuntime) {
        it.fbjniArchives.from(fbjniArchives)
        it.outputDirectory.set(layout.buildDirectory.dir("generated/t3-fbjni-cxx-runtime/" + variant.name))
    }
    variant.sources.jniLibs.addGeneratedSourceDirectory(runtimeTask) { it.outputDirectory }
}
${END}
`;

module.exports = function withAndroidFbjniRuntime(config) {
  return withAppBuildGradle(config, (nextConfig) => {
    if (nextConfig.modResults.language !== "groovy") {
      throw new Error("withAndroidFbjniRuntime requires the Expo Groovy app build.gradle.");
    }
    let contents = nextConfig.modResults.contents;
    const start = contents.indexOf(START);
    if (start !== -1) {
      const end = contents.indexOf(END, start);
      if (end === -1) {
        throw new Error("withAndroidFbjniRuntime found an incomplete generated block.");
      }
      contents = contents.slice(0, start) + contents.slice(end + END.length);
    }
    nextConfig.modResults.contents = contents.trimEnd() + "\n" + GRADLE;
    return nextConfig;
  });
};
