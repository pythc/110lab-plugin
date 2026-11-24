# 维护 GitHub 安装源

本仓库分发 110lab 客户端。用户安装无需 npm 依赖；维护工具使用 Node.js 22+、npm 和 Python 3，并需先运行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

同步支持两个可追溯的来源。不得使用个人安装缓存作为发行来源，也不要复制整个官网或服务器工作目录。

## 1. 从完整官方 ZIP 同步

本次上游官网的完整客户端版本为 0.21.0，GitHub 分发补丁版本为 0.21.1。

```sh
mkdir -p artifacts
curl --fail --location --proto '=https' \
  https://internal.110-lab.cn/downloads/110lab-plugin-0.21.0.zip \
  -o artifacts/upstream-0.21.0.zip
npm run sync:archive -- \
  --archive artifacts/upstream-0.21.0.zip \
  --source-url https://internal.110-lab.cn/downloads/110lab-plugin-0.21.0.zip \
  --version 0.21.1
```

先核对上游发布地址和版本。脚本记录实际 ZIP 的 SHA-256，不会把本地路径写进发行元数据。归档可采用平铺或单层 `110lab/` 包装；必须包含清单中的全部文件，不能传入增量更新包。

脚本先验证完整包、双 manifest、MCP 配置、Skills YAML 和文件布局，再替换插件目录及元数据。替换失败会恢复之前已替换的内容；恢复本身失败时保留 staging 备份，并明确报错，不能继续发布。

原始包的运行版本与 manifest 不一致时，必须显式增加补丁版本。本次统一桥接从安装包的 `plugin.json` 读取版本，GitHub 分发更新链接指向对应 GitHub Release；业务服务和授权地址保持不变。

## 2. 从官网 Git 源码构建同步

在干净且已审核的 `pythc/110lab-website` Git 检出中准备锁定依赖，然后执行：

```sh
npm run sync -- /absolute/path/to/110lab-website
# 需要分发补丁时：
npm run sync -- /absolute/path/to/110lab-website --version 0.21.2
```

脚本验证 origin、记录提交和 tree，执行 `npm run build`；如果上游定义了 `package:plugin`，再执行它。优先读取 `artifacts/plugin/`，未生成时读取 `plugin/110lab/`。构建前只清理已知、未被 Git 跟踪的 `artifacts/plugin/` 生成目录，拒绝链接目录，避免复用旧包。构建和打包不得修改源码或切换上游 commit/tree。

该路径仍要求完整的新版客户端。旧源码只生成部分文件时会失败，不能退回旧版 12 文件复制逻辑。脚本只构建与读取指定工作区，不部署官网或更新个人插件。

## 3. 文件清单与版本规则

`client-files.json` 持有完整的显式允许列表。新增桥接文件、文档或 Skill 时，先审查并更新这份清单，再同步；额外文件、缺失文件、链接和不完整 ZIP 都会被拒绝。`node_modules/`、个人配置、服务端代码和数据不属于客户端。

`distribution.json` 的 schemaVersion 为 2：

- `source.kind=release-archive`：保留官方 URL、ZIP SHA-256、原始插件版本。
- `source.kind=git`：保留上游仓库、commit、tree 和原始插件版本。
- `originalFiles` / `files`：分别记录原始与分发内容的逐文件 SHA-256。
- `changes`：说明分发补丁修改了哪些原始文件，未修改的文件必须保持原字节。

客户端双 manifest、根 package、lockfile 和分发版本一致。重复导入相同内容允许；相同版本的新字节拒绝写入。已有 tag、release 和资产不能覆盖。

## 4. 验证与发布

```sh
npm run verify:integrity
npm test
npm run package
```

`verify:integrity` 检查布局、哈希、来源、JSON/YAML、MCP 配置与语法。默认 `npm run verify` 还保留仓库原有的敏感字面量筛查；它不代表完整安全审计。按任务授权选择检查范围，不能删除或绕过发行 CI 的既有检查。

`npm test` 覆盖完整同步、失败回退、归档校验、更新工具以及实际 stdio 初始化和 148 个工具的离线发现。它不会连接业务服务，也不读取个人 OAuth。

真实只读检查使用 `npm run test:live`：经实际统一桥接读取公共工作台和 UI 资源，检查安装版本。请在全新的容器或专用 OS 账号下运行，不挂载个人 home、OAuth、需求凭据或桌面配置。该检查不调用邮件、发布、登录或其他业务写工具，不能替代本人登录、原生侧栏及逐项业务验收。

发布顺序：

1. 在独立分支同步、运行检查、自行 review；核对原始包与 `distribution.json` 的变化。
2. 推送候选分支，确认 Node.js 22/24 CI 通过；再将经检查的同一个提交合入 `main`，不可强推覆盖他人提交。
3. 在通过 CI 的提交建立新的 `v版本号` tag；上传 `npm run package` 生成的 ZIP 和 SHA-256 清单到 GitHub Release。
4. 回读远程 main/tag、Release 资产和下载哈希；用新检出再次运行完整性检查及 MCP 初始化。
5. 公布新版本及安装/升级步骤。GitHub 发布不会自动更新个人私有版或部署业务服务器。

若要校验安装后的缓存，使用客户端安装结果返回的真实目录：

```sh
node scripts/verify.mjs --integrity-only --plugin-root /actual/installed/plugin
node scripts/smoke.mjs --plugin-root /actual/installed/plugin
```

校验脚本必须来自对应版本。本次发布不修改当前用户的已安装插件。

## 5. 归档和回退

`npm run package` 只打包 `plugins/110lab`，产物包含一个顶层 `110lab/` 目录和全部隐藏文件，写入忽略的 `artifacts/`。归档使用固定条目顺序和时间，不包含市场目录、源码工作区或维护依赖。

回退使用 README 的指定 tag 安装步骤；撤回 main 改动使用新的 revert 提交。插件回退不回滚服务器数据、权限或本机凭据。本仓库未额外授予上游代码的开源许可，第三方组件继续遵循各 NOTICE / LICENSE。
