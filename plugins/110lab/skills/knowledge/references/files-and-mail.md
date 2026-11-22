# 文件与邮件交接

## 按资料类型选择

| 任务 | 实际工具路径 | 确认完成的证据 |
| --- | --- | --- |
| 给原生文档附文件 | `kb_attachment_upload_ticket` → 官方 helper 上传 → `kb_file_ticket_get` | succeeded、attachmentId，回读所属文档附件 |
| 下载原生文档附件 | `kb_attachment_get` → `kb_attachment_download_ticket` → helper | 指定本地文件实际存在；票据不是可公开分享的链接 |
| 原生文档导出 | `kb_document_export_ticket` → helper | Markdown/HTML/JSON 实际文件；不伪称原生导出支持 PDF |
| 新建文件夹、Markdown 或 Office 文件 | `kb_file_create`，按 Schema 明确 type、mode 和父目录 | 返回页面/文件 ID，`kb_file_info`/`kb_files_list` 回读 |
| 上传独立文件或替换文件版本 | `kb_managed_file_upload` → helper → `kb_file_ticket_get` | pageId、保存版本；替换前读取当前 expectedVersion，不换 ID 造成重复文件 |
| Word/PPT 文本、Excel 单元格、UTF-8 文件内容 | `kb_file_content_read` → `kb_file_content_update(expectedVersion,edits)` → 回读 | 新版本及实际内容一致；PDF 只提取文字，修改用原件替换 |
| 独立文件删除/恢复 | 明确目标后 `kb_file_trash` / `kb_file_untrash` | 回收站状态及原件版本保留；文件夹会包含后代 |
| 下载文件历史版本 | `kb_managed_file_download(pageId,version)` → helper | 实际保存的原始文件，核对版本元数据 |
| Office 导出或生成在线副本 | `kb_file_convert` → `kb_file_task` | 任务真正成功；导出用 `kb_file_export_download` 取票据，在线副本用返回的新页面 ID回读 |
| 恢复文件旧版本 | `kb_file_restore(version,expectedVersion)` | 生成新版本，旧历史仍保留；不要用文档 historyId 代替文件版本号 |

helper 只处理用户选定的源文件，或本任务明确要求生成/发送的产物；不扫描整个工作区、其他项目或客户端会话。把完整票据保存在仅本人可读的临时 JSON（0600），从本次返回的 helperUrl 获取当前脚本，再运行：

```sh
python3 knowledge-helper.py --ticket-file TICKET.json --upload SELECTED_FILE
python3 knowledge-helper.py --ticket-file TICKET.json --output EXPLICIT_DESTINATION
```

替换示意路径后执行；不把票据 token 放进聊天、命令行参数或 Git。二进制原件不放入 MCP 参数；文字或单元格修改只传本次需要的结构化 edits，不把整份 Office 文件转换成 base64。0.21.0 对应 helper 0.3.0，内容处理20 MiB、普通附件20 MiB、Office票据50 MiB，仍以实际票据和服务限制为准；旧版未加载时不假装新工具或限制已生效。上传读回 ticket 回执，下载检查实际文件。转换只返回 queued/running 时保留 taskId，之后续查，不重复创建转换任务。

## 选定文档 → 公共邮箱

1. 确认用户选定的页面、实际收件人和用途，调用 `kb_mail_prepare(pageIds,subject,to)` 固定可读资料及 revision。必要时用返回 package 票据和 helper 下载材料；这是准备材料，不是附件上传或邮件发送。
2. 根据用户要发的内容整理正文或真实附件，转 [公共邮件流程](../../operations/references/communications.md)。没有发信指令就交付材料，不因读取到收件人或邮件模板自动发送。
3. 知识库 attachmentId、ticketId、下载地址不能直接填公共邮箱 attachments。公共邮箱附件必须是 `lab_file_upload(purpose=mail_attachment,path=...)` 返回的 artifactId。原始材料 JSON 包也不是已上传邮件附件。
4. 公共邮箱当前接收 PDF/DOCX/PNG/JPG/TXT，附件合计10 MiB；原生导出的 Markdown/HTML/JSON不能假装是 PDF，也不能直接传不支持的文件。需要附件时按用户要求生成真实的受支持格式；格式不兼容时说明选择，不擅自删减全文、换成摘要或改变指定格式。
5. 内部知识库链接不等于外部收件人可访问。不能为使邮件链接可打开就自动公开空间或给收件人授予权限。正文过长或附件超限时保留阻碍，按用户目标选择拆分、受支持附件或仅发送链接；不要静默截断。

查看最终投递回执再报告实际状态，记录准备时的资料版本。发出后文档修改不会更新已固定的邮件内容。


## 内容编辑边界

DOCX/PPTX 使用读取返回的 part 与文本 index；Excel 使用真实 sheet 名和 A1 地址，公式不带开头的 =。UTF-8 文件使用 replace_content，JSON 会校验语法。文字索引仅属于读取时的 version。复杂图表、动画、增删幻灯片和数组/共享公式交给在线编辑器；PDF 提取不包含 OCR。

活跃网页编辑器会阻止外部写入、整份替换与历史恢复。关闭编辑器并等保存完成后重读版本；不要请求强制覆盖。helper 默认不覆盖本地目标，确需覆盖才显式 --overwrite。

## LaTeX 与离线项目

知识库中的 LaTeX 项目由当前知识库身份管理，编辑界面使用托管 Overleaf CE，不是官方 Overleaf 账号互通。

- `kb_latex_create` 在指定空间/目录创建项目；`kb_latex_info` 核对权限和归档。
- `kb_latex_files_list` 定位目标，`kb_latex_file_get` 读取这份文件的真实内容及 revision；新增用 `kb_latex_file_create`，修改用 `kb_latex_file_update(expectedRevision)`。冲突时重读合并，不能强制覆盖。单份 UTF-8 源码最多 512 KiB。
- `kb_latex_snapshot` 从固定源码编译，同时保留源码 ZIP 和 PDF。操作结果未知时复用 requestId 查询 `kb_operation_get`，不能另建一次。`kb_latex_archive_download` 返回原件下载票据，交给 helper，不能把 PDF base64 塞进上下文。
- 项目删除和恢复使用原生页面回收站工具；这些工具没有单独删除源码文件的接口，不能虚构。项目源码也不使用文档 blocks。

桌面 0.2 的离线功能需要预先下载项目和对应平台的编译组件。离线更改保留本地，联网时按云端 revision 自动同步；冲突保留双方数据，交由用户决定合并。远程 MCP 操作云端项目；桌面本地 MCP 才操作该设备离线副本，二者不可混淆。当前分发并验收的平台是 macOS Apple Silicon，其他平台保留原有版本。
