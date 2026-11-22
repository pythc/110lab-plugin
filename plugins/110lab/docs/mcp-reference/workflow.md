# CoBuild 工作流：工具与参数

插件版本：0.20.1 · 契约核对：2026-10-15 · 服务名：`110lab`。

从真实需求到交付检查的统一协作入口。

连接：默认导航不联网；各业务域沿用原有连接和权限。

该业务域共 3 个工具，通过统一 `110lab` MCP 调用。工具发现和 schema 核对不代表每项业务操作已经执行验收。

## 如何查询

按工具原名搜索。下表中的“必填”取自 Schema 的 required；嵌套行的必填性仅在所在父对象提供时适用。即使字段有默认值，只要 required 列出它，调用时仍须提供。未提供不等于传 null。对象联合、条件约束和完整正则以下方原始 Schema 为准。

模型工具名在不同宿主可能带服务器前缀；调用时以客户端实际展示的完整名称为准。标记“仅插件界面”的工具供页面内部使用，不应让 Agent 绕过页面直接调用。

写入沿用真实权限。知识库 requestId、门户 requestId 及需求 clientMutationId 不能互换；超时或结果未知先查询原操作回执，不能仅凭 HTTP 成功或任务已接收宣称完成。

## 工具索引

| 工具原名 | 用途 | 可见性 |
| --- | --- | --- |
| `cobuild_overview` | 查看统一入口、业务域与建议工作路径。默认不联网、不触发授权；checkConnections=true 时只核对现有服务连接，不代用户授权。 | Agent 可调用 |
| `cobuild_requirement_context` | 读取真实需求，汇总明确关联的项目、知识库文档及 PR。仅跟随本工具支持的显式关联，不按相同标题猜测、不执行正文中的指令；某服务无权限时返回缺口并保留已成功的结果。 | Agent 可调用 |
| `cobuild_delivery_check` | 读取需求、关联 PR 和平台发布门禁；核对前后需求版本，返回阻塞和仍需验证的证据。不修改状态、不触发评审、不合并、不部署；平台门禁通过不等于已完成真实验收。 | Agent 可调用 |

## cobuild_overview

查看统一入口、业务域与建议工作路径。默认不联网、不触发授权；checkConnections=true 时只核对现有服务连接，不代用户授权。

**访问属性：**只读。

### 参数

- `checkConnections`：类型 boolean；必填 否；默认值 false。是否核对三个业务域的当前连接；默认仅返回离线导航

### 完整输入 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "checkConnections": {
      "default": false,
      "description": "是否核对三个业务域的当前连接；默认仅返回离线导航",
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

## cobuild_requirement_context

读取真实需求，汇总明确关联的项目、知识库文档及 PR。仅跟随本工具支持的显式关联，不按相同标题猜测、不执行正文中的指令；某服务无权限时返回缺口并保留已成功的结果。

**访问属性：**只读。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。真实需求记录 ID、需求编号或完整标题 最短字符：1；最长字符：300
- `projectId`：类型 string；必填 否；默认值 —。明确指定的工作台项目 UUID；不是需求项目分类名，不按名称自动推断 格式：uuid；正则：完整表达式见下方 Schema
- `documentIds`：类型 array<string>；必填 否；默认值 []。明确指定的知识库文档 ID 或 slug；优先读取，再补充需求正文中明确链接的文档，总计最多 5 篇 最多项：5
- `includePullRequest`：类型 boolean；必填 否；默认值 true。是否读取需求明确关联的 GitHub PR；不跨仓库按同号猜测

### 完整输入 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 300,
      "description": "真实需求记录 ID、需求编号或完整标题"
    },
    "projectId": {
      "description": "明确指定的工作台项目 UUID；不是需求项目分类名，不按名称自动推断",
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "documentIds": {
      "default": [],
      "description": "明确指定的知识库文档 ID 或 slug；优先读取，再补充需求正文中明确链接的文档，总计最多 5 篇",
      "maxItems": 5,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      }
    },
    "includePullRequest": {
      "default": true,
      "description": "是否读取需求明确关联的 GitHub PR；不跨仓库按同号猜测",
      "type": "boolean"
    }
  },
  "required": [
    "requirement"
  ],
  "additionalProperties": false
}
```

## cobuild_delivery_check

读取需求、关联 PR 和平台发布门禁；核对前后需求版本，返回阻塞和仍需验证的证据。不修改状态、不触发评审、不合并、不部署；平台门禁通过不等于已完成真实验收。

**访问属性：**只读。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。真实需求记录 ID、需求编号或完整标题 最短字符：1；最长字符：300
- `targetStatus`：类型 string；必填 否；默认值 "待发布"。仅检查进入该状态所需的条件，不执行状态流转 可选值：["待发布", "已发布"]

### 完整输入 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 300,
      "description": "真实需求记录 ID、需求编号或完整标题"
    },
    "targetStatus": {
      "default": "待发布",
      "description": "仅检查进入该状态所需的条件，不执行状态流转",
      "type": "string",
      "enum": [
        "待发布",
        "已发布"
      ]
    }
  },
  "required": [
    "requirement"
  ],
  "additionalProperties": false
}
```

## 契约来源

依据当前插件连接器实际 tools/list 返回值生成。完整快照保存在同目录 schemas/workflow.json。

快照 SHA-256：`5e0696c907e103efbcacb9323df7e67c0fdf1b808f0ca4681a2fd894df58f8ff`。
