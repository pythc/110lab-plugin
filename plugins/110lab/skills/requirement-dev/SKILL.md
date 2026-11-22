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
