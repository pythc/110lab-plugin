import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFiles, digest, readClient, validateClient } from './package-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
const pluginRoot = resolve(root, 'plugins/110lab');
const files = await readClient(pluginRoot, await clientFiles(root));
assert.equal(validateClient(files).version, release.version);
for (const [name, bytes] of files) assert.equal(digest(bytes), release.files[name]);

const dependency = name => dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));
const sources = {
  'launch.mjs': resolve(root, 'scripts/portable-launcher.mjs'),
  'plugin-update.mjs': resolve(root, 'scripts/plugin-update.mjs'),
  'README.md': resolve(root, 'docs/PORTABLE-MCP.md'),
  ...Object.fromEntries([...files.keys()].map(name => [`versions/${release.version}/110lab/${name}`, resolve(pluginRoot, name)])),
};
for (const [name, entries] of Object.entries({ yauzl: ['index.js', 'fd-slicer.js', 'crc32.js'], pend: ['index.js'] })) {
  for (const entry of ['LICENSE', 'package.json', ...entries]) {
    sources[`node_modules/${name}/${entry}`] = resolve(dependency(name), entry);
  }
}

await mkdir(resolve(root, 'artifacts'), { recursive: true });
const archive = resolve(root, 'artifacts', `110lab-portable-${release.version}.zip`);
const code = `import io,json,pathlib,sys,zipfile
output, = sys.argv[1:]
archive = io.BytesIO()
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,source in sorted(json.load(sys.stdin).items()):
  item=zipfile.ZipInfo('110lab-portable/'+name,date_time=(1980,1,1,0,0,0));item.create_system=3;item.external_attr=0o100644<<16;item.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(item,pathlib.Path(source).read_bytes(),compresslevel=9)
pathlib.Path(output).write_bytes(archive.getvalue())
`;
execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', code, archive], {
  input: JSON.stringify(sources), env: { ...process.env, PYTHONUTF8: '1' },
});
console.log(JSON.stringify({ archive, version: release.version, sha256: digest(await readFile(archive)) }));
