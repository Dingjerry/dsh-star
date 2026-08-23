# DSH Star repository guidance

DSH Star is a Tauri 2 desktop distribution built on pinned official
DeepSeek Harness source code.

## Product boundary

- Rust/Tauri owns the native application, window, tray, updater, runtime
  supervision, process-tree cleanup, and OS integrations.
- The bundled Node runtime owns the official Harness Host, Cordis graph,
  profiles, plugins, sessions, settings, HTTP/WebSocket carrier, and Web UI.
- The main window loads the official Harness Web UI. Do not build a separate
  Start/Stop/Open control-panel product.
- Release builds must not depend on a system Node installation or a developer
  Harness checkout.
- Do not modify upstream Harness source. Pin an official tag/commit and add
  desktop behavior in first-party DSH Star adapters or plugins.

## Runtime and update invariants

- Rust directly supervises the Harness CLI and accepts only its validated
  loopback readiness URL; future native actions use a separate versioned bridge.
- Bind only to `127.0.0.1` with an ephemeral port.
- A runtime generation owns every child, listener, and native resource; shutdown
  must be idempotent and reap the complete process tree.
- Harness upgrades are tested release inputs, never an unchecked `master` pull.
- Application updates are signed. Future independent runtime packs must also be
  signed, atomically activated, health-checked, and rolled back on failure.
- Preserve user data under the official DSH home; runtime replacement must not
  rewrite credentials or profile data implicitly.

## Verification

Run from the repository root:

```sh
pnpm format
pnpm lint
pnpm check
pnpm test
pnpm build
```

Read `docs/architecture.md` before changing lifecycle, packaging, or update
boundaries. Use `.agents/skills/tauri-dev/SKILL.md` for implementation work.
