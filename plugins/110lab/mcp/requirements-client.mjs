// Credentials remain on the user's computer and go only to the existing app.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export const ENDPOINT = 'https://fcncvoyreb8p.feishuapp.com/app/app_17b6pxwde0x/openapi/mcp';
const MAX_RESPONSE = 8 * 1024 * 1024;
const DEFAULT_CREDENTIAL_FILE = path.join(os.homedir(), '.config', '110-requirement-mcp', 'credentials.json');

const windows = process.platform === 'win32';
const windowsAclScript = String.raw`
$ErrorActionPreference = 'Stop'
$target = $env:LAB_REQUIREMENTS_ACL_PATH
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$system = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$sidType = [System.Security.Principal.SecurityIdentifier]

function Assert-PrivateAcl($item) {
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Reparse point' }
  $acl = $item.GetAccessControl()
  $owner = $acl.GetOwner($sidType)
  $rules = @($acl.GetAccessRules($true, $true, $sidType))
  if ($owner -notin @($user, $system) -or !$rules.Count -or ($item.PSIsContainer -and !$acl.AreAccessRulesProtected)) {
    throw 'Credential ACL is not private'
  }
  foreach ($rule in $rules) {
    if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference -notin @($user, $system)) {
      throw 'Credential ACL grants access to another account'
    }
  }
}

if ($env:LAB_REQUIREMENTS_ACL_ACTION -eq 'prepare') {
  $security = [System.Security.AccessControl.DirectorySecurity]::new()
  $security.SetOwner($user)
  $security.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($user, $system)) {
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $security.AddAccessRule($rule)
  }
  [void][System.IO.Directory]::CreateDirectory($target, $security)
  $directory = Get-Item -LiteralPath $target -Force
  try { Assert-PrivateAcl $directory }
  catch {
    # Recover an empty directory left by a failed first login.
    if ($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint -or
        $directory.GetAccessControl().GetOwner($sidType) -ne $user -or
        @(Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1).Count) { throw }
    $existing = $directory.GetAccessControl('Access')
    $existing.SetSecurityDescriptorSddlForm($security.GetSecurityDescriptorSddlForm('Access'), 'Access')
    $directory.SetAccessControl($existing)
    Assert-PrivateAcl $directory
  }
} else {
  Assert-PrivateAcl (Get-Item -LiteralPath ([System.IO.Path]::GetDirectoryName($target)) -Force)
  Assert-PrivateAcl (Get-Item -LiteralPath $target -Force)
}
`;

function checkWindowsAcl(target, action) {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  const invalid = action === 'prepare' ? '连接目录权限无效' : '需求连接文件权限无效';
  if (!systemRoot || !path.isAbsolute(systemRoot)) throw new Error(invalid);
  try {
    execFileSync(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsAclScript, 'utf16le').toString('base64'),
    ], {
      env: { ...process.env, LAB_REQUIREMENTS_ACL_PATH: path.resolve(target), LAB_REQUIREMENTS_ACL_ACTION: action },
      stdio: 'ignore', windowsHide: true, timeout: 10000,
    });
  } catch {
    throw Object.assign(new Error(invalid), { safeMessage: `${invalid}。请确认凭据目录仅允许当前 Windows 账户和 SYSTEM 访问。` });
  }
}

function hasPrivateUnixMode(stat) {
  return (stat.mode & 0o077) === 0 && (!process.getuid || stat.uid === process.getuid());
}

export function loadIdentityCredential(file) {
  if (windows) {
    if (!fs.lstatSync(file, { throwIfNoEntry: false })) return;
    checkWindowsAcl(file, 'check');
  }
  let fd;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error('无法读取需求连接');
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 32768 || (!windows && !hasPrivateUnixMode(stat))) throw new Error();
    const value = JSON.parse(fs.readFileSync(fd, 'utf8'));
    if (value.version !== 2 || value.endpoint !== ENDPOINT || !/^[\w-]{43}$/.test(value.identityToken) ||
        !value.personalToken?.startsWith('rmcp_v1.') || typeof value.openApiKey !== 'string' || !value.openApiKey ||
        !Number.isFinite(Date.parse(value.expiresAt))) throw new Error();
    return value;
  } catch {
    throw new Error('需求连接文件无效');
  } finally {
    fs.closeSync(fd);
  }
}

export function saveIdentityCredential(file, value) {
  const directory = path.dirname(file);
  if (windows) checkWindowsAcl(directory, 'prepare');
  else {
    fs.mkdirSync(directory, { mode: 0o700, recursive: true });
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || !hasPrivateUnixMode(stat)) throw new Error('连接目录权限无效');
  }
  loadIdentityCredential(file);
  const temporary = file + '.' + randomBytes(8).toString('hex');
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    try {
      // Check the ACL the temporary file inherited before writing any credentials.
      if (windows) checkWindowsAcl(temporary, 'check');
      fs.writeFileSync(fd, JSON.stringify(value));
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export function loadCredentials(file = DEFAULT_CREDENTIAL_FILE) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 64 * 1024 || (stat.mode & 0o077) !== 0 ||
        (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe');
    const bytes = Buffer.alloc(64 * 1024 + 1);
    const size = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (size > 64 * 1024) throw new Error('too large');
    const value = JSON.parse(bytes.subarray(0, size).toString('utf8'));
    const validSecret = v => typeof v === 'string' && v.length > 0 && v.length <= 16384 && /^[\x21-\x7e]+$/.test(v);
    if (value.version !== 1 || value.endpoint !== ENDPOINT || !validSecret(value.openApiKey) ||
        !validSecret(value.personalToken) || !value.personalToken.startsWith('rmcp_v1.')) throw new Error('invalid');
    return {endpoint: ENDPOINT, openApiKey: value.openApiKey, personalToken: value.personalToken};
  } catch {
    throw new Error('需求平台连接码未配置或无效。请使用现有需求平台接入流程保存个人连接码，然后重新连接插件；凭据文件须由当前用户持有且仅本人可读。');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function decodeResponse(text, contentType) {
  if (!text.trim()) return [];
  const parse = raw => {
    const value = JSON.parse(raw);
    const values = Array.isArray(value) ? value : [value];
    if (values.some(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || item.jsonrpc !== '2.0') return true;
      if (!Object.hasOwn(item, 'id')) return typeof item.method !== 'string';
      if (!(item.id === null || typeof item.id === 'string' || Number.isSafeInteger(item.id))) return true;
      return Object.hasOwn(item, 'result') === Object.hasOwn(item, 'error') ||
        (Object.hasOwn(item, 'error') && (!item.error || !Number.isInteger(item.error.code) || typeof item.error.message !== 'string'));
    })) throw new Error('invalid protocol');
    return values;
  };
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'text/event-stream') return parse(text);
  return text.split(/\r?\n\r?\n/).flatMap(event => {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    return data ? parse(data) : [];
  });
}

async function boundedText(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('response too large'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export function createRelay({readCredentials = loadCredentials, fetchImpl = fetch, timeoutMs = 90000, responseLimit = MAX_RESPONSE} = {}) {
  let credentials;
  let sessionId;
  let protocolVersion;
  return async payload => {
    credentials ||= readCredentials();
    const headers = {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer ' + credentials.openApiKey, 'X-Requirement-Mcp-Token': credentials.personalToken,...(credentials.identityToken?{'X-Lab-Identity-Token':credentials.identityToken}:{})};
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetchImpl(credentials.endpoint, {method: 'POST', headers, redirect: 'error',
        body: JSON.stringify(payload), signal: abort.signal});
      if (!response.ok) {
        await response.body?.cancel();
        const message = [401, 403].includes(response.status) ? '需求平台认证失败，请检查个人连接码并重新连接插件。' : '需求平台请求失败 HTTP ' + response.status + '；写操作结果可能未知，请先查询修改结果，不要重复提交。';
        throw Object.assign(new Error(message), {safe: true});
      }
      const text = await boundedText(response, responseLimit);
      const values = decodeResponse(text, response.headers.get('content-type') || 'application/json');
      if (Object.hasOwn(payload, 'id') && !values.some(value => value.id === payload.id)) throw new Error('response ID mismatch');
      if (values.some(value => Object.hasOwn(value, 'id') && value.id !== payload.id)) throw new Error('unexpected response ID');
      if (!Object.hasOwn(payload, 'id') && values.some(value => Object.hasOwn(value, 'id'))) throw new Error('unexpected notification response');
      if (payload.method === 'initialize') {
        const reply = values.find(value => value.id === payload.id);
        if (reply?.result?.protocolVersion) protocolVersion = reply.result.protocolVersion;
      }
      sessionId = response.headers.get('mcp-session-id') || sessionId;
      return values;
    } catch (error) {
      if (error?.safe) throw error;
      // Never reflect upstream bodies, URLs, headers or credentials into errors.
      throw new Error('需求平台请求未取得可确认结果。请查询现有修改记录；写操作不得自动重放。');
    } finally { clearTimeout(timer); }
  };
}
