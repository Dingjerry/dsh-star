# Delivery roadmap

## M0 — Native foundation (complete)

- Tauri 2 / Rust application shell
- official Harness tag and commit lock
- official-source Git submodule boundary
- Rust-direct Harness CLI supervision and loopback URL validation
- loopback-only navigation validation
- single-instance behavior and process-group cleanup
- boot/recovery UI and architecture/update documentation

## M1 — Reproducible runtime closure (substantially complete)

- [x] complete the `dsh-v0.1.1-rc.2` checkout
- [x] build official Host, CLI, and Web assets with the locked pnpm graph
- [x] smoke-test the development runtime on an ephemeral loopback port
- [x] remove the transitional Node launcher process
- [x] package the supported Node runtime and required native modules for macOS
  arm64
- [x] generate a runtime manifest and dependency notices
- [x] add a packaged-runtime smoke test that reaches `ready` on an ephemeral
  port and verifies the official Web UI
- generate and verify content digests for every runtime artifact
- reproduce and smoke-test the runtime closure on each supported platform

## M2 — Desktop product behavior

- [x] register a Desktop page in the official Settings shell
- [x] integrate the independent DSH Community Market Host/Client package
- [x] add its sidebar launcher, standalone overlay, and Settings tab
- [x] preserve its Discover, Installable, Installed, and Sources boundaries
- [x] enable real catalog sources, constrained browsing, cache, and normalization
- managed plugin preview/install/uninstall with rollback
- tray, reopen, hide, and quit semantics
- startup diagnostics and safe recovery controls
- profile and credential compatibility tests against the official DSH home
- macOS signing/notarization and Windows signing

## M3 — Updates

- signed Tauri application updates that include a tested Harness runtime
- release automation that detects upstream tags and opens pinned upgrade changes
- optional signed runtime packs only after atomic activation, health checks,
  retained rollback, and host/runtime compatibility checks are implemented

Harness `master` is never consumed directly by a released application.
