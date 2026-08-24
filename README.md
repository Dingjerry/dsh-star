# DSH Star

## 简体中文

DSH Star 是基于 DeepSeek Harness 官方开源源码、使用 Tauri 2 与 Rust
封装的社区桌面版。它保留官方 Harness Host、Web UI、Profile 和插件生态，
由原生桌面外壳负责窗口、运行时进程和系统集成。

默认只发布两个 10 MB 以下的轻量桌面外壳：macOS 绿色版和 Windows 绿色版。
外壳不包含 Node.js、Harness 源码或依赖。首次运行时，它会检查应用数据目录；
若缺少运行时，再下载并校验 DSH Star 发布的 Node.js + 官方 Harness 签名运行时包。
运行时只下载一次，后续启动直接复用。

下载：[GitHub Actions 构建记录](https://github.com/Dingjerry/dsh-star/actions/workflows/build-artifacts.yml)

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
├── lightweight native shell (<10 MB download target)
├── native window, tray, updater, OS integration
├── runtime supervisor
│   └── separately downloaded, signed Node + pinned official Harness
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
a local Node runtime. Release shells do not include the runtime closure; they
install the separately published signed runtime pack into the application-data
directory on first use.

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
