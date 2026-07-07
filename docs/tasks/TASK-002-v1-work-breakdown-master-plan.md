# WriteStorm V1 工作颗粒度拆分总文档

`status: breakdown_only`
`implementation_allowed_from_this_document: false`

本文档是 WriteStorm V1 的工作颗粒度拆分总入口，用于把后续实现线程拆成可验证的小任务。它不是实施记录，也不是代码变更计划。实现线程必须按前置闸口逐块执行，不能跳过前置块；每个工程大块都应交付一个可从真实桌面入口验证的骨架态、空态、阻塞态或禁用态。

## 0A. V1 总线程与实现线程门禁

- 本线程是 V1 版本总线程，不负责具体实现，只负责掌握项目进度、输出实现线程用的 prompt、判断实现线程的工作计划\进度是否合理。
- 本门禁适用于本 V1 总线程，以及由本 V1 总线程创建、派发或明确接续的实现线程；非由本线程创建或派发的线程不受此门禁约束。
- 本 V1 总线程创建实现线程时，必须把本节完整写入实现线程 prompt 的开头或硬性上下文。
- 任何受本门禁约束的线程，每次回复必须首先回答：
  1. 你是什么线程，什么职责。
  2. 当前的工作进度是什么，正要执行什么工作，是否有依据。
  3. 后续预计的工作是什么，可能会有什么困难。
- 实现线程触及以下事项前必须停下请求总线程或用户授权：写文件、安装依赖、联网读取官方文档或 registry、运行脚手架、创建/切换分支、创建 worktree、执行可能破坏现有工作区的操作、跨出当前授权 Task 范围。
- 受本门禁约束的实现线程，如果无法从项目文档、工作拆分、总线程 prompt 或可见仓库事实中回答以上问题，必须停止实现并报告缺失依据。
- 本 V1 总线程只输出或审查实现线程 prompt、计划、进度、风险和验收证据，不直接承担具体实现；若需要修改治理文档以维持门禁、进度事实源或线程交接规则，可在本线程执行并说明依据。
- 进度判断依据优先级：最新用户指令 > 本工作拆分总文档 > 产品设计文档 > 仓库代码和验证证据 > 实现线程自述。

## 0. 总约束

- 产品形态：Windows 11 + macOS 桌面应用；不做 Web 运行版。
- 技术方向：Electron Forge + Vite + React + TypeScript。
- 主事实源：SQLite 是唯一事务性主事实源；JSON/Markdown 只做导出、镜像或可读产物。
- 安全边界：Renderer 不得直接访问 fs、SQLite、shell、Codex SDK；只能走 preload typed IPC。
- AI 边界：V1 AI 只允许 Codex SDK；SDK gate 不通过则 AI 阻塞，不回退 `codex exec`、app-server、API key 直连、本地模型或其他供应商。
- Markdown 边界：Markdown 只承载 `AnalysisModuleInstance.body` 的阅读/编辑视图；结构字段、证据、关系、标签、审查状态、AI 约束、技法候选必须经结构化控件写 SQLite。
- 产品诚实：未实现能力必须显示禁用、blocked 或 empty，不得用 mock 数据假装完成。
- 外部参照边界：外部软件、外部资料和未来来源类型只作二级参照；V1 主事实源仍是 SQLite、复制后的 source text 和用户确认资产。
- 当前前提：如果仓库仍无 `package.json/src/tests`，必须先做大块 1，不能跳做后续块。

## 1. 生产级工程约束

实现线程必须把脚手架、Node、native SQLite、Electron 安全、Electron e2e、Codex SDK packaged/runtime 和 AI pipeline 后段任务作为显式任务和验收硬闸，不能在实现时临场补设计。

1. 脚手架路径：大块 1 默认采用 Electron Forge `vite-typescript` 模板作为起点，再手动接入 React renderer；不得把 Forge Vite TS、Forge Webpack React TS、Vite `react-ts` 三条路线混写成一个“官方模板”。验收必须检查 `@electron-forge/plugin-vite` 的 main/preload/renderer 分开配置，以及 `package.json` 的 `main` 指向 `.vite/build/main.js`。
2. Node 版本：Vite 的 Node 要求高于 Codex SDK TS 的最低要求。本项目默认锁定 Node `22.12+` 作为开发、CI、packaging 统一基线；如实现线程选择 Node 20 LTS，也必须满足 `20.19+` 并写入 `engines`、`.nvmrc` 或 Volta/asdf 配置。
3. Native SQLite：`better-sqlite3` 是 Electron native module 风险点。大块 6 必须包含 Electron ABI rebuild、Vite external 化、Windows/macOS packaged smoke；不能只验证开发态连接。
4. Electron 安全：`nodeIntegration: false`、`contextIsolation: true` 只是起点。大块 1 还必须纳入 CSP、sandbox 策略、navigation/new-window 限制、`shell.openExternal` allowlist、IPC sender validation。
5. Electron e2e：生产路径使用 main 侧 native dialog；测试路径不能假设 Playwright 能像网页 file chooser 一样拦截 Electron native dialog，必须通过 main-process stub 注入 `dialog.showOpenDialog` 的固定返回。
6. Codex SDK：V1 只允许官方 Codex SDK。SDK 内部包装官方 `@openai/codex` CLI 并通过 JSONL 事件通信属于 SDK 机制，不等于产品禁止的直接 `codex exec` fallback。Spike 分成早期 feasibility gate 与后期 integration gate：早期先验证 Node、runtime、cwd/env/config、structured output、cancel/timeout 基本可行性；后期再接 Job、Settings、packaged runtime 和安全回归。
7. AI 后段：大块 14-18 不能停留在规格标题。真实 AI、diff、导出必须拆出 streaming、schema validation、transaction boundary、partial failure、idempotency、resume、packaged smoke。
8. 生产门禁：性能基线、全链路 e2e、日志/可观测性、发布/签名/更新策略、CI/CD、无障碍和 i18n 准备必须显式落入任务或硬闸；不能只靠实现者临场补。

参考来源：

- Electron Forge Vite TS template：https://www.electronforge.io/templates/vite-+-typescript
- Electron Forge Vite plugin：https://www.electronforge.io/config/plugins/vite
- Electron Forge React TS guide：https://www.electronforge.io/guides/framework-integration/react-with-typescript
- Vite guide：https://vite.dev/guide/
- Electron native modules：https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- Electron security：https://www.electronjs.org/docs/latest/tutorial/security
- Playwright Electron：https://playwright.dev/docs/api/class-electron
- Codex SDK docs：https://developers.openai.com/codex/sdk
- OpenAI Codex TypeScript SDK：https://github.com/openai/codex/tree/main/sdk/typescript

## 2. 产品能力地图

1. 资料库与桌面入口：创建/打开本地资料库，进入拆解书架、技法库、原创占位、设置。
2. 源文本与结构：导入 txt/md，复制源文件，自动生成卷/章节/故事段候选，用户校正并冻结 `structure_edition`。
3. 类型与模板：用户选择主类型/子类型；`TypeLibrary`、`PromptTemplate`、模板版本、小样预览、发布/回滚影响后续分析任务。
4. 分析模块：七个稳定模块，按 `book / volume / chapter / story_segment_range` 形成 `AnalysisModuleInstance`。
5. 内容资产：正文、结构化对象、`EvidenceAnchor`、`RelationLink`、`WorkTechniqueObservation`、`ReusableTechniqueCandidate`、`AIConstraint`。
6. 审查规则：AI 资产默认待审查；关键结论、候选、关系变化必须有有效证据。
7. 专题视角：跨模块派生视图，不是普通 `AnalysisModule`，不成为新事实源。
8. 融合技法库：`TechniqueEntry` 是独立资产，来自已采纳 `ReusableTechniqueCandidate`。
9. Job 与恢复：任务状态、checkpoint、失败原因、恢复入口。
10. 书籍完成：区分 `Task completed` 与 `Book completed`；完成前所有用户可见 AI 资产必须确认、拒绝、排除或合并。
11. 资料库健康：检查缺失文件、断链、孤儿对象、duplicate IDs、hash 不匹配，并提供修复/重建索引入口。
12. 导出：导出入口、阻塞原因、人类 Markdown 包和机器包目标。
13. 设置与 AI Gate：Codex SDK gate 状态、AI 禁用原因、日志/模板/schema/修复入口。
14. 原创书架：V1 独立占位，不创建项目、不生成正文。

## 3. 工程大块顺序

### Foundation 大块

1. 脚手架与安全基线
2. Shared domain/contracts/typed IPC
3. 分析模块边界契约与最小规格
4. 技法资产边界契约
5. 专题视角边界契约
6. 资料库、SQLite、migration、LibraryService
6A. Codex SDK feasibility gate（早期 Go/No-Go，不生成内容）
7. txt/md 导入
8. 结构候选生成与校正
9. `AnalysisModuleInstance` 工作台骨架
10. Job state/recovery shell
11. Export blocked state
12. 技法库半可用、类型模板壳、原创占位、设置壳

### AI Gate 与 Content Model 深化大块

13. Codex SDK integration gate（只接入门禁，不生成内容）
14. 七个分析模块深度规格、schema、审查规则拷打
15. 专题视角深度规格
16. 技法抽象与采纳深度规格

### AI Execution 大块

17. 真实 AI adapter/pipeline
18. 证据、关系、重跑 diff、书籍完成、健康检查、导出补实

---

# 大块 1：脚手架与安全基线

目标：建立可运行桌面应用、进程分层、最小安全基线和验证脚本。

前置：无。

禁止：SQLite、真实资料库、导入、AI、复杂 UI。

## Tasks

- Task 1.1 仓库状态审计：确认是否 docs-only，记录当前分支、未跟踪文件和是否已有 `package.json/src/tests`。验证：`rg --files`、`git status --short --branch`。
- Task 1.2 脚手架隔离策略：在仓库根目录落地，不另建工程副本、不在根目录再套同名项目目录。验收：`package.json` 与 `src/` 位于仓库根。
- Task 1.3 Node/package baseline：锁定 Node `22.12+` 为默认开发/CI/packaging 基线；若使用 Node 20，则必须满足 `20.19+`。范围：`package.json engines`、`.nvmrc` 或 Volta/asdf、CI 说明。验证：`node -v` 记录和 package manager 版本记录。
- Task 1.4 Forge 模板路径确认：使用 Electron Forge `vite-typescript` 模板作为起点；React 由 renderer 手动接入。验收：实现记录不能把 Forge Webpack React TS guide 或 Vite `react-ts` 当成同一个模板来源。
- Task 1.5 根目录脚手架落地：生成 `package.json`、Forge 配置、Vite 配置、`src`、测试目录。验证：脚本存在；没有生成额外工程副本。
- Task 1.6 React renderer 接入：安装 `react/react-dom` 与类型包，设置 TS JSX，renderer 使用 `createRoot`。验收：renderer 是 React 入口，不是纯 HTML 占位。
- Task 1.7 Forge Vite plugin 配置：main、preload、renderer 分开配置；`package.json main` 指向 `.vite/build/main.js`；renderer entry 和 Vite globals 可构建。验证：`npm run build` 产物路径检查。
- Task 1.8 进程目录收敛：`src/main`、`src/preload`、`src/renderer`、`src/shared`。验收：shared 不依赖进程层；renderer 不导入 Node/Electron privileged modules。
- Task 1.9 TS 与脚本基线：strict TS、Vitest、typecheck/test/build。验证：`npm run typecheck`、`npm run test:unit`、`npm run build`。
- Task 1.10 BrowserWindow 安全配置：禁 `nodeIntegration`，启 `contextIsolation`，明确 `sandbox` 策略，只通过 preload 暴露 API。验证：安全配置 unit/smoke。
- Task 1.11 Electron 生产安全 checklist：配置 CSP；限制 navigation；限制 new-window；`shell.openExternal` 只允许安全 URL allowlist；IPC handler 做 sender/frame validation。验证：安全回归测试或可观察 smoke。
- Task 1.12 Preload health bridge：只暴露 `window.writestorm.internal.health` 或等价 internal API，不混入产品 domain。验证：Electron smoke。
- Task 1.13 最小桌面入口壳：显示资料库未打开空态，并能从真实 Electron 窗口进入。验证：真实窗口非空，renderer 无 Node 权限。
- Task 1.14 Import guard 测试：shared/renderer 禁 privileged imports，main/preload 边界明确。验证：unit tests。
- Task 1.15 Electron/Playwright smoke：启动窗口、读取空态、调用 health；若涉及 native dialog，测试通过 main-process stub 注入，不走网页 file chooser 假设。验证：e2e/smoke。
- Task 1.16 CI/CD 脚本基线：定义本地 CI 等价命令，至少串起 `typecheck`、unit、Electron smoke、build；如果没有远程 CI，必须明确 blocked reason。验收：一条命令能复现基础质量门。
- Task 1.17 无障碍与 i18n 壳基线：renderer 使用可聚焦控件、可见 focus、基础 ARIA/label、对比度 smoke；显示文案和日期格式集中到可替换资源层，不把中文字符串散落到 domain/service。验证：component accessibility smoke。
- Task 1.18 发布/更新策略占位：记录 V1 是手动安装包、签名包还是自动更新通道；未确定前 packaged smoke 只能证明可打包，不能宣称可生产分发。范围：Windows code signing、macOS codesign/notarization、auto-update enabled/disabled reason。
- Task 1.19 完成门禁：`typecheck/test:unit/build` 全过；如已配置 e2e，则 Electron smoke 过；进入大块 2 前记录 Node、Forge、Electron、Vite、React 版本和安全 checklist 状态。

---

# 大块 2：Shared Domain、Contracts、Typed IPC

目标：固定跨进程语言、DTO、错误模型和 typed IPC。

前置：大块 1 完成。

禁止：SQLite、真实业务服务、导入、AI。

## Tasks

- Task 2.1 shared 布局：建立 `src/shared/domain`、`contracts`、`errors`。验收：shared 不导入 Electron/fs/SQLite/React。
- Task 2.2 ID brand：定义 LibraryId、BreakdownBookId、SourceTextId、StructureNodeId、StorySegmentRangeId、AnalysisModuleId、AnalysisModuleInstanceId、JobId、RevisionId、EvidenceAnchorId、ExportId、TechniqueEntryId。
- Task 2.3 基础 union：StructureNodeKind、ScopeKind、JobState、ModuleInstanceStatus。
- Task 2.4 DTO 基线：LibrarySummary、BookSummary、SourceTextMetadata、StructureNodeDto、StorySegmentRangeDto、ModuleInstanceSummary、JobSummary、ExportStatusDto。
- Task 2.5 DomainError：稳定 code、message、recoverable、details。
- Task 2.6 Contract registry：Zod request/response schema 覆盖 allowlist channels。
- Task 2.7 Main typed IPC router：统一注册、请求/响应校验。
- Task 2.8 NOT_IMPLEMENTED handlers：未实现 product channel 返回稳定错误。
- Task 2.9 Preload API：暴露 `window.writestorm.library/books/structure/modules/jobs/exports`。
- Task 2.10 边界门禁：shared、renderer、registry、preload 一致性测试。

---

# 大块 3：分析模块边界契约与最小规格

目标：在 SQLite 和模块实例实现前，锁定“模块是什么、产生什么资产、哪些字段走正文、哪些字段必须结构化”。

范围：`src/shared/domain/analysis*`、`src/shared/domain/evidence*`、`src/shared/domain/review*`、contracts fixtures。

前置：大块 2 已有 shared/contracts/errors 基线。

禁止：写真实 AI prompt、生成模块正文、做七模块深度 schema。

## Task 3.1 模块清单与分类锁定

目标：固定七个顶层模块和 AI 约束摘要的非顶层身份。

范围：`AnalysisModuleDefinition`。

Steps：

1. 列出七个模块 key/name/category。
2. 标记 `作品结构与分段` 为结构/输入类。
3. 标记六个普通分析类：情节、叙事、人物、世界、文风、技法。
4. 标记 `AI 约束摘要` 为 secondary system page。
5. 写 fixture 覆盖模块清单顺序。

验收：`AI 约束摘要` 不会生成普通 `AnalysisModuleInstance`。

验证：unit fixture test。

禁止：新增第八/第九普通模块。

## Task 3.2 Scope 支持矩阵

目标：定义每个模块支持哪些 scope。

范围：`AnalysisModuleDefinition`、`ScopeRef`。

前置：Task 3.1。

Steps：

1. 建立 `book/volume/chapter/story_segment_range` scope matrix。
2. 标记结构模块对 story range 的特殊关系。
3. 标记专题视角不在该矩阵内。
4. 写 unsupported scope fixture。

验收：实现线程不能随意给模块扩 scope。

验证：unit test。

禁止：把 `StorySegmentRange` 当 `StructureNode` kind。

## Task 3.3 模块产物类型矩阵

目标：定义每个模块可能产生的资产类型。

范围：`AnalysisAssetKind` union。

前置：Task 3.2。

Steps：

1. 定义 `body`、`structured_object`、`evidence_anchor`、`relation_link`、`work_technique_observation`、`reusable_technique_candidate`、`ai_constraint`。
2. 为七个模块建立 allowed asset matrix。
3. 标记技法观察可来自多个模块，但统一进入技法模块审查。
4. 写矩阵完整性测试。

验收：模块实例设计知道要预留哪些结构化资产。

验证：asset matrix tests。

禁止：所有内容都塞进 Markdown body。

## Task 3.4 Body 与结构化字段边界

目标：明确哪些内容可进 `AnalysisModuleInstance.body`，哪些必须经结构化控件写 SQLite。

范围：`AnalysisModuleInstance` contract、`ReviewAsset` contract。

前置：Task 3.3。

Steps：

1. 定义 body 只承载人类阅读正文。
2. 定义证据、标签、对象链接、关系、状态、AIConstraint、候选技法必须结构化。
3. 定义 Markdown 正文编辑只产生 Revision。
4. 写 body boundary 测试。

验收：Markdown/JSON 不会成为结构事实入口。

验证：contract test。

禁止：从 Markdown 自动解析结构事实回 SQLite。

## Task 3.5 模块前置依赖

目标：定义模块之间的最小依赖，不做执行调度。

范围：`ModuleDependency` contract。

前置：Task 3.4。

Steps：

1. 标记所有模块依赖 frozen structure。
2. 标记情节/叙事/人物/设定/文风/技法的输入依赖。
3. 标记 AIConstraint 依赖已确认资产。
4. 写 dependency graph 无环测试。

验收：后续 pipeline 有依赖基础。

验证：unit graph test。

禁止：在本块实现调度器。

## Task 3.6 导出、技法库、AI 约束参与规则

目标：定义模块输出如何进入导出、技法库和 AI 约束摘要。

范围：`ModuleOutputParticipation` contract。

前置：Task 3.5。

Steps：

1. 标记 body 可导出。
2. 标记未审查结构化资产导出需状态提示。
3. 标记 `ReusableTechniqueCandidate` 采纳后才进 `TechniqueEntry`。
4. 标记 AIConstraint 只能引用确认资产。
5. 写 participation fixture。

验收：Export/Technique/AIConstraint 后续不用猜规则。

验证：fixture tests。

禁止：未确认候选进入原创上下文。

## Task 3.7 最小审查状态规则

目标：给所有模块资产统一审查语言。

范围：`ReviewStatus`、`EvidenceRequirement`。

前置：Task 3.6。

Steps：

1. 定义 pending/confirmed/rejected/excluded/needs_evidence/stale。
2. 定义关键结论确认前必须有有效 `EvidenceAnchor`。
3. 定义证据不足不能进入候选或原创引用。
4. 写 review transition tests。

验收：审查模型可被七模块复用。

验证：unit tests。

禁止：用户主观接受替代缺失证据。

## Task 3.8 真实入口骨架验收

目标：本大块也要可从桌面入口观察。

范围：renderer settings/workbench debug info 或 module shell readout。

前置：Task 3.1-3.7。

Steps：

1. 在模块工作台壳层显示模块清单来源为 contract。
2. 显示 AI 约束摘要为二级系统页禁用/占位。
3. 显示 unsupported scope 的禁用原因。
4. 写 component smoke。

验收：真实桌面入口能看到契约影响。

验证：component/e2e smoke。

禁止：只落类型，不接任何可观察路径。

---

# 大块 4：技法资产边界契约

目标：提前锁定拆解书内技法观察、可复用候选、融合技法库条目、来源快照和复刻风险边界。

范围：`src/shared/domain/technique*`、`src/shared/domain/source-snapshot*`、review/evidence contracts。

前置：大块 3 完成。

禁止：实现完整技法库 UI、自动融合、多来源发布门禁、原创引用系统。

## Task 4.1 技法资产三层对象定义

目标：明确三类对象所属域。

范围：`WorkTechniqueObservation`、`ReusableTechniqueCandidate`、`TechniqueEntry`。

Steps：

1. 定义 WorkTechniqueObservation 属于 BreakdownBook。
2. 定义 ReusableTechniqueCandidate 仍属于 BreakdownBook。
3. 定义 TechniqueEntry 属于 TechniqueLibrary。
4. 写 ownership fixture。

验收：技法模块和融合技法库不会混成一个对象。

验证：domain tests。

禁止：TechniqueEntry 反向覆盖来源候选。

## Task 4.2 SourceSnapshot 契约

目标：定义采纳时保存什么来源快照。

范围：`SourceSnapshot` DTO。

前置：Task 4.1。

Steps：

1. 定义 sourceBookId/sourceCandidateId/sourceObservationIds。
2. 定义 capturedAt、summary、evidenceSummary。
3. 定义不保存原文句子、角色专名、专有设定正文。
4. 写 snapshot redaction test。

验收：来源删除或变化后仍可只读追溯。

验证：unit tests。

禁止：保存完整原文片段。

## Task 4.3 去专有化规则

目标：把技法复刻风险变成字段和流程约束。

范围：`ReusableTechniqueCandidate`、`ProblemSolutionPattern`。

前置：Task 4.2。

Steps：

1. 定义 candidate 必须包含 reusablePrinciple。
2. 定义必须包含 applicableScope、limitations。
3. 定义禁止字段：角色、专有设定、原文句子。
4. 定义桥段级引用必须转 ProblemSolutionPattern。
5. 写 forbidden content field test。

验收：候选可复用但不复刻原作表达。

验证：schema/fixture tests。

禁止：直接保存“某角色如何做”的可复用技法。

## Task 4.4 证据链表达方式

目标：确定技法库里证据是引用、摘要还是快照。

范围：`EvidenceSummary`、`SourceSnapshot`。

前置：Task 4.2。

Steps：

1. 拆解书内 observation/candidate 使用 `EvidenceAnchor` 引用。
2. TechniqueEntry 使用 SourceSnapshot + evidenceSummary。
3. 不把 EvidenceAnchor 作为跨域可变事实源。
4. 写 source change fixture。

验收：技法库可追溯，但不反写拆解书。

验证：unit tests。

禁止：技法库编辑修改来源证据状态。

## Task 4.5 TechniqueEntry 状态机

目标：锁定技法条目状态。

范围：`TechniqueEntryStatus`。

前置：Task 4.1。

Steps：

1. 定义 `draft | organized | pending_merge | deprecated`。
2. 定义允许迁移。
3. 定义 pending_merge 只是整理状态，不自动融合。
4. 写状态机测试。

验收：V1 不出现自动融合假能力。

验证：unit tests。

禁止：实现自动 merge。

## Task 4.6 手工新建策略

目标：明确 V1 默认不提供手工新建主动作。

范围：TechniqueLibrary capability contract。

前置：Task 4.5。

Steps：

1. 定义 `manualCreatePrimaryActionEnabled = false`。
2. 定义空态文案来源：来自已采纳候选。
3. 定义未来若开放手工创建需新产品决策。
4. 写 capability fixture。

验收：技法库空态不会引导错误数据入口。

验证：component/contract test。

禁止：绕过候选直接创建主流程。

## Task 4.7 原创引用快照预留

目标：为未来原创引用保留安全边界，但不实现原创。

范围：OriginalReferenceSnapshot placeholder contract。

前置：Task 4.3。

Steps：

1. 定义未来原创只可引用 confirmed/organized 技法资产。
2. 定义引用保存快照，不自动跟随来源。
3. 定义不可引用原始证据、草稿、未确认 AI 资产。
4. 写 placeholder fixture。

验收：后续原创系统不会污染来源域。

验证：contract tests。

禁止：创建 OriginalBook 数据。

## Task 4.8 真实入口骨架验收

目标：从桌面技法库入口可观察资产边界。

范围：技法库空态、详情壳。

前置：Task 4.1-4.7。

Steps：

1. 技法库空态显示“来自已采纳候选”。
2. 详情壳显示 source snapshot 二级信息位置。
3. 手工新建主按钮不存在或禁用。
4. 写 component smoke。

验收：用户能看出技法库独立于拆解书。

验证：component/e2e smoke。

禁止：让占位看起来像坏掉功能。

---

# 大块 5：专题视角边界契约

目标：提前锁定专题视角不是普通 `AnalysisModule`，也不是新事实源。

范围：`src/shared/domain/perspective*`、RelationLink/Evidence contracts、export participation。

前置：大块 3、4 完成。

禁止：实现五个专题视角深度 UI、AI 总结、自动刷新。

## Task 5.1 Perspective 身份定义

目标：定义专题视角的产品身份。

范围：`PerspectiveDefinition`、`PerspectiveInstance`。

Steps：

1. 定义 Perspective 不是 AnalysisModule。
2. 定义它是派生/组合视图。
3. 定义可存储 view instance，但不成为主事实源。
4. 写 identity tests。

验收：专题视角不会生成普通模块实例。

验证：unit tests。

禁止：把专题视角列入七模块清单。

## Task 5.2 五个 V1 内置视角清单

目标：锁定内置视角 key/name。

范围：PerspectiveDefinition fixtures。

前置：Task 5.1。

Steps：

1. 定义伏笔/悬念/回收链。
2. 定义人物关系动力/身份互动。
3. 定义设定展开/规则兑现。
4. 定义节奏/情绪/阅读驱动力。
5. 定义可复用技法来源视角。

验收：专题视角清单稳定。

验证：fixture test。

禁止：新增普通模块替代视角。

## Task 5.3 依赖资产矩阵

目标：定义每个视角依赖哪些模块资产。

范围：`PerspectiveDependencyMatrix`。

前置：Task 5.2。

Steps：

1. 列出依赖 AnalysisModuleInstance。
2. 列出依赖 RelationLink。
3. 列出依赖 EvidenceAnchor。
4. 列出依赖 WorkTechniqueObservation/ReusableTechniqueCandidate。
5. 写缺失依赖 fixture。

验收：缺失模块时能显示 blocked/partial。

验证：matrix tests。

禁止：视角自己生成关系事实。

## Task 5.4 可编辑性与新事实规则

目标：定义视角是否产生新事实、是否可编辑。

范围：`PerspectiveEditPolicy`。

前置：Task 5.3。

Steps：

1. 定义派生总结可刷新。
2. 定义用户可写 view note/annotation。
3. 定义关系事实、证据状态、候选技法必须回源模块编辑。
4. 写 edit policy tests。

验收：视角不成为事实编辑入口。

验证：unit tests。

禁止：在视角里直接改人物关系或技法候选。

## Task 5.5 stale、缺失、断链处理

目标：定义来源变化后的状态。

范围：`PerspectiveStatus`。

前置：Task 5.4。

Steps：

1. 定义 `current | partial | stale | blocked | needs_refresh`。
2. 定义结构变化标记 affected perspectives。
3. 定义证据断链显示来源错误。
4. 定义缺失模块显示 partial。
5. 写状态 fixture。

验收：视角不会静默展示过期结论。

验证：unit/component tests。

禁止：每次打开自动现算并覆盖旧视图。

## Task 5.6 导出与原创引用参与

目标：定义专题视角如何参与导出和未来原创引用。

范围：`PerspectiveExportPolicy`。

前置：Task 5.5。

Steps：

1. 定义可导出派生阅读视图。
2. 定义 stale/partial 导出必须带状态标记。
3. 定义原创只能引用已确认来源资产，不引用视角派生事实。
4. 写 export policy fixture。

验收：导出不会把派生视图伪装成事实源。

验证：unit tests。

禁止：专题视角直接进入原创上下文。

## Task 5.7 与技法模块/技法库关系

目标：明确可复用技法来源视角的边界。

范围：`PerspectiveTechniqueRelation` contract。

前置：大块 4、Task 5.6。

Steps：

1. 定义技法模块保存 observation/candidate。
2. 定义专题视角只追溯来源链。
3. 定义 TechniqueEntry 仍属于融合技法库。
4. 写 cross-domain fixture。

验收：视角、技法模块、技法库三者不混淆。

验证：contract tests。

禁止：在专题视角里采纳 TechniqueEntry。

## Task 5.8 真实入口骨架验收

目标：从工作台入口可观察专题视角边界。

范围：workbench perspective tab/placeholder。

前置：Task 5.1-5.7。

Steps：

1. 显示五个专题视角入口。
2. 显示“派生视图，不是模块”的说明或 UI 状态。
3. 显示缺失依赖的 partial/blocked 状态。
4. 写 component smoke。

验收：用户能看出专题视角是组合视图。

验证：component/e2e smoke。

禁止：把它展示成第八个 AnalysisModule。

---

# 大块 6：资料库、SQLite、Migration、LibraryService

目标：实现本地资料库与 SQLite 主事实源，同时为分析模块、技法资产、专题视角预留表边界。

前置：大块 1-5 完成。

禁止：导入源文本、真实分析、AI、完整技法库 UI。

## Tasks

- Task 6.1 前置契约闸口：确认 shared IPC、分析模块契约、技法资产契约、专题视角契约都已存在。验证：typecheck + contract fixture tests。
- Task 6.2 Library 文件夹契约：定义 root、manifest、`writestorm.sqlite`、source/exports/logs/cache/mirrors。验收：manifest 不做主事实源。
- Task 6.3 SQLite 连接与 Migration Runner：封装连接、migrations 表、事务执行、失败回滚。验证：migration integration tests。
- Task 6.4 Foundation Schema：library/book/source_text/structure/story_range/jobs/exports 基础表。验证：schema introspection tests。
- Task 6.5 Content Model Schema 预留：analysis_modules、analysis_module_instances、evidence_anchors、relation_links、work_technique_observations、reusable_technique_candidates、technique_entries、source_snapshots、perspective_views shell。禁止：TechniqueEntry 与 Candidate 合表；Perspective 当 AnalysisModuleInstance。
- Task 6.6 `better-sqlite3` native baseline：选择与当前 Electron/Node ABI 兼容的版本，记录 native module 风险和安装来源。验收：依赖只在 main/service 层使用。
- Task 6.7 Electron ABI rebuild：验证 Forge/@electron/rebuild 在 dev、package、make 流程中重建 native module；失败时返回明确阻塞。验证：rebuild 日志或 package smoke 证据。
- Task 6.8 Vite native externalization：在 main Vite 配置中 external 化 `better-sqlite3`，避免被 renderer/preload bundle。验证：bundle 检查和 import guard。
- Task 6.9 Packaged SQLite smoke：Windows 11 与 macOS packaged app 能打开 SQLite、跑 migration、关闭重开后读到 schema version。禁止：只用开发态 `npm start` 证明可用。
- Task 6.10 Path Guard：阻止 `..`、symlink、任意路径 escape；资料库 root 外路径一律拒绝。验证：path traversal tests。
- Task 6.11 LibraryService create/open/current：创建、打开、迁移、设置 current context、返回 summary。验证：service + IPC tests。
- Task 6.12 真实入口骨架：从桌面入口创建/打开资料库并到空拆解书架。验证：Electron smoke。
- Task 6.13 SQLite/migration 性能基线：用 small/medium library fixtures 记录 create/open/migration/常用 summary query 耗时；结果写入实现记录并成为非回归基线。

---

# 大块 6A：Codex SDK Feasibility Gate

目标：在进入导入、结构识别、模块工作台和内容深度规格前，尽早确认 Codex SDK 是否具备 V1 基本可行性，避免到 AI Execution 才发现 No-Go。

前置：大块 1、2、6 完成。

禁止：真实 AI 工作流、模块正文生成、fallback provider、把 SDK 暴露给 renderer。

## Tasks

- Task 6A.1 Feasibility scope：确认只做兼容性验证，不生成拆解正文；记录 Node/Electron/Forge/Codex SDK 官方文档来源。
- Task 6A.2 SDK 版本与供应链：验证 `@openai/codex-sdk` 版本、integrity、依赖树、Node 要求。验收：版本和最低 Node 与大块 1 baseline 不冲突。
- Task 6A.3 SDK runtime 语义：确认 TypeScript SDK server-side 使用方式、官方 `@openai/codex` CLI/JSONL 事件机制、进程启动方式。验收：文档明确“SDK 内部 CLI 机制”不是产品禁止的直接 `codex exec` fallback。
- Task 6A.4 Electron 进程边界探针：验证 SDK 只能在 main/utility/worker 侧运行；renderer 无 SDK、token、shell、fs 访问。验证：import guard + minimal smoke。
- Task 6A.5 Working directory/env/auth 探针：验证 SDK 默认/指定 working directory、Git repo 要求、library workspace 与项目仓库隔离、env/config/auth 失败形态。
- Task 6A.6 Minimal structured output：用固定短文本和最小 `outputSchema` 验证机器可校验 JSON；schema invalid、missing field、extra field 有明确失败路径。
- Task 6A.7 Timeout/cancel/cleanup 探针：验证 timeout、cancel 或等价中止机制、用户关闭窗口和 SDK 子进程残留清理；如果 SDK 暂不提供稳定能力，记录为 No-Go 或 conditional Go。
- Task 6A.8 Early Go/No-Go decision：记录版本、来源、每项证据、Go/No-Go、阻塞项和禁止 fallback。No-Go 时：大块 7-12 仍可作为非 AI Foundation 继续；大块 13、17 和所有真实 AI prompt/runtime 停止；大块 14-16 只能在产品确认“继续非 AI 内容规格”后执行。

验证：SDK minimal structured run、runtime/process boundary smoke、timeout/cancel/cleanup probe、security guard、Go/No-Go note。

---

# 大块 7：txt/md 导入

目标：导入 txt/md，复制源文件，记录 metadata 与 `source_text_edition`，为证据失效规则预留。

前置：大块 6 完成；大块 6A 已记录 Go/No-Go。

禁止：结构识别、AI、模块生成。

## Tasks

- Task 7.1 前置闸口：确认 Library/SQLite/current context 可用。
- Task 7.2 Import contract：定义 request/response/error，不让 renderer 传任意路径。
- Task 7.3 File dialog adapter：main 侧选择 `.txt/.md`。
- Task 7.4 Preflight：检查扩展名、大小、可读性、空文件。
- Task 7.5 Encoding：自动识别失败时返回可手动选择状态。
- Task 7.6 Source copy：复制到 library source 目录，原子写入。
- Task 7.7 Metadata：记录 filename、ext、size、hash、encoding、import time、`source_text_edition`。
- Task 7.8 Transaction：book + source_text 同事务，失败无半本书。
- Task 7.9 Duplicate/conflict：hash 重复和文件名冲突有明确行为。
- Task 7.10 Failure UI：错误给具体修复路径。
- Task 7.11 Electron import smoke：生产路径仍由 main 侧 native dialog 选择文件；测试路径通过 Playwright `electronApp.evaluate` 在 main process stub `dialog.showOpenDialog`，返回固定 txt/md fixture。验收：不得按网页 `filechooser` 写法测试 Electron native dialog。
- Task 7.12 Unicode/newline corpus：导入 fixture 覆盖 UTF-8 BOM、GB18030、日文、英文、全角数字、CRLF/LF、超长行；失败时给可操作编码选择或阻塞原因。

验证：unit/import matrix、integration transaction、Unicode corpus、Electron import smoke。

---

# 大块 8：结构候选生成与校正

目标：从源文本生成可审查的卷/章节/故事段候选，提供置信度、失败态、人工校正和冻结，并对下游实例、证据、专题视角 stale 规则留钩子。

前置：大块 7 完成。

禁止：Codex SDK 结构识别、模块实例正文、证据抽取；本块只做本地解析/候选生成和用户确认入口。

## Tasks

执行子块：

- 8A Detection engine：Task 8.1-8.10、8.12、8.13、8.18，只交付本地候选生成、校验、fixture 和性能基线。
- 8B Review and freeze：Task 8.11、8.14、8.15、8.17，只交付用户校正、确认、冻结和真实入口。
- 8C Invalidation hook：Task 8.16，只交付下游 stale/needs_rebuild 接口，不实现真实重跑。

- Task 8.1 前置闸口：确认源文本存在。
- Task 8.2 结构范围：标题树与故事段分离。
- Task 8.3 StructureNode contract：book/volume/chapter。
- Task 8.4 StorySegmentRange contract：独立 range/scope，不作为标题树 child。
- Task 8.5 StructureDetectionWorker：在 main/worker/service 侧读取源文本并生成候选，renderer 只拿 DTO。验收：大文件处理不阻塞 renderer。
- Task 8.6 标题模式识别：识别卷、篇、章、章节编号、Markdown 标题；输出候选 `StructureNode` tree、source offsets、raw heading text、confidence。
- Task 8.7 StorySegmentRange 候选：基于章节边界、空行/标题模式、长度窗口和转折提示生成 story segment range 候选；输出 start/end anchor、covered chapters、功能标签、起止原因、confidence。
- Task 8.8 置信度与失败态：定义 high/medium/low/unusable；无法识别章节时返回 `structure_detection_failed`，给“规则调整 + 手动标记 + 创建 book root shell”入口。
- Task 8.9 候选持久化：候选和用户确认稿分离；未确认候选不作为 frozen structure。验证：candidate/draft/frozen 状态测试。
- Task 8.10 Validation：层级、range、source offsets、重叠规则、covered chapters 与 source text hash 一致性。
- Task 8.11 用户确认入口：结构校正 UI 显示候选、置信度、不确定位置、跳过故事段选项；用户可编辑标题层级和故事段范围。
- Task 8.12 Fixture package：建立短篇 fixture，包含章节、卷、至少一个跨章节故事段、预期 `StructureNode` tree、预期 `StorySegmentRange` candidate 和低置信样例。
- Task 8.13 性能基线：用 50KB、1MB、5MB txt/md fixture 记录检测耗时和内存；验收为 worker 不阻塞 renderer，性能结果写入实现记录并进入非回归基线。
- Task 8.14 get/update structure：读取和更新标题树、story ranges。
- Task 8.15 freeze/unfreeze：生成/increment `structure_edition`，解冻显示影响；全量拆解前必须冻结。
- Task 8.16 Invalidation hook：标记 affected AnalysisModuleInstance/Evidence/Perspective/CompletionGate 的规则接口。
- Task 8.17 Real entry e2e：导入后自动生成结构候选，用户确认或修正后冻结。
- Task 8.18 多语言标题模式：fixture 覆盖中文“第 x 章/卷”、日文“第 x 話/章”、英文 Chapter/Part、Markdown heading、全角/半角编号；不能识别时进入低置信或手动校正，不误判为成功。

验证：domain/service/worker/component/e2e、structure fixture tests、Unicode/multilingual fixtures、performance baseline evidence。

---

# 大块 9：AnalysisModuleInstance 工作台骨架

目标：按大块 3 的 module/scope/asset matrix 创建模块实例壳。

前置：大块 3、8 完成。

禁止：真实 AI 内容、Job runtime、证据抽取、重跑 diff。

## Tasks

- Task 9.1 前置闸口：结构已冻结，模块契约可读取。
- Task 9.2 Module definitions seed：七模块稳定 key/name/category。
- Task 9.3 Instance contract：module + scope + version + status。
- Task 9.4 Instance creation：冻结后创建 book scope 实例。
- Task 9.5 Asset placeholders：body/evidence/relation/technique/AIConstraint 占位。
- Task 9.6 Workbench list/detail：显示模块、scope、状态、正文占位。
- Task 9.7 AI actions disabled：rerun/diff/analysis 显示禁用原因。
- Task 9.8 `modules:list-instances` IPC：typed 返回实例。
- Task 9.9 Boundary tests：AnalysisModule 与 Instance 分离；AI 约束摘要不是普通顶层模块。

验证：typecheck/unit/component/e2e。

---

# 大块 10：Job State 与 Recovery Shell

目标：任务状态、checkpoint、失败/恢复入口，并支持 future AI analysis = `AnalysisModuleInstance` batch。

前置：大块 9 完成。

禁止：真实后台队列、Codex SDK、AI 任务。

## Tasks

- Task 10.1 Job domain：JobState、JobType、checkpoint unit、合法迁移。
- Task 10.2 SQLite 持久化：jobs、job_checkpoints。
- Task 10.3 JobService shell：create/list/get/append checkpoint/transition/cancel/fail。
- Task 10.4 Existing flow records：导入、结构冻结、模块 shell 创建留下 job 记录。
- Task 10.5 IPC：`jobs:list/get/cancel`。
- Task 10.6 Recovery UI：状态徽标、checkpoint、failure reason、cancel、禁用 resume/keep draft。
- Task 10.7 Restart recovery：重启后 failed/resumable 仍显示恢复入口。
- Task 10.8 回归门禁：状态机、checkpoint 安全、invalid payload、import guards。

验证：unit/integration/e2e recovery smoke。

---

# 大块 11：Export Blocked State

目标：导出入口、目标形态、阻塞原因；读取大块 3/4/5 的导出参与规则。

前置：大块 9、10 完成。

禁止：真实导出包、迁移包、Markdown/JSON 反写 SQLite。

## Tasks

- Task 11.1 Export domain：ExportTargetKind、ExportAvailability、ExportBlockerCode、ExportStatusDto。
- Task 11.2 ExportStatus 计算：从 SQLite 当前事实生成 blockers 和 preview。
- Task 11.3 Content model blockers：模块未生成、资产未审查、证据不足、技法候选未采纳、专题视角 stale/partial。
- Task 11.4 安全排除清单：凭据、token、key、secure storage、完整敏感日志永不进入 preview。
- Task 11.5 IPC：只实现 `exports:get-status`，只读。
- Task 11.6 Workbench UI：显示 Markdown 包、机器包、blockers、excluded content；按钮禁用或未开放。
- Task 11.7 Job shell 联动：导出阻塞可被 job/status 面板看见，但不启动任务。
- Task 11.8 边界门禁：no-write status、no arbitrary path、no Markdown/JSON back-write、export blocked smoke。

验证：typecheck/unit/build/e2e blocked smoke。

---

# 大块 12：技法库半可用、类型模板壳、原创占位、设置壳

目标：按大块 4 的 TechniqueEntry/SourceSnapshot 边界实现边界入口，并建立 TypeLibrary、PromptTemplate、主类型/子类型选择和模板版本状态的产品壳。

前置：大块 4、9、11 完成。

禁止：原创项目、原创正文、真实 Codex SDK、自动技法融合。

## Tasks

- Task 12.1 TechniqueEntry repository/service：只整理已存在或已采纳条目。
- Task 12.2 技法库列表/空态：说明条目来自已采纳候选，不提供手工新建主动作。
- Task 12.3 技法详情/编辑：编辑标题、摘要、标签、适用范围、限制、状态。
- Task 12.4 SourceSnapshot 二级信息：可查看但不反写来源拆解书。
- Task 12.5 候选采纳入口占位：无 confirmed candidate 时显示不可用原因。
- Task 12.6 TypeLibrary seed：提供内置主类型/子类型列表：日轻校园、异世界、古代玄幻、现代幻想、都市恋爱、无限流；支持 book metadata 绑定 type/subtype。验证：book summary 显示所选类型。
- Task 12.7 TypeLibrary 自定义壳：显示“从内置模板复制后编辑”的入口状态；V1 若未实现编辑，则明确 disabled reason，不假装可用。
- Task 12.8 PromptTemplate registry 壳：定义模板 key、module key、type/subtype、schemaVersion、templateVersion、status。状态轴：draft、sample_passed、published_version、enabled、disabled、rolled_back。
- Task 12.9 模板版本绑定：每本拆解书记录当前 TypeLibrary 和 PromptTemplate version snapshot；模板升级不自动改写旧书。验证：DTO fixture 覆盖 version snapshot。
- Task 12.10 小样预览入口壳：在 Codex SDK Go 前显示 blocked；在大块 17 前不得真实运行 AI preview。验收：用户能看到 sample preview 是模板发布前硬闸。
- Task 12.11 发布/回滚入口壳：显示 publish/rollback/disable 的状态机与权限；未过 sample preview 不可发布。
- Task 12.12 原创书架占位：独立入口，不可创建项目，不显示技法库内容。
- Task 12.13 设置/AI 不可用壳：Codex gate required、连接器 unavailable、日志/模板/schema/修复/健康检查入口占位。
- Task 12.14 边界门禁：TechniqueEntry 不反写 source；原创无 create；renderer 无 Codex/secret/fs；模板版本变更不静默重跑旧书。
- Task 12.15 本地可观测性壳：设置页能查看本地日志策略、最近错误摘要、日志清理入口和“手动导出日志”入口；默认不远程上传 crash、使用统计或源文本片段。

验证：unit/component/top-level navigation smoke、type/template fixture tests、log policy smoke。

---

# 大块 13：Codex SDK Integration Gate

目标：在大块 6A Go 之后，把 Codex SDK feasibility 结果接入 Job、Settings、安全边界和 packaged runtime；仍然不生成拆解正文。

前置：大块 6A Go，大块 1、2、10、12 完成。

禁止：真实 AI 工作流、fallback provider、模块正文生成。

## Tasks

- Task 13.1 Integration 前置闸口：读取大块 6A Go/No-Go 记录；No-Go、conditional Go 未解锁或证据过期时停止，不进入真实 AI 或 prompt runtime。
- Task 13.2 SDK 版本漂移检查：复核 `@openai/codex-sdk` 版本、integrity、依赖树、Node 要求和大块 6A 记录是否仍一致；不一致时重跑 6A 相关探针。
- Task 13.3 SDK 内部 runtime 语义复核：确认 TypeScript SDK server-side 使用方式、官方 `@openai/codex` CLI/JSONL 事件机制、进程启动方式。验收：文档明确“SDK 内部 CLI 机制”不是产品禁止的直接 `codex exec` fallback。
- Task 13.4 Electron 进程边界：对照 main 与 utility/worker 运行方案；renderer 无 SDK、token、shell、fs 访问。验证：import guard + smoke。
- Task 13.5 Working directory/Git repo：验证 SDK 默认/指定 working directory、Git repo 要求、非 Git 目录失败形态、library workspace 与项目仓库的隔离。验收：失败映射为 AI_GATE 或 SDK_ENV 错误。
- Task 13.6 Env/config/auth：验证 ChatGPT-managed auth、未登录、过期、失败；验证 env/config 不写 SQLite、不进 DTO、不进入导出。验证：日志脱敏检查。
- Task 13.7 结构化输出：用 `outputSchema` 验证机器可校验 JSON；schema invalid、missing field、extra field 都有明确失败路径。
- Task 13.8 JSONL/stream/event handling：捕获 progress、partial、final、error 事件，映射到 Job checkpoint，不把 partial 当 completed。
- Task 13.9 取消/超时/进程清理：验证 timeout、cancel、用户关闭窗口、SDK 子进程残留清理和 Job resumable/failed 状态。
- Task 13.10 错误/用量/日志：auth/rate/schema/network/runtime 映射 DomainError；日志脱敏；SDK 返回的用量字段若不可得则明确 unknown，不伪造；V1 不做运行前成本估算或预算确认。
- Task 13.11 打包运行：Windows 11 与 macOS packaged app smoke；验证 SDK runtime 路径、working directory、env/config、cancel/timeout。缺任一平台不得宣布完整 Go。
- Task 13.12 Settings/Job Gate 接入壳：显示 passed/failed/blocked，AI 动作继续按 gate 禁用。
- Task 13.13 Integration note：记录版本、来源、每项证据、Go/No-Go、阻塞项、过期条件和禁止 fallback。

验证：SDK minimal run、structured output、cancel/timeout、Job mapping、packaged Windows/macOS smoke、security guard。

---

# 大块 14：七个分析模块深度规格、Schema、证据规则、审查规则拷打

目标：把七个模块逐一拆成深度规格，形成 schema、审查规则和证据要求。

前置：大块 3、6、9 完成；大块 6A Go，或产品明确确认继续非 AI 内容规格。真实 prompt、SDK runtime 和 AI pipeline 仍必须等待大块 13 Go。

禁止：写真实 prompt、跑 AI、生成正文。

## Tasks

- Task 14.1 模块规格模板：统一目标、scope、输入依赖、结构化资产、`body` 边界、证据密度、审查动作、导出参与。验收：七模块都能按同一模板填写。
- Task 14.2 Schema envelope：定义 moduleVersion、schemaVersion、sourceTextEdition、structureEdition、scopeRef、generatedAt、reviewState、evidencePolicy。禁止：把结构化字段塞进 Markdown body。
- Task 14.3 七模块结构化 schema 草案：为作品结构、情节、人物、叙事、世界、文风、技法分别产出 JSON schema/Zod schema 草案和最小 fixture。
- Task 14.4 证据规则矩阵：逐模块定义必需证据、可选证据、低置信处理、证据断链状态、可导出 evidence summary。验收：关键结论无证据时必须 blocked 或 needs_evidence。
- Task 14.5 审查状态机：定义 generated_pending_review、confirmed、stale、needs_rebuild、rejected/needs_evidence 等转换和权限。验证：transition tests。
- Task 14.6 跨模块所有权矩阵：明确人物、关系、技法观察、AI 约束、专题视角依赖分别由哪个模块写入、哪个模块只引用。禁止：同一事实被多个模块竞争写入。
- Task 14.7 每模块深度规格拷打：分别审查七模块的目标、输出结构、反例、复刻风险、导出用途和缺失依赖处理。验证：spec completeness checklist。
- Task 14.8 AI 约束摘要二级页规格：定义约束来源、确认状态、原创引用限制、导出标记；明确它聚合模块资产，不是普通顶层模块。
- Task 14.9 Validation corpus：建立 good/minimal/invalid/stale/no-evidence fixtures，覆盖 schema validation、review transition、evidence policy、export participation。
- Task 14.10 TypeLibrary 与 PromptTemplate 深度规格：定义主类型/子类型如何选择模块关注点、冲突优先级、templateVersion、schemaVersion、published freeze、rollback target、book snapshot。
- Task 14.11 小样预览规格：定义 sample input fixture、expected schema output、失败分类、sample_passed 的进入条件；未通过小样预览不得发布模板。
- Task 14.12 规格冻结门禁：七模块 schema、证据规则、审查规则、所有权矩阵、TypeLibrary/PromptTemplate 规格都过测试后，才允许大块 17 写真实 AI prompt 和 pipeline。

验证：spec completeness checklist、schema fixtures、cross-module ownership tests、template version fixtures。

---

# 大块 15：专题视角深度规格

目标：把五个内置专题视角做成深度规格，仍保持派生/组合视图身份。

前置：大块 5、14 完成。

禁止：普通模块化、自动成为事实源、自动刷新覆盖旧结果。

## Tasks

- Task 15.1 视角规格模板：统一依赖资产、链路结构、derived state、refresh policy、stale policy、导出标记。验收：视角不产生新事实，只保存 view instance 或派生缓存。
- Task 15.2 View instance 数据契约：定义 perspectiveKey、scopeRef、dependencySnapshot、computedAt、staleReason、missingDependency、exportParticipation。禁止：存成 AnalysisModuleInstance。
- Task 15.3 缺失/过期处理：定义 missing module、stale module、evidence broken、candidate rejected 时的 partial/blocked 状态和 UI 文案。
- Task 15.4 伏笔/悬念/回收链：定义 clue、payoff、状态、证据引用、断链提示和导出结构。
- Task 15.5 人物关系动力/身份互动：定义关系变化链、身份/权力差异、触发事件、技法线索、证据摘要。
- Task 15.6 设定展开/规则兑现：定义 reveal states、rule evidence、story consequence、unresolved issue、引用来源。
- Task 15.7 节奏/情绪/阅读驱动力：组合情节、叙事、文风解释阅读驱动力，并标记推断置信度。
- Task 15.8 可复用技法来源视角：追溯 observation path、abstraction path、evidence summary、limitations，不直接写 TechniqueEntry。
- Task 15.9 视角导出与原创引用规则：定义哪些内容进入 Markdown 包、机器包、AI 约束摘要；原创引用只能引用快照/摘要，不引用原文句子。
- Task 15.10 视角验证语料：good/partial/stale/broken-evidence/no-technique fixtures，覆盖 dependency matrix 和 ownership tests。

验证：perspective fixtures、dependency matrix tests、ownership tests。

---

# 大块 16：技法抽象与采纳深度规格

目标：深化 `WorkTechniqueObservation -> ReusableTechniqueCandidate -> TechniqueEntry` 的抽象、审查、采纳流程。

前置：大块 4、14、15 完成。

禁止：自动融合、发布门禁、原创正文生成。

## Tasks

- Task 16.1 Observation 生成与确认规则：定义来源模块、scope、表现描述、证据密度、confirmed/rejected/needs_evidence。验收：Observation 仍属于拆解书。
- Task 16.2 Candidate 抽象规则：定义 reusable principle、适用范围、限制、ProblemSolutionPattern、禁用字段。禁止：保留原作品角色名、专有设定、原文句子、桥段复刻。
- Task 16.3 去专名/去复刻检查：建立 redaction checklist 和 fixtures，覆盖角色、地名、组织、设定术语、连续原文表达。验证：redaction fixture tests。
- Task 16.4 候选审查与证据硬闸：有效证据、低相关阻塞、排除/替换、needs_evidence；证据不足不得采纳。
- Task 16.5 SourceSnapshot 规则：采纳时保存来源快照、evidenceSummary、source ids、sourceTextEdition、structureEdition；技法库编辑不反写拆解书。
- Task 16.6 采纳事务与幂等：Candidate -> TechniqueEntry 同事务；重复采纳返回 existing entry 或 pending_merge，不创建重复资产。
- Task 16.7 TechniqueEntry 状态机：draft、organized、pending_merge、deprecated 的进入条件、退出条件、可编辑字段、导出影响。
- Task 16.8 手工新建策略：V1 默认不提供手工新建主动作；如后续开启，必须走同等审查/来源说明流程。
- Task 16.9 原创引用快照：未来原创引用 TechniqueEntry 时保存 entry version、摘要、限制、来源快照摘要，不反向依赖拆解书实时状态。
- Task 16.10 技法库验证语料：adoption fixtures、duplicate fixtures、redaction fixtures、state transition tests、source snapshot immutability tests。

验证：redaction fixtures、review transition tests、adoption fixtures。

---

# 大块 17：真实 AI Adapter/Pipeline

目标：在 Codex SDK integration gate Go 之后，实现真实 AI 管线。

前置：大块 13 Go，大块 14-16 完成。

禁止：任何非 Codex SDK fallback。

## Tasks

- Task 17.1 AI Gate 再确认：读取大块 13 Go/No-Go 记录；No-Go、缺平台 packaged smoke、SDK runtime 不稳定时停止，不降级到其他 provider。
- Task 17.2 Codex adapter wrapper：封装 thread/run、prompt input、`outputSchema`、cwd/env/config、错误映射；renderer 不可直接访问 adapter。
- Task 17.3 Streaming/JSONL event adapter：把 progress、partial、final、error 事件映射为 Job events/checkpoints；partial 不写入 confirmed 资产。
- Task 17.4 Cancel/timeout controller：支持用户取消、超时、窗口关闭、进程清理；状态进入 cancelled/failed/resumable 有明确规则。
- Task 17.5 Prompt/schema version registry：每个模块绑定 promptVersion、schemaVersion、moduleVersion；重跑时记录版本，不覆盖历史。
- Task 17.6 Pipeline orchestrator：按 module dependency、scope、structureEdition、sourceTextEdition 创建 batch jobs；缺依赖时 blocked，不启动 SDK。
- Task 17.7 Transaction boundary：AI 输出先做 schema validation 和 evidence validation，再在单事务内写 body revision、EvidenceAnchor、RelationLink、Observation/Candidate、Job checkpoint。
- Task 17.8 Idempotency/resume：以 jobId、moduleInstanceId、batchKey 去重；已完成实例不重复写入；resume 从最后 checkpoint 继续或明确重跑策略。
- Task 17.9 Partial failure/retry：单模块失败不污染其他 confirmed 资产；失败 batch 保留 raw diagnostic 摘要、retry eligibility、recoverable reason。
- Task 17.10 AI 任务 UI：从真实桌面入口启动、观察 streaming 状态、取消、失败后恢复；禁用状态显示具体 gate reason。
- Task 17.11 Packaged AI smoke：Windows 11 与 macOS packaged app 完成 minimal structured run、cancel、timeout、schema invalid，且日志无 token/source plaintext 泄漏。
- Task 17.12 PromptTemplate sample preview runtime：用固定 sample text 和当前模板运行最小 structured output，失败时保持 draft，不允许发布。验证：sample_passed/failed fixtures 和 UI 状态。
- Task 17.13 PromptTemplate publish/rollback runtime：发布冻结当前版本，修改已发布模板创建新版本；rollback 指向上一个 published_version，不改写已完成书籍 snapshot。
- Task 17.14 AI 失败 UX 策略：定义半完成拆解书的可见范围、模块卡状态、可读 confirmed 资产、不可确认资产、retry/resume/cancel 动作、失败原因和下一步。验收：用户不会把 partial 当 completed，也不会丢失已确认内容。
- Task 17.15 AI runtime 性能与运行基线：用固定短/中 fixture 记录 structured run 总耗时、stream event 延迟、timeout/cancel 行为、日志体积和重启恢复耗时；V1 仍不做运行前成本估算。

验证：adapter integration tests、pipeline fixtures、transaction/idempotency tests、cancel/timeout tests、template preview tests、AI failure UX tests、AI runtime baseline、AI job e2e smoke、packaged Windows/macOS smoke。

---

# 大块 18：证据、关系、重跑 Diff、书籍完成、健康检查、导出补实

目标：补实 V1 闭环：证据审查、关系链接、模块重跑 diff、书籍完成门禁、资料库健康检查/修复和真实导出。

前置：大块 17 完成。

禁止：扩展原创正文生成。

## Tasks

执行子块：

- 18A Evidence and relations：Task 18.1-18.4，只交付证据与关系审查、断链、事务和一致性。
- 18B Rerun diff and completion：Task 18.5-18.13、18.21，只交付重跑候选、diff、下游 stale、完成门和失败/通知 UX。
- 18C Health repair and export：Task 18.14-18.20、18.22、18.23，只交付健康检查、修复/重建索引、导出包、性能基线和全链路 e2e。

- Task 18.1 EvidenceAnchor 完整审查：证据弹窗、状态、替换/排除/补证据、证据断链检测。验收：关键结论无有效证据时不能 confirmed。
- Task 18.2 Evidence transaction：证据状态变化与引用它的模块实例、专题视角、技法候选 stale 状态同事务更新。
- Task 18.3 RelationLink 完整审查：跨对象关系、冲突处理、来源追溯、方向性、关系类型、置信度、证据摘要。
- Task 18.4 Relation consistency：删除/替换对象、结构变更、候选拒绝时，关系进入 stale 或 broken，不静默保留。
- Task 18.5 模块重跑候选版本：按 `module + scope + structureEdition + sourceTextEdition` 重跑并保存 candidate result，不覆盖 confirmed 版本。
- Task 18.6 Diff engine：比较 Markdown body、结构化对象、EvidenceAnchor、RelationLink、Observation/Candidate、AIConstraint；输出 added/removed/changed/stale。
- Task 18.7 Diff 接受/拒绝事务：接受 diff 时按资产类型写入，拒绝保留候选和原因；重复接受幂等，不产生重复 evidence/relation。
- Task 18.8 Downstream stale propagation：diff 接受后标记依赖模块、专题视角、BookCompletionGate、导出状态、技法候选状态；用户能看到需要重建的范围。
- Task 18.9 BookCompletionPolicy：区分 `Task completed` 与 `Book completed`；定义 hard gate assets、review assets、deferred assets 三层。验收：低价值建议不阻塞完成，关键证据/结构/source copy 阻塞完成。
- Task 18.10 ReviewCompletionGate service：扫描用户可见 AI 资产，确认所有模块正文、关键证据、关系、技法观察、可复用候选、AI 约束都已确认、拒绝、排除或合并。验证：blocked/allowed fixture tests。
- Task 18.11 Mark book completed transaction：完成状态写入单事务；存在 blocker 时返回具体 blockers；完成后模板版本、结构版本、源文本版本成为 completion snapshot。
- Task 18.12 Reopen/needs_rebuild：结构、源文本、模板、证据或 diff 接受后，已完成书籍进入 needs_rebuild 或 pending_review；不得静默保持 completed。
- Task 18.13 Completion UI：真实桌面入口显示 blockers、deferred items、完成按钮和完成后状态；导出入口引用完成状态。
- Task 18.14 LibraryHealthCheck：检查 manifest、book directories、source text、source hash、schema version、module documents、evidence anchors、relation links、snapshots、task checkpoints、orphan objects、duplicate IDs、broken references。
- Task 18.15 Repair/Reindex service：支持重建索引、标记孤儿对象、标记断链引用、重算 hash、恢复可恢复任务；不能自动修复的问题进入人工处理清单。
- Task 18.16 Health UI 与 settings entry：设置页和资料库页都能进入健康检查；显示 severity、affected objects、recommended action、repair result。
- Task 18.17 Export manifest builder：定义 exportId、library/book/version、completion snapshot、source hashes、module versions、template versions、schema versions、review status、health status、blocked reasons。
- Task 18.18 Markdown package builder：生成面向人读的 Markdown 包，包含模块正文、证据摘要、专题视角、技法摘要；禁止包含 token、SDK config、未授权原文长摘。
- Task 18.19 Machine package builder：生成 JSON/SQLite-free 机器包，包含 schema version、结构化对象、证据摘要、关系、状态；不把 JSON 当主事实源反写。
- Task 18.20 Packaged export smoke：Windows 11 与 macOS packaged app 从真实桌面入口完成健康检查、标记书籍完成、导出、打开 manifest、校验 hash、确认无凭据和路径泄漏。
- Task 18.21 重跑与完成通知 UX：定义 in-app 通知、模块状态徽标、下次打开提示、diff 待处理计数、健康检查 blocker 提示；V1 不要求系统通知、邮件或后台同步。
- Task 18.22 Full journey e2e：从真实桌面入口完成 open/create library -> import fixture -> structure candidate -> freeze -> minimal AI run -> evidence review -> mark book completed -> health check -> export package -> reopen and verify state。
- Task 18.23 Export/health 性能基线：用 small/medium library fixtures 记录健康检查、重建索引、Markdown package、machine package、manifest hash 校验耗时和输出大小；结果写入非回归基线。

验证：evidence e2e、relation fixtures、rerun tests、diff fixtures、completion gate tests、notification UX tests、health/repair tests、transaction/idempotency tests、export package tests、export/health performance baseline、full journey e2e、packaged Windows/macOS smoke。

---

# 6. 跨大块安全与维护硬闸

- 数据安全：renderer 不接触 fs/SQLite/shell/Codex；凭据/token/secure storage 不进 SQLite、DTO、日志、导出。
- 流程风险：每个大块以前置闸口开始；前置缺失即停止，不跨块补做。
- Bug 风险：每个边界都要有 unit/integration/e2e 或可观察 smoke。
- 维护风险：domain/contracts/errors 是唯一跨进程语言；新增 channel 必进 registry；状态机必须有测试。
- 产品诚实：未实现能力必须显示禁用或 blocked，不得 mock 成完成。
- No-Go 策略：大块 6A 或 13 No-Go 时，不允许切换 fallback provider；非 AI Foundation 可继续，真实 AI、prompt runtime 和 AI-dependent 发布门禁必须停止等待产品决策。
- 主事实源：SQLite 为唯一事务性事实；Markdown/JSON 不反写结构事实。
- 外部参照策略：外部软件、外部资料和未来来源类型只作二级参照；未定义 Source contract 前不得进入主事实源、验收基准或导出 manifest。
- 脚手架文法风险：必须明确 Forge `vite-typescript` 起点、React renderer 手动接入、Forge Vite plugin 多入口配置、`.vite/build/main.js` main 入口、Node baseline。
- Native module 风险：`better-sqlite3` 必须有 Electron ABI rebuild、Vite external 化、packaged Windows/macOS smoke；开发态连接不等于生产可用。
- Electron 安全风险：BrowserWindow 基线必须扩展到 CSP、sandbox 策略、navigation/new-window 限制、`shell.openExternal` allowlist、IPC sender validation。
- Electron e2e 风险：native dialog 测试必须通过 main-process stub 注入 `dialog.showOpenDialog`；不得用网页 file chooser 模型替代。
- Codex SDK 风险：只允许官方 Codex SDK；SDK 内部 CLI/JSONL 机制可以作为 SDK runtime 使用，但不得改成直接 `codex exec` fallback。
- AI 执行风险：streaming、cancel/timeout、schema validation、transaction boundary、partial failure、idempotency、resume、packaged smoke 都是上线前门禁。
- 性能风险：SQLite/migration、结构识别、AI runtime、health/reindex、export 都必须有 small/medium fixture 基线；没有基线不得宣称生产可用。
- 全链路验收风险：局部 smoke 不能替代 full journey e2e；V1 完整闭环必须覆盖导入、结构冻结、最小 AI、审查、完成、健康检查、导出和重开。
- 日志与可观测性风险：默认本地日志、默认脱敏、默认不远程上传；crash/error report 和日志导出必须由用户显式触发或后续产品决策开启。
- 发布风险：packaged smoke 不等于生产分发；Windows signing、macOS codesign/notarization、自动更新策略和 CI/CD 门禁未明确前不得宣称发布就绪。
- 无障碍/i18n 风险：V1 UI 必须有键盘可达、可见 focus、基础 label/contrast smoke；界面文案、日期/数字格式和源文本 Unicode 处理必须集中管理。
- 结构识别风险：导入后必须有自动卷/章节/故事段候选、置信度、失败态、fixture、性能基线和用户确认入口；纯手动结构校正不能满足 V1。
- 类型模板风险：TypeLibrary、PromptTemplate、templateVersion、sample preview、publish/rollback、book snapshot 必须贯穿设置壳、规格、AI 运行和导出 manifest。
- 书籍完成风险：`Task completed` 不等于 `Book completed`；完成前用户可见 AI 资产必须确认、拒绝、排除或合并，关键证据/结构/source copy 是 hard blockers。
- 资料库健康风险：资料库必须能检查缺失文件、断链、孤儿对象、duplicate IDs、hash 不匹配，并提供修复/重建索引和人工处理清单。
- 内容模型风险：分析模块、技法资产、专题视角先定边界，再做 schema、UI、AI。
- 技法复刻风险：候选和快照不得保存角色专名、专有设定、原文句子或桥段复刻。
- 专题视角风险：专题视角只组合和派生，不直接写事实，不当第八个模块。
