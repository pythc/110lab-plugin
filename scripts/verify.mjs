import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { clientFiles, readClient, validateClient, digest, validateSource } from './package-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = process.argv.indexOf('--plugin-root');
if (index >= 0) assert.ok(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), '--plugin-root requires a directory');
const plugin = index >= 0 ? resolve(process.argv[index + 1]) : resolve(root, 'plugins/110lab');
const release = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const expected = await clientFiles(root), files = await readClient(plugin, expected), manifest = validateClient(files);
assert.equal(release.schemaVersion, 2); assert.equal(manifest.version, release.version); assert.equal(pkg.version, release.version);
assert.deepEqual(Object.keys(release.files).sort(), expected); assert.deepEqual(Object.keys(release.originalFiles).sort(), expected);
validateSource(release.source);
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
assert.equal(lock.version, release.version); assert.equal(lock.packages[''].version, release.version);
assert.deepEqual(lock.packages[''].engines, pkg.engines);
const marketplace = JSON.parse(await readFile(resolve(root, '.agents/plugins/marketplace.json'), 'utf8'));
assert.equal(marketplace.name, '110lab'); assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source.path, './plugins/110lab');
const modified = [];
for (const [name, bytes] of files) {
  const hash = digest(bytes); assert.equal(hash, release.files[name], 'Hash mismatch: ' + name); assert.ok(bytes.length > 0);
  assert.match(release.originalFiles[name], /^[a-f0-9]{64}$/);
  if (hash !== release.originalFiles[name]) modified.push(name);
  if (name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', resolve(plugin, name)]);
  // Preserve the pre-existing release screen by default. Integrity-only is an
  // explicit option for work that does not authorize a new sensitive-data scan.
  if (!process.argv.includes('--integrity-only') && !name.endsWith('.png')) {
    const text = bytes.toString('utf8');
    assert.doesNotMatch(text, /\/Users\/alex\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|LTAI[A-Za-z0-9]{16,}/, 'Sensitive material or local path: ' + name);
    assert.doesNotMatch(text, /["'](?:client_secret|app_secret|refresh_token|personalToken|openApiKey)["']\s*:\s*["'][A-Za-z0-9_.-]{16,}["']/, 'Credential literal: ' + name);
  }
}
assert.deepEqual([...new Set(release.changes.map(x => x.path))].sort(), modified.sort(), 'All source transformations must be recorded');
const catalog = JSON.parse(files.get('mcp/cobuild-tools.json'));
const names = Object.values(catalog).flat().map(x => x.name);
assert.equal(new Set(names).size, names.length);
assert.deepEqual(Object.keys(catalog).sort(), ['knowledge', 'portal', 'requirements']);
assert.ok(files.get('mcp/NOTICE.txt').toString().includes('Package: @modelcontextprotocol/sdk'));
console.log(JSON.stringify({ verified: true, version: release.version, files: expected.length,
  skills: 5, tools: names.length + 3, source: release.source.kind, sensitiveScreen: !process.argv.includes('--integrity-only') }));
