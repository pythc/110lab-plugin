import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { clientFiles, readClient, validateClient, digest, compareVersions, validateSource } from './package-files.mjs';
import { embedPluginUpdate } from './embed-plugin-update.mjs';

export function prepareClient(input, version) {
  const files = new Map([...input].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const source = validateClient(files), changes = [];
  version ||= source.version; assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(compareVersions(version, source.version) >= 0, 'Version downgrade is not supported');
  const bridgePath = 'mcp/cobuild-bridge.mjs';
  const bridge = files.get(bridgePath).toString('utf8');
  let bundled = bridge;
  const pattern = /Object\.freeze\(\{version:"([\d.]+)",url:"https:\/\/internal\.110-lab\.cn\/plugin-update",downloadUrl:"https:\/\/internal\.110-lab\.cn\/downloads\/110lab-plugin-[\d.]+\.zip"\}\)/g;
  const matches = [...bridge.matchAll(pattern)];
  assert.ok(matches.length <= 1, 'Ambiguous runtime release constant');
  if (matches.length && matches[0][1] !== version) {
    assert.ok(compareVersions(version, source.version) > 0, 'Runtime version differs from the manifest; use a new patch --version');
    const prefix = '// 110lab distribution: runtime version follows plugin.json.\nimport {readFileSync as __distributionReadFileSync} from "node:fs";\n';
    const runtime = 'Object.freeze((()=>{const version=JSON.parse(__distributionReadFileSync(new URL("../plugin.json",import.meta.url),"utf8")).version;return{version,url:"https://github.com/pythc/110lab-plugin/releases/latest",downloadUrl:`https://github.com/pythc/110lab-plugin/releases/download/v${version}/110lab-plugin-${version}.zip`};})())';
    bundled = prefix + bundled.replace(matches[0][0], runtime);
    changes.push({ path: bridgePath, reason: 'Read the installed version from plugin.json; preserve the existing bridge behavior' });
  }
  if (compareVersions(version, '0.21.3') >= 0) {
    const updated = embedPluginUpdate(bundled);
    if (updated !== bundled) changes.push({ path: bridgePath, reason: 'Expose the 110lab release check and download tool' });
    bundled = updated;
  }
  if (bundled !== bridge) files.set(bridgePath, Buffer.from(bundled));
  if (version !== source.version) {
    for (const name of ['plugin.json', '.codex-plugin/plugin.json']) {
      const manifest = JSON.parse(files.get(name)); manifest.version = version;
      files.set(name, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
      changes.push({ path: name, reason: `Distribution patch ${source.version} -> ${version}` });
    }
  }
  validateClient(files);
  return { files, version, sourceVersion: source.version, changes };
}

// Apply the plugin directory and both metadata files as a recoverable operation.
// Keep backups on a rollback failure instead of deleting the only recovery copy.
export async function replacePaths(replacements) {
  const applied = [];
  try {
    for (const item of replacements) {
      await rename(item.destination, item.backup);
      try { await rename(item.staged, item.destination); }
      catch (error) {
        try { await rename(item.backup, item.destination); }
        catch (rollback) { throw new AggregateError([error, rollback], 'Restore failed; preserve staging backups'); }
        throw error;
      }
      applied.push(item);
    }
  } catch (error) {
    const failures = [];
    for (const item of applied.reverse()) {
      try { await rm(item.destination, { recursive: true }); await rename(item.backup, item.destination); }
      catch (rollback) { failures.push(rollback); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], 'Restore failed; preserve the staging directory and inspect backups');
    throw error;
  }
}

export async function syncClient({ root, sourceDirectory, provenance, version }) {
  const expected = await clientFiles(root), original = await readClient(sourceDirectory, expected);
  const prepared = prepareClient(original, version);
  const current = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
  assert.ok(compareVersions(prepared.version, current.version) >= 0, 'Version downgrade is not supported');
  const hashes = Object.fromEntries(expected.map(name => [name, digest(prepared.files.get(name))]));
  if (current.version === prepared.version) assert.deepEqual(hashes, current.files, 'Version already exists with different bytes; choose a new version');
  const metadata = {
    schemaVersion: 2, plugin: '110lab', version: prepared.version,
    source: { ...provenance, version: prepared.sourceVersion },
    originalFiles: Object.fromEntries(expected.map(name => [name, digest(original.get(name))])),
    changes: prepared.changes, files: hashes,
  };
  validateSource(metadata.source);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')); pkg.version = prepared.version;
  let lock;
  try {
    lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
    lock.version = prepared.version;
    if (lock.packages?.['']) { lock.packages[''].version = prepared.version; lock.packages[''].engines = pkg.engines; }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(resolve(root, 'artifacts'), { recursive: true });
  const stage = await mkdtemp(resolve(root, 'artifacts/sync-'));
  const stagedPlugin = resolve(stage, 'plugin'); let preserve = false;
  try {
    for (const [name, bytes] of prepared.files) {
      const target = resolve(stagedPlugin, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes, { mode: 0o644 });
    }
    validateClient(await readClient(stagedPlugin, expected));
    await writeFile(resolve(stage, 'distribution.json'), JSON.stringify(metadata, null, 2) + '\n');
    await writeFile(resolve(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    const paths = [['plugin', 'plugins/110lab'], ['distribution.json', 'distribution.json'], ['package.json', 'package.json']];
    if (lock) { await writeFile(resolve(stage, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n'); paths.push(['package-lock.json', 'package-lock.json']); }
    await replacePaths(paths.map(([file, destination], i) => ({ staged: resolve(stage, file), destination: resolve(root, destination), backup: resolve(stage, 'previous-' + i) })));
  } catch (error) { preserve = error instanceof AggregateError; throw error; }
  finally { if (!preserve) await rm(stage, { recursive: true, force: true }); }
  return { version: prepared.version, sourceVersion: prepared.sourceVersion, files: expected.length, changedFiles: prepared.changes.map(x => x.path) };
}

export async function extractArchive(archive, destination, expected) {
  const code = `import json,pathlib,stat,sys,zipfile
archive,destination,expected=sys.argv[1:];expected=set(json.loads(expected));root=pathlib.Path(destination)
with zipfile.ZipFile(archive) as z:
 items=[x for x in z.infolist() if not x.is_dir()]
 assert len(items)<=256 and sum(x.file_size for x in items)<=32*1024*1024,'Archive size limit exceeded'
 names=[x.filename for x in items];prefix='110lab/' if names and all(x.startswith('110lab/') for x in names) else ''
 normalized=[n[len(prefix):] for n in names]
 assert len(set(normalized))==len(normalized) and set(normalized)==expected,'Archive must contain exactly the reviewed complete client package'
 for item,name in zip(items,normalized):
  assert not stat.S_ISLNK(item.external_attr>>16),'Archive links are not allowed'
  assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts and '\\\\' not in name,'Invalid archive path'
  assert item.file_size<=8*1024*1024,'Archive entry too large'
  target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(item));target.chmod(0o644)
`;
  execFileSync('python3', ['-c', code, resolve(archive), destination, JSON.stringify(expected)], { stdio: ['ignore', 'pipe', 'pipe'] });
}

export async function main(args = process.argv.slice(2)) {
  const root = fileURLToPath(new URL('../', import.meta.url)), options = new Map();
  for (let i = 0; i < args.length; i++) {
    assert.ok(['--archive', '--source-url', '--version'].includes(args[i]) && args[i + 1], 'Usage: sync-client.mjs --archive file.zip --source-url https://... [--version x.y.z]');
    assert.ok(!options.has(args[i]), 'Duplicate option'); options.set(args[i], args[++i]);
  }
  assert.ok(options.has('--archive') && options.has('--source-url'), '--archive and --source-url are required');
  const archive = options.get('--archive'), sourceUrl = new URL(options.get('--source-url'));
  assert.equal(sourceUrl.protocol, 'https:'); assert.ok(!sourceUrl.username && !sourceUrl.password && !sourceUrl.search && !sourceUrl.hash);
  assert.equal(sourceUrl.origin, 'https://internal.110-lab.cn');
  assert.match(sourceUrl.pathname, /^\/downloads\/110lab-plugin-\d+\.\d+\.\d+\.zip$/);
  const info = await lstat(archive); assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= 32 * 1024 * 1024);
  const sha256 = digest(await readFile(archive));
  await mkdir(resolve(root, 'artifacts'), { recursive: true });
  const temp = await mkdtemp(resolve(root, 'artifacts/import-'));
  try {
    await extractArchive(archive, temp, await clientFiles(root));
    const manifest = JSON.parse(await readFile(resolve(temp, 'plugin.json'), 'utf8'));
    assert.equal(sourceUrl.pathname, `/downloads/110lab-plugin-${manifest.version}.zip`);
    console.log(JSON.stringify(await syncClient({ root, sourceDirectory: temp, version: options.get('--version'), provenance: { kind: 'release-archive', url: sourceUrl.href, sha256 } })));
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
