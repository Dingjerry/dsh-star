# DSH Star architecture

## Goal

DSH Star provides the product experience of a self-contained Harness
desktop application using Tauri 2 and Rust. It consumes pinned official
DeepSeek Harness source without turning the Rust host into a second Harness
implementation.

## Components

### Native host

The Rust process owns single-instance behavior, application windows, tray,
updates, OS dialogs, deep links, and the lifetime of one runtime generation. It
does not own models, agents, sessions, profiles, plugins, or credentials.

### Runtime generation

A release generation contains a private Node executable, built official Harness
packages, the official Web frontend, DSH Star's desktop plugin, and any native
modules required by that exact build. Rust starts the Harness CLI directly in
its own process group and recognizes only a validated loopback readiness URL
from stdout. There is no second Node launcher process.

The macOS application carries that generation as a gzip-compressed tar archive
because pnpm's dependency graph relies on symbolic links that Tauri's resource
copier does not preserve. On first use, Rust expands the signed application
resource into an app-data staging directory, validates the pinned manifest and
required entry points, and atomically activates a commit-addressed directory.
It never extracts into a user profile. DSH Star sets `DSH_HOME` to an isolated
`dsh-home` below its Tauri application-data directory, so its profiles,
credentials, and desktop adapters cannot overwrite another host's shared
`~/.dsh`. An absolute `DSH_STAR_HOME` override exists for development only.

The pinned CLI's readiness line is treated as an intentionally narrow launch
contract: Rust accepts only an HTTP URL whose parsed host is exactly
`127.0.0.1` or `localhost`. Native actions added later use a separate,
versioned bridge instead of overloading human log output.

### WebView

The initial local page is a hidden recovery surface. The native window remains
hidden during normal startup and appears only after the official Harness Web
carrier finishes loading. A startup failure reveals the local recovery page.
Normal
Harness client modules communicate with the official Host over loopback
HTTP/WebSocket. Native capabilities must use a narrow, versioned bridge rather
than exposing unrestricted Tauri APIs to remote content.

## Repository layout

```text
packages/dsh-star-desktop/   first-party Host/browser desktop plugin
src-tauri/                   Rust native host
ui/                          boot/recovery surface only
upstream/deepseek-harness/   pinned official source checkout
upstream.json                authoritative upstream lock
scripts/                     source, runtime, and release verification
```

## Release boundary

Production artifacts must pass a runtime-closure check proving that Node,
Harness packages, Web assets, native modules, notices, and the desktop plugin exist
inside the application bundle. Release code must not search a developer home
directory or silently use a system Node installation. The expanded runtime is
an immutable cache keyed by the official Harness commit; user data remains in
the upstream-defined DSH home layout inside DSH Star's isolated application-data
directory.

## Lifecycle

One generation transitions through `stopped → starting → ready → stopping`.
Failures transition to `failed` with a stable code and operator-safe message.
Starting a new generation first disposes the previous one. The owning process
tree is terminated and reaped during stop, quit, crash recovery, and failed
startup.
