// Starts the installed entrypoint. Offline discovery never opens a service connection.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = process.argv.indexOf('--plugin-root');
if (index >= 0) assert.ok(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), '--plugin-root requires a directory');
const plugin = index >= 0 ? resolve(process.argv[index + 1]) : resolve(root, 'plugins/110lab');
const release = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
const config = JSON.parse(await readFile(resolve(plugin, '.mcp.json'), 'utf8')).mcpServers['110lab'];
const entry = config.args[0].replace('${PLUGIN_ROOT}/', '');
const temporary = await mkdtemp(join(tmpdir(), '110lab-plugin-smoke-'));
const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP', 'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
Object.assign(env, config.env, { XDG_DATA_HOME: temporary, LAB_REQUIREMENTS_AUTH_DIR: join(temporary, 'requirements') });
const child = spawn(process.execPath, [resolve(plugin, entry)], { cwd: plugin, env, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map(); let sequence = 0, stderr = '', protocolError;
child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); });
const lines = createInterface({ input: child.stdout });
function rejectPending(error) { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); }
lines.on('line', line => {
  let value;
  try { value = JSON.parse(line); assert.equal(value.jsonrpc, '2.0'); }
  catch (error) { protocolError = error; rejectPending(error); return; }
  const p = pending.get(value.id);
  if (p) { pending.delete(value.id); clearTimeout(p.timer); value.error ? p.reject(new Error(value.error.message)) : p.resolve(value.result); }
});
child.on('error', rejectPending);
child.on('exit', () => rejectPending(new Error('Packaged MCP process exited')));
const request = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP timeout: ' + method)); }, 45000);
  pending.set(id, { resolve, reject, timer });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
try {
  const init = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: '110lab-distribution-verification', version: '1.0.0' } });
  assert.equal(init.serverInfo.name, '110lab-cobuild'); assert.equal(init.serverInfo.version, release.version); assert.ok(init.capabilities.tools);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const catalog = await request('tools/list'), names = catalog.tools.map(t => t.name);
  assert.equal(new Set(names).size, names.length);
  const domains = JSON.parse(await readFile(resolve(plugin, 'mcp/cobuild-tools.json'), 'utf8'));
  const expected = [...Object.values(domains).flat().map(t => t.name), 'cobuild_overview', 'cobuild_requirement_context', 'cobuild_delivery_check'];
  assert.deepEqual(names.toSorted(), expected.toSorted());
  const overview = await request('tools/call', { name: 'cobuild_overview', arguments: { checkConnections: false } });
  assert.ok(!overview.isError);
  const content = JSON.parse(overview.content.find(c => c.type === 'text').text);
  assert.equal(content.domains.length, 3); assert.equal(content.connections.state, 'not_checked');
  const result = { initialized: true, entrypoint: entry, version: release.version, node: process.version, toolCount: names.length, domains: content.domains.length, offlineOverview: true, live: false };
  if (process.argv.includes('--live')) {
    // Run this mode in a fresh OS/container account, without a personal home mount.
    const open = catalog.tools.find(t => t.name === 'open_110lab');
    assert.ok(open?._meta?.['openai/ui']?.entrypoints?.some(e => e.type === 'global'));
    const resource = await request('resources/read', { uri: open._meta.ui.resourceUri });
    assert.ok(resource.contents.some(c => c.text?.includes('110lab')));
    const workbench = await request('tools/call', { name: 'open_110lab', arguments: {} });
    assert.ok(!workbench.isError); assert.ok(workbench.structuredContent.appCount > 0);
    assert.equal(workbench.structuredContent.installedPluginVersion, release.version);
    Object.assign(result, { live: true, globalEntrypoint: true, uiResource: true, appCount: workbench.structuredContent.appCount });
  }
  assert.ok(!protocolError); console.log(JSON.stringify(result));
} catch (error) { throw new Error(error.message + (stderr ? '\n' + stderr : ''), { cause: error }); }
finally {
  rejectPending(new Error('Test complete'));
  const exit = once(child, 'exit'); child.stdin.end();
  const kill = setTimeout(() => child.kill('SIGTERM'), 3000);
  try { if (child.exitCode === null) await exit; }
  finally { clearTimeout(kill); lines.close(); await rm(temporary, { recursive: true, force: true }); }
}
