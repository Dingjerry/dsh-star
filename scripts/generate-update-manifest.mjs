import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [inputArg, repository, tag, version, outputArg] = process.argv.slice(2);
if (!inputArg || !repository || !tag || !version || !outputArg) {
  throw new Error("usage: generate-update-manifest <input> <owner/repo> <tag> <version> <output>");
}

const input = resolve(inputArg);
const output = resolve(outputArg);
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(input);

function one(suffix) {
  const matches = files.filter(path => path.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`expected one ${suffix} payload, found ${matches.length}`);
  return matches[0];
}

const mac = one("_macOS-arm64_updater.app.tar.gz");
const windows = one("_Windows-x64_updater.nsis.zip");
const payloads = [mac, windows];
for (const payload of payloads) {
  if (!existsSync(`${payload}.sig`)) throw new Error(`missing updater signature for ${payload}`);
}
const download = payload => `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(basename(payload))}`;
const platform = payload => ({
  signature: readFileSync(`${payload}.sig`, "utf8").trim(),
  url: download(payload),
});
const manifest = {
  version,
  notes: `DSH Star v${version} signed lightweight-shell update.`,
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-aarch64": platform(mac),
    "windows-x86_64": platform(windows),
  },
};
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Update manifest created: ${output}`);
