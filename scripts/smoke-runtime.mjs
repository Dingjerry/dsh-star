import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const home = mkdtempSync(join(tmpdir(), "dsh-star-smoke-"));
const packaged = join(root, "runtime-dist/current");
const packagedNode = join(packaged, "node/bin", process.platform === "win32" ? "node.exe" : "node");
const packagedHarness = join(packaged, "harness");
const usePackaged = existsSync(join(packaged, "runtime.json"));
const node = usePackaged ? packagedNode : process.execPath;
const harness = usePackaged ? packagedHarness : join(root, "upstream/deepseek-harness");
const cli = join(harness, usePackaged ? "lib/bin.js" : "apps/cli/lib/bin.js");
const patch = usePackaged
  ? join(packaged, "desktop/cordis.patch.yml")
  : join(root, "packages/dsh-star-desktop/cordis.patch.yml");
const desktopPackage = usePackaged
  ? join(packagedHarness, "node_modules/dsh-star-desktop")
  : join(root, "packages/dsh-star-desktop");
const marketPackage = usePackaged
  ? join(packagedHarness, "node_modules/dsh-community-market")
  : join(root, "packages/dsh-community-market");
if (usePackaged) {
  const pnpmEntry = join(desktopPackage, "node_modules/pnpm/bin/pnpm.mjs");
  const pnpmVersion = execFileSync(packagedNode, [pnpmEntry, "--version"], { encoding: "utf8" }).trim();
  if (pnpmVersion !== "11.7.0") throw new Error(`Unexpected packaged pnpm version: ${pnpmVersion}`);
}
mkdirSync(join(home, "profiles/node_modules"), { recursive: true });
cpSync(desktopPackage, join(home, "profiles/node_modules/dsh-star-desktop"), { recursive: true });
cpSync(marketPackage, join(home, "profiles/node_modules/dsh-community-market"), { recursive: true });
const child = spawn(node, [cli, "web", "--patch", patch, "--port", "0", "--no-open"], {
  cwd: tmpdir(),
  env: {
    ...process.env,
    DSH_HOME: home,
  },
  stdio: ["ignore", "pipe", "inherit"],
});

let buffer = "";
let ready = false;
let failure;
let checking = false;
const fail = (error) => {
  failure ??= error instanceof Error ? error : new Error(String(error));
  child.kill("SIGTERM");
};
const timeout = setTimeout(() => fail(new Error("Harness runtime did not become ready within 30 seconds")), 30_000);

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line) continue;
    const match = line.match(/https?:\/\/[^\s]+/);
    if (match === null || checking) continue;
    const url = new URL(match[0]);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) continue;
    checking = true;
    void (async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
        const html = await response.text();
        if (!response.ok || !html.includes("__ModuleLoader__")) {
          throw new Error("Harness Web UI health check failed");
        }
        const marketResponse = await fetch(new URL("/api/community-market/state", url), {
          signal: AbortSignal.timeout(5_000),
        });
        const market = await marketResponse.json();
        if (!marketResponse.ok || !Array.isArray(market.sources) || !Array.isArray(market.builtIns)) {
          throw new Error("Community Market Host health check failed");
        }
        const installationsResponse = await fetch(new URL("/api/community-market/installations", url), {
          signal: AbortSignal.timeout(5_000),
        });
        const installations = await installationsResponse.json();
        if (!installationsResponse.ok || !Array.isArray(installations.installations)) {
          throw new Error("Community Market package-operation capability check failed");
        }
        ready = true;
        console.log(`${usePackaged ? "Packaged" : "Source"} Harness runtime ready: ${url}`);
        child.kill("SIGTERM");
      } catch (error) {
        fail(error);
      }
    })();
  }
});

child.on("close", (code) => {
  clearTimeout(timeout);
  rmSync(home, { recursive: true, force: true });
  if (failure) console.error(failure.message);
  if (failure || !ready || code !== 0) process.exitCode = 1;
});

child.on("error", fail);
