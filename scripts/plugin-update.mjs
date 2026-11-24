import { createHash as labUpdateCreateHash } from 'node:crypto';
import { createWriteStream as labUpdateCreateWriteStream } from 'node:fs';
import { mkdtemp as labUpdateMkdtemp, rename as labUpdateRename, rm as labUpdateRm } from 'node:fs/promises';
import { tmpdir as labUpdateTmpdir } from 'node:os';
import { join as labUpdateJoin } from 'node:path';
import { Readable as LabUpdateReadable, Transform as LabUpdateTransform } from 'node:stream';
import { pipeline as labUpdatePipeline } from 'node:stream/promises';

const labUpdateRepo = 'pythc/110lab-plugin';
const labUpdateReleaseApi = `https://api.github.com/repos/${labUpdateRepo}/releases/latest`;
const labUpdateMaxPackageSize = 32 * 1024 * 1024;
const labUpdateVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const labUpdateDownloadHosts = new Set(['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
const labUpdateMarketplace = {
  name: '110lab',
  interface: { displayName: '110 实验室' },
  plugins: [{
    name: '110lab',
    source: { source: 'local', path: './plugins/110lab' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
  }],
};
const labUpdateInstallSteps = [
  '向用户展示目标版本和 ZIP 路径。用户确认安装后，先结束飞书授权，再退出 Codex 桌面端。',
  '把 ZIP 里的完整 110lab 目录解压到本地市场的 plugins/110lab，保留隐藏清单。已有本地市场可先备份原目录，再用新版完整替换。',
  '新建本地市场时，把结果里的 marketplaceManifest 保存到市场根目录的 .agents/plugins/marketplace.json，再执行 codex plugin marketplace add "<市场根目录>"。如同名市场已指向其他来源，先经用户确认，用 codex plugin marketplace remove 110lab 移除旧来源。',
  '执行 codex plugin add 110lab@110lab，重开 Codex 并开启新会话。核对插件版本、MCP 工具和 Skills，保留原有登录数据目录。',
];

export const LAB_PLUGIN_UPDATE_TOOL = {
  name: 'lab_plugin_update',
  description: [
    '检查 110lab 正式发布版，或下载包含 MCP、插件配置和 Skills 的完整更新包。check 查询版本，download 下载有更新的 ZIP。',
    'download 返回 ready_to_install 后，按以下步骤安装。',
    ...labUpdateInstallSteps,
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: { action: { type: 'string', enum: ['check', 'download'] } },
    required: ['action'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
};

function labUpdateCompareVersions(first, second) {
  const a = first.split('.').map(BigInt);
  const b = second.split('.').map(BigInt);
  for (const [index, part] of a.entries()) {
    if (part !== b[index]) return part > b[index] ? 1 : -1;
  }
  return 0;
}

function labUpdateToolResult(value, isError = false) {
  return { structuredContent: value, content: [{ type: 'text', text: JSON.stringify(value) }], ...(isError && { isError }) };
}

async function fetchLabUpdateArchive(url, fetchImpl) {
  const signal = AbortSignal.timeout(30000);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (url.protocol !== 'https:' || !labUpdateDownloadHosts.has(url.hostname) ||
        url.username || url.password || url.port) throw new Error('Unexpected release download host');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': '110lab-plugin-update' },
      redirect: 'manual',
      signal,
    });
    if (response.ok && response.body) return response.body;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) break;
    url = new URL(location, url);
  }
  throw new Error('Release archive download failed');
}

async function saveLabUpdateArchive(asset, fetchImpl, temporaryRoot) {
  const directory = await labUpdateMkdtemp(labUpdateJoin(temporaryRoot, '110lab-update-'));
  const archive = labUpdateJoin(directory, asset.name);
  const partial = archive + '.partial';
  let size = 0;
  const hash = labUpdateCreateHash('sha256');
  try {
    const url = new URL(`https://api.github.com/repos/${labUpdateRepo}/releases/assets/${asset.id}`);
    const body = await fetchLabUpdateArchive(url, fetchImpl);
    const checksum = new LabUpdateTransform({
      transform(chunk, encoding, done) {
        size += chunk.length;
        if (size > asset.size) return done(new Error('Unexpected release archive size'));
        hash.update(chunk);
        done(null, chunk);
      },
    });
    await labUpdatePipeline(
      LabUpdateReadable.fromWeb(body), checksum, labUpdateCreateWriteStream(partial, { flags: 'wx', mode: 0o600 }),
    );
    if (size !== asset.size || 'sha256:' + hash.digest('hex') !== asset.digest) {
      throw new Error('Release archive integrity check failed');
    }
    await labUpdateRename(partial, archive);
    return archive;
  } catch (error) {
    await labUpdateRm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function handleLabPluginUpdate(args, { installedVersion, fetchImpl = fetch, temporaryRoot = labUpdateTmpdir() }) {
  if (!args || Object.keys(args).length !== 1 || !LAB_PLUGIN_UPDATE_TOOL.inputSchema.properties.action.enum.includes(args.action)) {
    return labUpdateToolResult({ status: 'invalid_arguments', message: 'action 必须是 check 或 download。' }, true);
  }
  if (typeof installedVersion !== 'string' || !labUpdateVersionPattern.test(installedVersion)) {
    return labUpdateToolResult({ status: 'unknown_version', message: '无法识别当前运行版本。' }, true);
  }

  let release;
  try {
    const response = await fetchImpl(labUpdateReleaseApi, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': '110lab-plugin-update' },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) return labUpdateToolResult({ status: 'no_release', installedVersion });
      throw new Error('Release service unavailable');
    }
    release = await response.json();
  } catch {
    return labUpdateToolResult({ status: 'check_failed', installedVersion, message: '暂时无法读取 GitHub 正式发布信息，请检查网络后重试。' }, true);
  }

  const tag = release?.tag_name;
  const version = typeof tag === 'string' && tag.startsWith('v') ? tag.slice(1) : '';
  if (release?.draft !== false || release.prerelease !== false || !labUpdateVersionPattern.test(version)) {
    return labUpdateToolResult({ status: 'invalid_release', installedVersion, message: '发布信息缺少有效的正式版本。' }, true);
  }
  const details = {
    installedVersion, latestVersion: version,
    releaseUrl: `https://github.com/${labUpdateRepo}/releases/tag/${tag}`,
  };
  const comparison = labUpdateCompareVersions(version, installedVersion);
  if (comparison <= 0) {
    return labUpdateToolResult({ ...details, updateAvailable: false, status: comparison === 0 ? 'up_to_date' : 'installed_ahead' });
  }

  const name = `110lab-plugin-${version}.zip`;
  const downloadUrl = `https://github.com/${labUpdateRepo}/releases/download/${tag}/${name}`;
  const asset = Array.isArray(release.assets) ? release.assets.find(candidate => candidate?.name === name) : undefined;
  if (!asset || asset.state !== 'uploaded' || asset.browser_download_url !== downloadUrl ||
      !Number.isSafeInteger(asset.id) || asset.id < 1 ||
      !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > labUpdateMaxPackageSize ||
      typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) {
    return labUpdateToolResult({ ...details, updateAvailable: true, status: 'package_unavailable', message: '新版尚未提供可下载且带 SHA-256 的完整插件包。' }, true);
  }
  if (args.action === 'check') return labUpdateToolResult({ ...details, updateAvailable: true, status: 'update_available' });

  try {
    const downloadPath = await saveLabUpdateArchive(asset, fetchImpl, temporaryRoot);
    return labUpdateToolResult({
      ...details, updateAvailable: true, status: 'ready_to_install', downloadPath,
      sha256: asset.digest.slice(7), installationSteps: labUpdateInstallSteps, marketplaceManifest: labUpdateMarketplace,
    });
  } catch {
    return labUpdateToolResult({ ...details, updateAvailable: true, status: 'download_failed', message: 'ZIP 下载或校验失败，请检查网络和本机临时目录后重试。' }, true);
  }
}
