# 项目与荣誉

## 从立项接到需求

1. `lab_projects_list` 找已有项目，必要时 `lab_project_get(id)` 核对负责人、成员、links、phase、revision与权限，避免同名重复建项。`lab_members_search` 定位实际subject。
2. 新建用 `lab_project_save(requestId,fields)`；编辑加id和最新expectedRevision。fields按Schema填，links保留repository/requirements/docs/demo各键及原值，保留不该移除的成员。完整字段不能以旧快照覆盖并发修改；没给定的信息先查资料，只问影响目标的关键项。
3. 用户要申请共同项目才 `lab_project_apply`；有明确管理员审核决定才 `lab_project_review`。自由探索保存、提交申请和审核通过是不同状态，不自动串成批准。
4. 回读项目的 `requirementsSync`：synced加真实远端ID/URL才确认同步；queued/syncing/retrying继续等待或保留待同步，blocked报告errorCode。同步为空不猜成功，不能另造同名分类。详情的links.requirements可用作后续入口，需求平台已有项目分类也须沿真实关联核对。
5. 用户要拆成需求时去需求平台已有页面创建并核验新记录ID；当前MCP不能创建需求。页面可由有权限的Agent按已授权任务操作，不必机械转交人工。接手后用 [requirement-dev](../../requirement-dev/SKILL.md) 推进，不把分类同步当成需求已创建。
6. 需要知识库方案/项目说明时复用目标空间/页面，按 [knowledge](../../knowledge/SKILL.md) 保存，再将实际链接合并进links.docs。不要擅自为每个项目新建空间或改成员权限。

`lab_project_milestone_save` 新建传projectId和fields（title、assignee、dueAt），修改状态传milestoneId、expectedRevision、status，不混传新建fields。assignee来自实际项目成员subject。只有对应里程碑实际验收完成且用户任务涵盖该动作时才标done；代码写好或需求状态变化不能替代验收。

## 成果接到荣誉

`lab_honors_list`/`lab_honor_get`核对是否已有记录与关联项目。按用户提供的奖项名称、举办方、级别、奖项、获奖日期和真实成员保存 `lab_honor_save`；不猜奖项级别，不因项目已上线就造一条荣誉。编辑fields保留最新完整信息，传expectedRevision。

需要证书时，用明确选定路径 `lab_file_upload(purpose=honor_certificate)`，取得artifactId后 `lab_honor_certificate_attach`，每一步回读最新revision再继续。没有附件路径或事实材料时报告缺项，不扫描下载目录代找。

只有用户要提交审核才 `lab_honor_submit`；审核动作 `lab_honor_review`只执行明确approve/return决定及说明。已批准记录修改可能重新进入审核，不保证立即继续公开。保存、提交、审核后分别回读实际状态；需要官网宣传时转 [邮件与官网](communications.md)，审核通过不自动授权公开发布。
