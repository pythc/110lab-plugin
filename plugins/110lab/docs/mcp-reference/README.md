# MCP 与 Skills 参考

这里是 CoBuild 的接口查询手册。使用某个应用的页面流程，请看同空间的使用说明；需要知道 Agent 能调用什么、参数怎么填，再查这里。

本版对应 **110lab 插件 0.21.0**，契约核对日期为 **2026-11-10**。默认只需连接 **1 个统一 MCP（110lab）**，内部保留工作台、需求平台、知识库 **3 个业务域**，配套 **5 个 Skill**。共 **147 个工具**：144 个对 Agent 可见，另有 3 个只供插件界面调用。数量包括登录和连接状态工具，不代表各项业务均已逐一做真实写入测试。

## 先看工作路径

按本次目标选取路径，不必每次从立项重跑：

- **从想法开始：** 项目立项 → 确认需求分类同步 → 在需求平台形成需求 → 获取稳定记录 ID。
- **已有需求：** 读取需求、项目与文档 → 核对代码和方案 → 实现、自测、review → PR 与门禁 → 按已有授权部署、验收和回写。
- **资料与运营交接：** 知识库维护实际方案/说明 → 在项目和需求回填链接；需要发信、成果登记或官网发布时，再进入对应运营流程。

[跨应用协作 Skill](skill-cobuild.md) 说明这几段怎样连接；[日常运营 Skill](skill-operations.md) 包含立项、荣誉、招新、邮件和动态。单纯改文档直接使用知识库 Skill，不强制走需求研发。

常用入口只有三个：`cobuild_overview` 查看能力；`cobuild_requirement_context` 汇总需求、明确关联的文档与 PR，并可读取指定项目；`cobuild_delivery_check` 检查门禁和现存证据缺口。详见 [CoBuild 工作流：工具与参数](workflow.md)。修改仍使用下面各域的原工具和原回执，不存在跨系统的一键事务。

## MCP：能调用什么

| 业务域（旧连接名） | 查询页 | 工具数 | 主要用途 |
| --- | --- | --- | --- |
| `110lab` | [工作台 MCP：工具与参数](portal.md) | 43（含 3 个界面专用） | 项目、荣誉、招新、公共邮箱和官网动态 |
| `110lab_requirements` | [需求平台 MCP：工具与参数](requirements.md) | 16 | 需求、人员、状态、AI 评审、发布检查及 GitHub PR |
| `110lab_knowledge` | [知识库 MCP：工具与参数](knowledge.md) | 85 | 文档、目录、空间、历史、评论、附件及权限 |

默认统一 MCP 注册名为 `110lab`。上表旧连接名仅用于识别原业务域，不需要同时安装三个连接。原工具名不变；更新后宿主的 `110lab_requirements` / `110lab_knowledge` 工具前缀会归入 `110lab`，需要重新发现工具。

各页列出原始工具名、用途、参数路径、类型、必填项、默认值与限制，并附完整输入 JSON Schema。客户端可能在工具名外加服务器前缀；实际调用以当前宿主发现的名称为准。

## Skills：怎样把工作做好

| Skill | 查询页 | 什么时候使用 |
| --- | --- | --- |
| `cobuild` | [跨应用协作](skill-cobuild.md) | 跨应用任务、接续已有工作、判断流程起点与交接结果 |
| `identity` | [统一身份连接](skill-identity.md) | 首次连接、身份不符、授权过期或连接排障；有效连接直接复用 |
| `knowledge` | [知识库操作](skill-knowledge.md) | 读取和修改文档、处理版本冲突、附件与邮件材料 |
| `requirement-dev` | [CoBuild 需求研发](skill-requirement-dev.md) | 接手需求、读代码、实施、自测、review 和交付回写 |
| `operations` | [日常运营](skill-operations.md) | 项目、荣誉、招新、公共邮箱与官网动态的操作和核验 |

Skill 是给 Agent 的工作说明，不是一个带 JSON 参数的 MCP 接口。你可以直接说：“用 CoBuild 处理需求 XXX，先给方案”，或“按这个已批准方案完成实现和自测”。客户端支持显式调用时，可选择对应 Skill；显示名可能带 `110lab:` 前缀。

## 从哪一步开始

1. **选择所需服务。** 先复用现有身份和授权；只有目标域未连接或确实缺权限才进入受支持的登录流程，由本人完成 OAuth 确认。单域任务不要求先连接全部服务。
2. **找对目标。** 先读真实需求、文档或项目，确认记录 ID 与当前版本。GitHub login、飞书 user_id、知识库成员 UUID 不是同一种标识。
3. **按实际契约修改。** 需求字段只传需要改的项；工作台的完整 fields 则合并最新值，保留未改链接和成员。知识库正文、元数据和文件分别用 revision、updatedAt、version。需求人员优先 add/remove。
4. **核对结果。** 需求使用 clientMutationId，写入返回 jobId 后查询 requirement_operation_get；知识库及门户使用各自的 requestId 和回执。任务已接收不代表业务已经落地。

## 当前边界

- 候选人考核 MCP、个人 QQ 邮箱 MCP、飞书原生工具集和 GitHub 独立连接，不计入这份插件清单。页面有入口不代表已提供该应用全部 MCP 功能。
- 需求 MCP 可读 PR 和修改待评审人，不创建/合并 PR、不运行 CI、不执行部署。PR 评审人接口会修改 GitHub，不是仅在平台内记录。
- 知识库部署在内网，需要校园网或 VPN。工具发现成功不保证当前网络可以完成文档操作。
- 文档转邮件材料不等于发信；公共邮箱发送、招新通知和官网发布仍沿用实际确认流程。
- 本手册是一次经过核对的版本快照。平台或插件接口升级后，以实时 tools/list、kb_capabilities 和实际权限为准，再重新生成手册。

## 维护方式

统一入口没有强行把业务账号合并；旧连接器文件保留供兼容配置使用。项目分类名不能当成工作台项目 ID，当前 PR 接口也未返回 head SHA，这两项缺口会在聚合结果中明确报告。

源码中使用 `scripts/generate-mcp-reference.py` 从连接器 tools/list 快照生成三个 MCP 查询页，保留完整 schema。更新接口时同步快照和文档，不只手改参数表。使用 `scripts/generate-skill-reference.py` 从实际 SKILL.md、references 和模板生成 Skill 查询页，避免说明与插件指令各写一套。


0.21.0 新增文件内容读写、文件回收站与恢复；文件 helper 更新到 0.3.0。Word/PPT 以文本位置操作，Excel 以工作表和单元格操作；工具可见不代表可以跳过原件版本、当前权限或网页编辑会话保护。

## LaTeX 与离线项目

知识库中的 LaTeX 项目由当前知识库身份管理，编辑界面使用托管 Overleaf CE，不是官方 Overleaf 账号互通。

- `kb_latex_create` 在指定空间/目录创建项目；`kb_latex_info` 核对权限和归档。
- `kb_latex_files_list` 定位目标，`kb_latex_file_get` 读取这份文件的真实内容及 revision；新增用 `kb_latex_file_create`，修改用 `kb_latex_file_update(expectedRevision)`。冲突时重读合并，不能强制覆盖。单份 UTF-8 源码最多 512 KiB。
- `kb_latex_snapshot` 从固定源码编译，同时保留源码 ZIP 和 PDF。操作结果未知时复用 requestId 查询 `kb_operation_get`，不能另建一次。`kb_latex_archive_download` 返回原件下载票据，交给 helper，不能把 PDF base64 塞进上下文。
- 项目删除和恢复使用原生页面回收站工具；这些工具没有单独删除源码文件的接口，不能虚构。项目源码也不使用文档 blocks。

桌面 0.2 的离线功能需要预先下载项目和对应平台的编译组件。离线更改保留本地，联网时按云端 revision 自动同步；冲突保留双方数据，交由用户决定合并。远程 MCP 操作云端项目；桌面本地 MCP 才操作该设备离线副本，二者不可混淆。当前分发并验收的平台是 macOS Apple Silicon，其他平台保留原有版本。

桌面离线副本另有 [9 个本地 MCP 工具及完整参数](desktop.md)。
