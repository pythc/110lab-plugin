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
