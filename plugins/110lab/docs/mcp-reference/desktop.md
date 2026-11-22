# 桌面离线 LaTeX MCP

这是 WeKnow 桌面 0.2 的可选本地连接，9 个工具不计入统一远程 MCP 的 147 个工具。应用必须正在运行，项目需要在该设备上提前缓存；远程 `kb_latex_*` 操作云端，本地 `weknow_latex_*` 操作设备副本。

在桌面应用的「文件 → 本地 LaTeX MCP 配置」中复制实际配置，添加到当前 Agent 客户端。配置使用应用自带运行时，路径由应用生成，不需要另外安装 Node；不要手写他人的路径或复制本地连接令牌。已有 CoBuild OAuth 仍用于云端服务，本地连接不能代替云端登录或权限。

使用 `weknow_latex_status` 核对组件和连接状态，`projects_list` 选择明确缓存的项目，读取文件获得 localRevision 后再改。离线编辑立即保存在本地；`sync` 返回 pending、offline、conflict、auth 或 denied 时，都不能声称已同步。合并冲突要读取双方内容后明确处理。

离线编译组件从校内分发器独立下载，使用客户端内置公钥验签。没有提前下载项目和组件时，断网不能临时取得它们。当前发布并验收 macOS Apple Silicon 0.2；Windows/Linux 保留此前 0.1.0-beta.5。

## weknow_latex_status

查看本地编辑器、编译组件和联网同步状态。不会开始上传。

```json
{
  "type": "object",
  "properties": {},
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_projects_list

列出当前设备上已缓存的项目，返回稳定 projectId、待同步状态和离线准备状态。

```json
{
  "type": "object",
  "properties": {},
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_files_list

列出指定本地项目的文本及资源文件元数据，不返回正文。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    }
  },
  "required": [
    "projectId"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_file_read

分页读取本地文本，返回整份文件的 localRevision。limit 为字符数；偏移也按字符计算。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "path": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 64000,
      "default": 16000
    }
  },
  "required": [
    "projectId",
    "path"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_file_write

按 localRevision 更新本机文本并立即落盘；不会直接覆盖云端。并发冲突返回错误。未知结果重试需保持同一 requestId 和相同正文。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "path": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "content": {
      "type": "string",
      "maxLength": 524288
    },
    "expectedLocalRevision": {
      "type": "string",
      "minLength": 1,
      "maxLength": 150
    },
    "requestId": {
      "type": "string",
      "format": "uuid"
    }
  },
  "required": [
    "projectId",
    "path",
    "content",
    "expectedLocalRevision",
    "requestId"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_file_create

在已缓存项目中新建文本文件，联网时按同一 requestId 创建到云端；同名云端文件会阻止覆盖。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "path": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "content": {
      "type": "string",
      "maxLength": 524288
    },
    "requestId": {
      "type": "string",
      "format": "uuid"
    }
  },
  "required": [
    "projectId",
    "path",
    "content",
    "requestId"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_compile

用已准备的原生 TeX 组件在本机离线生成 PDF；返回版本、摘要和日志，不把 PDF 正文放入上下文。失败不冒充旧 PDF 为本次成功。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    }
  },
  "required": [
    "projectId"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_sync

尝试同步此项目，重新验证云端身份与权限；返回真实状态。遇到冲突保留本地和云端内容；断网不丢弃草稿。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    }
  },
  "required": [
    "projectId"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## weknow_latex_conflict_resolve

显式保存合并后的文本，继续进入同步队列；应先读取冲突双方，不能猜测合并内容。

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "path": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "content": {
      "type": "string",
      "maxLength": 524288
    }
  },
  "required": [
    "projectId",
    "path",
    "content"
  ],
  "additionalProperties": false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

