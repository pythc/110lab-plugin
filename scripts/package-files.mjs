import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const compareVersions = (a, b) => {
  for (const v of [a, b]) assert.match(v, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
export function validateSource(source) {
  compareVersions(source.version, source.version);
  if (source.kind === 'release-archive') {
    assert.deepEqual(Object.keys(source).sort(), ['kind', 'sha256', 'url', 'version']);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(source.url, `https://internal.110-lab.cn/downloads/110lab-plugin-${source.version}.zip`);
  } else {
    assert.equal(source.kind, 'git');
    assert.deepEqual(Object.keys(source).sort(), ['commit', 'kind', 'repository', 'tree', 'version']);
    assert.equal(source.repository, 'https://github.com/pythc/110lab-website');
    assert.match(source.commit, /^[a-f0-9]{40}$/); assert.match(source.tree, /^[a-f0-9]{40}$/);
  }
}
export async function clientFiles(root) {
  const spec = JSON.parse(await readFile(resolve(root, 'client-files.json'), 'utf8'));
  assert.equal(spec.schemaVersion, 1); assert.equal(spec.plugin, '110lab');
  assert.ok(spec.files.length > 0 && spec.files.length <= 256);
  assert.equal(new Set(spec.files).size, spec.files.length);
  for (const name of spec.files) {
    assert.ok(!name.startsWith('/') && !name.includes('\\') && !name.split('/').includes('..'));
    assert.ok(!name.split('/').some(x => ['node_modules', '.git', 'private', '.config'].includes(x)));
    const file = name.split('/').at(-1);
    assert.ok(!file.startsWith('.env') && !['oauth.json', 'credentials.json', 'identity.json'].includes(file));
    assert.ok(!/\.(?:db|sqlite3?|key|pem)$/i.test(file));
  }
  return [...spec.files].sort();
}
export async function readClient(directory, expected) {
  const result = new Map(); let size = 0;
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const path = resolve(dir, name), info = await lstat(path);
      assert.ok(!info.isSymbolicLink(), 'Symlink is not distributable: ' + name);
      if (info.isDirectory()) await walk(path);
      else {
        assert.ok(info.isFile());
        const key = relative(directory, path).replaceAll('\\', '/');
        assert.ok(expected.includes(key), 'Unreviewed client file: ' + key);
        assert.ok(info.size <= 8 * 1024 * 1024, 'Client file too large: ' + key);
        size += info.size; assert.ok(size <= 32 * 1024 * 1024, 'Package too large');
        result.set(key, await readFile(path));
      }
    }
  }
  await walk(directory);
  assert.deepEqual([...result.keys()].sort(), expected, 'Incomplete client package');
  return result;
}
export function validateClient(files) {
  const json = name => JSON.parse(files.get(name).toString('utf8'));
  const manifest = json('plugin.json'), overlay = json('.codex-plugin/plugin.json');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, '110lab'); assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  compareVersions(manifest.version, manifest.version);
  assert.equal(overlay.name, manifest.name); assert.equal(overlay.version, manifest.version);
  assert.deepEqual(overlay.interface, manifest.extensions['com.openai'].interface);
  assert.ok([...overlay.interface.shortDescription].length <= 30);
  const mcp = json('mcp.json');
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(mcp.mcpServers, json('.mcp.json').mcpServers);
  assert.deepEqual(Object.keys(mcp.mcpServers), ['110lab']);
  const server = mcp.mcpServers['110lab'];
  assert.equal(server.type, 'stdio'); assert.equal(server.command, 'node'); assert.equal(server.cwd, '${PLUGIN_ROOT}');
  assert.deepEqual(server.args, ['${PLUGIN_ROOT}/mcp/cobuild-bridge.mjs']);
  assert.deepEqual(server.env, { NODE_USE_SYSTEM_CA: '1', KNOWLEDGE_URL: 'https://knowledge.110-lab.cn/mcp' });
  for (const [name, bytes] of files) {
    if (name.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
    if (name.endsWith('.yaml')) {
      const data = parseYaml(bytes.toString('utf8'));
      assert.ok(data?.interface?.display_name && data.interface.short_description, 'Invalid skill metadata: ' + name);
    }
    const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(name);
    if (match) {
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(bytes.toString('utf8'));
      assert.ok(frontmatter, 'Skill frontmatter missing: ' + name);
      const data = parseYaml(frontmatter[1]);
      assert.equal(data.name, match[1]); assert.ok(typeof data.description === 'string' && data.description.trim());
    }
  }
  assert.deepEqual([...files.keys()].filter(x => /^skills\/[^/]+\/SKILL\.md$/.test(x)).sort(),
    ['cobuild', 'identity', 'knowledge', 'operations', 'requirement-dev'].map(x => 'skills/' + x + '/SKILL.md'));
  return manifest;
}
