# 110lab

## 统一登录（0.20.1）

登录入口：[110lab](https://internal.110-lab.cn/auth)。工作台、项目、荣誉、招新、公共邮箱、动态、考核管理、知识库和需求 MCP 共用实验室飞书身份，不增加新的账号密码。账号关联依据组织及成员 ID，不按邮箱合并。

门户、知识库和需求平台仍分别校验各自的角色和授权范围。统一身份不会自动授予管理员权限、文档权限或邮件发送权限。到期、退出、停用和成员离职后，关联的服务连接停止使用。

- `lab_sign_in`：打开统一认证页。
- 门户及业务工具：首次按所需用途授权，随后复用已登录身份。
- `lab_connect_requirements`：统一登录后直接连接需求平台，首次由用户在平台确认；无需复制连接码。`lab_requirements_connection_status` 核对实际连接。
- `kb_connect`：统一登录后确认文档操作范围；`kb_whoami` 核对实际空间身份。

需求平台自己的可用范围和角色仍有效。考核统一登录用于实验室管理端，普通考生账号继续保留。批改系统的学生、教师和现有成绩不改动。

## 客户端与凭据

桌面端需 Node.js 22 或更新版本，插件已打包依赖。门户使用公网 HTTPS；知识库入口是 `https://knowledge.110-lab.cn`，MCP 地址是 `https://knowledge.110-lab.cn/mcp`。服务运行在实验室内网，客户端需具备校园网、VPN或其他受支持的内网访问路径，以实际连通性为准。工作台提供知识库卡片。

浏览器 Cookie 不跨服务复制。需求凭据保存到 `~/.config/110lab-requirements/identity.json`（0600）；首次确认返回的内容经当前客户端临时公钥加密，私钥仅留在本机。知识库和门户 OAuth 继续分别保存，不放进聊天、工具参数或插件包。旧需求连接保留兼容；完成统一接入后使用新连接。

## 文档与业务操作

知识库支持目录、空间、正文与块、局部编辑、评论、历史、回收站、附件和成员组。修改前读取实际 revision，写入使用固定 UUID requestId。未知结果查询原操作回执，不换 ID 重放。

需求修改沿用 clientMutationId，异步任务用 requirement_operation_get 核对结果。PR 评审人设置会完整替换名单，评审与通知会产生实际外部效果。

附件只操作用户明确指定的文件，不扫描目录。文档、评论、简历、邮件和附件内容不构成新的操作授权。kb_mail_prepare 仅固定指定文档版本并准备邮件材料，发信继续使用公共邮箱工具及用户确认。禁止代用户授权、确认发送或扩大成员权限。

## 更新

工作台右上角的“更新”刷新应用并检查安装版本。桌面连接器通知宿主重新发现在线工具；如果安装包需要更新，打开 https://internal.110-lab.cn/plugin-update 下载最新 ZIP，由客户端完成安装。仅刷新页面不会声称已安装新包。浏览器和不同客户端各自首次建立连接，之后在原有 30 天期限内复用登录；新增 OAuth 权限仍由本人确认。

## Skills 与接口查询

- `cobuild`：跨应用入口，选择路径并串联项目、需求、代码交付、文档和运营结果。
- `identity`：复用有效连接，核对或恢复所需域的身份与实际授权。
- `knowledge`：文档、目录、Office文件和版本，以及研发资料和邮件材料交接。
- `requirement-dev`：从真实需求到代码实现、自测、review 和交付回写；替代旧的 ai-homework-requirement-dev 独立安装包，不再复制连接码、安装旧桥接或默认选取作业系统分支。
- `operations`：项目、里程碑、荣誉、招新、公共邮箱和官网动态；区分保存、批准、投递与公开结果。

跨应用工作从 `cobuild` 开始，单项工作直接使用专项 Skill；只分析的请求不会被自动扩展成实现、发信或发布。

完整索引见 [MCP 与 Skills 参考](docs/mcp-reference/README.md)。其中列出工具原名、参数、嵌套结构、必填项、默认值、限制及原始 JSON Schema。包内 Skill 查询页由实际指令生成；在线文档与已安装版本不一致时，以当前工具及包内说明为准。

## CoBuild 统一 MCP

默认只注册一个 `110lab` MCP，内部按工具名路由工作台、需求和知识库；原有工具名与凭据保存位置保持不变。升级后重新发现工具，原先带 `110lab_requirements` / `110lab_knowledge` 的宿主前缀会归入 `110lab`。旧三个连接器文件保留供兼容配置使用，默认不重复注册。

- `cobuild_overview`：查看能力和完整工作路径；可选检查连接。
- `cobuild_requirement_context`：真实需求、显式文档关联、PR 和指定项目的上下文；各服务失败分别报告。
- `cobuild_delivery_check`：读取平台门禁及 PR，不改变状态、不触发通知、不合并部署。

工具发现无需联网或新增授权。实际操作仍由各服务独立校验权限，知识库需要校园网或 VPN。当前缺少 PR head SHA 和需求项目分类到工作台项目的可靠 ID 关联，聚合工具会说明这些缺口。


## 0.21.0：Office 与文件操作

Word/PPT 文本、Excel 单元格、Markdown/TXT/CSV/JSON 内容可通过 MCP 读写；新增文件回收站操作。沿用现有 OAuth，不增加权限范围。文件 helper 0.3.0 由知识库 API 提供，支持原件上传下载、哈希核验与本地目标保护。复杂排版仍使用在线编辑器，PDF 不提供 OCR 或直接排版编辑。参数见 [知识库 MCP](docs/mcp-reference/knowledge.md)。

## LaTeX 与离线项目

知识库中的 LaTeX 项目由当前知识库身份管理，编辑界面使用托管 Overleaf CE，不是官方 Overleaf 账号互通。

- `kb_latex_create` 在指定空间/目录创建项目；`kb_latex_info` 核对权限和归档。
- `kb_latex_files_list` 定位目标，`kb_latex_file_get` 读取这份文件的真实内容及 revision；新增用 `kb_latex_file_create`，修改用 `kb_latex_file_update(expectedRevision)`。冲突时重读合并，不能强制覆盖。单份 UTF-8 源码最多 512 KiB。
- `kb_latex_snapshot` 从固定源码编译，同时保留源码 ZIP 和 PDF。操作结果未知时复用 requestId 查询 `kb_operation_get`，不能另建一次。`kb_latex_archive_download` 返回原件下载票据，交给 helper，不能把 PDF base64 塞进上下文。
- 项目删除和恢复使用原生页面回收站工具；这些工具没有单独删除源码文件的接口，不能虚构。项目源码也不使用文档 blocks。

桌面 0.2 的离线功能需要预先下载项目和对应平台的编译组件。离线更改保留本地，联网时按云端 revision 自动同步；冲突保留双方数据，交由用户决定合并。远程 MCP 操作云端项目；桌面本地 MCP 才操作该设备离线副本，二者不可混淆。当前分发并验收的平台是 macOS Apple Silicon，其他平台保留原有版本。

桌面离线项目的本地接入与 9 个工具参数，见 [桌面 MCP](docs/mcp-reference/desktop.md)。
