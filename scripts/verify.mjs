import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = resolve(root, 'plugins/110lab');
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const release = await json('distribution.json');
const manifest = await json('plugins/110lab/plugin.json');
const compatibility = await json('plugins/110lab/.codex-plugin/plugin.json');
const marketplace = await json('.agents/plugins/marketplace.json');
assert.equal(manifest.name, '110lab');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, release.version);
assert.equal(compatibility.version, release.version);
assert.equal((await json('package.json')).version, release.version);
assert.deepEqual(compatibility.interface, manifest.extensions['com.openai'].interface);
assert.ok([...manifest.extensions['com.openai'].interface.shortDescription].length <= 30);
assert.equal(marketplace.name, '110lab');
assert.equal(marketplace.plugins.length, 1);
assert.equal(marketplace.plugins[0].source.path, './plugins/110lab');
assert.match(release.source.commit, /^[a-f0-9]{40}$/);
assert.equal(release.source.repository, 'https://github.com/pythc/110lab-website');

async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    const path = resolve(directory, name), stat = await lstat(path);
    assert.ok(!stat.isSymbolicLink(), 'Symlink is not distributable: ' + name);
    if (stat.isDirectory()) files.push(...await walk(path));
    else { assert.ok(stat.isFile()); files.push(relative(plugin, path).replaceAll('\\', '/')); }
  }
  return files.sort();
}
const expected = ['.codex-plugin/plugin.json', '.mcp.json', 'README.md', 'assets/logo.png', 'assets/logo.svg', 'assets/sidebar-icon.png', 'assets/sidebar-icon.svg', 'mcp.json', 'mcp/NOTICE.txt', 'mcp/portal-bridge.mjs', 'mcp/requirements-bridge.mjs', 'mcp/requirements-client.mjs', 'plugin.json'].sort();
assert.deepEqual(await walk(plugin), expected, 'Package must match the explicit client-only allowlist');
assert.deepEqual(Object.keys(release.files).sort(), expected);
for (const name of expected) {
  const bytes = await readFile(resolve(plugin, name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), release.files[name], 'Hash mismatch: ' + name);
  assert.ok(bytes.length > 0);
  if (name.endsWith('.png')) continue;
  const text = bytes.toString('utf8');
  assert.doesNotMatch(text, /\/Users\/alex\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|LTAI[A-Za-z0-9]{16,}/, 'Sensitive material or local path: ' + name);
  assert.doesNotMatch(text, /["'](?:client_secret|app_secret|refresh_token|personalToken|openApiKey)["']\s*:\s*["'][A-Za-z0-9_.-]{16,}["']/, 'Credential literal: ' + name);
  if (name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', resolve(plugin, name)]);
}
const mcp = await json('plugins/110lab/mcp.json');
assert.deepEqual(mcp.mcpServers, (await json('plugins/110lab/.mcp.json')).mcpServers);
assert.deepEqual(Object.keys(mcp.mcpServers).sort(), ['110lab', '110lab_requirements']);
for (const server of Object.values(mcp.mcpServers)) {
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.equal(server.cwd, '${PLUGIN_ROOT}');
  assert.ok(!server.env, 'No bundled credentials or machine environment');
  assert.equal(server.args.length, 1);
  assert.ok(expected.includes(server.args[0].replace('${PLUGIN_ROOT}/', '')));
}
assert.ok((await readFile(resolve(plugin, 'mcp/NOTICE.txt'), 'utf8')).includes('Package: @modelcontextprotocol/sdk'));
console.log(JSON.stringify({ verified: true, version: release.version, files: expected.length, sourceCommit: release.source.commit }));
