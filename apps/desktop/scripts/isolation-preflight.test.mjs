import { assert, describe, it } from "vite-plus/test";

import { resolveIsolationProfile, validateIsolationProfile } from "./isolation-preflight.mjs";

const production = {
  appUserModelId: "com.t3tools.t3code",
  t3Home: "/Users/alice/.t3",
  userDataDirectory: "/Users/alice/Library/Application Support/t3code",
  databasePath: "/Users/alice/.t3/userdata/state.sqlite",
  port: 3773,
};

describe("T3 isolation preflight", () => {
  it("resolves an explicit disposable profile without production paths", () => {
    const profile = resolveIsolationProfile({
      homeDirectory: "/Users/alice",
      platform: "darwin",
      env: {
        T3CODE_HOME: "/tmp/t3-reliability-880/t3-home",
        T3CODE_PORT: "3873",
        T3CODE_DESKTOP_APP_USER_MODEL_ID: "com.t3tools.t3code.reliability-dev",
      },
    });
    const validation = validateIsolationProfile(profile, production);

    assert.equal(validation.ok, true);
    assert.equal(profile.databasePath, "/tmp/t3-reliability-880/t3-home/userdata/state.sqlite");
    assert.equal(profile.userDataDirectory, "/Users/alice/Library/Application Support/t3code-dev");
    assert.equal(profile.port, 3873);
  });

  it("rejects missing explicit home and production port/identity", () => {
    const profile = resolveIsolationProfile({
      homeDirectory: "/Users/alice",
      platform: "darwin",
      env: {
        T3CODE_PORT: "3773",
        T3CODE_DESKTOP_APP_USER_MODEL_ID: "com.t3tools.t3code",
      },
    });
    const validation = validateIsolationProfile(profile, production);

    assert.equal(validation.ok, false);
    assert.include(
      validation.conflicts,
      "T3CODE_HOME must be explicit for an isolated desktop launch",
    );
    assert.include(validation.conflicts, "port is production port: 3773");
    assert.include(
      validation.conflicts,
      "app user model ID is production identity: com.t3tools.t3code",
    );
  });

  it("rejects a database family nested under production", () => {
    const profile = resolveIsolationProfile({
      homeDirectory: "/Users/alice",
      platform: "darwin",
      env: {
        T3CODE_HOME: "/Users/alice/.t3/test",
        T3CODE_PORT: "3873",
      },
    });
    const validation = validateIsolationProfile(profile, production);

    assert.equal(validation.ok, false);
    assert.include(validation.conflicts, "T3CODE_HOME overlaps production: /Users/alice/.t3/test");
  });
});
