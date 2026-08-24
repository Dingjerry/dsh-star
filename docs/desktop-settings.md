# Desktop settings and market boundary

DSH Star uses the official Harness extension seam without copying another
desktop host. Desktop-owned UI is a first-party Harness plugin;
Rust remains the authority for native actions and the official Harness remains
the authority for profiles, plugins, and settings.

## Settings surface

The first-party client plugin registers a bottom-most `Star Settings` entry in
the official `settings.section` slot. The first implemented surface shows
application and runtime identity, active profile, single-process architecture,
launch-at-login, close behavior, diagnostics, and update availability. Login
launch is backed by the native Tauri autostart integration, close behavior is
persisted by Rust, and diagnostics are read from the live process supervisor.
Separate update rows report the DSH Star shell channel and the latest official
DeepSeek Harness release. Downloads expose live progress and never restart
without confirmation.
The intended groups are:

- **Desktop** — application/runtime versions, launch behavior, close behavior,
  diagnostics, and update channel.
- **Profiles** — the active official `web` profile. Profile contents and
  credentials stay owned by Harness. Profile switching is not exposed until
  the Rust supervisor can validate, restart, and roll back a Web-capable
  profile safely.
- **Plugin market** — launched from the bottom of the main sidebar. Browsing
  and package mutation remain separate capabilities.

The market is the MIT-licensed `dsh-community-market` Harness Host/Client
plugin maintained in this repository. DSH Star retains its official
`sidebar.footer.action` and `shell.overlay` contributions and intentionally
omits the duplicate `settings.plugins.tab`. Discover, Installable, Installed,
and Sources are separate views backed by the market Host routes and one shared
launcher/overlay store. Catalog browsing remains portable. DSH Star supplies a
fixed active-profile adapter, an inventory adapter, and packaged pnpm 11.7.0;
install and uninstall still run through the official `dsh plugin` command. DSH
Star does not replace the official Settings shell or sidebar.

## Native bridge

The Harness page is loopback HTTP content. DSH Star exposes bounded Tauri
commands to read desktop status, change login launch, persist close behavior,
complete a user-confirmed window close action, and operate the signed update
state machine. None returns native paths, environment variables, secrets, or
credentials.

The Rust host validates all argument shapes and remains authoritative for these
native actions. Profile switching remains unavailable; update commands accept
no URLs or file paths from Web content and can only consume the configured
signed channels.

## Market safety

Market browsing is not permission to install. Provider manifests and images
use restricted HTTP clients with hostname, redirect, size, and content-type
limits. Installation requires a preview, a supported package source, a locked
profile operation, and an explicit confirmation. The runtime never executes a
provider-supplied command and never gives a market direct Tauri access.

The market persists explicit user-owned source records and validates remote
catalog data before it reaches the UI.

## Branding

Harness browser branding is produced by the upstream `build:official` profile,
which activates the official `ui-brand-official` slot occupant. DSH Star does
not patch official Web assets. The native application icon uses the official
fish geometry on a DSH Star-owned white application plate; product naming and
independence notices remain DSH Star-owned.
