import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const upstream = join(root, "upstream/deepseek-harness");
const hostPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const destination = join(root, "runtime-dist/current");
const archive = join(root, "runtime-dist/dsh-star-runtime.tar.gz");
const harness = join(destination, "harness");
const desktopDeploy = join(destination, ".desktop-deploy");
const marketDeploy = join(destination, ".market-deploy");
const desktopPackage = join(root, "packages/dsh-star-desktop");
const marketPackage = join(root, "packages/dsh-community-market");
const pnpmCommand = "pnpm";
const pnpmShell = process.platform === "win32";
function deployProduction(filter, cwd, target) {
  const args = [];
  if (process.platform === "win32") args.push("--config.node-linker=hoisted");
  args.push("--filter", filter, "deploy", "--prod", "--legacy", target);
  return spawnSync(pnpmCommand, args, {
    cwd,
    env: { ...process.env, CI: "true" },
    shell: pnpmShell,
    stdio: "inherit",
  });
}
const lock = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const desktopDigest = createHash("sha256")
  .update(readFileSync(join(desktopPackage, "package.json")))
  .update(readFileSync(join(desktopPackage, "index.js")))
  .update(readFileSync(join(desktopPackage, "client.js")))
  .update(readFileSync(join(desktopPackage, "cordis.patch.yml")))
  .digest("hex");
function digestTree(directory, hash = createHash("sha256"), prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    const key = join(prefix, entry.name);
    hash.update(key);
    if (entry.isDirectory()) digestTree(path, hash, key);
    else hash.update(readFileSync(path));
  }
  return hash;
}
const marketDigest = digestTree(marketPackage).digest("hex");

execFileSync(process.execPath, [join(root, "scripts/verify-upstream.mjs")], { stdio: "inherit" });
const clientBuildRecordPath = join(upstream, ".dsh-build/client-build-environment.json");
if (!existsSync(clientBuildRecordPath)) {
  throw new Error("Official Harness client artifacts are missing; run pnpm upstream:build first");
}
const clientBuildRecord = JSON.parse(readFileSync(clientBuildRecordPath, "utf8"));
const clientEnvironment = clientBuildRecord.environment;
if (clientEnvironment?.DSH_CLIENT_BUILD_PROFILE !== "official"
  || clientEnvironment?.DSH_CLIENT_TITLE !== "DeepSeek Harness"
  || clientEnvironment?.DSH_CLIENT_COMMIT_HASH !== lock.commit.slice(0, 7)) {
  throw new Error("Harness client artifacts were not built with the pinned official profile");
}
const pnpmVersion = execFileSync(pnpmCommand, ["--version"], { encoding: "utf8", shell: pnpmShell }).trim();
if (!/^11\./.test(pnpmVersion)) {
  throw new Error(`Runtime assembly requires pnpm 11.x, received ${pnpmVersion}`);
}
if (existsSync(destination)) {
  rmSync(destination, { recursive: true, force: true });
}
mkdirSync(destination, { recursive: true });

// Start from the production dependency graph. Runtime-only workspace peers are
// added explicitly below from the pinned, already-built official checkout.
// Shipping the complete development graph adds compilers, linters and tests to
// the desktop bundle and more than doubles its size.
const deployed = deployProduction("@deepseek-ai/dsh", upstream, harness);
if (deployed.status !== 0) throw new Error(`Harness deploy failed with ${deployed.status ?? deployed.signal}`);

// rc2's app-boot imports this peer at runtime, while the CLI package does not
// promote it to a production dependency. Keep the upstream source untouched
// and complete the deployed closure with the already-built official package.
const groupTarget = join(harness, "node_modules/@deepseek-ai/cordis-plugin-group");
mkdirSync(dirname(groupTarget), { recursive: true });
cpSync(join(upstream, "vendor/group"), groupTarget, {
  recursive: true,
  filter: (source) => !/(^|\/)(src|tests|node_modules)(\/|$)/.test(source),
});

// pnpm deploy intentionally omits workspace packages that are reachable only
// through peerDependencies. Harness loads those packages dynamically, so copy
// every built official workspace package's publication surface into the flat
// installation scope. Package contents remain byte-for-byte upstream output.
const officialScope = join(harness, "node_modules/@deepseek-ai");
const manifests = execFileSync("git", ["ls-files", "*package.json"], {
  cwd: upstream,
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);
for (const manifest of manifests) {
  const packageRoot = dirname(join(upstream, manifest));
  const metadata = JSON.parse(readFileSync(join(upstream, manifest), "utf8"));
  if (typeof metadata.name !== "string" || !metadata.name.startsWith("@deepseek-ai/")) continue;
  const target = join(officialScope, metadata.name.slice("@deepseek-ai/".length));
  if (existsSync(target)) continue;
  cpSync(packageRoot, target, {
    recursive: true,
    filter: (source) => !/(^|\/)(src|tests|node_modules)(\/|$)/.test(source),
  });
}

// Harness profiles load official plugins by bare package name from DSH_HOME.
// Expose pnpm's deployed workspace packages at the installation root so the
// official profile fallback can resolve them outside the source workspace.
if (process.platform !== "win32") {
  const virtualStore = join(harness, "node_modules/.pnpm");
  const virtualHoistRoot = join(virtualStore, "node_modules");
  const hoistedScope = join(virtualStore, "node_modules/@deepseek-ai");
  mkdirSync(hoistedScope, { recursive: true });
  for (const entry of readdirSync(virtualStore, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const scope = join(virtualStore, entry.name, "node_modules/@deepseek-ai");
    if (!existsSync(scope)) continue;
    for (const pkg of readdirSync(scope, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!pkg.isDirectory() && !pkg.isSymbolicLink()) continue;
      const source = join(scope, pkg.name);
      for (const target of [join(officialScope, pkg.name), join(hoistedScope, pkg.name)]) {
        if (existsSync(target)) continue;
        symlinkSync(relative(dirname(target), source), target, "dir");
      }
    }
  }

  // Packages copied from the upstream workspace sit at the flat install root,
  // outside pnpm's generated per-importer dependency links. Mirror pnpm's public
  // hoist view there so those official packages can resolve third-party imports
  // such as zod and ws without relying on the source checkout's node_modules.
  for (const dependency of readdirSync(virtualHoistRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = join(virtualHoistRoot, dependency.name);
    const target = join(harness, "node_modules", dependency.name);
    if (dependency.name.startsWith("@") && dependency.isDirectory()) {
      mkdirSync(target, { recursive: true });
      for (const scoped of readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!scoped.isDirectory() && !scoped.isSymbolicLink()) continue;
        const scopedSource = join(source, scoped.name);
        const scopedTarget = join(target, scoped.name);
        if (existsSync(scopedTarget)) continue;
        symlinkSync(relative(dirname(scopedTarget), scopedSource), scopedTarget, "dir");
      }
      continue;
    }
    if ((!dependency.isDirectory() && !dependency.isSymbolicLink()) || existsSync(target)) continue;
    symlinkSync(relative(dirname(target), source), target, "dir");
  }

  for (const pkg of readdirSync(officialScope, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!pkg.isDirectory() && !pkg.isSymbolicLink()) continue;
    const target = join(hoistedScope, pkg.name);
    if (existsSync(target)) continue;
    symlinkSync(relative(dirname(target), join(officialScope, pkg.name)), target, "dir");
  }
}

// DSH Star composes desktop-owned browser surfaces through the official
// Cordis/client-module extension seam. It is copied beside, never into, an
// upstream package and activated by an explicit launcher patch.
const deployedDesktop = deployProduction("dsh-star-desktop", root, desktopDeploy);
if (deployedDesktop.status !== 0) throw new Error(`Desktop plugin deploy failed with ${deployedDesktop.status ?? deployedDesktop.signal}`);
const desktopTarget = join(harness, "node_modules/dsh-star-desktop");
relativizeInternalLinks(desktopDeploy, desktopDeploy, realpathSync(desktopPackage));
renameSync(desktopDeploy, desktopTarget);
const deployedMarket = deployProduction("dsh-community-market", root, marketDeploy);
if (deployedMarket.status !== 0) throw new Error(`Market deploy failed with ${deployedMarket.status ?? deployedMarket.signal}`);
const marketTarget = join(harness, "node_modules/dsh-community-market");
relativizeInternalLinks(marketDeploy, marketDeploy, realpathSync(marketPackage));
renameSync(marketDeploy, marketTarget);
if (process.platform === "win32") {
  // The hoisted Windows deploy is already a complete, flat node_modules tree.
  // Keeping pnpm's virtual store would archive a second copy of every package,
  // and junction traversal can multiply that copy many times. The hoisted files
  // remain valid after the store is removed because Node resolves dependencies
  // from the flat ancestor node_modules directories.
  for (const deployedRoot of [harness, desktopTarget, marketTarget]) {
    rmSync(join(deployedRoot, "node_modules/.pnpm"), { recursive: true, force: true });
    rmSync(join(deployedRoot, "node_modules/.modules.yaml"), { force: true });
  }
}
mkdirSync(join(destination, "desktop"), { recursive: true });
cpSync(join(desktopPackage, "cordis.patch.yml"), join(destination, "desktop/cordis.patch.yml"));

const nodeSource = process.execPath;
const nodeTarget = join(destination, "node/bin", process.platform === "win32" ? "node.exe" : "node");
mkdirSync(dirname(nodeTarget), { recursive: true });
copyFileSync(nodeSource, nodeTarget);
if (process.platform !== "win32") chmodSync(nodeTarget, 0o755);

copyFileSync(join(upstream, "LICENSE"), join(destination, "HARNESS-LICENSE"));
copyFileSync(join(marketPackage, "LICENSE"), join(destination, "COMMUNITY-MARKET-LICENSE"));
copyFileSync(join(upstream, "THIRD_PARTY_NOTICES.md"), join(destination, "THIRD_PARTY_NOTICES.md"));

writeFileSync(join(destination, "runtime.json"), `${JSON.stringify({
  protocol: "dsh-star/1",
  host: {
    minVersion: hostPackage.version,
  },
  harness: {
    repository: lock.repository,
    tag: lock.tag,
    commit: lock.commit,
    client: {
      environment: clientEnvironment,
      artifacts: clientBuildRecord.artifacts,
    },
  },
  desktop: {
    package: "dsh-star-desktop",
    sha256: desktopDigest,
    marketPackage: "dsh-community-market",
    marketSha256: marketDigest,
  },
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
}, null, 2)}\n`);

rmSync(archive, { force: true });
// pnpm's deploy tree uses symlinks. Keep links whose targets are inside the
// runtime (the virtual store remains compact), but materialize links escaping
// the runtime into the developer checkout. A release archive must never retain
// a link to the source workspace.
function materializeExternalLinks(directory, boundary = destination) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(path);
      } catch (error) {
        // pnpm can leave an optional nested link dangling on Windows when the
        // package's peer is already available from the runtime root. It must
        // not abort release assembly or escape into the archive.
        if (error?.code === "ENOENT") {
          rmSync(path, { force: true, recursive: true });
          continue;
        }
        throw error;
      }
      if (relative(boundary, target).startsWith("..")) {
        rmSync(path, { force: true, recursive: true });
        cpSync(target, path, { recursive: true });
      }
      continue;
    }
    if (entry.isDirectory()) materializeExternalLinks(path, boundary);
  }
}
function relativizeInternalLinks(directory, boundary, sourcePackage) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = realpathSync(path);
      if (relative(boundary, target).startsWith("..")) {
        if (target === sourcePackage) {
          rmSync(path, { force: true, recursive: true });
          continue;
        }
        throw new Error(`Market deploy retained an external dependency link: ${path}`);
      }
      rmSync(path, { force: true, recursive: true });
      symlinkSync(relative(dirname(path), target), path, process.platform === "win32" ? "junction" : undefined);
      continue;
    }
    if (entry.isDirectory()) relativizeInternalLinks(path, boundary, sourcePackage);
  }
}
function materializeWindowsLinks(directory, boundary = destination, allowedRoot = root) {
  // realpathSync normalizes Windows drive-letter casing and separators.  The
  // deploy tree contains pnpm junctions whose targets may be reported with a
  // different casing, so comparing a raw relative path incorrectly marks
  // valid in-tree links as external.
  const normalizedBoundary = realpathSync(boundary);
  const normalizedAllowedRoot = realpathSync(allowedRoot);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = realpathSync(path);
      if (relative(normalizedAllowedRoot, target).startsWith("..")) {
        throw new Error(`Windows runtime retained an external reparse point: ${path}`);
      }
      // Refuse links that point to an ancestor: dereferencing one would create
      // an infinite copy and is always a malformed deploy tree.
      if (!relative(target, path).startsWith("..")) {
        throw new Error(`Windows runtime contains a cyclic reparse point: ${path}`);
      }
      rmSync(path, { force: true, recursive: true });
      cpSync(target, path, { recursive: true, dereference: true });
      materializeWindowsLinks(path, normalizedBoundary, normalizedAllowedRoot);
      continue;
    }
    if (entry.isDirectory()) materializeWindowsLinks(path, boundary);
  }
}
materializeExternalLinks(destination);
if (process.platform === "win32") {
  // Do not pass junctions to an archive tool. Windows archive utilities may
  // follow reparse points and duplicate the pnpm tree recursively.
  materializeWindowsLinks(destination);
  // Windows bsdtar follows directory junctions in pnpm's virtual store and
  // duplicates the same packages many times. 7-Zip's -snl/-snh switches keep
  // reparse points as links, matching the compact Unix archive semantics.
  const sevenZip = "C:\\Program Files\\7-Zip\\7z.exe";
  const tarPath = join(root, "runtime-dist/dsh-star-runtime.tar");
  rmSync(tarPath, { force: true });
  const tarred = spawnSync(
    sevenZip,
    ["a", "-ttar", "-snl", "-snh", "-mx=0", tarPath, ".\\*"],
    { cwd: destination, stdio: "inherit" },
  );
  if (tarred.status !== 0) {
    throw new Error(`Runtime tar packaging failed with ${tarred.status ?? tarred.signal}`);
  }
  const tarBytes = statSync(tarPath).size;
  const maxTarBytes = 900 * 1024 * 1024;
  if (tarBytes > maxTarBytes) {
    rmSync(tarPath, { force: true });
    throw new Error(`Runtime tar is unexpectedly large (${tarBytes} bytes); refusing to compress it.`);
  }
  console.log(`Compressing ${tarBytes} runtime bytes with balanced gzip settings`);
  const gzipped = spawnSync(sevenZip, ["a", "-tgzip", "-mx=5", "-mmt=on", archive, tarPath], {
    stdio: "inherit",
  });
  rmSync(tarPath, { force: true });
  if (gzipped.status !== 0) {
    throw new Error(`Runtime gzip packaging failed with ${gzipped.status ?? gzipped.signal}`);
  }
} else {
  const archived = spawnSync("tar", ["-czf", archive, "-C", destination, "."], {
    stdio: "inherit",
  });
  if (archived.status !== 0) {
    throw new Error(`Runtime archive failed with ${archived.status ?? archived.signal}`);
  }
}

// A Windows junction can accidentally expand the pnpm store while creating the
// archive. Fail the build instead of publishing a multi-gigabyte package.
const archiveBytes = statSync(archive).size;
const maxArchiveBytes = 1024 * 1024 * 1024;
if (archiveBytes > maxArchiveBytes) {
  rmSync(archive, { force: true });
  throw new Error(`Runtime archive is unexpectedly large (${archiveBytes} bytes); refusing to publish it.`);
}

console.log(`Runtime assembled at ${destination}`);
console.log(`Bundle-safe runtime archive created at ${archive}`);
