# Update model

## Application updates

The first supported update channel ships Harness upgrades inside signed DSH
Star application releases. Automation detects a new official Harness release,
opens an upgrade change for `upstream.json`, builds the complete runtime, runs
compatibility and package smoke tests, and only then publishes a signed update.

This is the default because Host packages, Web assets, Node, native modules,
desktop adapters, and profile migrations form one compatibility unit.
The application bundle includes a commit-addressed runtime archive. The native
host installs it through a staging directory and only reuses an existing copy
when its manifest and required entry points still match.

## Future runtime-pack updates

Independent runtime downloads may be added after the application update path is
stable. A runtime pack must include a signed manifest with its Harness tag,
commit, protocol version, platform, architecture, content digest, and minimum
host version.

Activation is transactional:

1. Download to a staging directory.
2. Verify signature, digest, platform, and protocol compatibility.
3. Boot a health-check generation without touching the active runtime.
4. Atomically switch the active-runtime pointer.
5. Retain the preceding runtime for rollback.
6. Roll back automatically if first real boot does not become healthy.

User profiles, sessions, settings, and credentials are never stored inside a
replaceable runtime pack.
