// Backward-compatible entry for a reviewed, clean upstream Git checkout.
import assert from 'node:assert/strict';
import { readFile, access, lstat, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { syncClient } from './sync-client.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2] && resolve(process.argv[2]);
assert.ok(source, 'Usage: sync-from-website.mjs /path/to/110lab-website [--version x.y.z]');
assert.ok(process.argv.length === 3 || (process.argv.length === 5 && process.argv[3] === '--version'));
const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Source checkout has changes');
assert.ok(['https://github.com/pythc/110lab-website.git', 'https://github.com/pythc/110lab-website', 'git@github.com:pythc/110lab-website.git'].includes(git('remote', 'get-url', 'origin')), 'Unexpected upstream');
const commit = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
// Only reset the known, untracked build output; never reuse an older archive.
for (const path of [resolve(source, 'artifacts'), resolve(source, 'artifacts/plugin')]) {
  try { const info = await lstat(path); assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Invalid build output directory'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.equal(git('ls-files', '--', 'artifacts/plugin'), '', 'Refusing to reset tracked source');
await rm(resolve(source, 'artifacts/plugin'), { recursive: true, force: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['run', 'build'], { cwd: source, stdio: 'inherit' });
assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Build changed source files');
const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
if (pkg.scripts?.['package:plugin']) execFileSync(npm, ['run', 'package:plugin'], { cwd: source, stdio: 'inherit' });
assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Packaging changed source files');
assert.equal(git('rev-parse', 'HEAD'), commit, 'Build changed the upstream commit');
assert.equal(git('rev-parse', 'HEAD^{tree}'), tree, 'Build changed the upstream tree');
let sourceDirectory = resolve(source, 'artifacts/plugin');
try { await access(resolve(sourceDirectory, 'plugin.json')); }
catch { sourceDirectory = resolve(source, 'plugin/110lab'); }
console.log(JSON.stringify(await syncClient({ root, sourceDirectory, version: process.argv[4], provenance: { kind: 'git', repository: 'https://github.com/pythc/110lab-website', commit, tree } })));
