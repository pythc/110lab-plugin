import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ENDPOINT, loadIdentityCredential, saveIdentityCredential } from '../plugins/110lab/mcp/requirements-client.mjs';

const windows = process.platform === 'win32';
const credential = {
  version: 2,
  endpoint: ENDPOINT,
  identityToken: 'a'.repeat(43),
  personalToken: 'rmcp_v1.test',
  openApiKey: 'test',
  expiresAt: '2099-01-01T00:00:00Z',
};

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), '110lab-requirements-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('saves, reloads and replaces a requirement identity in a new private directory', t => {
  const file = join(fixture(t), '新凭据 [测试]', 'identity.json');
  assert.equal(loadIdentityCredential(file), undefined);
  saveIdentityCredential(file, credential);
  assert.deepEqual(loadIdentityCredential(file), credential);
  saveIdentityCredential(file, { ...credential, name: 'Replacement' });
  assert.equal(loadIdentityCredential(file).name, 'Replacement');
});

test('rejects a credential file that grants other accounts access', t => {
  const file = join(fixture(t), 'auth', 'identity.json');
  saveIdentityCredential(file, credential);
  if (windows) {
    execFileSync('icacls.exe', [file, '/grant', '*S-1-1-0:(R)'], { stdio: 'ignore', windowsHide: true });
  } else {
    chmodSync(file, 0o644);
  }
  assert.throws(() => loadIdentityCredential(file), /需求连接文件.*无效/);
  assert.throws(() => saveIdentityCredential(file, credential), /需求连接文件.*无效/);
});

test('repairs an empty Windows directory left by a failed login and rejects an unsafe populated directory', { skip: !windows }, t => {
  const root = fixture(t);
  const directory = join(root, 'old-auth');
  mkdirSync(directory);
  const file = join(directory, 'identity.json');
  saveIdentityCredential(file, credential);
  assert.deepEqual(loadIdentityCredential(file), credential);

  const populated = join(root, 'populated');
  mkdirSync(populated);
  writeFileSync(join(populated, 'unrelated.txt'), 'Keep this file');
  assert.throws(() => saveIdentityCredential(join(populated, 'identity.json'), credential), /连接目录权限无效/);
});
