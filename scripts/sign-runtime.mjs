import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { resolve } from "node:path";

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error("usage: sign-runtime <source> <output>");
const encodedKey = process.env.DSH_STAR_RUNTIME_SIGNING_KEY_B64;
if (!encodedKey) throw new Error("DSH_STAR_RUNTIME_SIGNING_KEY_B64 is required");

const source = resolve(sourceArg);
const output = resolve(outputArg);
const archive = readFileSync(source);
const digest = createHash("sha256").update(archive).digest();
const key = createPrivateKey(Buffer.from(encodedKey, "base64"));
const signature = sign(null, digest, key);
if (signature.length !== 64) throw new Error("unexpected Ed25519 signature length");
copyFileSync(source, output);
writeFileSync(`${output}.sig`, signature);
console.log(`Signed runtime pack: ${output}`);
