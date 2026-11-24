import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { handleLabPluginUpdate } from '../scripts/plugin-update.mjs';

const releaseApi = 'https://api.github.com/repos/pythc/110lab-plugin/releases/latest';
const assetApi = 'https://api.github.com/repos/pythc/110lab-plugin/releases/assets/42';
const packageBytes = Buffer.from('test archive bytes');
const sha256 = createHash('sha256').update(packageBytes).digest('hex');

function release(version) {
  const tag = 'v' + version;
  const name = `110lab-plugin-${version}.zip`;
  return {
    tag_name: tag, draft: false, prerelease: false,
    assets: [{
      id: 42, name, state: 'uploaded', size: packageBytes.length, digest: 'sha256:' + sha256,
      browser_download_url: `https://github.com/pythc/110lab-plugin/releases/download/${tag}/${name}`,
    }],
  };
}

test('compares the published version with the running version without downloading on check', async () => {
  const options = { installedVersion: '0.21.3', fetchImpl: async (url) => {
    assert.equal(url, releaseApi);
    return Response.json(release('0.21.10'));
  } };
  const result = await handleLabPluginUpdate({ action: 'check' }, options);
  assert.equal(result.structuredContent.status, 'update_available');
  assert.equal(result.structuredContent.latestVersion, '0.21.10');
  for (const [installedVersion, expected] of [['0.21.10', 'up_to_date'], ['0.21.11', 'installed_ahead']]) {
    const response = await handleLabPluginUpdate({ action: 'download' }, { ...options, installedVersion });
    assert.equal(response.structuredContent.status, expected);
    assert.equal(response.structuredContent.updateAvailable, false);
  }
});

test('downloads a matching archive and returns its complete-package installation steps', async t => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), '110lab-update-test-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const latest = release('0.22.0');
  const assetUrl = 'https://release-assets.githubusercontent.com/fixture';
  const fetchImpl = async (url, options) => {
    if (url === releaseApi) return Response.json(latest);
    if (url.href === assetApi) {
      assert.equal(options.headers.Accept, 'application/octet-stream');
      return Response.redirect(assetUrl);
    }
    assert.equal(url.href, assetUrl);
    return new Response(packageBytes);
  };
  const result = await handleLabPluginUpdate({ action: 'download' }, { installedVersion: '0.21.3', fetchImpl, temporaryRoot });
  const value = result.structuredContent;
  assert.equal(value.status, 'ready_to_install');
  assert.deepEqual(await readFile(value.downloadPath), packageBytes);
  assert.equal(value.sha256, sha256);
  assert.match(value.installationSteps.join('\n'), /codex plugin add 110lab@110lab/);
  assert.equal(value.marketplaceManifest.plugins[0].source.path, './plugins/110lab');
});

test('rejects corrupted downloads and redirects away from the release hosts', async t => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), '110lab-update-test-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const latest = release('0.22.0');
  for (const response of [
    () => new Response(Buffer.alloc(packageBytes.length)),
    () => Response.redirect('https://example.test/unexpected.zip'),
  ]) {
    const fetchImpl = async url => {
      if (url === releaseApi) return Response.json(latest);
      assert.equal(url.href, assetApi);
      return response();
    };
    const result = await handleLabPluginUpdate({ action: 'download' }, { installedVersion: '0.21.3', fetchImpl, temporaryRoot });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.status, 'download_failed');
    assert.deepEqual(await readdir(temporaryRoot), []);
  }
});

test('reports missing archives and network failures without claiming to be up to date', async () => {
  const installedVersion = '0.21.3';
  const latest = release('0.22.0');
  latest.assets.length = 0;
  const missing = await handleLabPluginUpdate({ action: 'check' }, { installedVersion, fetchImpl: async () => Response.json(latest) });
  assert.equal(missing.structuredContent.status, 'package_unavailable');
  const disconnected = await handleLabPluginUpdate({ action: 'check' }, { installedVersion, fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.equal(disconnected.structuredContent.status, 'check_failed');
});
