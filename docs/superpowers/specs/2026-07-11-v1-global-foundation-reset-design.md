# WriteStorm V1 大块 1-7 全局地基重置设计

日期：2026-07-11  
状态：待用户审阅  
适用基线：`ce1b70f feat: implement block 7 text import` 及此前大块 1-7 代码  
前提：不存在需要兼容或迁移的真实用户资料库  

## 1. 决策摘要

本设计采用一次 **pre-release foundation reset**，不在现有大块 1-7 地基上继续追加修补 migration。

核心决策：

1. 重写开发期 migration 历史，从新的 `001_v1_runtime_baseline` 开始。
2. 生产 schema 只创建已有真实读写流程、领域模型已经冻结的表；禁止 speculative shell table。
3. 大块 7 已经真实使用 `Job`，因此现在冻结最小完整 Job/Checkpoint 模型，不再等待大块 10 才补地基。
4. `LibraryService` 不再把 raw SQLite 暴露给业务调用方；数据库事务通过内部 `LibraryUnitOfWork` seam 执行。
5. 新增 `SourceImportService` module，集中 Book、SourceText、Job、文件 staging 和补偿规则；IPC 退回 adapter 身份。
6. 源文件读取、编码、hash 和 staging 复制进入 utility/worker；Electron main 只保留 native dialog、生命周期和事务协调。
7. renderer 使用 SQLite-backed service state，不再把 mutation result 数组当事实源。
8. BrowserWindow guards 必须在任何 `loadURL` 前安装；生产 IPC 同时校验 URL 与真实 sender identity。
9. Library open 改为只读识别、备份、迁移、验证、发布 context 的安全流程。
10. IPC wire schema 采用 Zod-first；TypeScript wire DTO 从 schema 推导，停止手写双重事实源。
11. `AnalysisModuleInstance` 的 revision 不属于 identity；在大块 9 前修正合同。
12. 大块 3-5 的领域合同继续保留，但对应生产表延后到实际拥有读写流程的模块。

本设计不是大块 8 的实现设计。大块 8 当前未提交的纯解析算法和 fixtures 可保留；数据库 migration、Job wiring、IPC wiring 必须等待本设计落地后重新接入。

## 2. 为什么必须现在重置

截至大块 7，代码已证明以下产品路径可运行：

- Electron 安全基线和 typed IPC。
- Library create/open/current。
- SQLite migration runner。
- txt/md 导入、编码选择、不可变副本、metadata、重复策略。
- 最小 renderer 导入和失败恢复入口。

但当前实现也形成了以下全局问题：

- 大块 6 为未冻结领域创建 production shell table，后续只能 drop/recreate。
- `LibraryService.getCurrentContext()` 暴露 raw database，导致 import 和后续结构模块各自写 SQL、Job 和事务。
- `book-import-ipc.ts` 同时承担 adapter、业务编排、文件处理和持久化。
- 20 MiB 读取、编码和 hash 同步运行在 Electron main。
- renderer 用 `sourceImportResults` 保存书架事实，重启后不能从 SQLite 恢复完整书架。
- BrowserWindow 在页面加载后才安装 navigation/window-open guards。
- Library open 在确认 SQLite 是 WriteStorm 资料库前就创建 migration table 并执行 migration。
- shared DTO 与 Zod schema 双写，运行时约束已经发生漂移。
- `analysisRevision` 被错误列为实例 identity 字段。

这些问题继续向大块 8-10 扩散后，会出现多套 Job 状态写入、多套 source snapshot 读取、更多 destructive migration 和 renderer 手工缓存。当前不存在用户数据，保留这些历史没有收益。

## 3. 目标和非目标

### 3.1 目标

- 建立可长期 forward-only 演进的 SQLite 基线。
- 每张生产表都有唯一 owner module 和真实读写流程。
- 把 Electron adapter、领域 module、persistence adapter、worker adapter 分开。
- 保证错误资料库在任何写入前被拒绝。
- 保证未来 migration 有可恢复 snapshot。
- 保证 SQLite 始终是 renderer 的业务事实源。
- 为 Structure、ModuleInstance、Job runtime、Export 提供稳定扩展 seam。
- 把当前已确认的安全和业务规则固化为自动门禁。

### 3.2 非目标

- 不实现大块 8 的结构候选业务 UI。
- 不实现真实 AI、Codex SDK、模块正文或 evidence runtime。
- 不实现完整 Job recovery UI。
- 不实现 Export、Technique Library、Perspective 的生产持久化。
- 不兼容当前开发期 SQLite 文件。
- 不自动删除用户或开发者选中的旧资料库。
- 不改写 Git 历史；只重写尚未发布的 migration source baseline。

## 4. 架构原则

### 4.1 Production table admission rule

一个领域对象进入 production schema 前必须同时满足：

1. 领域 identity、owner、生命周期已冻结。
2. 已有真实写入路径。
3. 已有真实读取路径。
4. 已有稳定错误模型。
5. 已有 integration test 验证关键不变量。

只满足 shared contract 或 renderer readout，不足以创建 production table。

### 4.2 Migration is compatibility, not task history

Migration 记录已发布资料库格式的兼容演进，不记录任务执行过程。未发布阶段允许整体重置 baseline；第一次外部 alpha 或 release tag 之后：

- 已发布 migration 永不修改。
- 只允许 forward migration。
- 每次 pending migration 前创建数据库 snapshot。
- destructive migration 必须包含前置不变量检查和恢复说明。

### 4.3 Deep module ownership

业务复杂度必须集中在 deep module 后面：

- IPC adapter 不拥有事务顺序。
- Renderer mutation handler 不拥有业务事实。
- `LibraryService` 不向普通业务 module 暴露 database handle。
- Worker 不直接决定业务状态转换。
- Repository 不决定跨对象业务流程。

### 4.4 One canonical source per fact

- SQLite 是业务事实源。
- Source file 是 SQLite 引用的不可变大对象，不是独立业务事实源。
- Zod schema 是 IPC wire shape 的事实源。
- Domain policy constants 是状态词汇和转换规则的事实源。
- JSON/Markdown mirror 只从 SQLite 派生。

## 5. 目标进程与 module 结构

```text
Renderer
  AppRouter
  QueryClient
  library feature
  breakdown-shelf feature
  source-import feature
  diagnostics feature
        |
        v
Preload typed adapter
        |
        v
Main typed IPC adapter
        |
        +--> LibraryService
        +--> BookService
        +--> SourceImportService
        +--> SourceTextService
        +--> JobService
        |
        +--> LibraryUnitOfWork (internal seam)
        |      +--> SQLite repositories
        |
        +--> SourceTextWorker adapter
               +--> bounded read
               +--> decode
               +--> hash
               +--> staging copy
```

### 5.1 LibraryService

职责：

- create/open/close library。
- 验证 folder contract 和 manifest。
- 管理唯一 current `LibrarySession`。
- 运行安全 migration open protocol。
- 对 main modules 提供 session-scoped internal access。

公开 interface 不再返回：

- raw `better-sqlite3` database。
- 可由 renderer 操作的 filesystem path handle。
- migration implementation details。

`LibrarySummary` 表示持久化 Library；新增 `LibrarySessionSummary` 表示一次运行期打开会话：

```text
LibrarySessionSummary
- sessionId: opaque runtime id
- library: LibrarySummary
```

Renderer query key 必须包含 `sessionId`，防止关闭后重新打开同一 Library 时复用旧缓存。

### 5.2 LibraryUnitOfWork

`LibraryUnitOfWork` 是 main 内部 seam，不进入 preload/shared renderer contract。

职责：

- 获取当前 session 的 transaction scope。
- 在一个 SQLite transaction 中协调多个 repository。
- transaction 开始和提交前再次确认 session 未切换。
- 统一 foreign key、busy、constraint 和 corruption 错误映射。

普通业务 module 只能通过它执行跨对象写入，不能缓存 database handle。

### 5.3 BookService

职责：

- list/get `BreakdownBook`。
- 读取当前 SourceText、structure edition 和任务摘要。
- 更新 Book 自身 metadata/lifecycle。

不负责：

- native dialog。
- 文件复制和编码。
- SourceText staging。
- Job 状态机。

### 5.4 SourceTextService

职责：

- SourceText identity、edition、metadata 和 canonical relative path。
- 读取 library-owned source copy。
- hash 验证和 health-check 支持。
- 协调 SourceTextWorker adapter。

Canonical source path 固定为：

```text
source/{sourceTextId}/{originalFileName}
```

每个 edition 创建新的 `SourceTextId` 和不可变副本；不覆盖旧文件。

### 5.5 SourceImportService

新增 application module，拥有完整 txt/md import use case：

1. 接收 main-side dialog 产生的 opaque selection。
2. 创建或解析 session-bound pending token。
3. 生成 JobId，并通过 JobService 持久化 `queued` import Job；此时 `book_id` 为空。
4. 调用 SourceTextWorker 进行 bounded read、decode、hash 和 staging，并把 Job 转为 `running`。
5. 执行 duplicate policy。
6. 原子 promote staging file 到 canonical path。
7. 通过 LibraryUnitOfWork 在一个 transaction 中创建 Book、SourceText，绑定 Job.book_id，追加 checkpoint，并把 Job 转为 `completed`。
8. 数据库失败时删除 final copy，并把仍存在的 import Job 转为 `failed`。
9. 进程崩溃遗留文件由 startup recovery/health check 根据 Job 和未引用 `SourceTextId` 恢复、清理或报告。

`books:import-source` IPC adapter 只负责：

- contract validation。
- 调用 SourceImportService。
- DomainError 到 response envelope 的映射。

### 5.6 JobService

大块 7 已真实创建 import Job，因此现在冻结 Job 核心；大块 10 继续实现 UI 和完整 recovery，不再重建 schema。

职责：

- create/list/get Job。
- 合法状态转换。
- append checkpoint。
- failure/cancel/completed 规则。
- JobSummary 映射。

Job 状态词汇一次固定为：

```text
queued
estimating
waiting_confirmation
running
paused
failed
resumable
cancelled
completed
```

Import 的最小路径允许：

```text
queued -> running -> completed
queued/running -> failed
queued/running -> cancelled
failed -> resumable
```

状态转换必须由 JobService 执行；业务 repository 不直接拼写 `UPDATE jobs SET state = ...`。

### 5.7 SourceTextWorker

Worker adapter 负责可能阻塞 Electron main 的工作：

- extension/readability/type 检查。
- 最大字节数限制。
- 单次受控读取。
- UTF-8/UTF-8 BOM decode。
- 用户明确选择后的 GB18030 decode。
- SHA-256。
- 写入 library 内 staging file。

Main 与 worker 之间传递 versioned protocol。Renderer 永远不接触 source path、file handle、worker process 或 staging path。

## 6. BrowserWindow 与 IPC 安全生命周期

### 6.1 Window creation order

固定顺序：

```text
create BrowserWindow
-> install navigation guard
-> install setWindowOpenHandler
-> bind production IPC sender identity
-> loadURL/loadFile
```

禁止在 `loadURL` resolve 后才安装 guards。

### 6.2 Sender identity

生产 product IPC 必须同时验证：

- URL 为允许的 `writestorm://app` 或受信 dev origin。
- `webContentsId` 等于当前主窗口。
- 调用来自 main frame，不接受未授权 subframe。

URL-only 校验保留为第二层检查，不再是唯一信任依据。

窗口销毁或重建时，sender identity binding 必须同步更新。

## 7. 新的 SQLite baseline

### 7.1 Migration reset

删除开发期 migration source：

```text
001_foundation_schema
002_content_model_shell
003_source_import_metadata
```

替换为：

```text
001_v1_runtime_baseline
```

当前本地开发资料库不做 runtime migration。打开时返回 `DEV_SCHEMA_RESET_REQUIRED`，由开发者明确删除重建。

### 7.2 Baseline tables

`001_v1_runtime_baseline` 只创建：

```text
schema_migrations
library
books
source_texts
jobs
job_checkpoints
```

### 7.3 暂不创建的表

以下表从 baseline 删除，在 owner module 真正进入 runtime 时创建：

```text
structure_detection_runs
structure_sets
structure_nodes
story_segment_ranges
exports
analysis_modules
analysis_module_instances
evidence_anchors
relation_links
work_technique_observations
reusable_technique_candidates
source_snapshots
technique_entries
perspective_views
revisions
```

大块 3-5 shared contracts 不受影响。

### 7.4 SQLite identity

新数据库必须设置固定 `PRAGMA application_id`，用于在任何 schema 写入前识别 WriteStorm SQLite。

同时固定：

```text
schemaEpoch = 2
```

旧开发基线视为 epoch 1。`schemaEpoch` 写入 `library` row，并在 manifest 中作为 diagnostic hint；SQLite 仍是权威来源。

不匹配行为：

- application_id 不匹配：`LIBRARY_DATABASE_NOT_WRITESTORM`。
- schema epoch 旧：`DEV_SCHEMA_RESET_REQUIRED`。
- migration history 未知或不连续：`LIBRARY_SCHEMA_INCOMPATIBLE`。

上述错误必须在写入前返回。

### 7.5 Book 和 SourceText 不变量

```text
books.current_source_text_id -> source_texts.id
source_texts.book_id -> books.id
UNIQUE(source_texts.book_id, source_texts.source_edition)
UNIQUE(source_texts.content_hash)
CHECK(source_texts.source_edition > 0)
CHECK(source_texts.size_bytes > 0)
```

产品规则明确为：同一 Library 内同一 source hash 只对应一个已导入 SourceText；重复导入返回 existing Book/SourceText，不创建第二个 BreakdownBook。不同模板或类型分析通过同一本 BreakdownBook 的版本化任务完成，不通过复制 Book 实现。

### 7.6 Job 和 Checkpoint 不变量

`jobs` 至少包含：

```text
id
book_id nullable
kind
state
completed_units
total_units nullable
payload_schema_version
payload_json
error_code nullable
error_details_json nullable
created_at
updated_at
```

`job_checkpoints` 至少包含：

```text
id
job_id
sequence
kind
payload_schema_version
payload_json
created_at
UNIQUE(job_id, sequence)
```

`payload_json` 不是无约束数据袋。每个 `kind + payload_schema_version` 必须绑定 Zod schema，读取时验证。

## 8. Safe Library Open Protocol

### 8.1 Create

```text
validate empty root
-> create folder contract
-> create SQLite
-> set application_id
-> run baseline
-> insert library identity/schemaEpoch
-> validate schema
-> publish LibrarySession
```

Create 失败时只清理由本次 create 新建的文件和目录。

### 8.2 Open

```text
validate manifest and folders
-> open SQLite read-only probe
-> verify application_id
-> verify library identity/schemaEpoch
-> verify migration history
-> close probe
-> create migration snapshot when pending
-> open writable SQLite
-> run pending migrations in transaction
-> validate resulting schema and identity
-> publish LibrarySession
```

任何 probe 错误都不得创建表、更新 pragma 或改变数据库文件。

### 8.3 Migration backup

Library folder 新增：

```text
backups/
  pre-migration-{from}-{to}-{timestamp}.sqlite
```

规则：

- 使用 SQLite online backup mechanism，不在 WAL 活跃时直接复制数据库文件。
- pending migration 前必须先完成 snapshot。
- migration 失败时 transaction rollback，snapshot 保留。
- 自动保留最近三个 migration snapshots。
- `backups/` 不是 cache，不允许启动时自动清空。
- migration 失败后 Library 保持 blocked，不自动用 backup 覆盖当前文件；恢复动作必须显式。

## 9. Filesystem transaction 和 crash consistency

SQLite 与 filesystem 不能形成真正的单一原子事务。本设计采用明确的 staging + compensation 模型：

```text
persist queued import Job with nullable book_id
-> worker writes source/.staging/{jobId}.tmp and Job becomes running
-> main performs duplicate precheck
-> atomic promote to source/{sourceTextId}/{originalFileName}
-> one SQLite transaction writes Book + SourceText
   + binds Job.book_id + appends Checkpoint + completes Job
-> on unique-hash race remove promoted file and return existing ids
-> on other DB failure remove promoted file and fail Job
```

Duplicate precheck 只是用户体验优化，数据库 `UNIQUE(content_hash)` 仍是最终并发门禁。唯一约束冲突必须重新查询 existing Book/SourceText，不能降级成通用 database error。

进程在 promote 后、DB commit 前崩溃时可能留下 orphan source file 和 `running` Job，但不会留下 half Book。启动 recovery/health check 必须：

- 扫描 `source/.staging` 过期文件。
- 扫描 `source/{sourceTextId}` 是否有 SQLite 引用。
- 将重启时仍为 `queued/running` 的 import Job 转为可解释的 `failed/resumable` 状态。
- 将 orphan 标记为可安全清理项。
- 不在未验证 hash/path 前自动删除非 staging 用户文件。

这是 V1 明确接受的 crash consistency 规则，不宣称 filesystem/SQLite 完全原子。

## 10. Renderer service state 和导航

### 10.1 Query state

落实 D011，新增 TanStack Query。Query key 以 LibrarySession 为根：

```text
['library-session', sessionId]
['library-session', sessionId, 'books']
['library-session', sessionId, 'book', bookId]
['library-session', sessionId, 'jobs']
```

规则：

- 成功 import 后 invalidate `books` 和 `jobs`，不 append 本地事实数组。
- open/create/close Library 时清空上一个 session 的业务 cache。
- renderer 只保存 selection、dialog visibility、draft input 等 view state。
- Book shelf 首次进入和重启后都从 `books:list` 读取。

### 10.2 Renderer module layout

目标结构：

```text
src/renderer/
  app/
    AppRouter.tsx
    query-client.ts
  routes/
    NoLibraryRoute.tsx
    BreakdownShelfRoute.tsx
    DiagnosticsRoute.tsx
  features/
    library/
    breakdown-shelf/
    source-import/
  components/
  i18n/
  styles/
```

`App.tsx` 只负责 providers 和 router，不再包含 library、import、analysis readout、technique readout、perspective readout 的全部实现。

### 10.3 Contract readouts

大块 3-5 readout 是有效验收资产，但不是最终 no-library 产品主体。它们移动到 `DiagnosticsRoute`：

- 测试和开发入口可观察。
- production 默认导航不展示工程合同墙。
- no-library route 只显示真实创建/打开资料库路径和错误。

## 11. Shared contracts 和 domain identity

### 11.1 Zod-first wire contracts

IPC request、response、DTO 的 canonical 定义放在分域 schema module：

```text
src/shared/contracts/
  library.ts
  books.ts
  source-import.ts
  jobs.ts
  structure.ts
  registry.ts
```

规则：

- Wire TypeScript 类型使用 `z.infer`。
- 禁止用宽泛 `as z.ZodType<...>` 掩盖 schema/type 漂移。
- Domain-only 类型可以继续使用 TypeScript 定义。
- 状态枚举从 shared domain constants 构建 schema。
- 数据库 row type 不进入 renderer/shared DTO。

`SourceTextMetadata.sizeBytes` 必须在 schema、builder、SQLite 中一致为正整数。

### 11.2 AnalysisModuleInstance identity

修正为：

```text
stable identity:
- id
- bookId
- moduleId
- scope

version/state:
- analysisRevision
- status
- sourceTextEdition
- structureEdition
- schemaVersion
- moduleVersion
```

数据库 natural uniqueness 使用 `bookId + moduleId + normalized scope identity`；`analysisRevision` 变化不创建新实例 identity。

该修正在大块 9 创建任何 production instance/table 前完成，并同步：

- `CONTEXT.md`。
- shared constants/types/tests。
- future migration design。

## 12. Error contract

新增或固定以下稳定原因：

```text
LIBRARY_DATABASE_NOT_WRITESTORM
DEV_SCHEMA_RESET_REQUIRED
LIBRARY_SCHEMA_INCOMPATIBLE
LIBRARY_MIGRATION_BACKUP_FAILED
LIBRARY_MIGRATION_FAILED
LIBRARY_SESSION_CHANGED
SOURCE_IMPORT_WORKER_FAILED
SOURCE_IMPORT_STAGING_FAILED
SOURCE_IMPORT_DATABASE_FAILED
SOURCE_IMPORT_ORPHAN_DETECTED
```

规则：

- 错误原因必须能决定具体恢复动作。
- IPC adapter 不把已知领域错误降级成 `INTERNAL_ERROR`。
- 错误 details 不暴露任意外部 source path 给 renderer。
- migration/health 日志不得包含源文本正文。

## 13. 测试和门禁

### 13.1 Security

- 断言 navigation/window-open guards 在首个 `loadURL` 前安装。
- 断言 production IPC 拒绝错误 `webContentsId`、subframe 和错误 URL。
- 断言 renderer/preload bundle 不包含 fs、SQLite、worker 或 Codex privileged import。

### 13.2 Library open/migration

- 打开任意非 WriteStorm SQLite 后文件 hash 不变化。
- 旧 schema epoch 在任何写入前返回 reset error。
- unknown/non-contiguous migration 在任何 pending write 前拒绝。
- pending migration 前 snapshot 已完成。
- migration 失败时原数据库仍可打开，snapshot 保留。
- create 和 open 使用不同协议，open 不创建缺失数据库。

### 13.3 Schema

- Fresh database 精确 introspection。
- Production table allowlist 只包含已批准 runtime tables。
- 每张表在测试中声明 owner module。
- 不允许 baseline 出现 Structure、Analysis、Technique、Perspective、Export shell table。
- Job state/checkpoint/SourceText edition constraints 有 integration tests。

### 13.4 Import

- Book、SourceText、completed import Job、checkpoint 单事务。
- duplicate hash 返回 existing ids。
- worker 超时/崩溃不创建 Book。
- DB 失败删除 promoted source copy。
- crash orphan fixture 被 health check 检出。
- GB18030 retry token 绑定 LibrarySession。
- 关闭或切换 Library 清理 token 和 worker task。

### 13.5 Renderer

- 打开已有 Library 后书架从 SQLite 恢复。
- Import mutation 后通过 query invalidation 出现新书。
- 切换 session 不显示旧 Library cache。
- failure actions 触发真实 retry/open flow。
- diagnostics readout 不占用默认 no-library 产品入口。
- `tsconfig` 纳入 `tests/**/*.tsx`。

### 13.6 Cross-platform

- Windows packaged SQLite/source import smoke。
- macOS packaged SQLite/source import smoke 在完整跨平台放行前必须执行。
- `makers: []` 和缺少 macOS runner 继续作为 release blocker，不与本地架构重置混为完成。

## 14. 文档和决策记录更新

实现时必须同步更新：

- `docs/engineering/CONTEXT.md`
- `docs/engineering/TECHNICAL_DESIGN.md`
- `docs/engineering/DECISIONS.md`
- `docs/product/write-storm-product-design.md`
- `docs/product/FLOWS.md`
- `docs/tasks/TASK-002-v1-work-breakdown-master-plan.md`

新增 ADR：

```text
ADR: Pre-release schema reset and production table admission
```

ADR 必须记录：

- 当前无真实用户数据。
- 旧开发 SQLite 不兼容。
- production table admission rule。
- 第一次 external alpha/release 后 migration immutable。
- canonical source path。
- Job core 提前冻结原因。
- 不再创建 speculative shell table。

## 15. 对当前大块 8 未提交工作的处理

当前工作区已经存在大块 8 未提交代码。处理原则：

### 15.1 可保留

- 纯 heading/line/markdown/story-range detection algorithm。
- 纯 confidence 和 validation logic。
- 多语言 fixture。
- worker protocol 中与纯 detection input/output 有关的部分。
- 不依赖旧 migration/schema 的性能 fixture。

### 15.2 必须暂停并重接

- `004_structure_workspace` migration。
- 直接 drop 大块 6 shell table 的逻辑。
- 直接从 `LibraryService.getCurrentContext().database` 读写的逻辑。
- Structure repository 直接写 `jobs` 状态的逻辑。
- 未经过 JobService 的 run/job 双状态更新。
- 未经过 LibraryUnitOfWork 的跨表事务。

禁止为了保留当前大块 8 migration 而弱化本设计。

## 16. 实施阶段和依赖顺序

### Phase 0: Freeze

- 暂停新增大块 8 persistence/IPC wiring。
- 记录当前 worktree 文件归属，保留用户未提交修改。
- 不修改或回滚纯 detection 工作。

### Phase 1: Contract corrections

- 冻结 Job core 和 checkpoint contract。
- 冻结 Book/SourceText invariants 和 canonical path。
- 修正 AnalysisModuleInstance identity。
- 固定 Zod-first wire contract rule。
- 写 ADR 和更新 Context/Decisions。

### Phase 2: Security and Library lifecycle

- 修正 BrowserWindow guard order 和 sender identity。
- 实现 read-only Library probe。
- 实现 application_id/schemaEpoch。
- 实现 migration snapshot adapter 和 safe open protocol。

### Phase 3: Schema reset

- 删除开发期 001-003 migration source。
- 创建 `001_v1_runtime_baseline`。
- 重建 schema tests、Library fixtures 和 performance baseline。
- 明确旧开发 Library reset error。

### Phase 4: Deep main modules

- 收窄 LibraryService interface。
- 创建 LibraryUnitOfWork。
- 创建 BookService、SourceTextService、SourceImportService、JobService。
- 将 import SQL 和事务移出 IPC adapter。

### Phase 5: Worker import path

- 建立 versioned SourceTextWorker protocol。
- 移动 bounded read/decode/hash/staging。
- 建立 timeout/cancel/crash cleanup。
- 补 crash orphan health-check seam。

### Phase 6: Renderer foundation

- 引入 TanStack Query 和 LibrarySession query keys。
- 拆分 routes/features。
- 书架从 `books:list` 恢复。
- readout 移到 diagnostics。

### Phase 7: Recertification

- 运行 typecheck、unit、integration、packaged e2e。
- Windows packaged gates 通过。
- macOS/release maker 保持明确 blocked，直到对应环境验证。
- 大块 1-7 重新由 V1 总线程审查放行。

### Phase 8: Resume Block 8

- 从新的 `002_structure_workspace` 开始最终 Structure schema。
- StructureService 使用 LibraryUnitOfWork、JobService 和 SourceTextService。
- 重新接入可保留的纯 detection/worker/fixture 工作。

## 17. 完成标准

只有全部满足以下条件，才能宣布“大块 1-7 全局地基重置完成”：

1. Fresh Library 只创建 baseline allowlist 中的表。
2. 旧开发 SQLite 被明确拒绝且未被写入。
3. 错误 SQLite 被拒绝且文件不变化。
4. BrowserWindow guards 先于任何页面加载。
5. Product IPC 绑定真实 sender identity。
6. LibraryService 公开 interface 不暴露 raw database。
7. Import IPC adapter 不包含 SQL、hash、decode、copy 或补偿业务逻辑。
8. SourceText 重活运行在 worker adapter。
9. Book/SourceText/Job/Checkpoint import 单事务门禁通过。
10. Renderer 重启和 reopen 后从 SQLite 恢复书架。
11. Zod wire schema 与推导类型不存在双重定义。
12. AnalysisModuleInstance identity 不包含 `analysisRevision`。
13. source path 文档和实现统一为 `source/{sourceTextId}/{originalFileName}`。
14. migration snapshot、失败回滚和 blocked recovery 路径有测试。
15. 当前大块 8 persistence 没有绕过新 module seams。
16. `npm run check` 在当前平台通过；未执行平台继续明确 blocked。

## 18. 明确保留的现有设计

以下现有方向正确，不应在重置中推翻：

- Electron + React + TypeScript。
- context isolation、sandbox、no nodeIntegration。
- main-side native library/source dialog。
- typed allowlisted IPC 和 preload bridge。
- SQLite 单一事务性业务事实源。
- opaque pending token、TTL 和 LibrarySession 绑定。
- SourceText immutable copy、encoding、hash、edition。
- AnalysisModule 与 AnalysisModuleInstance 分离。
- ReviewAsset 与 ModuleInstanceStatus 分离。
- Technique Observation/Candidate/Entry/SourceSnapshot 分域。
- Perspective 不是 AnalysisModule，也不是事实源。
- 6A No-Go/未执行时 non-AI Foundation 可继续，真实 AI 保持阻塞。

## 19. 被本设计取代的做法

- 用 production empty shell table 表示未来领域存在。
- 用后续 drop/recreate 修补 shell schema。
- 把 migration 当成任务完成记录。
- 通过 LibraryService 向业务代码分发 raw database。
- 在 IPC adapter 中编排领域事务。
- 在 Electron main 同步完成大文本读取、decode 和 hash。
- 用 renderer local array 表示 SQLite-backed 书架事实。
- 在页面加载后安装 BrowserWindow guards。
- 在验证 Library identity 前执行 migration。
- 手写 wire DTO 后用类型断言强制 Zod 对齐。
- 把 revision 当作实例 identity。

## 20. 审阅门禁

本设计获用户确认后，下一步只允许创建 implementation plan。计划必须：

- 按 Phase 0-8 拆分。
- 每个 Task 控制在 20-30 分钟。
- 每个 Step 控制在 2-5 分钟。
- 明确文件范围、验收标准和验证命令。
- 保护当前大块 8 未提交纯 detection 工作。
- 不在一个 Task 中同时重写 schema、service、worker 和 renderer。

在 implementation plan 获得批准前，不开始代码实现。

---

# WriteStorm V1 Global Foundation Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute in an isolated worktree created from the current working-tree snapshot so the uncommitted Block 8 pure detection work remains available and the main checkout is not mutated.

**Goal:** Replace the pre-release Block 1-7 foundation with a safe, forward-only runtime baseline whose security lifecycle, SQLite schema, domain modules, worker path, renderer state and verification gates match the approved global design.

**Architecture:** Reset unpublished migrations to one runtime baseline, then place business behavior behind Library, Book, SourceText, SourceImport and Job modules. Electron main remains the lifecycle/composition host, utility worker owns blocking source processing, renderer uses session-keyed service state, and Block 8 persistence reconnects only after the new seams are in place.

**Tech Stack:** Electron Forge, React, TypeScript strict mode, Zod, TanStack Query, better-sqlite3, Vitest, React Testing Library, Playwright Electron.

## 21.1 Execution Rules

1. Do not implement in the dirty main checkout.
2. Create an isolated worktree from the current working-tree snapshot; preserve all existing Block 8 files.
3. Never revert or overwrite another thread's changes.
4. One Task per execution batch unless the user explicitly authorizes continuous execution.
5. Every behavior change follows RED -> minimal GREEN -> focused regression -> commit.
6. Do not stage or commit unrelated files.
7. Do not report the Block 1-7 structural reset complete until Task 18, and do not report it recertified until Task 20 completes with fresh evidence.
8. macOS and release-maker gates remain blocked unless actually executed on their required environment.

## 21.2 Target File Map

### Shared contracts and domain

```text
src/shared/domain/ids.ts                         branded domain ids only
src/shared/domain/analysis.ts                    AnalysisModuleInstance identity and policies
src/shared/domain/job.ts                         Job states and transition policy
src/shared/contracts/common.ts                   common Zod primitives and response envelope
src/shared/contracts/library.ts                  LibrarySession/Library wire schemas
src/shared/contracts/books.ts                    BookSummary/list schemas
src/shared/contracts/source-import.ts            import request/result/error schemas
src/shared/contracts/jobs.ts                     Job/Checkpoint wire schemas
src/shared/contracts/structure.ts                existing and Block 8 structure wire schemas
src/shared/contracts/modules.ts                  module-instance wire schemas
src/shared/contracts/exports.ts                  export placeholder wire schemas
src/shared/contracts/registry.ts                 channel-to-schema composition only
```

### Main process

```text
src/main/windows/main-window.ts                  secure BrowserWindow creation order
src/main/ipc/product-sender-policy.ts             URL + webContents + main-frame policy
src/main/library/library-service.ts               create/open/close and session lifecycle
src/main/library/library-database-probe.ts        read-only database identity probe
src/main/library/library-unit-of-work.ts           internal transaction seam
src/main/library/migration-backup.ts              SQLite online backup and retention
src/main/books/book-service.ts                     Book list/get module
src/main/jobs/job-service.ts                       Job transitions/checkpoints
src/main/source-text/source-text-service.ts        source metadata/path/health module
src/main/source-text/source-import-service.ts      import use-case orchestration
src/main/source-text/worker-protocol.ts             versioned worker messages
src/main/source-text/worker-runner.ts               utility-process adapter
src/main/source-text/worker-entry.ts                bounded read/decode/hash/staging worker
src/main/source-text/source-health.ts               staging/orphan/recovery inspection
src/main/books/book-import-ipc.ts                   thin IPC adapter only
src/main/main.ts                                    composition root only
```

### Database

```text
src/main/db/schema-identity.ts                      application_id/schemaEpoch constants
src/main/db/migrations/001_v1_runtime_baseline.ts  only current runtime tables
src/main/db/migrations/index.ts                     new registry
```

The implementation deletes the unpublished migration source files `001_foundation_schema.ts`, `002_content_model_shell.ts`, and `003_source_import_metadata.ts`. The uncommitted `004_structure_workspace.ts` is not promoted as migration 004; its final compatible schema becomes migration 002 during the Block 8 reattachment in Task 19.

### Renderer

```text
src/renderer/app/AppRouter.tsx
src/renderer/app/query-client.ts
src/renderer/routes/NoLibraryRoute.tsx
src/renderer/routes/BreakdownShelfRoute.tsx
src/renderer/routes/DiagnosticsRoute.tsx
src/renderer/features/library/
src/renderer/features/breakdown-shelf/
src/renderer/features/source-import/
src/renderer/App.tsx
```

## 21.3 Task Sequence

### Task 1: Freeze Decisions And Protect The Worktree

**Files:**
- Create: `docs/adr/0001-pre-release-schema-reset-and-table-admission.md`
- Create: `tests/unit/v1-foundation-design-docs.test.ts`
- Modify: `docs/engineering/CONTEXT.md`
- Modify: `docs/engineering/DECISIONS.md`

- [ ] **Step 1: Create the isolated execution worktree**

Use the `using-git-worktrees` skill with a working-tree starting state. Name the branch `codex/v1-foundation-reset`. Verify the worktree contains the current Block 8 untracked detection files before editing.

- [ ] **Step 2: Write a failing decision-document test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('V1 foundation decisions', () => {
  it('records schema reset, table admission and immutable migration policy', () => {
    const adr = readFileSync('docs/adr/0001-pre-release-schema-reset-and-table-admission.md', 'utf8');
    expect(adr).toContain('pre-release schema reset');
    expect(adr).toContain('production table admission');
    expect(adr).toContain('source/{sourceTextId}/{originalFileName}');
    expect(adr).toContain('published migrations are immutable');
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/unit/v1-foundation-design-docs.test.ts`  
Expected: FAIL because the ADR does not exist.

- [ ] **Step 4: Write the ADR and align Context/Decisions**

Record the no-user-data premise, schema epoch reset, table admission rule, canonical source path, Job core freeze and post-alpha immutable migration rule. Mark Block 8 persistence as paused while pure detection remains reusable.

- [ ] **Step 5: Verify GREEN**

Run: `npm run test:unit -- tests/unit/v1-foundation-design-docs.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add docs/adr/0001-pre-release-schema-reset-and-table-admission.md docs/engineering/CONTEXT.md docs/engineering/DECISIONS.md tests/unit/v1-foundation-design-docs.test.ts
git commit -m "docs: freeze V1 foundation reset decisions"
```

### Task 2: Correct AnalysisModuleInstance Identity

**Files:**
- Modify: `src/shared/domain/analysis.ts`
- Modify: `docs/engineering/CONTEXT.md`
- Modify: `tests/unit/shared-analysis-review.test.ts`
- Modify: `tests/unit/shared-domain-dtos.test.ts`

- [ ] **Step 1: Write the failing identity assertion**

```ts
expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.identityFields).toEqual([
  'id', 'bookId', 'moduleId', 'scope',
]);
expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.identityFields).not.toContain('analysisRevision');
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/shared-analysis-review.test.ts tests/unit/shared-domain-dtos.test.ts`  
Expected: FAIL because `analysisRevision` is still an identity field.

- [ ] **Step 3: Change the contract**

```ts
export type AnalysisModuleInstanceContract = {
  readonly ownerKind: 'analysis_module_instance';
  readonly identityFields: readonly ['id', 'bookId', 'moduleId', 'scope'];
  readonly revisionField: 'analysisRevision';
  // existing status/body/review fields remain
};
```

Update the constant and Context language so revision is mutable version state.

- [ ] **Step 4: Verify GREEN and typecheck**

Run: `npm run test:unit -- tests/unit/shared-analysis-review.test.ts tests/unit/shared-domain-dtos.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/domain/analysis.ts docs/engineering/CONTEXT.md tests/unit/shared-analysis-review.test.ts tests/unit/shared-domain-dtos.test.ts
git commit -m "fix: keep module revision out of instance identity"
```

### Task 3: Freeze The Real Job And Checkpoint Contract

**Files:**
- Create: `src/shared/domain/job.ts`
- Create: `src/shared/contracts/jobs.ts`
- Create: `tests/unit/shared-job-contract.test.ts`
- Modify: `src/shared/domain/index.ts`
- Modify: `src/shared/contracts/index.ts`

- [ ] **Step 1: Write failing state and transition tests**

```ts
expect(JOB_STATES).toEqual([
  'queued', 'estimating', 'waiting_confirmation', 'running', 'paused',
  'failed', 'resumable', 'cancelled', 'completed',
]);
expect(canTransitionJob('queued', 'running')).toBe(true);
expect(canTransitionJob('running', 'completed')).toBe(true);
expect(canTransitionJob('completed', 'running')).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/shared-job-contract.test.ts`  
Expected: FAIL because `job.ts` does not exist.

- [ ] **Step 3: Implement the canonical policy**

```ts
export const JOB_STATES = [
  'queued', 'estimating', 'waiting_confirmation', 'running', 'paused',
  'failed', 'resumable', 'cancelled', 'completed',
] as const;

export const JOB_TRANSITIONS = {
  queued: ['estimating', 'running', 'failed', 'cancelled'],
  estimating: ['waiting_confirmation', 'running', 'failed', 'cancelled'],
  waiting_confirmation: ['running', 'cancelled'],
  running: ['paused', 'failed', 'cancelled', 'completed'],
  paused: ['running', 'cancelled'],
  failed: ['resumable'],
  resumable: ['running', 'cancelled'],
  cancelled: [],
  completed: [],
} as const;
```

Define Zod-first `JobSummary`, `JobCheckpointDto` and versioned payload envelope schemas in `contracts/jobs.ts`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:unit -- tests/unit/shared-job-contract.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/domain/job.ts src/shared/domain/index.ts src/shared/contracts/jobs.ts src/shared/contracts/index.ts tests/unit/shared-job-contract.test.ts
git commit -m "feat: freeze V1 job and checkpoint contracts"
```

### Task 4: Establish Zod-First Wire Contracts

**Files:**
- Create: `src/shared/contracts/common.ts`
- Create: `src/shared/contracts/library.ts`
- Create: `src/shared/contracts/books.ts`
- Create: `src/shared/contracts/source-import.ts`
- Modify: `src/shared/contracts/registry.ts`
- Modify: `src/shared/contracts/index.ts`
- Modify: `src/shared/domain/dtos.ts`
- Test: `tests/unit/shared-contract-registry.test.ts`

- [ ] **Step 1: Add failing canonical-type tests**

Assert `sourceTextMetadataSchema.safeParse({ sizeBytes: 0, ...validFields }).success` is `false`, and add compile-time assignments using `z.infer<typeof librarySummarySchema>` and `z.infer<typeof bookSummarySchema>`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/shared-contract-registry.test.ts`  
Expected: FAIL because zero-byte metadata still passes.

- [ ] **Step 3: Split common and library/book/import schemas**

Move the existing schemas without changing channel names. Export wire DTO types from their schemas:

```ts
export const sourceTextMetadataSchema = z.object({
  id: sourceTextIdSchema,
  bookId: breakdownBookIdSchema,
  fileName: z.string().trim().min(1),
  format: z.enum(['txt', 'md']),
  sizeBytes: z.number().int().positive(),
  encoding: z.enum(['utf-8', 'gb18030']),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  sourceTextEdition: z.number().int().positive(),
  importedAt: isoDateTimeStringSchema,
}).strict();
export type SourceTextMetadata = z.infer<typeof sourceTextMetadataSchema>;
```

- [ ] **Step 4: Remove duplicate wire DTO declarations**

Keep domain-only types in `domain/dtos.ts`; update imports so wire summaries come from `shared/contracts`. Do not use `as z.ZodType<...>` casts for the moved schemas.

- [ ] **Step 5: Verify focused tests and typecheck**

Run: `npm run test:unit -- tests/unit/shared-contract-registry.test.ts tests/unit/preload-api.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/contracts src/shared/domain/dtos.ts tests/unit/shared-contract-registry.test.ts tests/unit/preload-api.test.ts
git commit -m "refactor: make core IPC schemas canonical"
```

### Task 5: Finish Contract Decomposition Without Breaking Block 8 Types

**Files:**
- Create: `src/shared/contracts/structure.ts`
- Create: `src/shared/contracts/modules.ts`
- Create: `src/shared/contracts/exports.ts`
- Modify or delete after emptying: `src/shared/contracts/schemas.ts`
- Modify: `src/shared/contracts/registry.ts`
- Test: `tests/unit/ipc-boundary-consistency.test.ts`
- Test: `tests/unit/shared-structure-contracts.test.ts`

- [ ] **Step 1: Write a registry coverage test**

```ts
expect(Object.keys(CONTRACT_REGISTRY).sort()).toEqual([...PRODUCT_IPC_CHANNELS].sort());
```

Add assertions that structure schemas still parse the current Block 8 fixture DTOs.

- [ ] **Step 2: Move schemas by owner module**

Move structure, module and export schemas into focused files. Preserve public exports from `contracts/index.ts` so pure Block 8 detection code remains source-compatible.

- [ ] **Step 3: Remove the monolithic schema implementation**

Delete `schemas.ts` only after `rg -n "contracts/schemas|from './schemas'" src tests` returns no consumers. If Block 8 files import it directly, change those imports to `contracts/structure`.

- [ ] **Step 4: Verify**

Run: `npm run test:unit -- tests/unit/ipc-boundary-consistency.test.ts tests/unit/shared-contract-registry.test.ts tests/unit/shared-structure-contracts.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/contracts tests/unit/ipc-boundary-consistency.test.ts tests/unit/shared-contract-registry.test.ts tests/unit/shared-structure-contracts.test.ts
git commit -m "refactor: split IPC schemas by domain owner"
```

### Task 6: Install BrowserWindow Guards Before Loading

**Files:**
- Create: `src/main/windows/main-window.ts`
- Create: `src/main/ipc/product-sender-policy.ts`
- Create: `tests/unit/main-window-security.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/ipc/not-implemented-handlers.ts`

- [ ] **Step 1: Write the failing ordering test**

Use injected BrowserWindow-like dependencies and record calls:

```ts
expect(calls).toEqual([
  'create-window', 'set-window-open-handler', 'on-will-navigate',
  'bind-sender-policy', 'load-url',
]);
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/main-window-security.test.ts`  
Expected: FAIL because loading currently precedes guard installation.

- [ ] **Step 3: Implement secure creation order**

```ts
export async function createMainWindow(deps: MainWindowDependencies): Promise<BrowserWindow> {
  const window = deps.createWindow(secureWebPreferences(deps.preloadPath));
  installNavigationGuards(window, deps.openExternal);
  deps.bindSenderPolicy(window.webContents.id);
  await window.loadURL(deps.appUrl);
  return window;
}
```

Sender policy must require trusted URL, expected `webContentsId`, and the main frame.

- [ ] **Step 4: Verify security tests**

Run: `npm run test:unit -- tests/unit/main-window-security.test.ts tests/unit/main-typed-ipc-router.test.ts tests/unit/scaffold-boundaries.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main/windows/main-window.ts src/main/ipc/product-sender-policy.ts src/main/main.ts src/main/ipc/not-implemented-handlers.ts tests/unit/main-window-security.test.ts
git commit -m "fix: secure the window before first navigation"
```

### Task 7: Replace Development Migrations With The Runtime Baseline

**Files:**
- Create: `src/main/db/schema-identity.ts`
- Create: `src/main/db/migrations/001_v1_runtime_baseline.ts`
- Delete: `src/main/db/migrations/001_foundation_schema.ts`
- Delete: `src/main/db/migrations/002_content_model_shell.ts`
- Delete: `src/main/db/migrations/003_source_import_metadata.ts`
- Modify: `src/main/db/migrations/index.ts`
- Modify: `tests/integration/db/app-schema.test.ts`

- [ ] **Step 1: Replace the schema expectation with the new allowlist**

```ts
expect(tableNames(db)).toEqual([
  'books', 'job_checkpoints', 'jobs', 'library', 'schema_migrations', 'source_texts',
]);
expect(tableNames(db)).not.toContain('analysis_module_instances');
expect(tableNames(db)).not.toContain('structure_nodes');
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/db/app-schema.test.ts`  
Expected: FAIL because shell tables still exist.

- [ ] **Step 3: Define database identity constants**

```ts
export const WRITESTORM_SQLITE_APPLICATION_ID = 0x5753544d;
export const WRITESTORM_SCHEMA_EPOCH = 2;
```

- [ ] **Step 4: Write `001_v1_runtime_baseline`**

Create only `library`, `books`, `source_texts`, `jobs`, and `job_checkpoints`, with the constraints from Sections 7.5 and 7.6. Set `PRAGMA application_id` during create/bootstrap, not during read-only open probe.

- [ ] **Step 5: Verify schema integration**

Run: `npm run test:integration -- tests/integration/db/app-schema.test.ts tests/integration/db/migration-runner.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/db tests/integration/db/app-schema.test.ts tests/integration/db/migration-runner.test.ts
git commit -m "refactor: reset the unpublished SQLite baseline"
```

### Task 8: Add Read-Only Database Probe And Schema-Epoch Rejection

**Files:**
- Create: `src/main/library/library-database-probe.ts`
- Create: `tests/integration/library/library-database-probe.test.ts`
- Modify: `src/main/library/library-service.ts`
- Modify: `src/shared/errors/domain-error.ts`

- [ ] **Step 1: Write non-mutation tests**

Create an arbitrary SQLite file, hash its bytes, call the probe, hash it again, and assert equality. Add an epoch-1 fixture and expect `DEV_SCHEMA_RESET_REQUIRED`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/library/library-database-probe.test.ts`  
Expected: FAIL because the probe does not exist.

- [ ] **Step 3: Implement the read-only probe**

```ts
export function probeLibraryDatabase(databasePath: string): LibraryDatabaseProbeResult {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const applicationId = db.pragma('application_id', { simple: true });
    // Read library identity, schema epoch and migration history without CREATE/UPDATE.
    return validateProbeRows(applicationId, readProbeRows(db));
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Wire probe before writable open**

`LibraryService.open` must call the probe before `openSqliteDatabase` and before `runMigrations`. Create flow bypasses probe and bootstraps the new database explicitly.

- [ ] **Step 5: Verify**

Run: `npm run test:integration -- tests/integration/library/library-database-probe.test.ts tests/integration/library/library-service.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/library/library-database-probe.ts src/main/library/library-service.ts src/shared/errors/domain-error.ts tests/integration/library
git commit -m "feat: reject invalid libraries before database writes"
```

### Task 9: Add Migration Snapshot And Safe Open Protocol

**Files:**
- Create: `src/main/library/migration-backup.ts`
- Create: `tests/integration/library/migration-backup.test.ts`
- Modify: `src/main/library/folder-contract.ts`
- Modify: `src/main/library/library-service.ts`

- [ ] **Step 1: Write failing backup-order tests**

Record calls and assert `probe -> backup -> migrate -> validate -> publish-session`. Add a failing-backup case that proves migration is not invoked.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/library/migration-backup.test.ts`  
Expected: FAIL because no backup adapter exists.

- [ ] **Step 3: Add `backups/` to the folder contract**

Create `backups` on Library create and require it on open for epoch-2 libraries. Do not classify it as cache.

- [ ] **Step 4: Implement online backup and retention**

```ts
export async function createPreMigrationBackup(
  database: SqliteDatabase,
  targetPath: string,
): Promise<void> {
  await database.backup(targetPath);
}
```

Retain the newest three successful `pre-migration-*.sqlite` files after a new backup completes.

- [ ] **Step 5: Implement safe open order**

Only publish `currentSession` after post-migration schema and identity validation. Migration or backup failure returns stable Library errors and leaves no current session.

- [ ] **Step 6: Verify**

Run: `npm run test:integration -- tests/integration/library/migration-backup.test.ts tests/integration/library/library-service.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/main/library tests/integration/library
git commit -m "feat: make library migrations recoverable"
```

### Task 10: Introduce LibrarySession And LibraryUnitOfWork

**Files:**
- Create: `src/main/library/library-unit-of-work.ts`
- Create: `tests/integration/library/library-unit-of-work.test.ts`
- Modify: `src/main/library/library-service.ts`
- Modify: `src/shared/contracts/library.ts`

- [ ] **Step 1: Write failing session-switch tests**

Begin work under session A, switch to session B before commit, and expect `LIBRARY_SESSION_CHANGED`. Assert the public LibraryService type no longer exposes `getCurrentContext().database`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/library/library-unit-of-work.test.ts`  
Expected: FAIL because raw context is still exposed.

- [ ] **Step 3: Implement the internal seam**

```ts
export interface LibraryUnitOfWork {
  read<T>(operation: (session: InternalLibrarySession) => T): T;
  write<T>(operation: (session: InternalLibrarySession) => T): T;
}
```

`write` starts a better-sqlite3 transaction and checks the session id immediately before commit.

- [ ] **Step 4: Return `LibrarySessionSummary` over IPC**

```ts
export const librarySessionSummarySchema = z.object({
  sessionId: z.string().uuid(),
  library: librarySummarySchema,
}).strict();
```

- [ ] **Step 5: Verify**

Run: `npm run test:integration -- tests/integration/library/library-unit-of-work.test.ts tests/integration/library/library-service.test.ts`  
Run: `npm run typecheck`  
Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/main/library src/shared/contracts/library.ts tests/integration/library
git commit -m "refactor: hide SQLite behind library sessions"
```

### Task 11: Implement JobService

**Files:**
- Create: `src/main/jobs/job-service.ts`
- Create: `src/main/jobs/job-repository.ts`
- Create: `tests/integration/jobs/job-service.test.ts`
- Modify: `src/main/source-text/source-text-import-transaction.ts`

- [ ] **Step 1: Write failing transition/checkpoint tests**

Cover queued -> running -> completed, completed -> running rejection, monotonically increasing checkpoint sequence, and payload schema rejection.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/jobs/job-service.test.ts`  
Expected: FAIL because JobService does not exist.

- [ ] **Step 3: Implement repository primitives**

Repository methods accept an internal transaction database and perform row mapping only: `insert`, `get`, `updateState`, `appendCheckpoint`, `list`.

- [ ] **Step 4: Implement policy ownership in JobService**

```ts
transition(jobId, nextState, now) {
  const current = this.require(jobId);
  if (!canTransitionJob(current.state, nextState)) {
    throw new JobServiceError('invalid_transition', `${current.state} -> ${nextState}`);
  }
  return this.repository.updateState(jobId, nextState, now);
}
```

- [ ] **Step 5: Remove direct Job SQL from import transaction**

Replace it with repository operations invoked through the same LibraryUnitOfWork transaction.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:integration -- tests/integration/jobs/job-service.test.ts tests/integration/source-text/source-text-import-transaction.test.ts`  
Expected: PASS.

```powershell
git add src/main/jobs src/main/source-text/source-text-import-transaction.ts tests/integration/jobs tests/integration/source-text
git commit -m "feat: centralize job transitions and checkpoints"
```

### Task 12: Implement BookService

**Files:**
- Create: `src/main/books/book-service.ts`
- Create: `src/main/books/book-repository.ts`
- Create: `tests/integration/books/book-service.test.ts`
- Modify: `src/main/books/book-import-ipc.ts`

- [ ] **Step 1: Write failing persisted-list tests**

Create two books through repository fixtures, reopen the Library, call BookService.list, and assert stable ordering and current SourceText editions.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/books/book-service.test.ts`  
Expected: FAIL because BookService does not exist.

- [ ] **Step 3: Implement BookRepository and BookService**

BookRepository owns SQL/row mapping. BookService owns current-session requirement and DTO mapping. It exposes `list()` and `get(bookId)` only for this increment.

- [ ] **Step 4: Remove listing SQL from the IPC module**

`books:list` delegates to `bookService.list()` and maps known errors.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:integration -- tests/integration/books/book-service.test.ts`  
Run: `npm run test:unit -- tests/unit/main-book-import-ipc.test.ts`  
Expected: PASS.

```powershell
git add src/main/books tests/integration/books tests/unit/main-book-import-ipc.test.ts
git commit -m "feat: add the persisted book module"
```

### Task 13: Move Source Processing Into A Utility Worker

**Files:**
- Create: `src/main/source-text/worker-protocol.ts`
- Create: `src/main/source-text/worker-entry.ts`
- Create: `src/main/source-text/worker-runner.ts`
- Create: `vite.source-text-worker.config.ts`
- Create: `tests/unit/source-text-worker-protocol.test.ts`
- Create: `tests/e2e/source-text-worker-probe.spec.ts`
- Modify: `forge.config.ts`

- [ ] **Step 1: Write failing protocol tests**

Define versioned `prepare-import`, `cancel` and result/error messages. Reject unknown versions, extra fields and renderer-originated paths.

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/source-text-worker-protocol.test.ts`  
Expected: FAIL because the protocol does not exist.

- [ ] **Step 3: Implement worker processing**

The worker opens the selected path, reads at most `maxSizeBytes + 1`, decodes with fatal TextDecoder, computes SHA-256, and writes a `wx` staging file under `source/.staging/{jobId}.tmp`.

- [ ] **Step 4: Implement timeout/cancel/crash cleanup in runner**

Runner owns worker lifecycle and returns stable `SOURCE_IMPORT_WORKER_FAILED` errors. It removes incomplete staging files after timeout or crash.

- [ ] **Step 5: Package the worker and run probes**

Run: `npm run test:unit -- tests/unit/source-text-worker-protocol.test.ts`  
Run: `npm run build`  
Run: `npx playwright test tests/e2e/source-text-worker-probe.spec.ts`  
Expected: protocol tests pass, package succeeds, packaged worker probe passes.

- [ ] **Step 6: Commit**

```powershell
git add src/main/source-text vite.source-text-worker.config.ts forge.config.ts tests/unit/source-text-worker-protocol.test.ts tests/e2e/source-text-worker-probe.spec.ts
git commit -m "feat: process imported source files in a utility worker"
```

### Task 14: Implement SourceTextService And Source Health

**Files:**
- Create: `src/main/source-text/source-text-service.ts`
- Create: `src/main/source-text/source-text-repository.ts`
- Create: `src/main/source-text/source-health.ts`
- Create: `tests/integration/source-text/source-text-service.test.ts`
- Create: `tests/integration/source-text/source-health.test.ts`

- [ ] **Step 1: Write failing metadata/path tests**

Assert canonical path `source/{sourceTextId}/{originalFileName}`, positive size, SHA-256 shape, monotonic edition and immutable previous editions.

- [ ] **Step 2: Write failing health tests**

Create stale staging, referenced source, unreferenced source directory and hash mismatch fixtures. Assert health results distinguish safe staging cleanup from manual-review orphan files.

- [ ] **Step 3: Verify RED**

Run: `npm run test:integration -- tests/integration/source-text/source-text-service.test.ts tests/integration/source-text/source-health.test.ts`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement SourceTextService**

Centralize metadata validation, relative-path construction, duplicate lookup, source read verification and repository mapping. Remove duplicated hash/path rules from helper callers.

- [ ] **Step 5: Implement source health inspection**

Health inspection reports `stale_staging`, `orphan_source`, `missing_source`, and `hash_mismatch`. Only stale files under `.staging` are automatically removable.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:integration -- tests/integration/source-text/source-text-service.test.ts tests/integration/source-text/source-health.test.ts`  
Expected: PASS.

```powershell
git add src/main/source-text tests/integration/source-text
git commit -m "feat: deepen source text ownership and health checks"
```

### Task 15: Implement SourceImportService

**Files:**
- Create: `src/main/source-text/source-import-service.ts`
- Create: `tests/integration/source-text/source-import-service.test.ts`
- Modify: `src/main/books/book-import-entry.ts`
- Modify: `src/main/source-text/source-text-import-transaction.ts`

- [ ] **Step 1: Write failing end-to-end module tests**

Cover successful import, duplicate hash, encoding retry, session switch, worker crash, DB failure compensation, unique-hash race and checkpoint creation.

- [ ] **Step 2: Verify RED**

Run: `npm run test:integration -- tests/integration/source-text/source-import-service.test.ts`  
Expected: FAIL because SourceImportService does not exist.

- [ ] **Step 3: Implement the orchestration sequence**

Implement exactly the Section 5.5 sequence: queued Job, worker staging, running transition, duplicate precheck, atomic promotion, one final UnitOfWork transaction, compensation, stable error mapping.

- [ ] **Step 4: Add race and crash recovery behavior**

On `UNIQUE(content_hash)` failure, remove promoted file, re-query existing ids and return `duplicate_source_hash`. On process restart, health logic converts abandoned queued/running import jobs to failed/resumable with a concrete reason.

- [ ] **Step 5: Verify**

Run: `npm run test:integration -- tests/integration/source-text/source-import-service.test.ts tests/integration/source-text/source-health.test.ts tests/integration/jobs/job-service.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/source-text src/main/books/book-import-entry.ts tests/integration/source-text
git commit -m "feat: centralize the source import use case"
```

### Task 16: Reduce IPC And Main To Adapters And Composition

**Files:**
- Modify: `src/main/books/book-import-ipc.ts`
- Modify: `src/main/ipc/not-implemented-handlers.ts`
- Modify: `src/main/main.ts`
- Modify: `src/preload/writestorm-api.ts`
- Test: `tests/unit/main-book-import-ipc.test.ts`
- Test: `tests/unit/main-typed-ipc-router.test.ts`

- [ ] **Step 1: Add an IPC shallowness gate**

Add a test/import guard proving `book-import-ipc.ts` does not import `node:fs`, `node:crypto`, `better-sqlite3`, source copy helpers or migration files.

- [ ] **Step 2: Verify RED**

Run: `npm run test:unit -- tests/unit/main-book-import-ipc.test.ts tests/unit/scaffold-boundaries.test.ts`  
Expected: FAIL because the adapter still owns business logic.

- [ ] **Step 3: Replace implementation with delegation**

```ts
export function createBookIpcDependencies(deps: {
  books: BookService;
  sourceImport: SourceImportService;
}): BookIpcDependencies {
  return {
    list: () => deps.books.list(),
    importSource: (request) => deps.sourceImport.import(request),
  };
}
```

- [ ] **Step 4: Compose modules in main**

Construct LibraryService/UnitOfWork, repositories, JobService, BookService, SourceTextService, worker runner and SourceImportService once. Register cleanup for window close, Library switch and app quit.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/unit/main-book-import-ipc.test.ts tests/unit/main-typed-ipc-router.test.ts tests/unit/scaffold-boundaries.test.ts`  
Run: `npm run typecheck`  
Expected: PASS.

```powershell
git add src/main src/preload tests/unit
git commit -m "refactor: keep IPC as a typed adapter"
```

### Task 17: Establish Renderer Session Queries

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/renderer/app/query-client.ts`
- Create: `src/renderer/features/library/library-queries.ts`
- Create: `src/renderer/features/breakdown-shelf/book-queries.ts`
- Create: `tests/unit/renderer-service-state.test.ts`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Install the approved dependency**

Run: `npm install @tanstack/react-query`  
Expected: package and lockfile update only.

- [ ] **Step 2: Write failing session-cache tests**

Assert books are loaded from `books:list` after reopen, import invalidates books/jobs, and session B cannot display session A cache.

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/unit/renderer-service-state.test.ts`  
Expected: FAIL because query modules do not exist.

- [ ] **Step 4: Implement query keys and mutations**

```ts
export const bookKeys = {
  all: (sessionId: string) => ['library-session', sessionId, 'books'] as const,
  detail: (sessionId: string, bookId: string) =>
    ['library-session', sessionId, 'book', bookId] as const,
};
```

Import success invalidates `bookKeys.all(sessionId)` and the session Job key; it never appends a local business array.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/unit/renderer-service-state.test.ts`  
Run: `npm run typecheck`  
Expected: PASS.

```powershell
git add package.json package-lock.json src/renderer tests/unit/renderer-service-state.test.ts
git commit -m "feat: make renderer state follow the library session"
```

### Task 18: Split Renderer Product Routes And Diagnostics

**Files:**
- Create: `src/renderer/app/AppRouter.tsx`
- Create: `src/renderer/routes/NoLibraryRoute.tsx`
- Create: `src/renderer/routes/BreakdownShelfRoute.tsx`
- Create: `src/renderer/routes/DiagnosticsRoute.tsx`
- Move/refactor: `src/renderer/source-import-failure.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `tsconfig.json`
- Test: `tests/unit/renderer-routes.test.tsx`

- [ ] **Step 1: Include TSX tests in typecheck**

Add `tests/**/*.tsx` to `tsconfig.json`.

- [ ] **Step 2: Write failing route tests**

Test no-library actions, persisted shelf, import failure recovery and diagnostics readouts as separate routes. Assert the default no-library route does not render the engineering contract wall.

- [ ] **Step 3: Verify RED**

Run: `npm run test:unit -- tests/unit/renderer-routes.test.tsx`  
Expected: FAIL because routes are not split.

- [ ] **Step 4: Move behavior into focused routes/features**

`App.tsx` becomes providers plus `AppRouter`. Diagnostics preserves all Block 3-5 observable contract readouts without making them the primary product surface.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:unit -- tests/unit/renderer-routes.test.tsx tests/unit/source-import-failure-ui.test.ts`  
Run: `npm run typecheck`  
Expected: PASS.

```powershell
git add src/renderer tests/unit/renderer-routes.test.tsx tests/unit/source-import-failure-ui.test.ts tsconfig.json
git commit -m "refactor: split product routes from diagnostics"
```

### Task 19: Reattach Block 8 To The New Foundation

**Files:**
- Replace: `src/main/db/migrations/004_structure_workspace.ts` with `src/main/db/migrations/002_structure_workspace.ts`
- Modify: `src/main/db/migrations/index.ts`
- Modify: `src/main/structure/structure-service.ts`
- Modify: `src/main/structure/structure-source-snapshot.ts`
- Modify: `src/main/structure/persistence/structure-detection-run-repository.ts`
- Test: existing Block 8 unit/integration tests

- [ ] **Step 1: Preserve pure detection files unchanged**

Record hashes for `src/main/structure/detection/**` and fixtures before persistence refactoring. Do not rewrite algorithms merely to match new storage modules.

- [ ] **Step 2: Write failing seam tests**

Add import guards proving StructureService does not call `LibraryService.getCurrentContext().database` and Structure repositories do not directly transition Job rows.

- [ ] **Step 3: Create final migration 002**

Build final Structure tables directly. Do not include `DROP TABLE structure_nodes` or an empty-shell assertion because migration 001 no longer creates those tables.

- [ ] **Step 4: Reconnect services**

StructureService obtains source snapshots through SourceTextService, transactions through LibraryUnitOfWork, and Job transitions/checkpoints through JobService.

- [ ] **Step 5: Verify Block 8 focused gates**

Run: `npm run test:unit -- tests/unit/shared-structure-contracts.test.ts tests/unit/structure-detector.test.ts tests/unit/structure-validator.test.ts tests/unit/structure-worker-protocol.test.ts`  
Run: `npm run test:integration -- tests/integration/db/structure-workspace-migration.test.ts tests/integration/db/structure-detection-run-repository.test.ts tests/integration/structure`  
Expected: PASS.

- [ ] **Step 6: Confirm pure logic hashes or explain intentional changes**

Any changed detection file must have an explicit behavioral test and review note; persistence refactoring alone is not a reason to alter detection behavior.

- [ ] **Step 7: Commit**

```powershell
git add src/main/db/migrations src/main/structure tests/unit tests/integration
git commit -m "refactor: attach structure detection to the new foundation"
```

### Task 20: Documentation, Performance And Full Recertification

**Files:**
- Modify: `docs/engineering/CONTEXT.md`
- Modify: `docs/engineering/TECHNICAL_DESIGN.md`
- Modify: `docs/engineering/DECISIONS.md`
- Modify: `docs/product/write-storm-product-design.md`
- Modify: `docs/product/FLOWS.md`
- Modify: `docs/tasks/TASK-002-v1-work-breakdown-master-plan.md`
- Modify: `docs/tasks/TASK-000-pre-v1-hard-gates.md`
- Modify: `docs/engineering/V1-BLOCK-1-STATUS.md`
- Modify: `docs/engineering/V1-BLOCK-6-STATUS.md`
- Modify: `docs/engineering/V1-BLOCK-7-STATUS.md`
- Modify: `docs/engineering/V1-BLOCK-8-PERFORMANCE-BASELINE.md`
- Modify: `docs/engineering/V1-BLOCK-8A-STATUS.md`
- Test: all gates

- [ ] **Step 1: Update canonical documentation**

Record final table ownership, source path, Library open protocol, module seams, Job ownership, renderer service state, schema epoch and migration publication rule.

- [ ] **Step 2: Run placeholder/contradiction scans**

Run:

```powershell
rg -n "source/breakdown-books|analysisRevision.*identity|content model shell|structure shell|raw database|getCurrentContext\(\).*database" docs src
```

Expected: no active-contract occurrences; historical/voided documents must be clearly marked and excluded.

- [ ] **Step 3: Re-record performance baselines**

Run the Library create/open/migration baseline against the new schema and source-worker 50 KB/1 MB/5 MB fixtures. Record observed time, memory, timeout and main-process responsiveness.

- [ ] **Step 4: Run fresh complete verification**

Run: `npm run check`  
Expected:

- typecheck exit 0;
- all unit tests pass;
- all integration tests pass;
- build/package succeeds;
- all current-platform Electron e2e tests pass.

- [ ] **Step 5: Run diff hygiene and scope checks**

Run: `git diff --check`  
Expected: exit 0.  
Run: `git status --short`  
Expected: only files belonging to this plan or preserved Block 8 work are present.

- [ ] **Step 6: Record blocked platform gates honestly**

If macOS smoke and release makers were not executed, status documents must continue to say blocked/not verified. Do not infer them from Windows packaging.

- [ ] **Step 7: Commit the recertification record**

```powershell
git status --short
git add -- docs/engineering/CONTEXT.md docs/engineering/TECHNICAL_DESIGN.md docs/engineering/DECISIONS.md docs/engineering/V1-BLOCK-1-STATUS.md docs/engineering/V1-BLOCK-6-STATUS.md docs/engineering/V1-BLOCK-7-STATUS.md docs/engineering/V1-BLOCK-8-PERFORMANCE-BASELINE.md docs/engineering/V1-BLOCK-8A-STATUS.md docs/product/write-storm-product-design.md docs/product/FLOWS.md docs/tasks/TASK-000-pre-v1-hard-gates.md docs/tasks/TASK-002-v1-work-breakdown-master-plan.md
git diff --cached --name-only
git commit -m "docs: recertify the V1 foundation"
```

## 21.4 Review Checkpoints

The implementation thread must stop for review after:

1. Task 5: shared contract and identity corrections.
2. Task 10: security, schema reset, safe Library open and UnitOfWork.
3. Task 16: deep main modules, worker import path and thin IPC.
4. Task 18: renderer state and route split.
5. Task 19: Block 8 reattachment.
6. Task 20: full recertification.

At every checkpoint report:

- completed Tasks, not just changed files;
- fresh verification command outputs;
- remaining risks and blocked platforms;
- whether preserved Block 8 pure logic changed;
- whether any design deviation requires a new user decision.

## 21.5 Plan Completion Rule

This plan is complete only when every Task has a passing focused verification, Task 20 has a fresh passing `npm run check`, the migration/source-path/identity contradiction scans are clean, and the V1 review thread has independently approved the resulting Block 1-7 foundation. Task completion does not by itself mean Block 8 or V1 is complete.
