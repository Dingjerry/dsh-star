---
name: tauri-dev
description: Develop and review DSH Star, the Tauri/Rust desktop host for a bundled, pinned DeepSeek Harness runtime.
---

# DSH Star Tauri development

Read `AGENTS.md` and `docs/architecture.md` before changing runtime, packaging,
or update code.

Keep the boundary explicit: Tauri owns native lifecycle and directly
supervises one bundled Node process running official Harness behavior. The
WebView loads Harness itself; the local dashboard is only a temporary
boot/recovery surface.

When changing the runtime:

- Keep readiness parsing limited to an exact loopback HTTP URL. Use a separate
  versioned bridge for future native actions; do not add a second Node launcher.
- Treat one launch as one generation and release all resources together.
- Use an independent process group on Unix and an equivalent complete-process-
  tree mechanism on Windows.
- Never fall back to an arbitrary system Harness or unverified online source in
  release builds.
- Keep user profiles and credentials outside replaceable runtime directories.

When changing updates:

- Pin an official Harness tag and commit in `upstream.json`.
- Prefer shipping a tested Harness upgrade with a signed DSH Star application
  update.
- Require signatures, atomic activation, health checks, and rollback before
  enabling independently downloadable runtime packs.

Before handoff, run Rust formatting, Clippy with warnings denied, tests, runtime
protocol tests, and the relevant packaged-runtime smoke test.
