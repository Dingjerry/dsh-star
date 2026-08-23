import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const lock = JSON.parse(readFileSync(resolve(root, 'upstream.json'), 'utf8'))
const checkout = resolve(root, 'upstream/deepseek-harness')

if (!existsSync(resolve(checkout, '.git'))) {
  console.error(`Official Harness checkout is missing at ${checkout}`)
  console.error(`Expected ${lock.tag} (${lock.commit})`)
  process.exit(1)
}

if (!existsSync(resolve(checkout, 'package.json'))) {
  console.error('Official Harness submodule is registered but not fully checked out')
  console.error('Run: git submodule update --init --checkout')
  process.exit(1)
}

const actual = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: checkout,
  encoding: 'utf8',
}).trim()

if (actual !== lock.commit) {
  console.error(`Harness commit mismatch: expected ${lock.commit}, got ${actual}`)
  process.exit(1)
}

const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
  cwd: checkout,
  encoding: 'utf8',
}).trim()

if (changes) {
  console.error('Official Harness checkout contains local modifications')
  process.exit(1)
}

console.log(`Harness source verified: ${lock.tag} (${actual.slice(0, 12)})`)
