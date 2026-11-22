import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { clientFiles, readClient, validateClient, digest } from '../scripts/package-files.mjs';
import { prepareClient, syncClient, replacePaths, extractArchive } from '../scripts/sync-client.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url));
const expected = await clientFiles(repo), original = await readClient(resolve(repo, 'plugins/110lab'), expected);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), '110lab-distribution-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'plugins'));
  await cp(resolve(repo, 'plugins/110lab'), join(root, 'plugins/110lab'), { recursive: true });
  for (const name of ['client-files.json', 'distribution.json', 'package.json', 'package-lock.json']) await cp(resolve(repo, name), join(root, name));
  return root;
}
const hashTree = async root => Object.fromEntries([...await readClient(join(root, 'plugins/110lab'), expected)].map(([name, bytes]) => [name, digest(bytes)]));
const provenance = { kind: 'release-archive', url: 'https://internal.110-lab.cn/downloads/110lab-plugin-0.21.1.zip', sha256: 'a'.repeat(64) };

test('retains all skills, documentation, schemas, bridge files and legal notices', () => {
  assert.equal(original.size, 61); assert.equal(validateClient(original).version, '0.21.1');
  const updated = prepareClient(original, '0.21.2');
  assert.deepEqual([...updated.files.keys()].sort(), expected);
  for (const [name, bytes] of original) if (!['plugin.json', '.codex-plugin/plugin.json'].includes(name)) assert.deepEqual(updated.files.get(name), bytes);
});

test('catches the observed runtime-version drift and fixes only an explicit new patch', () => {
  const source = new Map(original);
  source.set('mcp/cobuild-bridge.mjs', Buffer.from('const release=Object.freeze({version:"0.20.4",url:"https://internal.110-lab.cn/plugin-update",downloadUrl:"https://internal.110-lab.cn/downloads/110lab-plugin-0.20.4.zip"});export{release};'));
  assert.throws(() => prepareClient(source), /use a new patch/);
  const fixed = prepareClient(source, '0.21.2');
  assert.match(fixed.files.get('mcp/cobuild-bridge.mjs').toString(), /new URL\("\.\.\/plugin.json"/);
  assert.match(fixed.files.get('mcp/cobuild-bridge.mjs').toString(), /github.com\/pythc\/110lab-plugin\/releases/);
  assert.equal(JSON.parse(fixed.files.get('plugin.json')).version, '0.21.2');
  assert.throws(() => prepareClient(original, '0.20.0'), /downgrade/);
});

test('new release updates the complete directory, hashes, root package and lock metadata', async t => {
  const root = await fixture(t), before = await hashTree(root);
  const result = await syncClient({ root, sourceDirectory: resolve(repo, 'plugins/110lab'), provenance, version: '0.21.2' });
  assert.equal(result.files, 61);
  const dist = JSON.parse(await readFile(join(root, 'distribution.json'))), lock = JSON.parse(await readFile(join(root, 'package-lock.json')));
  assert.equal(dist.schemaVersion, 2); assert.equal(dist.source.version, '0.21.1'); assert.equal(dist.version, '0.21.2');
  assert.equal(JSON.parse(await readFile(join(root, 'package.json'))).version, '0.21.2');
  assert.equal(lock.version, '0.21.2'); assert.equal(lock.packages[''].version, '0.21.2');
  assert.deepEqual(dist.originalFiles, before); assert.deepEqual(dist.files, await hashTree(root));
  // Repeat the identical import; a release cannot acquire new bytes under the same version.
  await syncClient({ root, sourceDirectory: resolve(repo, 'plugins/110lab'), provenance, version: '0.21.2' });
  const source = join(root, 'bad-source'); await cp(resolve(repo, 'plugins/110lab'), source, { recursive: true });
  await writeFile(join(source, 'README.md'), 'Changed after publication');
  const hashes = await hashTree(root);
  await assert.rejects(syncClient({ root, sourceDirectory: source, provenance, version: '0.21.2' }), /different bytes/);
  assert.deepEqual(await hashTree(root), hashes);
});

test('an incomplete or unexpected input fails before replacing the current package', async t => {
  for (const mode of ['missing', 'extra', 'symlink']) {
    const root = await fixture(t), source = join(root, 'source');
    await cp(resolve(repo, 'plugins/110lab'), source, { recursive: true });
    const before = await hashTree(root), metadata = await readFile(join(root, 'distribution.json'));
    if (mode === 'missing') await rm(join(source, 'mcp/knowledge-tools.json'));
    if (mode === 'extra') await writeFile(join(source, 'unreviewed.txt'), 'not in package');
    if (mode === 'symlink') { await rm(join(source, 'README.md')); await symlink(join(repo, 'README.md'), join(source, 'README.md')); }
    await assert.rejects(syncClient({ root, sourceDirectory: source, provenance, version: '0.21.2' }));
    assert.deepEqual(await hashTree(root), before); assert.deepEqual(await readFile(join(root, 'distribution.json')), metadata);
  }
});

test('failure midway through file replacement restores every earlier destination', async t => {
  const root = await fixture(t);
  for (const name of ['a', 'b']) await writeFile(join(root, name), 'old-' + name);
  await writeFile(join(root, 'new-a'), 'new-a');
  await assert.rejects(replacePaths([
    { destination: join(root, 'a'), staged: join(root, 'new-a'), backup: join(root, 'backup-a') },
    { destination: join(root, 'b'), staged: join(root, 'missing-b'), backup: join(root, 'backup-b') },
  ]), /ENOENT/);
  assert.equal(await readFile(join(root, 'a'), 'utf8'), 'old-a'); assert.equal(await readFile(join(root, 'b'), 'utf8'), 'old-b');
});

test('parses actual skill YAML and rejects inconsistent manifests or added environment', () => {
  const invalid = new Map(original); invalid.set('skills/identity/agents/openai.yaml', Buffer.from('interface: [unterminated'));
  assert.throws(() => validateClient(invalid));
  const config = JSON.parse(original.get('.mcp.json')); config.mcpServers['110lab'].env.UNRELATED = 'unexpected';
  invalid.set('skills/identity/agents/openai.yaml', original.get('skills/identity/agents/openai.yaml'));
  invalid.set('.mcp.json', Buffer.from(JSON.stringify(config))); assert.throws(() => validateClient(invalid));
});

function zip(source, target, mode) {
  const code = `import pathlib,sys,zipfile
+source,target,mode=sys.argv[1:]
+with zipfile.ZipFile(target,'w') as z:
+ for p in sorted(pathlib.Path(source).rglob('*')):
+  if p.is_file() and not(mode=='partial' and p.name=='cobuild-bridge.mjs') and not(mode=='link' and str(p.relative_to(source))=='README.md'):z.write(p,'110lab/'+str(p.relative_to(source)))
+ if mode=='traversal':z.writestr('../escape.txt','never extract')
+ if mode=='duplicate':z.writestr('110lab/plugin.json','{}')
+ if mode=='link':
+  item=zipfile.ZipInfo('110lab/README.md');item.create_system=3;item.external_attr=0o120777<<16;z.writestr(item,'/tmp/outside')
+`.replace(/^\+/gm, '');
  execFileSync('python3', ['-c', code, source, target, mode]);
}
test('extracts complete archives and rejects partial updates, extra paths and duplicate entries', async t => {
  const root = await fixture(t);
  for (const mode of ['complete', 'partial', 'traversal', 'duplicate', 'link']) {
    const target = join(root, mode + '.zip'), destination = join(root, mode); await mkdir(destination);
    zip(resolve(repo, 'plugins/110lab'), target, mode);
    if (mode === 'complete') {
      await extractArchive(target, destination, expected); assert.deepEqual(await readClient(destination, expected), original);
    } else await assert.rejects(extractArchive(target, destination, expected));
  }
});

test('refuses a stale release or unverifiable source before changing a package', async t => {
  const root = await fixture(t), before = await hashTree(root), distPath = join(root, 'distribution.json');
  await assert.rejects(syncClient({ root, sourceDirectory: resolve(repo, 'plugins/110lab'), provenance: { ...provenance, sha256: 'invalid' }, version: '0.21.2' }));
  assert.deepEqual(await hashTree(root), before);
  const dist = JSON.parse(await readFile(distPath)); dist.version = '0.22.0'; await writeFile(distPath, JSON.stringify(dist));
  await assert.rejects(syncClient({ root, sourceDirectory: resolve(repo, 'plugins/110lab'), provenance, version: '0.21.2' }), /downgrade/);
  assert.deepEqual(await hashTree(root), before);
});

test('the Git entrypoint rebuilds and records the real commit, and rejects dirty or wrong origins', async t => {
  const root = await fixture(t), upstream = join(root, 'upstream'); await mkdir(upstream);
  await cp(resolve(repo, 'scripts'), join(root, 'scripts'), { recursive: true });
  await symlink(resolve(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  await writeFile(join(upstream, '.gitignore'), 'artifacts/\n.build-done\n');
  await writeFile(join(upstream, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: { build: 'node build.mjs', 'package:plugin': 'node package.mjs' } }));
  await writeFile(join(upstream, 'build.mjs'), "import{writeFileSync}from'node:fs';writeFileSync('.build-done','built');\n");
  await writeFile(join(upstream, 'package.mjs'), "import{readFileSync,cpSync,mkdirSync}from'node:fs';if(readFileSync('.build-done','utf8')!=='built')throw Error('not built');mkdirSync('artifacts',{recursive:true});cpSync('../plugins/110lab','artifacts/plugin',{recursive:true});\n");
  const git = (...args) => execFileSync('git', args, { cwd: upstream, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Distribution Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', 'https://github.com/pythc/110lab-website.git'); git('add', '.'); git('commit', '-qm', 'fixture');
  await mkdir(join(upstream, 'artifacts/plugin'), { recursive: true });
  await writeFile(join(upstream, 'artifacts/plugin/stale.txt'), 'must not survive a rebuild');
  const invoke = () => execFileSync(process.execPath, [join(root, 'scripts/sync-from-website.mjs'), upstream, '--version', '0.21.2'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  invoke(); const dist = JSON.parse(await readFile(join(root, 'distribution.json')));
  assert.equal(dist.source.kind, 'git'); assert.equal(dist.source.commit, git('rev-parse', 'HEAD')); assert.equal(dist.source.tree, git('rev-parse', 'HEAD^{tree}'));
  assert.equal(dist.version, '0.21.2');
  const before = await hashTree(root);
  await writeFile(join(upstream, 'untracked.mjs'), 'unreviewed'); assert.throws(invoke); await rm(join(upstream, 'untracked.mjs'));
  git('remote', 'set-url', 'origin', 'https://github.com/example/other.git'); assert.throws(invoke);
  git('remote', 'set-url', 'origin', 'https://github.com/pythc/110lab-website.git');
  await writeFile(join(upstream, 'build.mjs'), "import{writeFileSync}from'node:fs';writeFileSync('package.json','{}');\n"); git('add', '.'); git('commit', '-qm', 'broken build fixture');
  assert.throws(invoke); assert.deepEqual(await hashTree(root), before);
});
