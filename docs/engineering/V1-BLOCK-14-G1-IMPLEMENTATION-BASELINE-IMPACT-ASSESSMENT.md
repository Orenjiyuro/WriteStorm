# V1 Block 14 14-G1 实现基线影响评估

Date: 2026-07-27

Status: `IMPACT_ASSESSMENT_COMPLETE / IMPLEMENTATION_ADMISSION_OPEN`

Authority: D124、D131、`V1-BLOCK-14-G0-CROSS-EXAMINATION-RECORD.md`、
`V1-BLOCK-14-STORY-PLOT-CROSS-EXAMINATION-RECORD.md`

Implementation status: 未授权。本文只记录当前实现基线与获批产品本体之间的改造范围，
不修改 shared contract、migration、服务、工作台、测试、Prompt 或真实 AI。

## 1. 一句话结论

14-G0 获批本体与当前实现基线存在系统性差异，影响 shared contract、迁移快照、模块实例、
工作台、TypeLibrary/Prompt 快照、Perspective/Technique 依赖、完成/导出门禁和测试。影响
范围已经查清，但 canonical key、共享命题/Evidence、状态机及迁移策略尚未冻结，所以
14-G1 不能授权实现，也不能被夹进某个 deep Schema Task。

当前项目没有生产分析结果或需要裁决的“旧用户书库分析数据”。需要兼容的是仓库内现行代码、
不可变 migration 快照、测试 fixture 和配置契约。

## 2. 当前实现基线

### 2.1 模块注册表

`src/shared/domain/analysis.ts` 当前冻结七个实现键：

1. `structure_and_segments`
2. `plot_causality`
3. `narrative_pacing`
4. `character_relations`
5. `world_rules`
6. `style_expression`
7. `technique_principles`

它与14-G0获批本体的差异不是简单改名：

- 结构当前占一个 `AnalysisModule`，目标本体中结构是前置范围层；
- 人物与关系当前合并，目标本体中必须拆成两个单写者模块；
- 主题意蕴当前缺失；
- 技法当前是核心模块，目标本体中归 Block 16；
- 叙述、世界和语言的名称与权威边界已变化；
- 故事情节已有 D131 端点/所有权补丁后的领域语义，但生产配置仍开放；
- 最终 canonical key 和顺序尚未冻结，现有键不得被当作目标答案。

### 2.2 Scope、资产和依赖

同一文件当前还把以下内容绑定到旧模块键：

- `ANALYSIS_MODULE_SCOPE_MATRIX`：所有模块均声明 Book、卷、章和故事段；
- `ANALYSIS_MODULE_ASSET_MATRIX`：来源模块可直接拥有
  `work_technique_observation`、`ai_constraint` 等已被14-G0撤销的资产；
- `ANALYSIS_TECHNIQUE_OBSERVATION_ROUTING`：技法模块同时充当来源和审查模块；
- `ANALYSIS_MODULE_DEPENDENCY_GRAPH.inputModuleKeys`：表达整模块先后和依赖；
- `ReviewAssetEnvelope`：以 `sourceModuleInstanceId` 作为权威来源，尚不能表达跨 Scope
  canonical asset 或命题级依赖；
- `ANALYSIS_MODULE_INSTANCE_CONTRACT`：模块实例状态、正文和结构化资产被捆在同一个浅层壳中。

目标语义要求：

- Scope 是读取、运行和展示视角，不是事实所有权容器；
- 模块实例记录运行和覆盖，canonical asset 跨 Scope 保持身份；
- 技法和正式 AIConstraint 分别由 Block 16、模块外约束治理域单写；
- `inputModuleKeys` 不再表示整模块完成前置或整模块 stale；
- 资产/命题级引用和阶段资格取代整模块内容依赖；
- 当前 ReviewAsset 浅壳不能冒充 deep payload 或共享命题包络。

### 2.3 数据库迁移

| 基线 | 当前耦合 | 目标影响 |
| --- | --- | --- |
| `003_analysis_module_definitions.ts` 及 boundaries | 旧键 allowlist、名称、类别、顺序、`id = key`、七行 seed | 历史 migration 不得原地改写；目标注册表需要单独获准的新 migration 或预发布重建决策 |
| `004_analysis_module_instances.ts` 及 boundaries | 外键指向旧定义；按旧模块为冻结 Book 回填实例；Scope 唯一索引以 module_id 为轴 | 需评估新注册表、运行实例与 canonical asset 分离后如何创建/读取实例；不得把实例继续当事实根 |
| `005_analysis_module_asset_placeholders.ts` 及 boundaries | 在实例上增加 Markdown body 占位 | 只能保留为运行/阅读表达；不能作为 deep structured asset 存储 |
| `tests/fixtures/db/v1-runtime-baseline-*` | 固化当前 migration 结果 | 新 migration 获准后需重新生成测试 fixture；这不是用户数据迁移 |

`tests/unit/block9-migration-snapshot-immutability.test.ts` 等现有门禁要求历史 migration 快照不可
被静默改写。14-G1因此明确否决“直接编辑 migration 003 seed 解决新本体”。

### 2.4 ModuleWorkspace、服务和前台

| 区域 | 当前假设 | 需要后续改造 |
| --- | --- | --- |
| `src/shared/domain/module-workspace-gate.ts` | 逐项比较旧键、定义、Scope、资产矩阵和整模块依赖图；返回 moduleCount | 改为目标注册表、结构前置资格和生产关注卡资格；不得以旧数组全等作为最终产品门禁 |
| `src/main/modules/analysis-module-instance-*` | 按旧 moduleId 读取、创建和修订模块实例 | 保留运行记录职责；资产身份、审查和依赖不得继续隐含归实例 |
| `src/renderer/features/module-workbench/AnalysisModuleWorkbench.tsx` | 从旧定义/资产 placeholder 组合页面；以实例状态和 Markdown body 为主要内容 | 导航适配新七模块；后续由Block 18承接卡片、覆盖、异常与精确纠错，当前不实现 |
| `src/renderer/i18n.ts`、Diagnostics、queries | 旧名称、计数和状态文本 | 更新目标名称及“运行/覆盖/审查/下游可用”分离文案 |
| E2E入口与 harness | 当前只验证旧工作台/空状态可达 | 实现后需验证自然入口显示新七模块、结构不再作为模块、人物/关系拆分和主题出现 |

### 2.5 TypeLibrary、Methodology、Prompt 和配置快照

`src/shared/domain/type-library.ts` 当前：

- 以 `z.enum(ANALYSIS_MODULE_KEYS)` 绑定 PromptTemplate、有效 Prompt 模块快照和影响计划；
- 要求 Prompt 模块数组与旧 `ANALYSIS_MODULE_KEYS` 完全同序；
- 配置 diff 以模块键为 affected/rebuild 单位；
- complete rerun 等于重建全部旧普通模块；
- ContentFocus/Methodology/Prompt snapshots 均继承旧模块数量与顺序。

影响：

- 目标 canonical key 未冻结前不能生成新的有效 Prompt/Methodology snapshot Schema；
- ordered ContentFocus 应先组合为模块有效方法，不成为独立事实所有者；
- 七个 ContentFocus 的故事情节切片只能增加关注问题；
- 六问关注卡与条件触发器必须成为运行配置的一部分，但不能把 Q1–Q47 整体写入 Prompt；
- 配置失效仍可按模块快照 diff 计算，语义失效必须改走实际资产/命题依赖；
- Block 12“确认后永久冻结”冲突仍是独立P0，不在14-G1实现。

受影响的现有 fixture/test 至少包括：

- `tests/fixtures/prompt-template/book-version-snapshot.ts`
- `tests/unit/block12-book-version-snapshot.test.ts`
- `tests/unit/type-library-governance.test.ts`
- Prompt sample/publication 与 TypeLibrary contract tests
- TypeLibrary integration/E2E natural-path tests

14-G1只登记影响，不修改这些资产。

### 2.6 Perspective、Technique 和约束治理

`src/shared/domain/perspective.ts` 的五类Perspective依赖矩阵直接引用旧模块键，包括
`character_relations`、`plot_causality`、`narrative_pacing`、`technique_principles`。

后续必须：

- 将 Block 15 改成只引用七模块稳定资产/结论；
- 将人物与关系依赖拆开；
- 删除 Technique 作为核心模块来源，改为 Block 16 独立所有者；
- 不让 Perspective 成为事实写入者；
- 不让跨模块缺失由 Perspective 自行补造。

`AnalysisAssetKind` 和资产矩阵当前允许来源模块直接拥有
`work_technique_observation`、`reusable_technique_candidate`、`ai_constraint`。这与 D124
单写者裁决冲突，必须在目标 shared contract 中移除或重新路由，但本轮不改代码。

### 2.7 完成、发布和导出

`src/shared/domain/export.ts`、`src/main/exports/export-status-*` 当前按模块实例状态和数量计算：

- not generated；
- pending review；
- stale / needs rebuild；
- body 是否非空；
- ReviewAsset/Technique/completion owner 是否可用。

该模型不能直接表达 D124/D131 的：

- 当前版本覆盖完成；
- 必答关注面已处置；
- checked-empty / not-applicable / insufficient-evidence / unresolved；
- 单项命题审查资格；
- 特定消费者的下游可用性；
- 调用者不可伪造的计算型 `passed`；
- append-only 新正文的覆盖前沿。

目标实现需要新的确定性门禁输入，不能只把 `actualCount === expectedCount` 或 Markdown body
非空当成完成。Block 11现有 blocked-state 行为保持基线，不在14-G1中提前实现新导出。

## 3. 生产简化影响

故事情节 Q1–Q47 分为三层：

1. 领域方法：六问关注骨架和命中后的条件分析；
2. 共享治理：Evidence、版本、候选、审查、失效和完成语义，七模块定义一次；
3. 工程约束：ID、去重、循环、单写者、Schema、CAS和事务，由程序执行。

这一分层对实现基线的影响是：

- PromptTemplate 不再承载全部领域规则和工程不变量；
- shared Schema/validator 承担判别联合、引用、层级循环和单写者检查，包括 EventRelation
  关系族/端点矩阵、合法多父、准入非循环及 Plotline 生命周期单写者校验；
- AI候选不得填写正式ID、review、revision、CAS或`passed`；
- Block 17按短公共协议 + 模块关注卡 + 命中条件 + 严格候选Schema组合；
- Block 17生产验证必须保留六问裸骨架、六问加经验证条件触发、六问加全部AI文学判断卡
  三个正式组；原始Q1–Q47直输只作过载压力测试。第二组才是候选，不得把触发选择实现成
  模型每次完整自检；
- Block 18按卡片展示和异常优先审查，用户不逐条确认普通原子命题；
- `StandardStoryRecap`在来源资格满足后独立综合，不与首次发现调用捆绑。
- 后续工程任务需增加文档一致性lint：核对最新决策号、模块状态、四类资产和核心单写者，
  并拒绝活动摘要重新复制详细关系端点、Lifecycle枚举或Recap准入规则。

## 4. 精确改造范围

### 4.1 Shared domain/contracts

- `src/shared/domain/analysis.ts`
- `src/shared/domain/perspective.ts`
- `src/shared/domain/module-workspace-gate.ts`
- `src/shared/domain/type-library.ts`
- `src/shared/domain/type-library-built-ins.ts`
- `src/shared/domain/export.ts`
- `src/shared/contracts/modules.ts`
- `src/shared/contracts/exports.ts`
- shared barrel/registry DTO tests

### 4.2 Main/database

- migration 003–005及其 boundaries、registry和schema witnesses
- `src/main/modules/analysis-module-*`
- `src/main/exports/export-status-*`
- TypeLibrary repository/service/IPC
- runtime schema validator与数据库fixture生成

### 4.3 Renderer/natural path

- ModuleWorkbench、queries和i18n
- ExportStatusPanel
- Diagnostics contract readout
- app router/e2e harness中的模块入口

### 4.4 Tests

- shared analysis modules/scope/assets/dependencies/review tests
- module workspace gate和module-instance tests
- migrations 003–005、schema compatibility、runtime validator和DB fixture tests
- TypeLibrary/Prompt snapshot、composition、publication gate tests
- Perspective dependency/export/technique relation tests
- export calculator/service/renderer tests
- renderer ModuleWorkbench和自然入口E2E
- 实现获准后新增七模块registry缺项即失败、六问关注卡、条件触发和跨模块引用fixture

## 5. 后续实现必须分开的工作包

14-G1否决把以下内容塞进一个“大改模块枚举”Task：

1. canonical key/order与注册表准入；
2. 历史migration保持不变、新migration/预发布重建策略；
3. ModuleInstance运行记录与CanonicalAsset所有权分离；
4. shared Evidence/命题/review/history协议；
5. TypeLibrary/Methodology/Prompt snapshot升级；
6. Perspective/Technique/AIConstraint依赖重路由；
7. 完成/发布/导出门禁重构；
8. 前台导航、卡片与自然入口；
9. 单元、集成、兼容、E2E和packaged-entry回归。

每个工作包必须单独获得实现授权、RED证据、GREEN证据和停止条件。

## 6. 仍未裁决，因而阻止实现准入

- 新七模块canonical key和稳定顺序；
- 现有key是弃用、别名还是仅历史快照；
- shared claim/Evidence/review/revision具体Schema；
- migration采用新增升级路径还是预发布schema重建；
- ModuleInstance与CanonicalAsset的物理表拓扑；
- 运行关注卡和条件触发的版本字段；
- Block 17批次、上下文复用、Prompt和token预算；
- Block 18事务、CAS、依赖索引、UI和selective stale实现；
- Block 12确认后永久冻结冲突的修复方案。

这些是真正会改变实现方向的未决项。不存在“旧用户书库分析数据怎么迁移”的产品选择。

## 7. 14-G1验收结论

已完成：

- 识别所有主要实现耦合面；
- 区分历史migration快照、仓库fixture与不存在的生产数据；
- 列出精确文件族、测试族和独立工作包；
- 证明当前旧模块contract不能直接承载14-G0/D131；
- 建立“评估完成不等于实现准入”的失败关闭条件。

未完成且不得伪装完成：

- canonical key及兼容策略；
- shared Schema和状态机；
- migration/服务/UI/测试实现；
- 真实AI与长篇生产验证。

因此14-G1当前只能是：

```text
IMPACT_ASSESSMENT_COMPLETE
IMPLEMENTATION_ADMISSION_OPEN
NO_CODE_CHANGE_AUTHORIZED
```
