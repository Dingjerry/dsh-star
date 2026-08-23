import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-star-desktop";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const profileName = process.env.DSH_STAR_PROFILE || "web";
const dshHome = process.env.DSH_HOME;
const cliEntry = process.argv[1];

function assertRuntimePaths() {
  if (!dshHome || !isAbsolute(dshHome)) throw new Error("dsh-star-desktop: DSH_HOME is unavailable");
  if (!cliEntry || !isAbsolute(cliEntry)) throw new Error("dsh-star-desktop: Harness CLI path is unavailable");
}

function profileDir() {
  assertRuntimePaths();
  return join(dshHome, "profiles", profileName);
}

function packageManagerPath() {
  const bin = join(packageRoot, "node_modules", ".bin");
  const node = dirname(process.execPath);
  return [bin, node, process.env.PATH || ""].filter(Boolean).join(process.platform === "win32" ? ";" : ":");
}

function startPluginCommand(args, invokingDir, signal) {
  assertRuntimePaths();
  if (!isAbsolute(invokingDir)) throw new Error("dsh-star-desktop: plugin working directory must be absolute");
  const child = spawn(process.execPath, [cliEntry, "plugin", "--profile", profileName, ...args], {
    cwd: invokingDir,
    env: { ...process.env, DSH_HOME: dshHome, PATH: packageManagerPath(), CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let settled = false;
  const cancel = () => {
    if (!settled) child.kill("SIGTERM");
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const done = new Promise((resolveDone, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode, childSignal) => {
      settled = true;
      signal?.removeEventListener("abort", cancel);
      resolveDone({ exitCode, signal: childSignal });
    });
  });
  return { stdout: child.stdout, stderr: child.stderr, done, cancel };
}

function installedBundles() {
  const dir = profileDir();
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return [];
  }
  return Object.keys(manifest.dependencies || {}).flatMap((packageName) => {
    try {
      const packageDir = resolve(dir, "node_modules", packageName);
      const installed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
      if (!installed?.dsh?.bundle?.patch) return [];
      return [{ bundleId: packageName, packageName, status: "active", mutable: false }];
    } catch {
      return [];
    }
  });
}

export function apply(ctx) {
  assertRuntimePaths();
  const pendingRecovery = new Map();
  const desktopProfiles = Object.freeze({
    current: Object.freeze({ name: profileName, dir: profileDir() }),
  });
  const desktopPnpm = {
    runPlugin(args, invokingDir, signal) {
      return startPluginCommand(args, invokingDir, signal);
    },
    async installPlugin(request) {
      const target = `${request.recovery.packageName}@${request.recovery.packageVersion}`;
      pendingRecovery.set(request.recovery.receiptId, request.recovery.packageName);
      return startPluginCommand(["add", ...(request.pnpmOptions || []), target], request.invokingDir, request.signal);
    },
    async recoveredInstallReceiptIds() { return []; },
    async acknowledgeRecoveredInstall(receiptId) { pendingRecovery.delete(receiptId); },
    async rollbackPluginInstall(receiptId) {
      const packageName = pendingRecovery.get(receiptId);
      if (!packageName) return false;
      const handle = startPluginCommand(["remove", packageName], profileDir());
      handle.stdout.resume();
      handle.stderr.resume();
      const outcome = await handle.done;
      pendingRecovery.delete(receiptId);
      return outcome.exitCode === 0 && outcome.signal === null;
    },
  };
  const desktopPlugins = {
    list: installedBundles,
    disabledPackageNames() { return []; },
    isDisabled() { return false; },
    previewDisable() { throw new Error("DSH Star plugin disabling is not available yet"); },
    executeDisable() { return Promise.reject(new Error("DSH Star plugin disabling is not available yet")); },
    previewEnable() { throw new Error("DSH Star plugin enabling is not available yet"); },
    executeEnable() { return Promise.reject(new Error("DSH Star plugin enabling is not available yet")); },
  };
  const desktopActions = {
    async requestRestart() {
      const marker = join(dshHome, "restart-request");
      await import("node:fs/promises").then(fs => fs.writeFile(marker, "restart\\n"));
    },
  };
  ctx.effect(() => ctx.provide("desktopProfiles", desktopProfiles), "dsh-star-desktop: active profile");
  ctx.effect(() => ctx.provide("desktopPnpm", desktopPnpm), "dsh-star-desktop: package manager");
  ctx.effect(() => ctx.provide("desktopPlugins", desktopPlugins), "dsh-star-desktop: plugin inventory");
  ctx.effect(() => ctx.provide("desktopActions", desktopActions), "dsh-star-desktop: native actions");
}
