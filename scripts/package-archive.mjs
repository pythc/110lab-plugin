import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { clientFiles, readClient, validateClient, digest } from './package-files.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(resolve(root, 'distribution.json'), 'utf8'));
const files = await readClient(resolve(root, 'plugins/110lab'), await clientFiles(root));
assert.equal(validateClient(files).version, release.version);
for (const [name, bytes] of files) assert.equal(digest(bytes), release.files[name]);
await mkdir(resolve(root, 'artifacts'), { recursive: true });
const archive = resolve(root, 'artifacts', `110lab-plugin-${release.version}.zip`);
const code = `import json,pathlib,sys,zipfile
root,out,names=sys.argv[1:]
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name in json.loads(names):
  item=zipfile.ZipInfo('110lab/'+name,date_time=(1980,1,1,0,0,0));item.create_system=3;item.external_attr=0o100644<<16;item.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(item,(pathlib.Path(root)/name).read_bytes(),compresslevel=9)
`;
execFileSync('python3', ['-c', code, resolve(root, 'plugins/110lab'), archive, JSON.stringify([...files.keys()].sort())]);
console.log(JSON.stringify({ archive, version: release.version, files: files.size, sha256: digest(await readFile(archive)) }));
