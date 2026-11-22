# 招新记录与通知

这里处理官网招新工作台的候选人，不包含考核系统交卷、考试日志上传或考试成绩发布接口。用户给考生学号/考试链接时，不把它直接当作工作台candidateId。

1. `lab_candidates_list`筛选，再 `lab_candidate_get(id)` 读取简历、记录、当前stage/revision和发送状态；同名有歧义先核对实际候选人，不改另一条记录。
2. 用户明确给出初筛判断、分数/评语或面试安排时才 `lab_candidate_record`。按record.action的真实Schema填写screen/assessment/interview/schedule；schedule核对时区、时间、面试官、邮箱、联系方式与地点，转ISO时间不改变用户本意。读取简历不构成安排面试、评分或录取的授权。
3. `lab_candidate_decide`只记录用户明确的accept/reject决定和note；不自行推断最终录取。它不等于已通知候选人，也不默认发送Offer。需要的独立考核/Offer功能未在该MCP提供时，使用对应已有页面和实际授权。
4. 面试邮件先 `lab_recruitment_options` 核对模板与变量，必要时在明确模板维护任务内 `lab_recruitment_template_save`，不为一次通知改全局模板。
5. 读最新候选人revision与templateRevision，逐人 `lab_recruitment_notice_preview`，保存真实previewId/confirmationUrl。本人确认原预览后才 `lab_recruitment_notice_send`，再 `lab_operation_get` 查返回的投递operationId；需要时回读候选人notification。批量任务仍逐人核对，不拿一人的预览发另一人。

SIMULATED/模拟完成不能报告真发信，QUEUED只是排队，UNKNOWN保留待核实；服务商接收也不证明对方已阅读。旧预览失效时先核实原操作是否已执行，再根据真实状态重新准备，不换requestId强行重发。
