#[cfg(not(debug_assertions))]
use std::io::{Read, Write};
use std::{fs, path::Path};
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{webview::PageLoadEvent, Manager, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;

#[derive(Default)]
struct AppState {
    child: Mutex<Option<Child>>,
    revealed: AtomicBool,
    closing: AtomicBool,
    close_behavior: Mutex<CloseBehavior>,
}

#[derive(Clone, Copy, Default)]
enum CloseBehavior {
    #[default]
    Ask,
    Hide,
    Quit,
}

fn close_behavior_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("desktop-close-behavior"))
        .map_err(|error| error.to_string())
}

fn load_close_behavior(app: &tauri::AppHandle) -> CloseBehavior {
    let Ok(path) = close_behavior_path(app) else {
        return CloseBehavior::Ask;
    };
    match fs::read_to_string(path).as_deref() {
        Ok("hide") => CloseBehavior::Hide,
        Ok("quit") => CloseBehavior::Quit,
        _ => CloseBehavior::Ask,
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    launch_at_login: bool,
    close_behavior: &'static str,
    runtime_running: bool,
    profile: &'static str,
    loopback_only: bool,
    updates_enabled: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeCheck {
    node_found: bool,
    node_path: Option<String>,
    node_version: Option<String>,
    harness_found: bool,
    dependencies_ready: bool,
    can_start: bool,
    message: String,
}

#[cfg(debug_assertions)]
fn node_version(node: &Path) -> Option<String> {
    let output = Command::new(node).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!version.is_empty()).then_some(version)
}

#[cfg(debug_assertions)]
fn supported_node(version: Option<&str>) -> bool {
    let Some(version) = version else { return false };
    let mut parts = version.trim_start_matches('v').split('.');
    let major = parts.next().and_then(|value| value.parse::<u64>().ok());
    let minor = parts.next().and_then(|value| value.parse::<u64>().ok());
    matches!((major, minor), (Some(major), Some(minor)) if major >= 24 || (major == 22 && minor >= 19))
}

#[cfg(debug_assertions)]
fn inspect_project_runtime() -> RuntimeCheck {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let node = std::env::var_os("DSH_STAR_NODE")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("node"));
    let version = node_version(&node);
    let cli = root.join("upstream/deepseek-harness/apps/cli/lib/bin.js");
    let harness_found = cli.is_file();
    let dependencies_ready = root.join("upstream/deepseek-harness/node_modules").is_dir()
        && root
            .join("runtime-dist/current/harness/node_modules/dsh-community-market")
            .is_dir()
        && root
            .join("packages/dsh-star-desktop/cordis.patch.yml")
            .is_file();
    let can_start = supported_node(version.as_deref()) && harness_found && dependencies_ready;
    let message = if can_start {
        "已检测到可用的 Node.js、Harness 和桌面依赖。".into()
    } else if !supported_node(version.as_deref()) {
        "未检测到可用 Node.js（需要 22.19+）。".into()
    } else if !harness_found {
        "当前项目缺少官方 Harness 源码，请先初始化子模块。".into()
    } else {
        "项目依赖尚未安装或运行时未构建。".into()
    };
    RuntimeCheck {
        node_found: version.is_some(),
        node_path: version.as_ref().map(|_| node.display().to_string()),
        node_version: version,
        harness_found,
        dependencies_ready,
        can_start,
        message,
    }
}

#[tauri::command]
fn runtime_check(app: tauri::AppHandle) -> RuntimeCheck {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        inspect_project_runtime()
    }

    #[cfg(not(debug_assertions))]
    match managed_runtime(&app) {
        Ok(runtime) => RuntimeCheck {
            node_found: true,
            node_path: Some(
                runtime
                    .join(if cfg!(windows) {
                        "node/bin/node.exe"
                    } else {
                        "node/bin/node"
                    })
                    .display()
                    .to_string(),
            ),
            node_version: None,
            harness_found: true,
            dependencies_ready: true,
            can_start: true,
            message: "已检测到受管理的 DSH Star 运行时。".into(),
        },
        Err(message) => RuntimeCheck {
            node_found: false,
            node_path: None,
            node_version: None,
            harness_found: false,
            dependencies_ready: false,
            can_start: false,
            message,
        },
    }
}

#[tauri::command]
fn install_runtime_dependencies(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(not(debug_assertions))]
    {
        install_downloaded_runtime(&app)?;
        start_runtime(&app)?;
        Ok("运行时安装完成，DeepSeek Harness 正在启动。".into())
    }

    #[cfg(debug_assertions)]
    {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let status = Command::new("pnpm")
            .args(["install", "--frozen-lockfile"])
            .current_dir(root.join("upstream/deepseek-harness"))
            .status()
            .map_err(|error| format!("无法运行 pnpm：{error}"))?;
        if !status.success() {
            return Err("Harness 依赖安装失败，请查看终端输出。".into());
        }
        let status = Command::new("pnpm")
            .args(["runtime:build"])
            .current_dir(&root)
            .status()
            .map_err(|error| format!("无法构建 DSH Star 运行时：{error}"))?;
        if !status.success() {
            return Err("桌面运行时构建失败，请查看终端输出。".into());
        }
        start_runtime(&app)?;
        Ok("依赖已安装，DeepSeek Harness 正在启动。".into())
    }
}

#[tauri::command]
fn desktop_status(app: tauri::AppHandle) -> Result<DesktopStatus, String> {
    let state = app.state::<AppState>();
    let close_behavior = match *state
        .close_behavior
        .lock()
        .map_err(|_| "settings state poisoned")?
    {
        CloseBehavior::Ask => "ask",
        CloseBehavior::Hide => "hide",
        CloseBehavior::Quit => "quit",
    };
    let runtime_running = state
        .child
        .lock()
        .map_err(|_| "runtime state poisoned")?
        .is_some();
    let launch_at_login = app
        .autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())?;
    Ok(DesktopStatus {
        launch_at_login,
        close_behavior,
        runtime_running,
        profile: "web",
        loopback_only: true,
        updates_enabled: false,
    })
}

#[tauri::command]
fn set_launch_at_login(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|error| error.to_string())?;
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_close_behavior(app: tauri::AppHandle, behavior: String) -> Result<String, String> {
    let behavior = match behavior.as_str() {
        "ask" => CloseBehavior::Ask,
        "hide" => CloseBehavior::Hide,
        "quit" => CloseBehavior::Quit,
        _ => return Err("unsupported close behavior".into()),
    };
    *app.state::<AppState>()
        .close_behavior
        .lock()
        .map_err(|_| "settings state poisoned")? = behavior;
    let value = match behavior {
        CloseBehavior::Ask => "ask",
        CloseBehavior::Hide => "hide",
        CloseBehavior::Quit => "quit",
    };
    let path = close_behavior_path(&app)?;
    fs::create_dir_all(path.parent().ok_or("settings path has no parent")?)
        .map_err(|error| error.to_string())?;
    fs::write(path, value).map_err(|error| error.to_string())?;
    Ok(value.into())
}

#[tauri::command]
fn close_window_action(app: tauri::AppHandle, quit: bool) {
    if quit {
        app.exit(0);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
#[derive(serde::Deserialize)]
struct BundleManifest {
    harness: BundleHarness,
    desktop: BundleDesktop,
}

#[cfg(not(debug_assertions))]
#[derive(serde::Deserialize)]
struct UpstreamLock {
    commit: String,
}

#[cfg(not(debug_assertions))]
#[derive(serde::Deserialize)]
struct ManagedManifest {
    harness: ManagedHarness,
    platform: String,
    architecture: String,
}

#[cfg(not(debug_assertions))]
#[derive(serde::Deserialize)]
struct ManagedHarness {
    commit: String,
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
#[derive(serde::Deserialize)]
struct BundleDesktop {
    sha256: String,
    #[serde(rename = "marketSha256")]
    market_sha256: String,
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
#[derive(serde::Deserialize)]
struct BundleHarness {
    commit: String,
    client: BundleClient,
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
#[derive(serde::Deserialize)]
struct BundleClient {
    artifacts: BundleArtifacts,
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
#[derive(serde::Deserialize)]
struct BundleArtifacts {
    sha256: String,
}

#[cfg(not(debug_assertions))]
fn validate_runtime(root: &Path, manifest: &str) -> bool {
    (root.join("node/bin/node").is_file() || root.join("node/bin/node.exe").is_file())
        && root.join("harness/lib/bin.js").is_file()
        && root.join("desktop/cordis.patch.yml").is_file()
        && root
            .join("harness/node_modules/dsh-star-desktop/client.js")
            .is_file()
        && root
            .join("harness/node_modules/dsh-community-market/lib/index.js")
            .is_file()
        && root
            .join("harness/node_modules/dsh-community-market/lib/client.js")
            .is_file()
        && root
            .join("harness/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js")
            .is_file()
        && root
            .join("harness/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js")
            .is_file()
        && fs::read_to_string(root.join("runtime.json")).is_ok_and(|value| value == manifest)
}

#[cfg(not(debug_assertions))]
fn runtime_matches_platform(manifest: &ManagedManifest) -> bool {
    let expected_platform = match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        value => value,
    };
    let expected_architecture = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        value => value,
    };
    manifest.platform == expected_platform && manifest.architecture == expected_architecture
}

#[cfg(not(debug_assertions))]
fn managed_runtime(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let lock: UpstreamLock = serde_json::from_str(include_str!("../../upstream.json"))
        .map_err(|error| format!("invalid embedded upstream lock: {error}"))?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("runtime");
    let entries =
        fs::read_dir(&base).map_err(|_| "未安装 DSH Star 运行时，请点击安装。".to_string())?;
    for entry in entries.flatten() {
        let root = entry.path();
        if !root.is_dir() || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let Ok(manifest) = fs::read_to_string(root.join("runtime.json")) else {
            continue;
        };
        let Ok(metadata) = serde_json::from_str::<ManagedManifest>(&manifest) else {
            continue;
        };
        if metadata.harness.commit == lock.commit
            && runtime_matches_platform(&metadata)
            && validate_runtime(&root, &manifest)
        {
            return Ok(root);
        }
    }
    Err("未找到与当前版本匹配的受管理运行时，请点击安装。".into())
}

#[cfg(not(debug_assertions))]
fn runtime_asset_name() -> Result<&'static str, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Ok("dsh-star-runtime-macos-arm64.tar.gz"),
        ("windows", "x86_64") => Ok("dsh-star-runtime-windows-x64.tar.gz"),
        _ => Err(format!(
            "当前平台尚无运行时包：{}-{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        )),
    }
}

#[cfg(not(debug_assertions))]
fn install_downloaded_runtime(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use ed25519_dalek::{Signature, VerifyingKey};
    use sha2::{Digest, Sha256};

    const PUBLIC_KEY: [u8; 32] = [
        0x09, 0x75, 0x25, 0xa1, 0xfb, 0xcb, 0x9f, 0x4f, 0x58, 0xe8, 0xbb, 0x05, 0x63, 0x69, 0x69,
        0xe8, 0xb1, 0x85, 0x5e, 0x08, 0x57, 0xa9, 0xdd, 0x9a, 0x38, 0x99, 0x16, 0xc1, 0x2e, 0xb3,
        0xfb, 0xd9,
    ];
    const MAX_RUNTIME_BYTES: u64 = 1024 * 1024 * 1024;
    const RUNTIME_RELEASE: &str = "runtime-b150a551b8d4";

    let asset = runtime_asset_name()?;
    let url = format!(
        "https://github.com/Dingjerry/dsh-star/releases/download/{RUNTIME_RELEASE}/{asset}"
    );
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("runtime");
    fs::create_dir_all(&base).map_err(|error| error.to_string())?;
    let download = base.join(format!(".{asset}-{}.download", std::process::id()));
    let staging = base.join(format!(".runtime-{}.staging", std::process::id()));
    for temporary in [&download, &staging] {
        if temporary.exists() {
            if temporary.is_dir() {
                fs::remove_dir_all(temporary).map_err(|error| error.to_string())?;
            } else {
                fs::remove_file(temporary).map_err(|error| error.to_string())?;
            }
        }
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent(concat!("DSH-Star/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30 * 60))
        .build()
        .map_err(|error| format!("无法初始化下载器：{error}"))?;
    let response = client
        .get(&url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("运行时下载失败：{error}"))?;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RUNTIME_BYTES)
    {
        return Err("运行时包超过安全体积限制。".into());
    }
    let mut archive = fs::File::create(&download).map_err(|error| error.to_string())?;
    let copied = std::io::copy(&mut response.take(MAX_RUNTIME_BYTES + 1), &mut archive)
        .map_err(|error| format!("保存运行时失败：{error}"))?;
    archive.flush().map_err(|error| error.to_string())?;
    if copied > MAX_RUNTIME_BYTES {
        let _ = fs::remove_file(&download);
        return Err("运行时包超过安全体积限制。".into());
    }

    let signature_response = client
        .get(format!("{url}.sig"))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("运行时签名下载失败：{error}"))?;
    if signature_response
        .content_length()
        .is_some_and(|size| size > 1024)
    {
        let _ = fs::remove_file(&download);
        return Err("运行时签名超过安全体积限制。".into());
    }
    let mut signature = Vec::with_capacity(64);
    signature_response
        .take(1025)
        .read_to_end(&mut signature)
        .map_err(|error| format!("读取运行时签名失败：{error}"))?;
    if signature.len() > 1024 {
        let _ = fs::remove_file(&download);
        return Err("运行时签名超过安全体积限制。".into());
    }
    let signature =
        Signature::from_slice(&signature).map_err(|_| "运行时签名格式无效。".to_string())?;
    let mut archive = fs::File::open(&download).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = archive
            .read(&mut buffer)
            .map_err(|error| format!("读取运行时失败：{error}"))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    let digest = hasher.finalize();
    VerifyingKey::from_bytes(&PUBLIC_KEY)
        .map_err(|_| "内置运行时公钥无效。".to_string())?
        .verify_strict(&digest, &signature)
        .map_err(|_| "运行时签名验证失败，安装已取消。".to_string())?;

    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;
    let archive = fs::File::open(&download).map_err(|error| error.to_string())?;
    let decoder = flate2::read::GzDecoder::new(archive);
    if let Err(error) = tar::Archive::new(decoder).unpack(&staging) {
        let _ = fs::remove_dir_all(&staging);
        let _ = fs::remove_file(&download);
        return Err(format!("运行时解压失败：{error}"));
    }
    let manifest = fs::read_to_string(staging.join("runtime.json"))
        .map_err(|error| format!("运行时清单缺失：{error}"))?;
    let metadata: ManagedManifest =
        serde_json::from_str(&manifest).map_err(|error| format!("运行时清单无效：{error}"))?;
    let lock: UpstreamLock = serde_json::from_str(include_str!("../../upstream.json"))
        .map_err(|error| format!("invalid embedded upstream lock: {error}"))?;
    if metadata.harness.commit != lock.commit
        || !runtime_matches_platform(&metadata)
        || !validate_runtime(&staging, &manifest)
    {
        let _ = fs::remove_dir_all(&staging);
        let _ = fs::remove_file(&download);
        return Err("运行时与当前 DSH Star 版本不匹配。".into());
    }
    let digest_hex = format!("{digest:x}");
    let destination = base.join(format!(
        "{}-{}-signed",
        metadata.harness.commit,
        &digest_hex[..12]
    ));
    if validate_runtime(&destination, &manifest) {
        let _ = fs::remove_dir_all(&staging);
        let _ = fs::remove_file(&download);
        return Ok(destination);
    }
    if destination.exists() {
        fs::remove_dir_all(&destination).map_err(|error| error.to_string())?;
    }
    fs::rename(&staging, &destination).map_err(|error| {
        let _ = fs::remove_dir_all(&staging);
        format!("运行时激活失败：{error}")
    })?;
    let _ = fs::remove_file(&download);
    Ok(destination)
}

#[cfg(all(not(debug_assertions), feature = "bundled-runtime"))]
fn install_runtime(app: &tauri::AppHandle, resources: &Path) -> Result<PathBuf, String> {
    let manifest = fs::read_to_string(resources.join("runtime/runtime.json"))
        .map_err(|error| format!("failed to read the signed runtime manifest: {error}"))?;
    let metadata: BundleManifest = serde_json::from_str(&manifest)
        .map_err(|error| format!("invalid signed runtime manifest: {error}"))?;
    if metadata.harness.commit.len() != 40
        || !metadata
            .harness
            .commit
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("The signed runtime manifest has an invalid Harness commit.".into());
    }
    if metadata.harness.client.artifacts.sha256.len() != 64
        || !metadata
            .harness
            .client
            .artifacts
            .sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("The signed runtime manifest has an invalid client artifact digest.".into());
    }
    if metadata.desktop.sha256.len() != 64
        || !metadata
            .desktop
            .sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("The signed runtime manifest has an invalid desktop plugin digest.".into());
    }
    if metadata.desktop.market_sha256.len() != 64
        || !metadata
            .desktop
            .market_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("The signed runtime manifest has an invalid market plugin digest.".into());
    }

    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("runtime");
    let generation = format!(
        "{}-{}-{}-{}",
        metadata.harness.commit,
        &metadata.harness.client.artifacts.sha256[..8],
        &metadata.desktop.sha256[..8],
        &metadata.desktop.market_sha256[..8]
    );
    let destination = base.join(&generation);
    if validate_runtime(&destination, &manifest) {
        return Ok(destination);
    }

    fs::create_dir_all(&base).map_err(|error| error.to_string())?;
    if destination.exists() {
        fs::remove_dir_all(&destination).map_err(|error| error.to_string())?;
    }
    let staging = base.join(format!(".{generation}-{}.staging", std::process::id()));
    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;

    let archive = fs::File::open(resources.join("runtime/dsh-star-runtime.tar.gz"))
        .map_err(|error| format!("failed to open the signed runtime: {error}"))?;
    let decoder = flate2::read::GzDecoder::new(archive);
    if let Err(error) = tar::Archive::new(decoder).unpack(&staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("failed to install the signed runtime: {error}"));
    }
    if !validate_runtime(&staging, &manifest) {
        let _ = fs::remove_dir_all(&staging);
        return Err("The installed DSH Star runtime is incomplete.".into());
    }
    fs::rename(&staging, &destination).map_err(|error| {
        let _ = fs::remove_dir_all(&staging);
        format!("failed to activate the signed runtime: {error}")
    })?;
    Ok(destination)
}

fn show_status(window: &WebviewWindow, message: &str, failed: bool) {
    let encoded = serde_json::to_string(message).expect("status message must serialize");
    let _ = window.eval(format!(
        "window.__DSH_STAR_SET_STATUS__?.({encoded}, {failed})"
    ));
}

fn reveal_recovery(app: &tauri::AppHandle, message: &str) {
    let state = app.state::<AppState>();
    state.revealed.store(true, Ordering::Release);
    if let Some(window) = app.get_webview_window("main") {
        show_status(&window, message, true);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn is_harness_url(url: &url::Url) -> bool {
    url.scheme() == "http" && matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
}

struct RuntimeCommand {
    node: PathBuf,
    cli: PathBuf,
    patch: PathBuf,
    desktop: PathBuf,
    market: PathBuf,
    harness: Option<PathBuf>,
}

fn runtime_command(app: &tauri::AppHandle) -> Result<RuntimeCommand, String> {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        let check = inspect_project_runtime();
        if !check.can_start {
            return Err(check.message);
        }
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let cli = root.join("upstream/deepseek-harness/apps/cli/lib/bin.js");
        let desktop = root.join("packages/dsh-star-desktop");
        let market = root.join("runtime-dist/current/harness/node_modules/dsh-community-market");
        if !market.is_dir() {
            return Err(
                "The Community Market runtime is missing; run pnpm runtime:build first.".into(),
            );
        }
        let patch = desktop.join("cordis.patch.yml");
        let node = std::env::var_os("DSH_STAR_NODE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("node"));
        Ok(RuntimeCommand {
            node,
            cli,
            patch,
            desktop,
            market,
            harness: None,
        })
    }

    #[cfg(not(debug_assertions))]
    {
        #[cfg(feature = "bundled-runtime")]
        let runtime = {
            let resources = app
                .path()
                .resource_dir()
                .map_err(|error| error.to_string())?;
            install_runtime(app, &resources)?
        };
        #[cfg(not(feature = "bundled-runtime"))]
        let runtime = managed_runtime(app)?;
        let node_name = if cfg!(windows) { "node.exe" } else { "node" };
        let node = runtime.join("node/bin").join(node_name);
        let cli = runtime.join("harness/lib/bin.js");
        let patch = runtime.join("desktop/cordis.patch.yml");
        let harness = runtime.join("harness");
        let desktop = harness.join("node_modules/dsh-star-desktop");
        let market = harness.join("node_modules/dsh-community-market");
        if !node.is_file()
            || !cli.is_file()
            || !patch.is_file()
            || !desktop.is_dir()
            || !market.is_dir()
        {
            return Err("The signed DSH Star runtime is incomplete.".into());
        }
        Ok(RuntimeCommand {
            node,
            cli,
            patch,
            desktop,
            market,
            harness: Some(harness),
        })
    }
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let target = destination.join(entry.file_name());
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            let link = fs::read_link(entry.path()).map_err(|error| error.to_string())?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(link, target).map_err(|error| error.to_string())?;
            #[cfg(windows)]
            if entry.path().is_dir() {
                std::os::windows::fs::symlink_dir(link, target)
                    .map_err(|error| error.to_string())?;
            } else {
                std::os::windows::fs::symlink_file(link, target)
                    .map_err(|error| error.to_string())?;
            }
        } else if file_type.is_dir() {
            copy_directory(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn install_profile_plugin(
    dsh_home: &Path,
    package_name: &str,
    source: &Path,
) -> Result<(), String> {
    let destination = dsh_home.join("profiles/node_modules").join(package_name);
    let parent = destination
        .parent()
        .ok_or_else(|| "desktop plugin destination has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let staging = parent.join(format!(".{package_name}-{}.staging", std::process::id()));
    let previous = parent.join(format!(".{package_name}-{}.previous", std::process::id()));
    for temporary in [&staging, &previous] {
        if temporary.exists() {
            fs::remove_dir_all(temporary).map_err(|error| error.to_string())?;
        }
    }
    copy_directory(source, &staging)?;
    if destination.exists() {
        fs::rename(&destination, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&staging, &destination) {
        if previous.exists() {
            let _ = fs::rename(&previous, &destination);
        }
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("failed to activate {package_name}: {error}"));
    }
    if previous.exists() {
        fs::remove_dir_all(previous).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn dsh_star_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("DSH_STAR_HOME") {
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err("DSH_STAR_HOME must be an absolute path.".into());
        }
        return Ok(path);
    }
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("dsh-home"))
        .map_err(|error| error.to_string())
}

fn harness_url(line: &str) -> Option<url::Url> {
    line.split_whitespace().find_map(|word| {
        let value = word.trim_end_matches([',', ')', ']']);
        let parsed = url::Url::parse(value).ok()?;
        if is_harness_url(&parsed) {
            Some(parsed)
        } else {
            None
        }
    })
}

fn start_runtime(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window is unavailable".to_string())?;
    let state = app.state::<AppState>();
    let mut slot = state.child.lock().map_err(|_| "runtime state poisoned")?;
    if slot.is_some() {
        return Ok(());
    }

    let runtime = runtime_command(app)?;
    let dsh_home = dsh_star_home(app)?;
    fs::create_dir_all(&dsh_home).map_err(|error| error.to_string())?;
    install_profile_plugin(&dsh_home, "dsh-star-desktop", &runtime.desktop)?;
    install_profile_plugin(&dsh_home, "dsh-community-market", &runtime.market)?;
    show_status(&window, "Starting official DeepSeek Harness…", false);
    let mut command = Command::new(runtime.node);
    command
        .args([runtime.cli.as_os_str(), "web".as_ref(), "--patch".as_ref()])
        .arg(runtime.patch)
        .args(["--port", "0", "--no-open"])
        .env("DSH_HOME", &dsh_home)
        .env("DSH_STAR_PROFILE", "web")
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    if let Some(harness) = runtime.harness {
        command.current_dir(harness);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to start runtime: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "runtime stdout is unavailable".to_string())?;
    *slot = Some(child);
    drop(slot);

    let reader_app = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { break };
            let Some(window) = reader_app.get_webview_window("main") else {
                continue;
            };
            if let Some(url) = harness_url(&line) {
                let _ = window.navigate(url);
            }
        }
    });

    let reaper_app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));
        let state = reaper_app.state::<AppState>();
        let Ok(mut slot) = state.child.lock() else {
            return;
        };
        let Some(child) = slot.as_mut() else {
            return;
        };
        match child.try_wait() {
            Ok(Some(status)) => {
                let restart_marker = dsh_star_home(&reaper_app)
                    .ok()
                    .map(|home| home.join("restart-request"));
                let requested_restart = restart_marker.as_ref().is_some_and(|path| path.exists());
                if let Some(path) = restart_marker {
                    if requested_restart {
                        let _ = fs::remove_file(path);
                    }
                }
                if let Some(window) = reaper_app.get_webview_window("main") {
                    let message = if status.success() {
                        "Harness exited before the Web page became ready."
                    } else {
                        "Harness failed to start. Check the runtime installation and try again."
                    };
                    drop(window);
                    if requested_restart {
                        slot.take();
                        drop(slot);
                        if let Err(error) = start_runtime(&reaper_app) {
                            reveal_recovery(&reaper_app, &format!("Restart failed: {error}"));
                        }
                        return;
                    }
                    reveal_recovery(&reaper_app, message);
                }
                eprintln!("[dsh-star] Harness exited: {status}");
                slot.take();
                return;
            }
            Ok(None) => {}
            Err(_) => {
                slot.take();
                return;
            }
        }
    });
    Ok(())
}

fn stop_runtime(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let Ok(mut slot) = state.child.lock() else {
        return;
    };
    let Some(mut child) = slot.take() else {
        return;
    };
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGTERM);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => break,
        }
    }
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    let _ = child.wait();
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("DSH Star")
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let state = app.state::<AppState>();
            if state.revealed.load(Ordering::Acquire) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_status,
            runtime_check,
            install_runtime_dependencies,
            set_launch_at_login,
            set_close_behavior,
            close_window_action
        ])
        .on_window_event(|window, event| {
            let tauri::WindowEvent::CloseRequested { api, .. } = event else {
                return;
            };
            let state = window.app_handle().state::<AppState>();
            if state.closing.swap(true, Ordering::AcqRel) {
                return;
            }
            let behavior = state
                .close_behavior
                .lock()
                .map(|value| *value)
                .unwrap_or_default();
            match behavior {
                CloseBehavior::Hide => {
                    api.prevent_close();
                    state.closing.store(false, Ordering::Release);
                    let _ = window.hide();
                }
                CloseBehavior::Quit | CloseBehavior::Ask => {
                    api.prevent_close();
                    let _ = window.destroy();
                    window.app_handle().exit(0);
                }
            }
        })
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Finished || !is_harness_url(payload.url()) {
                return;
            }
            let state = webview.app_handle().state::<AppState>();
            state.revealed.store(true, Ordering::Release);
            let window = webview.window();
            let _ = window.set_title(concat!("DSH Star · v", env!("CARGO_PKG_VERSION")));
            let _ = window.show();
            let _ = window.set_focus();
        })
        .setup(|app| {
            *app.state::<AppState>()
                .close_behavior
                .lock()
                .map_err(|_| "settings state poisoned")? = load_close_behavior(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                window.set_title(concat!("DSH Star · v", env!("CARGO_PKG_VERSION")))?;
                // Show the native boot surface immediately. Harness startup and
                // runtime extraction continue under the visible loading screen.
                window.show()?;
                window.set_focus()?;
            }
            let signal_app = app.handle().clone();
            ctrlc::set_handler(move || signal_app.exit(0))
                .map_err(|error| format!("failed to install signal handler: {error}"))?;
            if let Err(error) = start_runtime(app.handle()) {
                eprintln!("[dsh-star] startup failed: {error}");
                reveal_recovery(app.handle(), &error);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DSH Star");

    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            stop_runtime(app);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::harness_url;

    #[test]
    fn extracts_only_loopback_harness_urls() {
        assert_eq!(
            harness_url("dsh web: http://127.0.0.1:49152").map(|url| url.to_string()),
            Some("http://127.0.0.1:49152/".into())
        );
        assert!(harness_url("dsh web: http://127.0.0.1.example.com:49152").is_none());
        assert!(harness_url("dsh web: https://example.com").is_none());
    }
}
