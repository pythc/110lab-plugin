import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { preparePortablePlugin } from '../scripts/portable-launcher.mjs';

const source = fileURLToPath(new URL('../plugins/110lab', import.meta.url));
const current = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')).version;
const [major, minor, patch] = current.split('.');
const target = `${major}.${minor}.${Number(patch) + 1}`;

async function installFixture(t) {
  const installation = await mkdtemp(join(tmpdir(), '110lab-portable-test-'));
  t.after(() => rm(installation, { recursive: true, force: true }));
  const seed = join(installation, 'versions', current, '110lab');
  await mkdir(join(installation, 'versions'), { recursive: true });
  await cp(source, seed, { recursive: true });
  return installation;
}

async function zipFixture(installation, { brokenBridge = false, extraPath = '' } = {}) {
  const output = join(installation, 'fixture.zip');
  const code = `import json,pathlib,sys,zipfile
root,path,version,broken,extra=sys.argv[1:]
root=pathlib.Path(root)
with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for item in root.rglob('*'):
  if not item.is_file(): continue
  name=item.relative_to(root).as_posix(); data=item.read_bytes()
  if name == 'plugin.json':
   manifest=json.loads(data); manifest['version']=version; data=json.dumps(manifest)
  if name == 'mcp/cobuild-bridge.mjs' and broken: data='throw new Error("broken candidate")'
  z.writestr('110lab/'+name,data)
 if extra: z.writestr(extra,'unsafe')
`;
  execFileSync(process.platform === 'win32' ? 'python' : 'python3',
    ['-c', code, source, output, target, brokenBridge ? 'yes' : '', extraPath], { env: { ...process.env, PYTHONUTF8: '1' } });
  return readFile(output);
}

function fakeRelease(bytes, { version = target, badDigest = false } = {}) {
  const tag = `v${version}`;
  const name = `110lab-plugin-${version}.zip`;
  return async url => {
    if (String(url).endsWith('/releases/assets/123')) return new Response(bytes);
    assert.match(String(url), /\/releases\/latest$/);
    return Response.json({
      tag_name: tag, draft: false, prerelease: false,
      assets: [{ id: 123, name, state: 'uploaded', size: bytes.length,
        digest: 'sha256:' + (badDigest ? '0'.repeat(64) : createHash('sha256').update(bytes).digest('hex')),
        browser_download_url: `https://github.com/pythc/110lab-plugin/releases/download/${tag}/${name}` }],
    });
  };
}

test('two clients can start during an update and keep the previous release intact', async t => {
  const installation = await installFixture(t);
  const fetchImpl = fakeRelease(await zipFixture(installation));
  const results = await Promise.all([preparePortablePlugin(installation, { fetchImpl }),
    preparePortablePlugin(installation, { fetchImpl })]);
  assert.deepEqual(results.map(plugin => plugin.version), [target, target]);
  assert.deepEqual((await readdir(join(installation, 'versions'))).sort(), [current, target].sort());
  assert.equal((await preparePortablePlugin(installation, { fetchImpl: fakeRelease(Buffer.from('old'), { version: current }) })).version, target);
  assert.ok(await readFile(join(results[0].root, 'skills', 'identity', 'SKILL.md'), 'utf8'));
});

test('keeps the installed version when offline or when the archive fails validation', async t => {
  const installation = await installFixture(t);
  const fakeNetwork = async () => { throw new Error('offline'); };
  const bytes = await zipFixture(installation, { extraPath: '110lab/../unsafe.txt' });
  for (const fetchImpl of [fakeNetwork, fakeRelease(bytes, { badDigest: true }), fakeRelease(bytes)]) {
    assert.equal((await preparePortablePlugin(installation, { fetchImpl })).version, current);
    assert.deepEqual(await readdir(join(installation, 'versions')), [current]);
  }
});

test('keeps the installed version if the new bridge cannot start', async t => {
  const installation = await installFixture(t);
  const messages = [];
  const fetchImpl = fakeRelease(await zipFixture(installation, { brokenBridge: true }));
  assert.equal((await preparePortablePlugin(installation, { fetchImpl, log: message => messages.push(message) })).version, current);
  assert.deepEqual(await readdir(join(installation, 'versions')), [current]);
  assert.match(messages.join('\n'), /MCP (exited|closed)/);
});
