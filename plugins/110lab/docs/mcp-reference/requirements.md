# 需求平台 MCP：工具与参数

插件版本：0.20.1 · 契约核对：2026-10-15 · 服务名：`110lab_requirements`。

需求、人员、状态、AI 评审、发布就绪检查和 GitHub PR。

连接：lab_requirements_connection_status；未连接时 lab_connect_requirements，由本人在浏览器完成。

该业务域共 16 个工具，通过统一 `110lab` MCP 调用。工具发现和 schema 核对不代表每项业务操作已经执行验收。

## 如何查询

按工具原名搜索。下表中的“必填”取自 Schema 的 required；嵌套行的必填性仅在所在父对象提供时适用。即使字段有默认值，只要 required 列出它，调用时仍须提供。未提供不等于传 null。对象联合、条件约束和完整正则以下方原始 Schema 为准。

模型工具名在不同宿主可能带服务器前缀；调用时以客户端实际展示的完整名称为准。标记“仅插件界面”的工具供页面内部使用，不应让 Agent 绕过页面直接调用。

写入沿用真实权限。知识库 requestId、门户 requestId 及需求 clientMutationId 不能互换；超时或结果未知先查询原操作回执，不能仅凭 HTTP 成功或任务已接收宣称完成。

## 工具索引

| 工具原名 | 用途 | 可见性 |
| --- | --- | --- |
| `lab_connect_requirements` | 通过 110lab 统一登录连接需求平台。返回浏览器登录页；由用户本人完成登录，无需复制连接码。 | Agent 可调用 |
| `lab_requirements_connection_status` | 核对当前需求平台连接状态，不发起授权或修改业务。 | Agent 可调用 |
| `requirement_operation_get` | 根据修改返回的jobId查询最终结果。已接受不代表已落地；unknown时不得盲目重试或重复通知。 | Agent 可调用 |
| `my_requirement_todos` | 与工作台待我推进一致：当前处理人为已认证用户，排除已发布、已关闭。只读，返回紧凑列表和分页游标；restartRequired 时从第一页重新读取。 | Agent 可调用 |
| `requirements_list` | 按标题、编号、状态、项目或迭代筛选需求，返回后续工具需要的记录 ID。 | Agent 可调用 |
| `requirement_release_readiness` | 只读检查需求进入待发布或已发布前的验收项、自测、人员、Git 分支、合并请求、检查与评审门禁。 | Agent 可调用 |
| `requirement_get` | 按记录 ID、需求编号或完整标题读取需求全部结构化字段。 | Agent 可调用 |
| `requirement_trigger_review` | 手动触发或重新触发一项需求的指定 AI 评审。需求清晰度依赖需求介绍和验收标准；技术与交付评审依赖对应研发资料。 | Agent 可调用 |
| `iteration_trigger_available_reviews` | 对指定迭代的全部非缺陷需求补跑当前资料可支持的评审；资料不足的评审会跳过并返回原因，不会发送飞书通知。 | Agent 可调用 |
| `requirement_update_fields` | 修改需求的基础字段、排期、介绍、验收标准、进展或阻塞信息；只提交明确提供的字段。 | Agent 可调用 |
| `requirement_update_personnel` | 支持按角色 add 增加、remove 移除或 replace 调整为目标名单。userIds 使用飞书 user_id；replace 空数组移除读取时的成员，但保留其后的并发新增。优先使用明确增删。同次重试须复用 clientMutationId。 | Agent 可调用 |
| `requirement_transition_status` | 按需求工作流流转状态，并执行处理人、角色与交付物校验。 | Agent 可调用 |
| `pull_requests_list` | 查询当前仓库的 GitHub 合并请求、关联需求和迭代、检查状态及 GitHub 待评审人。 | Agent 可调用 |
| `pull_request_get` | 读取一个合并请求的 GitHub 评论、评审、行内讨论、检查结果、关联需求和 GitHub 待评审人。 | Agent 可调用 |
| `pull_request_set_reviewers` | 完整替换 GitHub 合并请求的待评审人。使用拥有仓库写权限的 GitHub login；首次使用某账号时通过 reviewerBindings 绑定飞书 user_id。新增评审人会收到 GitHub 原生通知和周催办飞书私聊。传空数组表示清空。 | Agent 可调用 |
| `pull_requests_refresh` | 立即从 GitHub 刷新当前仓库的合并请求缓存。 | Agent 可调用 |

## 容易混淆的契约

- PR 评审人是 GitHub 待评审人，reviewerLogins 为 GitHub login；不是旧版平台内部评审人。完整替换会移除未保留的人，并可能发送真实通知。
- 人员 userIds 为飞书 user_id；mode 默认 replace，可显式 add/remove。
- 写入返回 jobId 后，以该值作为 requirement_operation_get.operationId 查询最终结果。
- 当前未提供创建需求、上传附件、直接保存技术方案正文、创建/合并 PR 或部署工具。

## lab_connect_requirements

通过 110lab 统一登录连接需求平台。返回浏览器登录页；由用户本人完成登录，无需复制连接码。

**访问属性：**只读。

无输入参数，传 `{}`。

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

## lab_requirements_connection_status

核对当前需求平台连接状态，不发起授权或修改业务。

**访问属性：**只读。

无输入参数，传 `{}`。

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

## requirement_operation_get

根据修改返回的jobId查询最终结果。已接受不代表已落地；unknown时不得盲目重试或重复通知。

**访问属性：**只读。

### 参数

- `operationId`：类型 string；必填 是；默认值 —。以字段名及类型为准；接口未提供额外说明。 格式：uuid；正则：完整表达式见下方 Schema

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "operationId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    }
  },
  "required": [
    "operationId"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## my_requirement_todos

与工作台待我推进一致：当前处理人为已认证用户，排除已发布、已关闭。只读，返回紧凑列表和分页游标；restartRequired 时从第一页重新读取。

**访问属性：**只读。

### 参数

- `limit`：类型 integer；必填 否；默认值 100。以字段名及类型为准；接口未提供额外说明。 最小值：1；最大值：100
- `cursor`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。 最长字符：80

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "limit": {
      "default": 100,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "cursor": {
      "type": "string",
      "maxLength": 80
    }
  },
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirements_list

按标题、编号、状态、项目或迭代筛选需求，返回后续工具需要的记录 ID。

**访问属性：**只读。

### 参数

- `query`：类型 string；必填 否；默认值 —。标题或需求编号关键词
- `status`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `project`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `iteration`：类型 string；必填 否；默认值 —。迭代名称或记录 ID
- `limit`：类型 integer；必填 否；默认值 30。以字段名及类型为准；接口未提供额外说明。 最小值：1；最大值：100

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "description": "标题或需求编号关键词",
      "type": "string"
    },
    "status": {
      "type": "string"
    },
    "project": {
      "type": "string"
    },
    "iteration": {
      "description": "迭代名称或记录 ID",
      "type": "string"
    },
    "limit": {
      "default": 30,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_release_readiness

只读检查需求进入待发布或已发布前的验收项、自测、人员、Git 分支、合并请求、检查与评审门禁。

**访问属性：**只读。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1
- `targetStatus`：类型 string；必填 否；默认值 "待发布"。以字段名及类型为准；接口未提供额外说明。 可选值：["待发布", "已发布"]

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    },
    "targetStatus": {
      "default": "待发布",
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
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_get

按记录 ID、需求编号或完整标题读取需求全部结构化字段。

**访问属性：**只读。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    }
  },
  "required": [
    "requirement"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_trigger_review

手动触发或重新触发一项需求的指定 AI 评审。需求清晰度依赖需求介绍和验收标准；技术与交付评审依赖对应研发资料。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1
- `reviewType`：类型 string；必填 是；默认值 —。以字段名及类型为准；接口未提供额外说明。 可选值：["clarity", "technical_stability", "delivery_readiness"]

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    },
    "reviewType": {
      "type": "string",
      "enum": [
        "clarity",
        "technical_stability",
        "delivery_readiness"
      ]
    }
  },
  "required": [
    "requirement",
    "reviewType"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## iteration_trigger_available_reviews

对指定迭代的全部非缺陷需求补跑当前资料可支持的评审；资料不足的评审会跳过并返回原因，不会发送飞书通知。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `iteration`：类型 string；必填 是；默认值 —。迭代名称或记录 ID 最短字符：1

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "iteration": {
      "type": "string",
      "minLength": 1,
      "description": "迭代名称或记录 ID"
    }
  },
  "required": [
    "iteration"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_update_fields

修改需求的基础字段、排期、介绍、验收标准、进展或阻塞信息；只提交明确提供的字段。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1
- `clientMutationId`：类型 string；必填 否；默认值 —。建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。 正则：^[a-zA-Z0-9_-]{8,128}$
- `title`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。 最短字符：1
- `introduction`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `acceptanceCriteria`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `selfTestReport`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `defectCause`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `gitBranchName`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `githubPullRequestUrl`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。 格式：uri
- `type`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `source`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `priority`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `project`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `iterationIds`：类型 array<string>；必填 否；默认值 —。所属迭代，最多一个 ID；空数组表示清空，不得同时关联多个迭代 最多项：1
- `effort`：类型 number 或 null；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `latestProgress`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `blocked`：类型 boolean；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `blocker`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `startAt`：类型 number 或 string 或 null；必填 否；默认值 —。毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null
- `developmentStartAt`：类型 number 或 string 或 null；必填 否；默认值 —。毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null
- `developmentEndAt`：类型 number 或 string 或 null；必填 否；默认值 —。毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null
- `testingAt`：类型 number 或 string 或 null；必填 否；默认值 —。毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null
- `deadlineAt`：类型 number 或 string 或 null；必填 否；默认值 —。毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    },
    "clientMutationId": {
      "description": "建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。",
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]{8,128}$"
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "introduction": {
      "type": "string"
    },
    "acceptanceCriteria": {
      "type": "string"
    },
    "selfTestReport": {
      "type": "string"
    },
    "defectCause": {
      "type": "string"
    },
    "gitBranchName": {
      "type": "string"
    },
    "githubPullRequestUrl": {
      "type": "string",
      "format": "uri"
    },
    "type": {
      "type": "string"
    },
    "source": {
      "type": "string"
    },
    "priority": {
      "type": "string"
    },
    "project": {
      "type": "string"
    },
    "iterationIds": {
      "maxItems": 1,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "所属迭代，最多一个 ID；空数组表示清空，不得同时关联多个迭代"
    },
    "effort": {
      "anyOf": [
        {
          "type": "number",
          "minimum": 0
        },
        {
          "type": "null"
        }
      ]
    },
    "latestProgress": {
      "type": "string"
    },
    "blocked": {
      "type": "boolean"
    },
    "blocker": {
      "type": "string"
    },
    "startAt": {
      "description": "毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null",
      "anyOf": [
        {
          "type": "number"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "developmentStartAt": {
      "description": "毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null",
      "anyOf": [
        {
          "type": "number"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "developmentEndAt": {
      "description": "毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null",
      "anyOf": [
        {
          "type": "number"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "testingAt": {
      "description": "毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null",
      "anyOf": [
        {
          "type": "number"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
    "deadlineAt": {
      "description": "毫秒时间戳、YYYY-MM-DD/ISO 8601 字符串或 null",
      "anyOf": [
        {
          "type": "number"
        },
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "requirement"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_update_personnel

支持按角色 add 增加、remove 移除或 replace 调整为目标名单。userIds 使用飞书 user_id；replace 空数组移除读取时的成员，但保留其后的并发新增。优先使用明确增删。同次重试须复用 clientMutationId。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1
- `clientMutationId`：类型 string；必填 否；默认值 —。建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。 正则：^[a-zA-Z0-9_-]{8,128}$
- `mode`：类型 string；必填 否；默认值 "replace"。以字段名及类型为准；接口未提供额外说明。 可选值：["replace", "add", "remove"]
- `role`：类型 string；必填 是；默认值 —。以字段名及类型为准；接口未提供额外说明。 可选值：["handlers", "productOwners", "developers", "testers", "foOwners", "releaseOwners", "proposers", "followers"]
- `userIds`：类型 array<string>；必填 是；默认值 —。飞书 user_id 列表

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    },
    "clientMutationId": {
      "description": "建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。",
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]{8,128}$"
    },
    "mode": {
      "default": "replace",
      "type": "string",
      "enum": [
        "replace",
        "add",
        "remove"
      ]
    },
    "role": {
      "type": "string",
      "enum": [
        "handlers",
        "productOwners",
        "developers",
        "testers",
        "foOwners",
        "releaseOwners",
        "proposers",
        "followers"
      ]
    },
    "userIds": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "飞书 user_id 列表"
    }
  },
  "required": [
    "requirement",
    "role",
    "userIds"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## requirement_transition_status

按需求工作流流转状态，并执行处理人、角色与交付物校验。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `requirement`：类型 string；必填 是；默认值 —。需求记录 ID、需求编号或完整标题 最短字符：1
- `clientMutationId`：类型 string；必填 否；默认值 —。建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。 正则：^[a-zA-Z0-9_-]{8,128}$
- `status`：类型 string；必填 是；默认值 —。以字段名及类型为准；接口未提供额外说明。 最短字符：1
- `handlerUserIds`：类型 array<string>；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `selfTestReport`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `defectCause`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。
- `githubPullRequestUrl`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。 格式：uri
- `latestProgress`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": {
      "type": "string",
      "minLength": 1,
      "description": "需求记录 ID、需求编号或完整标题"
    },
    "clientMutationId": {
      "description": "建议每次新修改生成唯一键；同一次请求重试必须复用此键和原参数。返回 jobId 后查询最终结果，unknown 不得重放。",
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]{8,128}$"
    },
    "status": {
      "type": "string",
      "minLength": 1
    },
    "handlerUserIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "selfTestReport": {
      "type": "string"
    },
    "defectCause": {
      "type": "string"
    },
    "githubPullRequestUrl": {
      "type": "string",
      "format": "uri"
    },
    "latestProgress": {
      "type": "string"
    }
  },
  "required": [
    "requirement",
    "status"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## pull_requests_list

查询当前仓库的 GitHub 合并请求、关联需求和迭代、检查状态及 GitHub 待评审人。

**访问属性：**只读。

### 参数

- `query`：类型 string；必填 否；默认值 —。PR 编号、标题、分支或关联需求编号关键词
- `state`：类型 string；必填 否；默认值 —。以字段名及类型为准；接口未提供额外说明。 可选值：["OPEN", "MERGED", "CLOSED"]
- `iteration`：类型 string；必填 否；默认值 —。迭代名称或记录 ID
- `reviewerLogin`：类型 string；必填 否；默认值 —。GitHub 待评审人的 login
- `limit`：类型 integer；必填 否；默认值 30。以字段名及类型为准；接口未提供额外说明。 最小值：1；最大值：100

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "description": "PR 编号、标题、分支或关联需求编号关键词",
      "type": "string"
    },
    "state": {
      "type": "string",
      "enum": [
        "OPEN",
        "MERGED",
        "CLOSED"
      ]
    },
    "iteration": {
      "description": "迭代名称或记录 ID",
      "type": "string"
    },
    "reviewerLogin": {
      "description": "GitHub 待评审人的 login",
      "type": "string"
    },
    "limit": {
      "default": 30,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## pull_request_get

读取一个合并请求的 GitHub 评论、评审、行内讨论、检查结果、关联需求和 GitHub 待评审人。

**访问属性：**只读。

### 参数

- `pullNumber`：类型 integer；必填 是；默认值 —。GitHub PR 编号 大于：0；最大值：9007199254740991

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "pullNumber": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991,
      "description": "GitHub PR 编号"
    }
  },
  "required": [
    "pullNumber"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## pull_request_set_reviewers

完整替换 GitHub 合并请求的待评审人。使用拥有仓库写权限的 GitHub login；首次使用某账号时通过 reviewerBindings 绑定飞书 user_id。新增评审人会收到 GitHub 原生通知和周催办飞书私聊。传空数组表示清空。

**访问属性：**可改变状态／需按具体用途授权。

### 参数

- `pullNumber`：类型 integer；必填 是；默认值 —。GitHub PR 编号 大于：0；最大值：9007199254740991
- `reviewerLogins`：类型 array<string>；必填 是；默认值 —。GitHub login 列表 最多项：100
- `reviewerBindings`：类型 array<object>；必填 否；默认值 —。首次绑定或修改映射时提供；已绑定账号可省略
- `reviewerBindings[].login`：类型 string；必填 是；默认值 —。GitHub login 最短字符：1
- `reviewerBindings[].feishuEmployeeId`：类型 string；必填 是；默认值 —。对应飞书成员的 user_id 最短字符：1

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {
    "pullNumber": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991,
      "description": "GitHub PR 编号"
    },
    "reviewerLogins": {
      "maxItems": 100,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "GitHub login 列表"
    },
    "reviewerBindings": {
      "description": "首次绑定或修改映射时提供；已绑定账号可省略",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "login": {
            "type": "string",
            "minLength": 1,
            "description": "GitHub login"
          },
          "feishuEmployeeId": {
            "type": "string",
            "minLength": 1,
            "description": "对应飞书成员的 user_id"
          }
        },
        "required": [
          "login",
          "feishuEmployeeId"
        ]
      }
    }
  },
  "required": [
    "pullNumber",
    "reviewerLogins"
  ],
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## pull_requests_refresh

立即从 GitHub 刷新当前仓库的合并请求缓存。

**访问属性：**可改变状态／需按具体用途授权。

无输入参数，传 `{}`。

### 完整输入 Schema

```json
{
  "type": "object",
  "properties": {},
  "$schema": "https://json-schema.org/draft/2020-12/schema"
}
```

## 契约来源

依据当前插件连接器实际 tools/list 返回值生成。完整快照保存在同目录 schemas/requirements.json。

快照 SHA-256：`3afcfb5b359afe5226f15372f1788725f4e1274d7def212b4ab40b027c4240f5`。
