# CoBuild 需求研发 Skill

插件候选版本：0.20.1 · Skill 原名：`requirement-dev`。

通过 CoBuild 把一项已明确需求推进到代码、测试、评审和交付回写；用于接手需求、修缺陷、落实方案或准备交付。结合实际仓库，不默认项目或分支，不代替项目立项、录取决定或发信流程。

Skill 不接收固定 JSON 参数。直接说明目标和已有记录链接即可；显式调用语法以客户端菜单为准，名称可能带 `110lab:` 前缀。

下面原文由插件实际源文件生成。工具参数查同目录 MCP 手册；Skills 说明如何使用工具，不新增工具、身份或授权。

## 当前完整 Skill 原文

````markdown
---
name: requirement-dev
description: 通过 CoBuild 把一项已明确需求推进到代码、测试、评审和交付回写；用于接手需求、修缺陷、落实方案或准备交付。结合实际仓库，不默认项目或分支，不代替项目立项、录取决定或发信流程。
---

# CoBuild 需求研发

把“要解决什么、实现在哪、怎样验收、当前交到哪一步”对齐。先确定本次范围：只分析就不改代码；已经授权实现则持续完成实现、自测、review和获授权回写，不把下面每个阶段都变成一次用户审批。

## 1. 接手真实需求和上下文

需要时按 [身份连接](../identity/SKILL.md) 核对需求域。已知编号/ID直接 `requirement_get`；不确定目标用 `requirements_list`，查看本人工作可用 `my_requirement_todos`。确定后始终用稳定记录 ID；同名标题返回候选时选择有依据的记录，否则只问目标歧义，不默认第一条。

用 `cobuild_requirement_context` 汇总明确关联的项目、文档和 PR。查看 consistent/gaps、资料截断和 PR completeness；用原工具读足本次相关内容；达到工具上限仍缺资料时使用已有授权页面或导出，不虚报已读全。需求的 project 分类不能替代工作台项目 UUID；有明确 projectId/documentIds 才传，不按名称猜。

确认实际仓库、基线和开发分支，读取适用的仓库规范与代码调用链，保留脏工作树。需要隔离时建立独立工作树，不自动切走原分支、stash或reset。不默认任何作业系统仓库、main或某个历史版本分支。

## 2. 把验收变成可执行的方案

提炼用户场景、范围、角色和验收标准，再核对代码现状。只对会改变业务行为或取舍的缺失信息询问；代码事实先自己查。小改动可直接说明方案，复杂改动用 [需求分析](assets/需求分析模板.md) / [技术方案](assets/技术方案模板.md) 记录决策，已有文档优先更新，不重复建几份。

把验收项映射到实现和验证。文本 acceptanceCriteria 和平台的可追踪验收项不是同一个字段；需要创建/勾选结构化验收项时使用已有页面，不发明 MCP 参数。方案正文放在已有仓库或获授权的知识库页面，再回填真实链接；当前接口没有 technicalPlan 字段，不用改写原需求介绍来代替它。

## 3. 实现、自测、review并留下证据

按实际代码链路修改，执行与改动匹配的检查，亲自 review 完整差异并处理发现。涉及状态、并发、异步、升级/迁移/回滚时，核查旧数据、版本兼容和恢复条件。不能拿编译、mock或AI结论代替真实业务验收。具体证据检查见 [研发与交付](references/development-workflow.md)。

在有回写授权时，于有意义的阶段更新 `requirement_update_fields` 的真实进展、阻塞、分支、PR和自测报告，只传需要改的字段。支持的修改生成稳定 clientMutationId，返回 jobId 后 `requirement_operation_get(operationId=jobId)`，最终回读 `requirement_get`。结果未知不换键重放。人员改动优先显式 add/remove；userIds是飞书user_id，完整 replace 前核对最新名单。

知识库使用 [knowledge](../knowledge/SKILL.md) 的 revision/文件版本保护；不要把旧需求快照或截断资料整份回写。代码提交、推送、PR、合并与部署依据各自已有授权和仓库门禁，先准备可审查结果，不因做完代码就自动合并发布。

## 4. 评审与交付

- PR创建/CI/合并/部署用当前已连接且获授权的仓库工具或CLI。回填真实PR链接后按需 `pull_requests_refresh`，再 `pull_request_get`；即使只读PR，空/旧缓存也可能触发共享刷新，不把它当成零副作用压力测试。
- PR讨论检查 completeness 的 comments/reviews/reviewThreads。false或缺失表示还没读全，去已有GitHub工具/平台页面补读。缺口影响最终评审结论，但不妨碍继续不依赖它的本地分析或实现。需求MCP目前没有PR head SHA，必须另用代码工具核对当前提交和测试绑定，不按PR编号猜仓库。
- 平台AI评审按本次任务需要触发：`requirement_trigger_review` 的 clarity、technical_stability、delivery_readiness。材料不足先补实际资料；已接受/排队不是通过。没有独立AI评审查询工具时从平台页面核实，不重复调用触发工具来轮询。整个迭代补跑只在用户确实要处理整迭代时用 `iteration_trigger_available_reviews`。
- 改GitHub待评审人会真实增删名单并通知。只有有相应安排时才用 `pull_request_set_reviewers`，其 reviewerLogins 是完整目标名单，reviewerBindings映射飞书user_id；不把“做review”自动解释为通知全组或替换现有人选。
- 准备平台流转、PR交付或发布时，用 `cobuild_delivery_check` / `requirement_release_readiness` 核对门禁与证据。本次只交付本地结果时不为形式强制调用发布检查。ready不等于已上线；资料缺口未补齐就不宣称交付验证完成。状态流转只使用需求当前workflow/allowedStatuses和平台允许的路径，不硬编码“开发完→已发布”。

实际部署验收完成且已获授权后才回写相应状态、安排里程碑或更新用户说明。若只交付本地代码，清楚标注未推送、未部署。交付时给出需求、方案、代码/PR、提交SHA、实际测试与review、部署/验收结果和仍需处理项，规模小就用几句话，不机械填满模板。

跨系统回执与恢复见 [交接与恢复](../cobuild/references/handoffs.md)，具体参数和能力缺口见 [MCP契约](references/mcp-contracts.md)。
````

## references/development-workflow.md

````markdown
# 研发与交付证据

## 从验收往回检查

先把每条重要验收标准对应到用户路径、相关实现和可核验证据。看代码现状后再选测试，不为了完成表格而声称没做过的验证。测试环境、命令、结果、提交SHA与未覆盖项应能对应起来；没有真实测试就明确写未测。

| 改动 | 主要验证 |
| --- | --- |
| 交互/展示 | 按实际页面路径体验，核对空态、失败、长内容与接口结果 |
| 规则/权限/状态 | 正常和拒绝路径，角色/对象范围，状态前置条件 |
| 队列/外部接口 | 入队与最终落地区别，原回执、幂等、并发、超时与部分失败 |
| 数据迁移/升级/回滚 | 旧版本和旧数据兼容，结构指纹/迁移前置，发布和恢复顺序 |

自行review覆盖本次所有差异，包括未提交/未跟踪文件；检查正确性、权限、数据一致性、性能、错误传播和无关改动。修复具体发现，再重跑受影响检查。只有用户或仓库要求时才额外委派/强制外部review，不把多Agent当作完成条件。

## 平台回写与协作交接

有回写授权时，在实际阶段结束后更新进展和证据，不每执行一条命令就写平台。selfTestReport写真实环境/命令/结果/限制，可附知识库或CI链接；缺陷原因有证据才填。跨人交接应说明当前版本、已验证内容、下一位需要做什么，而不是只改处理人。

需求写入的clientMutationId、jobId及最终目标回读按 [交接与恢复](../../cobuild/references/handoffs.md) 执行。字段可局部修改；完整快照回写会覆盖别人更新。人员默认replace，增删必须显式指定mode，不能混用知识库UUID或GitHub login。

## 发布和回滚

沿实际仓库的commit/push/PR/部署流程执行已经授权的动作；没有授权的外部动作，先把代码、测试、差异和回滚条件准备成可审查结果，再说明尚缺的决定。不要把“提交到main”“推送”“部署”互相替代。

PR检查关注实际head SHA、CI检查、人工评审和讨论是否读全。平台AI通过不是CI或人工review通过；readiness为true不是部署回执。部署完成后核对实际运行版本、关键用户路径与依赖，必要时保留回滚点；没部署就不能将需求标为已发布。

失败时只恢复尚未完成的步骤。例如文档已保存而PR关联失败，保留文档链接再补关联；服务已接收邮件但回执未知，停止重发并核对原投递。不能用重做整条链路掩盖部分成功。
````

## references/mcp-contracts.md

````markdown
# 需求MCP契约与页面交接

使用统一110lab连接中的原工具名，参数以当前实际Schema为准。旧包ai-homework-requirement-dev不再提供默认仓库/分支、桥接bootstrap或凭据搬运；不主动删除用户在其他客户端安装的副本，也不自动安装GitHub连接。

## 关键参数和副作用

| 动作 | 工具/参数 | 核对点 |
| --- | --- | --- |
| 定位需求 | `requirements_list`、`requirement_get(requirement)` | 确定后优先用记录ID；编号唯一性和标题歧义不能由列表顺序替代 |
| 修改字段 | `requirement_update_fields(requirement,clientMutationId,...)` | 只提交本次要改的字段；不新增technicalPlan、附件或结构化验收项等未支持参数 |
| 改人员 | `requirement_update_personnel(requirement,role,userIds,mode,clientMutationId)` | userIds是飞书user_id；mode默认replace，add/remove要明确写；缺可靠身份映射时不猜 |
| 流转 | `requirement_transition_status(requirement,status,clientMutationId,...)` | 看真实workflow/allowedStatuses及门禁；处理人和交付证据按当前状态要求提供 |
| 查结果 | `requirement_operation_get(operationId)` | operationId取修改返回的jobId；不是需求ID、requestId或clientMutationId |
| AI评审 | `requirement_trigger_review(requirement,reviewType)` | reviewType为clarity/technical_stability/delivery_readiness；会触发评审，不是状态轮询 |
| 迭代评审 | `iteration_trigger_available_reviews(iteration)` | 作用整个迭代；资料不足跳过不等于通过，不为单条需求扩大范围 |
| PR | `pull_request_get(pullNumber)`、`pull_requests_list`、`pull_requests_refresh` | 绑定真实仓库；缓存可能自动刷新；检查completeness，另取实际head SHA |
| 指定评审人 | `pull_request_set_reviewers(pullNumber,reviewerLogins,reviewerBindings)` | 完整替换GitHub待评审人；首次login映射feishuEmployeeId（飞书user_id）；新增会有真实通知 |

不要使用旧契约reviewerEmployeeIds/reviewerUserIds/internalReviewers。批量评审、刷新缓存和设置评审人都不是普通读取的附带步骤。

## 当前需要现有页面/其他工具完成的事情

需求创建、结构化验收项维护、上传需求附件、查看完整AI评审进度在需求平台页面完成；技术方案可在知识库或仓库维护，关联真实链接。当前需求MCP没有这些独立接口。浏览器可用且用户已授权相应任务时，Agent可以操作页面并核验结果；只有实际缺信息、权限或本人确认才交给用户，不凭缺MCP就一概要求手工完成。

创建/合并PR、CI和部署使用已有获授权的代码工具/CLI；工具不存在时说明阻碍，不临时假造接口或静默换仓库。插件中的考核、批改入口也不代表需求MCP拥有其业务接口。

完整输入字段见 [需求工具参数](../../../docs/mcp-reference/requirements.md)。回执恢复见 [跨应用交接](../../cobuild/references/handoffs.md)。
````

## assets/PR模板.md

````markdown
## 问题与结果

说明具体触发场景、原行为和改后结果。

- 需求记录 / 链接：
- 方案或使用说明（如有）：
- 平台迭代（如有）：
- 实际 base / head 分支与提交 SHA：

## 验证

| 验收标准 | 实现位置 | 实际测试 / 体验证据 |
| --- | --- | --- |
|  |  |  |

- 测试环境、命令和结果：
- 自行 review 发现及处理：
- 未运行或仅以 mock 验证的部分：
- 风险、兼容性和必要回滚条件：

## 交付状态

分别说明平台回写、PR / CI、部署和真实验收的已核验结果。未部署就明确未部署；不要预勾未完成事项，不把平台 AI 评审或就绪检查当成代码与生产验收。
````

## assets/技术方案模板.md

````markdown
# <需求编号> <标题>：技术方案

小改动不必完整套用；围绕实际决策保留必要内容，已有页面优先更新。

## 依据与选择

- 需求 / 原方案链接及读取版本：
- 代码现状和需要改变的行为：
- 推荐实现与关键取舍：

## 主要链路

描述入口 → 权限与校验 → 状态 / 数据 → 异步或外部处理 → 最终可观察结果。按需配图，不只列组件名。

- 数据与接口变化：
- 页面与用户交互：
- 并发、幂等、超时及部分失败恢复：
- 旧版本 / 旧数据兼容（如涉及）：

## 实施与验收

| 要完成的内容 | 对应验收项 | 验证方式 |
| --- | --- | --- |
|  |  |  |

- 资源开销、可观测性和必要的发布 / 回滚条件：
- 未解决的决定、影响与下一步：

## 实施后补记

只填写已发生的事实：实际改动、运行检查、review发现与修复、当前提交或构建版本、未验证边界。方案获批不等于实现或发布完成。
````

## assets/需求分析模板.md

````markdown
# <需求编号> <标题>：需求分析

仅保留本次需要的部分；未知事实写明待核实，不用模板制造既定结论。

## 目标与关联

- 需求记录 ID / 链接、读取版本：
- 实际项目 ID / 迭代：
- 需要解决的用户场景：
- 本次范围与不做的内容：

## 现状依据

- 实际仓库、基线与相关入口：
- 当前业务链路 / 已有资料：
- 已确认事实、代码证据、尚待确认的取舍：

## 验收与交付

| 验收标准 | 影响的角色或状态 | 准备怎样验证 |
| --- | --- | --- |
|  |  |  |

- 权限、异常、并发或兼容性边界：
- 本次预期交付到哪一步（方案 / 本地代码 / PR / 部署）：
- 需要澄清的问题与目前可独立推进的部分：
````
