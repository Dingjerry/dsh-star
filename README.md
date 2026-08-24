# DSH Star

## 简体中文

DSH Star 是基于 DeepSeek Harness 官方开源源码、使用 Tauri 2 与 Rust
封装的社区桌面版。它保留官方 Harness Host、Web UI、Profile 和插件生态，
由原生桌面外壳负责窗口、运行时进程和系统集成。

当前测试版包含 macOS 和 Windows 构建。构建产物会在 GitHub Actions 的
`Build release artifacts` 任务中生成，下载后请先解压再运行。由于测试版包含
Node.js、官方 Harness 和依赖，文件体积较大；后续会提供检测本机环境的轻量版。

下载：[GitHub Actions 构建记录](https://github.com/Dingjerry/dsh-star/actions/runs/32655615129)

## English

DSH Star is a Tauri/Rust desktop distribution built on the official
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) source code.
It aims to provide an install-and-run desktop experience while preserving the
official Harness Host, Web UI, profiles, and plugin ecosystem.

## Status

The project has a working native host, pinned upstream source, boot/recovery
surface, first-party Star Settings, a sidebar Plugin Market, and a
reproducible local runtime assembly. Rust directly supervises the single
packaged Node + official Harness process. The closure passes an isolated Web UI
and market-capability smoke test; signing, release automation, and signed updates remain future
milestones.

## Architecture

```text
DSH Star (Tauri/Rust)
├── native window, tray, updater, OS integration
├── runtime supervisor
│   └── bundled Node + pinned official Harness
└── WebView
    └── official Harness Web UI over loopback HTTP/WebSocket
```

See [docs/architecture.md](docs/architecture.md),
[docs/desktop-settings.md](docs/desktop-settings.md), and
[docs/updating.md](docs/updating.md). Delivery milestones are tracked in
[docs/roadmap.md](docs/roadmap.md).

## Upstream baseline

- Tag: `dsh-v0.1.1-rc.2`
- Commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
- Node: `^22.19.0 || >=24.0.0`

The exact source lock is recorded in `upstream.json`.
The independently versioned Community Market snapshot is recorded in
`community-market.json`.

## Development

```sh
git submodule update --init --checkout
corepack pnpm run runtime:build
pnpm runtime:smoke
pnpm check
pnpm dev
```

The official source checkout belongs at `upstream/deepseek-harness` and must
match `upstream.json`. Runtime assembly requires pnpm 11.x. Development may use
a local Node runtime; packaged builds must use the
bundled runtime closure generated under `runtime-dist/current`.

DSH Star uses its own Harness home under the Tauri application-data directory
(`dsh-home`) and never writes its desktop adapters into the shared `~/.dsh`
used by other desktop hosts. Set the absolute `DSH_STAR_HOME` environment variable only
for an intentional development override.

## License and branding

DSH Star is an independent project. DeepSeek Harness is used to identify the
compatible upstream project and remains subject to its license and brand
guidelines. The bundled community-market Host/Client plugin is distributed
under its included MIT license.
DSH Star supplies its own profile, plugin-inventory, and bundled-pnpm adapters;
Electron-only window and terminal capabilities are not bundled.
