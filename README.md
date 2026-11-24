# 110lab 插件

110 实验室工作台的 GitHub 安装源。当前版本 **0.21.4**，包含统一 MCP、工作台、需求平台、WeKnow、5 个 Skills 和接口参考文档。

0.21.4 为 WorkBuddy、DeepSeek Harness 和其他本地 MCP 客户端提供通用自动更新安装包。

## 安装

WorkBuddy、DeepSeek Harness 和其他支持本地 MCP 的客户端可以下载 [通用安装包](https://github.com/pythc/110lab-plugin/releases/latest)。配置一次后，启动 110lab 时自动检查并安装新版。[通用 MCP 使用指南](docs/PORTABLE-MCP.md)

准备 Git、**Node.js 22 或更新版本**（建议 24.x），以及支持 `codex plugin` 的 Codex CLI。安装命令已按本机 CLI **0.169.0** 的帮助核对。

```sh
codex plugin marketplace add pythc/110lab-plugin --ref main
codex plugin add 110lab@110lab
```

重新打开 Codex 桌面端，在 **110 实验室 → 110lab** 确认已安装。打开新会话，输入“打开 110lab 工作台”，或使用客户端显示的侧栏入口。

插件已打包 MCP 运行依赖，使用者无需执行 `npm install`、构建官网或准备服务器源码。WeKnow 等内网服务需要校园网络或 VPN。

## 更新现有 GitHub 安装

```sh
codex plugin marketplace upgrade 110lab
codex plugin add 110lab@110lab
```

更新完成后关闭、重新打开插件，并在新会话中发现工具。先结束正在进行的飞书授权再更新，避免本机授权回调进程在中途关闭。

在新会话中可以用 `lab_plugin_update` 检查 GitHub 的最新正式发布。传入 `{"action":"check"}` 查看版本，传入 `{"action":"download"}` 会下载并核对完整 ZIP。工具返回本机路径和通过本地插件市场装包的步骤。

个人私有版和本 GitHub 安装源是两个分发渠道。市场升级只更新这个 GitHub 来源；请在客户端停用重复的旧入口，保留一个启用的 110lab。插件更新不要求删除本机登录文件。

只刷新工作台网页不会安装新插件。当前版默认只有 **1 个 `110lab` MCP**，目录包含 **148 个工具**和 **5 个 Skills**；其中 3 个工具仅供插件界面使用。名称一致不代表已获得对应业务权限。

## 登录与权限

1. 在工作台点击飞书登录，以自己的实验室成员身份完成认证。登录按现有规则保留最多 30 天，主动退出、停用或撤销后失效。
2. 需求平台 MCP 使用 `lab_connect_requirements`，完成本人确认后用 `lab_requirements_connection_status` 核对；无需手工复制旧连接码。
3. 知识库使用 `kb_connect` 完成本人授权，再用 `kb_whoami` 核对身份和空间权限。校园网络或 VPN 需保持可用。
4. 门户、需求平台和知识库分别校验业务角色和授权范围。安装插件不会获得管理员、HR 或额外文档权限。新增 OAuth 授权仍需本人确认。

“周催办”是现有飞书授权应用名，每位成员仍使用自己的身份。对外考生、批改系统的师生账号保留原有入口。

凭据由本机连接器管理，不随 GitHub 仓库或 ZIP 分发。旧连接文件保留兼容；更新后先使用正常登录流程，不复制其他成员的凭据，也不删除自己的旧登录目录。

## 可以使用什么

| 入口 | 用途 |
| --- | --- |
| `cobuild` | 跨应用任务、能力概览和交付检查 |
| `identity` | 身份、连接和权限核对 |
| `knowledge` | WeKnow 文档、目录、附件、Office 与 LaTeX 操作 |
| `requirement-dev` | 从真实需求到代码实现、测试和交付回写 |
| `operations` | 项目、里程碑、荣誉、招新、公共邮箱与官网动态 |

[完整 MCP 与 Skills 参考](plugins/110lab/docs/mcp-reference/README.md)保留工具原名、参数和使用边界。包内接口说明沿用 0.21.0 功能契约。工具发现不需要先登录；实际业务操作仍需有效授权。复杂 Office 排版继续使用在线编辑器。

## 固定版本与回退

```sh
codex plugin marketplace remove 110lab
codex plugin marketplace add pythc/110lab-plugin --ref v0.21.1
codex plugin add 110lab@110lab
```

切换分支或 tag 时先移除旧来源，再按指定 ref 添加。跟随最新版时把 `v0.21.1` 改为 `main`；回退时使用已发布的旧 tag，例如 `v0.15.1`。回退只影响插件客户端，不回滚服务器数据或本机登录凭据。

[GitHub Releases](https://github.com/pythc/110lab-plugin/releases)提供归档 ZIP；完整包只有一个 `110lab/` 目录，包含隐藏 manifest。优先用上述 GitHub 市场命令安装，ZIP 不代表所有客户端都支持直接导入。

## 常见问题

- **找不到 node**：确认 `node --version` 可用；安装 Node.js 后重新打开桌面端，使其读取新的运行环境。
- **缺少 `codex plugin` 命令**：更新 CLI 后检查 `codex plugin --help`；可先添加来源，再在桌面端插件目录完成安装。
- **仍显示 0.15.1 或工具很少**：核对市场来源/ref、已安装版本，以及是否启用了旧私有版；完成升级并重新安装，开启新会话后再核对。
- **授权后 127.0.0.1 拒绝连接**：回到插件重新发起登录；旧授权页的本机回调进程可能已经关闭。
- **网页已登录，但 MCP 未连接**：按所需业务域完成连接确认，核对对应的连接状态和本人权限。
- **知识库不可达**：核对校园网络/VPN与实际服务连通性；不要反复重新授权。
- **浏览器、手机或 Windows**：本发行方式依赖桌面本地 Node 环境。Windows 桌面登录及原生侧栏更新尚未实机验收。

## 维护与来源

- `client-files.json`：显式审核的 **61 个客户端文件**，新增文件需先更新清单。
- `plugins/110lab/`：可直接安装的完整插件；包含 5 个 Skills、3 个业务域、统一桥接、参考文档和第三方许可。
- `distribution.json`：原始完整发行 ZIP 的地址、SHA-256、逐文件原始/分发哈希，以及本次版本修正。
- `scripts/`：完整包同步、官网 Git 构建同步、校验、MCP 启动和归档工具。

本次来源为官网公开发布的 `110lab-plugin-0.21.0.zip`，不是个人安装缓存。仓库不引入服务器部署内容、候选人材料或数据库。

[维护说明](docs/MAINTAINING.md) · [更新历史](CHANGELOG.md) · [验证记录](docs/VERIFICATION.md)
