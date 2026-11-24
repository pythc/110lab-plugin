import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';
import { handleLabPluginUpdate } from './plugin-update.mjs';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const entrypoint = 'mcp/cobuild-bridge.mjs';
const requiredFiles = ['mcp.json', '.mcp.json', '.codex-plugin/plugin.json', entrypoint, 'mcp/cobuild-tools.json',
  'mcp/portal-bridge.mjs', 'mcp/requirements-bridge.mjs', 'mcp/requirements-client.mjs', 'mcp/knowledge-bridge.mjs',
  'skills/identity/SKILL.md'];
const oauthTools = ['lab_sign_in', 'lab_whoami', 'lab_connect_requirements',
  'lab_requirements_connection_status', 'kb_connect', 'kb_connection_status', 'kb_whoami'];

function compareVersions(left, right) {
  const a = left.split('.').map(BigInt);
  const b = right.split('.').map(BigInt);
  for (const [i, part] of a.entries()) {
    if (part !== b[i]) return part > b[i] ? 1 : -1;
  }
  return 0;
}

async function installedPlugin(directory, version) {
  const root = join(directory, '110lab');
  try {
    if (!(await lstat(directory)).isDirectory() || !(await lstat(root)).isDirectory()) return;
    const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'));
    if (manifest.name !== '110lab' || manifest.version !== version) return;
    for (const filename of requiredFiles) {
      if (!(await lstat(join(root, filename))).isFile()) return;
    }
    return { root, version };
  } catch {
    return;
  }
}

async function extractPackage(archive, destination) {
  const zip = await yauzl.openPromise(archive, { lazyEntries: true, autoClose: false, strictFileNames: true });
  const filenames = new Set();
  let total = 0;
  try {
    if (zip.entryCount < 1 || zip.entryCount > 256) throw new Error('Unexpected number of ZIP entries');
    for await (const entry of zip.eachEntry()) {
      const parts = entry.fileName.split('/');
      const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      const key = entry.fileName.normalize('NFC').toLowerCase();
      const isReserved = part => /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(part);
      if (parts.length < 2 || parts[0] !== '110lab' || filenames.has(key) || (mode && mode !== 0o100000) ||
          parts.some(part => !part || /[<>:"\\|?*\u0000-\u001f]|[ .]$/u.test(part) || isReserved(part))) {
        throw new Error('Unexpected ZIP entry');
      }
      filenames.add(key);
      total += entry.uncompressedSize;
      if (entry.uncompressedSize > 8 * 1024 * 1024 || total > 32 * 1024 * 1024) {
        throw new Error('Uncompressed ZIP is too large');
      }
      const output = join(destination, ...parts);
      await mkdir(dirname(output), { recursive: true });
      await pipeline(await zip.openReadStreamPromise(entry), createWriteStream(output, { flags: 'wx', mode: 0o600 }));
    }
  } finally {
    zip.close();
  }
}

function bridgeEnvironment() {
  return { NODE_USE_SYSTEM_CA: '1', KNOWLEDGE_URL: 'https://knowledge.110-lab.cn/mcp', ...process.env };
}

async function probeBridge(plugin) {
  const child = spawn(process.execPath, [join(plugin.root, entrypoint)], {
    cwd: plugin.root, env: bridgeEnvironment(), stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
  });
  const closed = once(child, 'close').catch(() => {});
  const lines = createInterface({ input: child.stdout });
  let timeout;
  try {
    await new Promise((done, fail) => {
      timeout = setTimeout(() => fail(new Error('MCP startup check timed out')), 5000);
      const send = (method, params, id) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n');
      child.once('error', fail);
      child.once('exit', () => fail(new Error('MCP exited during startup check')));
      child.stdin.once('error', fail);
      lines.on('line', line => {
        try {
          const response = JSON.parse(line);
          if (response.jsonrpc !== '2.0' || response.error) throw new Error('Invalid MCP response');
          if (response.id === 1) {
            if (response.result?.serverInfo?.name !== '110lab-cobuild' ||
                response.result?.serverInfo?.version !== plugin.version) throw new Error('Unexpected MCP identity');
            send('notifications/initialized');
            send('tools/list', {}, 2);
          } else if (response.id === 2) {
            const names = new Set(response.result?.tools?.map(tool => tool.name));
            if (!oauthTools.every(name => names.has(name)) || !names.has('lab_plugin_update')) {
              throw new Error('MCP update or OAuth tools are missing');
            }
            done();
          }
        } catch (error) {
          fail(error);
        }
      });
      send('initialize', { protocolVersion: '2025-03-26', capabilities: {},
        clientInfo: { name: '110lab-launcher-check', version: '1.0.0' } }, 1);
    });
  } finally {
    clearTimeout(timeout);
    lines.close();
    child.stdin.destroy();
    child.kill();
    await closed;
  }
}

export async function preparePortablePlugin(installation, { fetchImpl = fetch, log = () => {} } = {}) {
  const versions = join(installation, 'versions');
  const installed = (await readdir(versions)).filter(name => versionPattern.test(name)).sort((a, b) => compareVersions(b, a));
  let current;
  for (const version of installed) {
    current = await installedPlugin(join(versions, version), version);
    if (current) break;
  }
  if (!current) throw new Error('110lab 安装包不完整。请重新解压通用安装包。');

  let workspace;
  try {
    workspace = await mkdtemp(join(versions, '.update-'));
    const deadline = AbortSignal.timeout(15000);
    const response = await handleLabPluginUpdate({ action: 'download' }, {
      installedVersion: current.version, temporaryRoot: workspace,
      fetchImpl: (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.any([deadline, options.signal]) }),
    });
    const update = response.structuredContent;
    if (update.status !== 'ready_to_install') {
      if (response.isError) log(`更新未完成（${update.status}），继续运行 ${current.version}`);
      return current;
    }

    const stage = join(workspace, 'package');
    await extractPackage(update.downloadPath, stage);
    const candidate = await installedPlugin(stage, update.latestVersion);
    if (!candidate) throw new Error('新版文件或版本清单不完整');
    await probeBridge(candidate);

    const destination = join(versions, update.latestVersion);
    try {
      await rename(stage, destination);
    } catch (error) {
      // Another launcher may have finished installing this version first.
      if (!await installedPlugin(destination, update.latestVersion)) throw error;
    }
    log(`已安装 110lab ${update.latestVersion}`);
    return await installedPlugin(destination, update.latestVersion) ?? current;
  } catch (error) {
    log(`更新失败，继续运行 ${current.version}（${error.message}）`);
    return current;
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const log = message => process.stderr.write(`[110lab] ${message}\n`);
  const plugin = await preparePortablePlugin(dirname(fileURLToPath(import.meta.url)), { log });
  const child = spawn(process.execPath, [join(plugin.root, entrypoint)], {
    cwd: plugin.root, env: bridgeEnvironment(), stdio: 'inherit', windowsHide: true,
  });
  const stop = signal => child.kill(signal);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const [code] = await once(child, 'close');
    process.exitCode = code ?? 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`[110lab] ${error.message}\n`); process.exitCode = 1; });
}
