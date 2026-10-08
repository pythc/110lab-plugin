// No npm dependencies. Offline mode only initializes the actual packaged process.
// --live additionally reads the public workbench and its tool/resource catalog.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';

const root = fileURLToPath(new URL('../', import.meta.url));
const pluginArgument = process.argv.indexOf('--plugin-root');
if (pluginArgument >= 0 && (!process.argv[pluginArgument + 1] || process.argv[pluginArgument + 1].startsWith('--'))) throw new Error('--plugin-root requires a directory');
const plugin = pluginArgument >= 0 ? resolve(process.argv[pluginArgument + 1]) : resolve(root, 'plugins/110lab');
const release = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
const child = spawn(process.execPath, [resolve(plugin, 'mcp/portal-bridge.mjs')], { cwd: plugin, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let sequence = 0, stderr = '', protocolError;
child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); });
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let value;
  try { value = JSON.parse(line); assert.equal(value.jsonrpc, '2.0'); }
  catch (error) { protocolError = error; for (const p of pending.values()) p.reject(error); return; }
  const p = pending.get(value.id);
  if (p) { pending.delete(value.id); clearTimeout(p.timer); value.error ? p.reject(new Error(value.error.message)) : p.resolve(value.result); }
});
child.on('error', error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); });
const request = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP timeout: ' + method)); }, 45000);
  pending.set(id, { resolve, reject, timer });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
try {
  const init = await request('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: '110lab-distribution-verification', version: '1.0.0' } });
  assert.equal(init.serverInfo.name, '110lab');
  assert.equal(init.serverInfo.version, release.version);
  assert.ok(init.capabilities.tools);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const result = { initialized: true, version: release.version, node: process.version };
  if (process.argv.includes('--live')) {
    const catalog = await request('tools/list');
    const open = catalog.tools.find(t => t.name === 'open_110lab');
    assert.ok(open?._meta?.['openai/ui']?.entrypoints?.some(e => e.type === 'global'));
    const resource = await request('resources/read', { uri: open._meta.ui.resourceUri });
    assert.ok(resource.contents.some(c => c.text?.includes('110lab')));
    const workbench = await request('tools/call', { name: 'open_110lab', arguments: {} });
    assert.ok(!workbench.isError);
    assert.ok(workbench.structuredContent.appCount > 0);
    Object.assign(result, { toolCount: catalog.tools.length, globalEntrypoint: true, uiResource: true, appCount: workbench.structuredContent.appCount });
  }
  assert.ok(!protocolError);
  console.log(JSON.stringify(result));
} catch (error) { throw new Error(error.message + (stderr ? '\n' + stderr : ''), { cause: error }); }
finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  const exit = once(child, 'exit');
  child.stdin.end();
  const kill = setTimeout(() => child.kill('SIGKILL'), 3000);
  if (child.exitCode === null) await exit;
  clearTimeout(kill);
  lines.close();
}
