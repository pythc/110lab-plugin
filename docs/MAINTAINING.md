# 维护安装源

业务代码的源仓库是 [110lab-website](https://github.com/pythc/110lab-website)。这里保存经过验证的可运行客户端快照，不部署服务器，也不更新个人账号下的私有插件。

## 同步新版本

1. 在独立且干净的官网仓库检出要发布的已审核提交。上游版本须同步修改插件双 manifest 和 package.json；发布新内容必须增加版本号，不重写已发布 tag。
2. 使用上游要求的 Node.js 版本安装锁定依赖：`npm ci`。下面的同步命令会重新构建，防止使用旧的忽略文件。同步完成后运行上游的登录、持久化和需求待办回归测试。
3. 在本安装源目录运行：

   ```sh
   node scripts/sync-from-website.mjs /absolute/path/to/110lab-website
   npm run verify
   npm test
   npm run test:live
   ```

4. 同步脚本只复制明确列出的 12 个客户端文件，并生成插件 README 和 `distribution.json`。不得把上游整个仓库、`private/`、`.config/` 或本机插件缓存复制过来。确认包内没有额外文件。
5. 人工复核差异、版本、包内地址、依赖许可及 `distribution.json` 的源码提交。校验脚本的模式扫描只能辅助检查，不能代替人工确认。
6. 使用独立容器/测试账号，从 GitHub 来源完成实际安装，初始化 MCP、读取工具目录及工作台资源。不得用维护者的 OAuth 或需求平台凭据代替新成员测试。真实授权需要本人确认；测试不得发送邮件或发布动态。
7. 合并后等待 CI 通过，再建立 `v版本号` tag 和 GitHub Release。用户从 `main` 更新，也能选择稳定 tag。

`npm test` 仅启动插件包并完成 MCP 握手，不读取本机登录文件。`npm run test:live` 还会读取公网工具目录、工作台入口和 UI 资源；不会调用业务写入、邮箱或登录工具。

安装后可用 `node scripts/verify.mjs --plugin-root /actual/installed/plugin` 校验实际缓存的全部文件，再用 `node scripts/smoke.mjs --live --plugin-root /actual/installed/plugin` 验证该缓存中的进程和工作台。路径使用安装命令返回的 `installedPath`，不要猜测。

## 打包

ZIP 应仅包含顶层 `110lab/` 目录及其隐藏 manifest 文件。将 `plugins/110lab/` 打包，校验其文件列表与 `distribution.json` 完全一致，并为 ZIP 附上 SHA-256。GitHub 仓库目录用于市场安装，ZIP 用于归档或手动配置本地市场，不宣称所有客户端都支持直接导入 ZIP。

## 回滚

已有发布不可覆盖。需要回退时，先运行 `codex plugin marketplace remove 110lab`，再以已验证 tag 添加来源并重新安装；CLI 不允许直接用不同 ref 覆盖同名来源。确认市场来源的 `ref`、已安装文件及版本，而不是只检查 `main`。如需撤回 `main` 上的改动，使用新的 revert 提交。服务器数据、权限和本机登录凭据不在插件回滚范围内。

本仓库未额外授予上游代码的开源许可；第三方包分别按 `mcp/NOTICE.txt` 中的许可分发。
