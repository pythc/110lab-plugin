import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const start = '// Begin 110lab distribution update tool\n';
const end = '// End 110lab distribution update tool\n';
const source = readFileSync(new URL('./plugin-update.mjs', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

export function embedPluginUpdate(bridge) {
  const existing = bridge.indexOf(start);
  if (existing !== -1) {
    const boundary = bridge.indexOf(end, existing);
    assert.ok(boundary !== -1, 'Incomplete update tool in the CoBuild bundle');
    return bridge.slice(0, existing) + start + source + end + bridge.slice(boundary + end.length);
  }

  // Keep the imported SDK bundle intact and add the tool to its local dispatcher.
  const listings = [...bridge.matchAll(/tools:\[\.\.\.[\w$]+,\.\.\.Object\.values\([\w$]+\)\.flat\(\)\]/g)];
  const handlers = [...bridge.matchAll(/let\{name:([\w$]+),arguments:([\w$]+)=\{\}\}=[\w$]+\.params;(?=if\([\w$]+\.some\()/g)];
  const versions = [...bridge.matchAll(/name:"110lab-cobuild",version:([\w$]+)\.version/g)];
  assert.equal(listings.length, 1, 'Cannot locate the CoBuild tool list');
  assert.equal(handlers.length, 1, 'Cannot locate the CoBuild tool dispatcher');
  assert.equal(versions.length, 1, 'Cannot locate the CoBuild runtime version');
  const [handler, name, args] = handlers[0];
  const updated = bridge.replace(listings[0][0], listings[0][0].replace('tools:[', 'tools:[LAB_PLUGIN_UPDATE_TOOL,'))
    .replace(handler, handler + `if(${name}===LAB_PLUGIN_UPDATE_TOOL.name)return handleLabPluginUpdate(${args},{installedVersion:${versions[0][1]}.version});`);
  return start + source + end + updated;
}
