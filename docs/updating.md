# Update model

## Application updates

DSH Star checks the fixed `update-channel-stable` GitHub release for a Tauri
update manifest. The platform payload is downloaded in the background and its
minisign signature is verified before the UI offers a restart. Installation
only begins after the user confirms. The public versioned release continues to
show just the two lightweight macOS and Windows downloads; machine-consumed
updater payloads live in the separate internal channel.

## Harness source and runtime updates

DSH Star checks official DeepSeek Harness releases and resolves the release tag
to its official commit. A newer upstream version is reported immediately, but
the update button is enabled only when DSH Star has published a matching signed
runtime pack for the current platform. `master`, arbitrary archives, and system
Harness installations are never executed by a release build.

A runtime pack includes a signed manifest with its Harness tag, commit,
protocol version, platform, architecture, content digest, and minimum host
version.

Activation is transactional:

1. Download to a staging directory.
2. Verify signature, digest, platform, and protocol compatibility.
3. Boot an isolated health-check generation without touching the active runtime.
4. Atomically switch the active-runtime pointer.
5. Retain the preceding runtime for rollback.
6. Ask the user to restart, then roll back automatically if first real boot
   does not become healthy.

User profiles, sessions, settings, and credentials are never stored inside a
replaceable runtime pack.
