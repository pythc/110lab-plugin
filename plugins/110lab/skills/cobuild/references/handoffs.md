# 跨应用交接与恢复

## 同一件事，分别认清各系统的记录

| 对象 | 可信关联 | 容易混淆的地方 |
| --- | --- | --- |
| 工作台项目 | `lab_project_get` 的 UUID、`links`、`requirementsSync` | 需求的 `project` 是分类名称；`requirementsSync.projectId` 是需求平台远端分类 ID，都不能冒充工作台 UUID |
| 需求 | `requirement_get` 的记录 ID、编号、`updatedAt`、显式链接 | 同名标题拒绝选择；不要按列表首条修改 |
| 代码 | 实际仓库、分支、PR 链接及从 Git/GitHub 读取的 head SHA | 需求 MCP 的 PR 编号不代表所有仓库的同号 PR；目前不提供 head SHA |
| 知识库 | 空间/页面/文件 ID、原生文档 `revision`、元信息 `updatedAt`、文件 `version` | 三种版本保护字段互不替代；Office 二进制不支持原生文档块编辑 |
| 人员 | 工作台 `subject`、需求的飞书 `user_id`、知识库成员 UUID、GitHub login 各自核对 | 邮箱或显示名相同不是身份映射证据；不要截取 subject 拼出 user_id |
| 文件 | 所属系统返回的附件 ID、票据、文件版本 | 知识库 attachmentId 不能直接填进公共邮箱 attachments；后者要先上传为 artifactId |

项目发起、需求实施与资料沉淀一般这样交接：项目详情确认 → 查看 `requirementsSync` 和需求链接 → 定位/在页面创建需求 → 取得需求 ID → 代码与验收 → 知识库记录方案/使用说明 → 回填链接和证据。不是每项工作都要新建项目、文档或里程碑；已有目标优先复用。

项目同步为 `queued`/`syncing`/`retrying` 时，只能说项目已保存、远端尚未确认；`blocked` 报告错误，`null` 不推断为已同步。读回 `synced` 及远端 ID/URL才确认这段交接。不要另外创建同名分类来抢先补齐。

## 查对回执

| 写入域 | 保留什么 | 怎样确认 |
| --- | --- | --- |
| 需求修改 | 原 `clientMutationId`、完整调用参数、返回的 `jobId` | `requirement_operation_get(operationId=jobId)` 查最终状态，再 `requirement_get` 回读。不能用需求 ID 查操作 |
| 知识库写入 | 同一 UUID `requestId`、参数、返回 `operationId` | `kb_operation_get` 查原操作，回读文档/文件/权限。文件上传另以 `ticketId` 调 `kb_file_ticket_get`；转换用 `taskId` 调 `kb_file_task` |
| 工作台直接保存 | 同一 UUID `requestId`、目标 ID、版本 | 成功返回对象后用对应 get 核验；没有返回操作 ID 就不要拿 requestId 冒充 operationId |
| 工作台预览、发送和发布 | `previewId`、`confirmationUrl`、发送/发布返回的 `operationId` | `lab_operation_get` 查可信确认和执行结果；如果结果还有投递 operationId，继续查该投递，不把预览完成当作送达 |

稳定键属于同一次动作；内容、版本或收件人改了是新动作，须重新生成预览和键。`running`/`queued` 可有限轮询或之后续查；不要高频空查。`unknown`/断链保持未知，查询原记录并核实外部结果；不换键重放、不把未知当失败重发。

跨系统只回写本次需要的最少字段。例如知识库文档已保存而需求回写失败，就保留页面链接，恢复需求回写；不要再创建一篇同样的文档。冲突后重读、重新合并用户意图，再用新版本提交；不偷偷删除协作者的更新。

## 接手中断工作

从用户给出的记录 ID、链接和原操作回执恢复，再读取当前版本；不要把上个会话的状态当成实时状态。只缺某一服务时说明受影响的步骤，先完成本地分析或其他已授权步骤。工具不存在、资料截断、权限不足、网络不可达应分别报告；创建 PR、运行 CI、部署等走已有获授权的仓库工具/流程，不能发明 MCP 接口。

精确参数查 [接口手册](../../../docs/mcp-reference/README.md)。当实际工具与手册不一致，以实时 Schema 为准，标记版本差异，不通过改配置、读令牌文件或切换他人账号绕过。
