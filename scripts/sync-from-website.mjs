// Import only reviewed client files. Never copy the website checkout recursively.
import { readFile, writeFile, mkdir, lstat, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2] && resolve(process.argv[2]);
if (!source) throw new Error('Usage: node scripts/sync-from-website.mjs /path/to/110lab-website');
const git = (...args) => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Source checkout must have no tracked changes');
if (!['https://github.com/pythc/110lab-website.git', 'https://github.com/pythc/110lab-website', 'git@github.com:pythc/110lab-website.git'].includes(git('remote', 'get-url', 'origin'))) throw new Error('Unexpected upstream repository');
const commit = git('rev-parse', 'HEAD');
// Generated bundles are ignored upstream; always rebuild instead of trusting a stale file.
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: source, stdio: 'inherit' });
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Build changed tracked source files');
const files = [
  'plugin.json', '.codex-plugin/plugin.json', 'mcp.json', '.mcp.json',
  'assets/logo.png', 'assets/logo.svg', 'assets/sidebar-icon.png', 'assets/sidebar-icon.svg',
  'mcp/portal-bridge.mjs', 'mcp/requirements-bridge.mjs', 'mcp/requirements-client.mjs', 'mcp/NOTICE.txt',
];
const sourceRoot = resolve(source, 'plugin/110lab');
// Preflight all files before replacing any release content.
for (const file of files) {
  const info = await lstat(resolve(sourceRoot, file));
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Not a regular file: ' + file);
}
const version = JSON.parse(await readFile(resolve(sourceRoot, 'plugin.json'), 'utf8')).version;
const hashes = {};
for (const file of files) {
  const target = resolve(root, 'plugins/110lab', file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, file), target);
  hashes[file] = createHash('sha256').update(await readFile(target)).digest('hex');
}
await writeFile(resolve(root, 'plugins/110lab/README.md'), '# 110lab\n\n110 实验室工作台。安装、飞书登录和需求平台个人连接说明：\n\nhttps://github.com/pythc/110lab-plugin#readme\n\n插件通过本机 Node.js 20.11+ 运行；不需要 npm install。第三方依赖许可见 mcp/NOTICE.txt。\n');
hashes['README.md'] = createHash('sha256').update(await readFile(resolve(root, 'plugins/110lab/README.md'))).digest('hex');
await writeFile(resolve(root, 'distribution.json'), JSON.stringify({
  plugin: '110lab', version,
  source: { repository: 'https://github.com/pythc/110lab-website', commit, tree: git('rev-parse', 'HEAD^{tree}') },
  files: hashes,
}, null, 2) + '\n');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
pkg.version = version;
await writeFile(resolve(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log(JSON.stringify({ version, sourceCommit: commit, files: Object.keys(hashes).length }));
