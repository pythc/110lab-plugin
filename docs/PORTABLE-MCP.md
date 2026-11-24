# 110lab 通用 MCP 使用指南

WorkBuddy 桌面版和 DeepSeek Harness 都可以用这个安装包。配置一次后，每次客户端重新启动 110lab MCP，启动程序会检查 GitHub 正式版、校验下载包并验证新 MCP 能启动。有一步失败，就继续使用本机已安装的版本。

## 第一次安装

1. 安装 Node.js 22 或更新版本，在终端运行 `node --version` 确认可用。
2. 在 [GitHub Releases](https://github.com/pythc/110lab-plugin/releases/latest) 下载 `110lab-portable-版本号.zip`，或获取团队发来的同名安装包，完整解压到固定的本地目录。以下配置以 Windows 的 `D:/Apps/110lab-portable` 为例。macOS 可以使用自己的目录，例如 `/Users/你的用户名/Apps/110lab-portable`。
3. 确认解压后的目录里能直接看到 `launch.mjs` 和 `versions`，然后按下面对应客户端配置。以后保留 `launch.mjs` 的路径即可。

### WorkBuddy 桌面版

打开「专家 · 技能 · 连接器 → 连接器 → 自定义连接器 → 添加 MCP」，把下面的 `110lab` 条目加进现有 `mcpServers`。按实际目录修改 `args`，保存后按 WorkBuddy 的提示确认信任。若 WorkBuddy 找不到 `node`，将 `command` 改成 Node 可执行文件的完整路径。[WorkBuddy 配置指引](https://docs.ardot.tencent.com/ardot-mcp/ide-integration.html#workbuddy)

```json
{
  "mcpServers": {
    "110lab": {
      "type": "stdio",
      "command": "node",
      "args": ["D:/Apps/110lab-portable/launch.mjs"],
      "env": { "NODE_USE_SYSTEM_CA": "1" },
      "timeout": 30000
    }
  }
}
```

### DeepSeek Harness

在所用 Harness profile 的 `cordis.patch.yml` 中，把下面的段落加到已有 YAML 列表里。桌面版 profile 是 `<DSH_HOME>/profiles/desktop`。通过 `dsh web` 启动时使用 `<DSH_HOME>/profiles/web`。未设置 `DSH_HOME` 时，通常使用当前用户目录下的 `.dsh`。保存后重新启动 Harness。[Harness MCP 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md) · [配置层说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md)

```yaml
- insert:
    - id: mcp-110lab
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: 110lab
        transport: stdio
        command: node
        args:
          - 'D:/Apps/110lab-portable/launch.mjs'
        env:
          NODE_USE_SYSTEM_CA: '1'
        startupTimeoutMs: 30000
```

如果已经配过 110lab，修改原有条目即可。其他支持本地 `stdio` 的客户端也可以用相同启动命令。DeepSeek 普通网页和手机聊天版无法运行这个本地程序。

## 验证 MCP 和飞书授权

在新会话发一句「用 110lab 检查三个服务的连接状态」。工具应调用 `cobuild_overview`，参数为 `checkConnections: true`。连接情况按业务分别确认。

| 要使用的服务 | 如何验证和授权 |
| --- | --- |
| 工作台 | 用 `lab_whoami` 核对身份与权限，有登录提示时由本人按提示完成。Windows 工作台凭据检查可能挡住首次授权，可以先用需求平台和知识库。 |
| 需求平台 | `lab_requirements_connection_status` 返回 `connected: true` 即可用。需要登录时，运行 `lab_connect_requirements`，本人在浏览器确认，再查一次状态。 |
| 知识库 | 校园网或 VPN 可用时，用 `kb_connection_status` 查看，按需运行 `kb_connect` 并本人确认，再用 `kb_whoami` 核对。 |

飞书授权和客户端本身的账号登录是两件事。更新程序只操作安装目录里的版本文件，登录凭据由 110lab 在各自的用户目录管理。

## 以后怎么更新

- 结束正在进行的授权，再通过客户端重连 110lab，或退出并重开客户端。下一次启动会检查新版。已经运行的 MCP 会继续用它启动时的版本。
- 想确认当前版本，可以让助手调用 `lab_plugin_update` 的 `check`。当前版本、GitHub 正式版本会一起显示。这个工具的手动安装指引仍面向 Codex，通用安装包由 `launch.mjs` 负责安装更新。
- 每次升级会下载完整版本，里面包括 MCP、配置和 Skills 源文件。客户端通过其自身的导入功能注册的 Skills 需要按该客户端的方式更新。

维护者运行 `npm ci` 和 `npm run package:portable`，在 `artifacts/` 中获得通用安装包。以后发布新版时照常上传带 SHA-256 的 `110lab-plugin-版本号.zip` 到 [GitHub Releases](https://github.com/pythc/110lab-plugin/releases)。已经安装通用启动程序的同学会在下次启动 MCP 时收到新版。
