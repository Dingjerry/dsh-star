import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  throw new Error("The portable Windows package can only be assembled on Windows.");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(root, "src-tauri", "target", "release");
const binary = join(release, "dsh-star.exe");
const runtime = join(root, "runtime-dist");
const packageRoot = join(release, "bundle", "portable", "DSH Star");
const packageRuntime = join(packageRoot, "runtime");
const archive = join(release, "bundle", "portable", "DSH-Star_0.1.0_windows-x64.zip");

for (const required of [
  binary,
  join(runtime, "dsh-star-runtime.tar.gz"),
  join(runtime, "current", "runtime.json"),
]) {
  if (!existsSync(required)) {
    throw new Error(`Required release input is missing: ${required}`);
  }
}

rmSync(packageRoot, { force: true, recursive: true });
rmSync(archive, { force: true });
mkdirSync(packageRuntime, { recursive: true });

cpSync(binary, join(packageRoot, "DSH Star.exe"));
for (const entry of readdirSync(release)) {
  if (entry.toLowerCase().endsWith(".dll")) {
    cpSync(join(release, entry), join(packageRoot, entry));
  }
}
cpSync(join(runtime, "dsh-star-runtime.tar.gz"), join(packageRuntime, "dsh-star-runtime.tar.gz"));
cpSync(join(runtime, "current", "runtime.json"), join(packageRuntime, "runtime.json"));
writeFileSync(
  join(packageRoot, "README-Windows.txt"),
  [
    "DSH Star portable test package",
    "",
    "1. Extract the entire ZIP before launching DSH Star.exe.",
    "2. Keep the runtime folder beside DSH Star.exe; it contains the bundled Node and official Harness runtime.",
    "3. Windows 10/11 may require the Microsoft Edge WebView2 Runtime.",
    "",
  ].join("\r\n"),
);

const sevenZip = "C:\\Program Files\\7-Zip\\7z.exe";
const compressed = spawnSync(
  sevenZip,
  [
    "a",
    "-tzip",
    "-mx=0",
    archive,
    join(packageRoot, "*"),
  ],
  { stdio: "inherit" },
);
if (compressed.status !== 0) {
  throw new Error(`Windows ZIP packaging failed with ${compressed.status ?? compressed.signal}`);
}
if (!existsSync(archive) || statSync(archive).size < statSync(join(runtime, "dsh-star-runtime.tar.gz")).size) {
  throw new Error("Windows ZIP packaging produced an incomplete archive.");
}

console.log(`Portable Windows package created at ${archive}`);
