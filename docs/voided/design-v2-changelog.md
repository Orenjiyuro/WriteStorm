# 设计方案变更追踪（v1 → v2）

日期：2026-07-04 → 2026-07-05  
审查文档状态：已删除（`write-storm-product-design-review-issues.md` 不再存在）  
新增文件：`FLOWS.md`、`TASK-000-pre-v1-hard-gates.md`、`TASK-001-breakdown-workbench-foundation.md`

---

## 一、元数据变更

| 字段 | v1（7/4） | v2（7/5） |
|:-----|:----------|:----------|
| 阶段 | 技术栈选择前的产品边界锁定文档 | 产品边界与已确认技术约束 |
| 文档目的 | "不做技术栈选择" | "记录已确认的技术方向" |
| 文档地位 | 无 | 本文档是当前产品设计事实源 |

---

## 二、产品定位变更

| 维度 | v1 | v2 |
|:-----|:---|:---|
| **目标平台** | "Windows 原生" | "面向 Windows 11 和 macOS 的本地优先桌面写作者工具，不提供 Web 运行版" |
| 产品原则 #6 | "JSON/结构化数据是主事实源" | "SQLite 是唯一事务性主事实源；JSON 和 Markdown 是导出、镜像或人类可读产物" |

---

## 三、AI 连接器策略——最重大的变更

### v1（§6.4）
"账号式连接器"策略：
- 要求"官方文档支持、合法稳定的账号式连接器"
- "API Key 可以作为支持能力，但不能自动替代账号式连接器验收"
- spike 失败则"回到产品层重新选择供应商或调整 V1 目标"

### v2（§6.4）
"Codex SDK 技术闸口"策略：
- **锁定 Codex SDK 为唯一路径**
- 无任何 fallback："不自动回退到 `codex exec`、app-server、GUI app 自动化或其他供应商"
- spike 失败则"V1 AI 能力阻塞"
- 明确非 AI 部分可以继续

**同时删除了：**
- 成本估算要求（§6.1 "显示任务进度、估算和失败状态" → "显示任务进度和失败状态"）
- 预算确认门禁（§20 从"成本和预算"改为"运行限制"）
- 对应状态机中的 `waiting_user_confirmation` 和 `estimating` 状态

---

## 四、对象模型——新增 4 个对象

| 对象 | v1 | v2 |
|:-----|:---|:---|
| `StorySegmentRange` | ❌ 不存在 | ✅ 新增：可跨章节的故事段范围层 |
| `AnalysisModuleInstance` | ❌ 概念存在，但不再对象模型表中 | ✅ 新增：模块+scope 的具体分析实例 |
| `Perspective` | ❌ 信息架构中有，对象模型表中无 | ✅ 新增：跨模块专题视角 |
| `SourceSnapshot` | ❌ 不存在 | ✅ 新增：跨域引用时的来源快照 |
| `Topic` | ❌ 不存在 | ✅ 新增：技法库主题页 |

**原有对象变更：**
- `StructureNode` 描述从"全书、卷、故事段、章节等层级节点"改为"全书、卷、章节等标题层级节点；不承载可跨章节的故事段"
- 对象总数：18 → 22

---

## 五、状态机——新增 AnalysisModuleInstance 状态

| 状态机 | v1 | v2 |
|:-------|:---|:---|
| 拆解书状态 | `... → pending_cost_confirmation → analyzing → ...` | `... → ready_to_analyze → analyzing → ...`（删除了成本确认） |
| AI 资产状态 | 与 v2 相同 | 无变化 |
| **分析模块实例状态** | ❌ 不存在 | ✅ **新增 §8.3**：`not_generated → generated_pending_review → confirmed → stale \| needs_rebuild` |
| 任务状态 | `queued → estimating → waiting_user_confirmation → running → paused → failed → resumable → cancelled → completed` | `queued → running → paused → failed → resumable → cancelled → completed`（删除了 estimating 和 waiting_user_confirmation） |

---

## 六、存储结构——完全重写

### v1（§18）
```text
library-root/
  manifest.json
  index/
    books.json, technique-entries.json, ...
  breakdown-books/{book-id}/
    book.json, source/, modules/, revisions/, evidence/, jobs/
  technique-library/entries/
  exports/
```
主事实源：JSON，Markdown 是阅读和正文编辑视图

### v2（§18）
```text
library-root/
  manifest.json
  writestorm.sqlite
  source/breakdown-books/{book-id}/original.txt
  exports/{export-id}/
  logs/
  cache/
  mirrors/
    markdown/
    json/
```
主事实源：SQLite，JSON/Markdown 由 SQLite 派生

**新增规则：**
- Markdown 正文编辑会创建 `Revision`，标记实例为"正文已改"
- 正文编辑涉及已确认结论时，相关结构化资产显示"需复核"
- 导出时需区分"正文已编辑但结构化资产未复核"的模块

---

## 七、§13 关系层——新增两个完整矩阵

### v2 §13.1 事实源归属矩阵（全新）

定义了 9 类事实的主归属模块和跨模块冲突处理规则：

| 事实类型 | 主事实源 |
|:---------|:---------|
| 标题层级、章节边界 | `StructureNode` |
| 故事段范围 | `StorySegmentRange` |
| 事件、因果、状态变化 | `情节大纲与因果` |
| 人物身份、别名、关系、弧线 | `人物系统与关系` |
| 信息释放、误导、伏笔机制 | `叙事结构、信息释放与节奏` |
| 设定规则、限制、代价 | `世界设定与规则` |
| 整体文风、语言策略 | `文风语言与表达` |
| 本书技法观察、可复用候选 | `写作技法与可复用原则` |
| AI 可用约束摘要 | `AI 约束摘要` |

### v2 §13.2 失效传播规则矩阵（全新）

| 变化 | 直接失效 | 待复核 | 不自动改写 |
|:-----|:---------|:-------|:----------|
| 源文本 hash 变化 | 相关证据 + 模块实例 | 关系、候选、AI 约束 | 已确认资产 |
| 标题层级变更 | 受影响 scope 实例、证据、导出索引 | 专题视角、关系链接 | 未覆盖实例 |
| StorySegmentRange 调整 | 该 range 的模块实例和证据 | 情节、叙事、技法、专题视角 | 标题树 |
| 人物合并/拆分/改名 | 人物索引和相关关系视图 | 情节影响、技法线索、AI 约束 | 来源证据摘录 |
| Markdown 正文编辑 | 对应实例正文 revision | 相关结构化资产 | JSON 结构字段 |

---

## 八、项目文件结构变化

| 状态 | 文件 | 说明 |
|:----:|:-----|:-----|
| 🟢 修改 | `write-storm-product-design.md` | v2（本变更追踪对象） |
| 🔴 删除 | `write-storm-product-design-review-issues.md` | 审查问题记录已删除 |
| 🟢 新增 | `FLOWS.md` | V1 Flow Map，定义首个增量边界 |
| 🟢 新增 | `docs/tasks/TASK-000-pre-v1-hard-gates.md` | 前置硬闸任务 |
| 🟢 新增 | `docs/tasks/TASK-001-breakdown-workbench-foundation.md` | 首个工作台基础增量 |
| 🟢 已有 | `docs/tasks/TASK-002-v1-work-breakdown-master-plan.md` | 工作拆分总规划 |

---

## 九、对审计报告的重新评估

### 9.1 我之前的审计报告中哪些需要修订

| 审计报告的原结论 | 新状态 | 原因 |
|:-----------------|:------:|:-----|
| **"三处未经声明的技术偏移"** | 🔄 **已解决** | 设计文档 v2 已明确记录 Electron cross-platform、SQLite 主事实源、Codex SDK 锁定这三个技术决策 |
| **"Codex SDK Spike 位置过晚"** | ⚠️ **仍成立** | 设计文档 v2 不定义实施顺序，TASK-002 仍将 spike 放在大块 13 |
| **"大块 8 和 18 粒度过大"** | ⚠️ **仍成立** | 设计文档更新不影响这个判断 |
| **"缺少 Schema 版本间迁移"** | ⚠️ **部分解决** | §18 增加了 Markdown 编辑的 revision 规则，但 SQLite schema migration 策略仍未定义 |
| **"审查完成条件不可达"** | ⚠️ **仍成立** | 设计文档 §25.1 仍然要求"所有用户可见 AI 资产必须确认、拒绝、排除或合并" |

### 9.2 设计 v2 解决了的审查问题

| 审查问题 | v2 的处理 |
|:---------|:----------|
| 3.1 连接器 fallback | 锁定 Codex SDK，明确无 fallback（与审查建议矛盾，但这是产品决策） |
| 3.3 状态语义不统一 | §8.3 新增 AnalysisModuleInstance 独立状态，§8.6 简化 Job 状态 |
| 3.4 模块实例未落为一等对象 | 已加入对象模型表和存储结构 |
| 3.5 证据策略 | §13.1 + §13.2 新增事实源归属和失效传播矩阵 |
| 3.6 专题视角变新模块 | 已加入对象模型表，身份定义为"只派生" |
| D4 模块重跑级联（盲点） | §13.2 失效传播矩阵覆盖了 |
| D7 正文编辑审计（盲点） | §18 新增："正文编辑创建 Revision"、"涉及已确认资产需复核" |
