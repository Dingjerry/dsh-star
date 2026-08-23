# Contributing to DSH Star

DSH Star is a thin Tauri 2/Rust desktop host for the official DeepSeek
Harness. Please keep upstream Harness source unchanged; desktop behavior
belongs in the native host, adapters, or documentation in this repository.

Before opening a pull request:

```sh
pnpm check
pnpm test
pnpm lint
```

Do not commit `runtime-dist/`, build output, credentials, API keys, or personal
configuration. Remove sensitive data from logs and screenshots before sharing.
