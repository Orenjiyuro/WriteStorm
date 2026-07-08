# WriteStorm 产品设计审查问题记录

日期：2026-07-05  
来源：基于当前产品设计草案、Task 1 竞品/证据基线、Task 1d NovelWriter/酒馆式 agent 补充、Task 2 产品设计审查、Task 3 同类软件反证、Task 4 修订门禁整理。  
范围：记录进入后续修订和技术方案前需要处理的问题、限制和兼容性判断；不修改原始产品方案。

## 0. 明确排除项

本记录暂不写入 Task 2 的第一条 V1 体量问题。  
这里的排除只针对该问题本身，不影响记录账号式连接器、审查负担、状态机、模块实例、证据策略等其他问题。

## 1. 前置证据限制与待验证项

### 1.1 账号式连接器仍未验证

- 级别：待验证 / Pre-V1 闸口
- 文档位置：[技术 spike 前置项](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:158)、[技术方案前必须回答的问题](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1264)
- 问题：文档要求 V1 至少实现一个官方文档支持、合法稳定的账号式连接器，并明确 API Key 不能自动替代账号式连接器验收；但当前还没有完成官方文档级 spike。
- 风险：如果目标供应商不存在合法稳定的账号式本地应用接入，V1 的 AI 连接验收口径会失效。
- 修订方向：在技术方案前建立 `Pre-V1 Go/No-Go` 检查项，列出供应商候选、官方文档证据、失败后的产品调整分支，以及 API Key 或本地模型是否只用于开发验证。

### 1.2 缺少 UI 原型或截图，无法评价真实入口成本

- 级别：证据限制
- 文档位置：[V1 拆解主流程](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:258)、[产品表面清单](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1095)
- 问题：当前只有文字产品结构和流程，没有 UI 原型、截图或交互草图。
- 风险：无法判断首次进入、资料库选择、AI 配置、结构校正、证据审查、重跑 diff、导出修复等入口是否自然，尤其无法判断审查负担在真实界面中是否可承受。
- 修订方向：后续需要补一轮低保真产品结构稿或真实入口路径验收图；在此之前，不应声称入口体验、审查效率或高保真视觉已通过。

### 1.3 缺少样本文本和 AI 输出样例

- 级别：证据限制
- 文档位置：[长篇 AI 拆解管线](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:277)、[证据、审查、重跑与 diff](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:587)
- 问题：当前没有用于验证结构识别、证据密度、关系抽取、技法抽象、AI 约束摘要的样本文本和 AI 输出样例。
- 风险：无法验证证据密度是否合理、拆解结果是否稳定、技法候选是否能有效去除来源角色/设定/表达。
- 修订方向：技术方案前准备至少一份短篇或长篇节选样本，跑通结构识别、模块输出、证据锚点、技法候选和重跑 diff 的样例验收。

### 1.4 外部同类软件只作为二级参照

- 级别：审查边界
- 文档位置：[产品定位](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:13)、[明确非目标](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1198)
- 问题：Scrivener、yWriter、Manuskript、Plottr、Dabble、Novelcrafter、Sudowrite、Obsidian、NotebookLM、NovelWriter、SillyTavern 等只能校准行业能力和风险，不能替代 WriteStorm 的定位。
- 风险：若直接照搬竞品，产品可能偏向通用写作套件、云端故事规划、AI 正文生成或自由 Markdown 知识库，削弱“本地优先、证据审查、拆解资产沉淀”的核心差异。
- 修订方向：后续竞品对照应按“可借鉴 / 不应照搬 / 与 WriteStorm 冲突”三类记录，不把外部功能清单自动转成需求。

## 2. Task 1d 兼容性观察

### 2.1 角色 agent 推演剧情不进入 V1

- 级别：边界确认
- 文档位置：[原创书架 V1 边界](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:105)、[原创书架占位验收](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1182)
- 问题：NovelWriter、SillyTavern 和多 agent 叙事研究都提示未来原创阶段可能需要角色行为推演、世界状态、导演-角色协作、记忆/计划/反思和图谱一致性检查等机制，但当前版本仍只是拆解小说的方案设计。
- 风险：若提前把 agent 推演写进 V1，会冲掉拆解闭环；若完全不考虑，未来原创书架可能无法复用拆解资产。
- 修订方向：保持 V1 原创书架占位，不创建项目、不生成正文、不做角色 agent 推演；只在拆解产物合同中保留未来映射能力。

### 2.2 拆解模块应与未来原创基线模块同构、对象不同构

- 级别：未来兼容性
- 文档位置：[模块资格与 scope 轴](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:338)、[原创项目模型](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:841)
- 问题：预期原创功能会拥有与拆解类似的情节、人物、关系、世界规则、叙事节奏、文风和技法结构，但拆解侧是有证据的历史分析，原创侧是可变的创作状态和推演空间。
- 风险：如果强行共用同一对象和状态机，原创功能会被证据模型绑死；如果完全不同构，拆解资产未来难以进入原创基线。
- 修订方向：产品合同中明确“模块同构、对象不同构”：两侧共享作品结构语言，但拆解对象和原创对象各自独立，通过确认后的抽象资产、快照和引用关系连接。

### 2.3 拆解产物应能映射为未来原创 agent 的抽象资产

- 级别：未来兼容性
- 文档位置：[人物系统与关系](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:428)、[世界设定与规则](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:485)、[桥段级引用安全对象](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:778)
- 问题：角色 agent 推演未来需要角色行为约束、世界规则、问题-解法机制、文风约束、关系立场、记忆/状态等输入；当前文档已有部分来源，但尚未明确这些是未来可映射的抽象产物。
- 风险：拆解模块可能只做成分析报告页面，未来无法支撑原创角色行为、世界状态和剧情沙盘。
- 修订方向：在拆解模块合同中补充可映射产物：抽象人物功能、关系动力、世界规则、限制与代价、问题-解法机制、文风/叙事约束；同时维持禁止来源角色、专有设定和原文桥段直接进入原创 agent 的硬边界。

## 3. 产品设计问题

### 3.1 账号式连接器缺少 fallback 产品策略

- 级别：Blocker
- 文档位置：[账号式连接器规则](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:160)
- 问题：文档说 V1 目标是至少实现一个官方文档支持、合法稳定的账号式连接器，且不能用 API Key 偷换验收，但没有定义找不到账号式接入时的产品 fallback。
- 风险：一旦目标供应商不支持合法稳定的账号式本地应用接入，V1 的 AI 能力和验收口径会直接失效。
- 修订方向：将账号式连接器提升为技术栈选择前的明确闸口；若账号式连接器 No-Go，必须重新定义 V1 AI 验收。API Key、本地模型或手动导入 AI 输出只能作为重定版 V1 或降级路径，不能继续挂在“账号式连接器验收已满足”的名义下。

### 3.2 用户审查负担可能不可完成

- 级别：High
- 文档位置：[V1 拆解主流程](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:258)、[证据、审查、重跑与 diff](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:587)、[拆解闭环验收](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1142)
- 问题：长篇拆解会生成大量对象、关系、证据、本书技法观察、可复用候选和 AI 约束，但文档要求完成前所有用户可见 AI 资产都必须确认、拒绝、排除或合并。
- 风险：用户可能无法完成一本书的审查，导致“标记完成”成为不可达状态。
- 修订方向：定义审查分层和完成门槛：阻塞资产、建议资产、后台缓存分开；支持按模块完成、批量确认/排除、证据债务队列，并明确哪些未处理项会阻止完成。

### 3.3 Book / Job / Asset 状态机语义不统一

- 级别：High
- 文档位置：[拆解书状态](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:195)、[AI 生成资产状态](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:211)、[任务状态](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:247)
- 问题：`paused_failed` 混合暂停和失败；任务状态同时存在 `paused`、`failed`、`resumable`；完成验收要求“排除”，但 AI 资产状态没有对应状态。
- 风险：任务恢复、失败处理、完成判断、UI 状态和数据迁移会出现不同实现口径。
- 修订方向：分离 Book、Job、Asset 三套状态语义，并明确暂停、失败、可恢复、取消、确认、拒绝、排除、失效、需同步等状态的转换关系。

### 3.4 `模块 x scope` 未落成一等产品对象

- 级别：High
- 文档位置：[模块资格与 scope 轴](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:338)、[存储结构建议](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:865)、[重跑规则](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:601)
- 问题：文档定义 `chapter / story_segment / volume / book` 是同一模块下的分析实例范围，但对象模型和存储样例仍更像每个模块只有一个 Markdown 文件。
- 风险：局部重跑、diff、证据失效、导出、审查状态都缺少稳定承载单位。
- 修订方向：补充产品级对象概念，例如 `AnalysisModuleInstance = module + scope + version + status`；不需要先锁技术字段，但要明确它是一等审查、重跑、导出和失效单位。

### 3.5 证据锚点策略偏技术字段，产品失效策略不完整

- 级别：High
- 文档位置：[证据锚点](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:630)、[证据失效规则](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:673)
- 问题：文档定义了 offset、excerpt hash、结构变更失效等字段和规则，但没有明确源文本是否默认不可变、用户是否能替换源文件、锚点重建后是否需要用户确认。
- 风险：源文本变化、编码修正、章节拆分或故事段调整后，证据门禁可能变得不可解释。
- 修订方向：产品层明确导入源副本默认不可变；如允许替换源文本或修正正文内容，应形成新的 `source_text_edition`，并触发证据重建、局部失效和人工确认。章节拆分、故事段调整和 scope 重建不应混入源文本版本，应进入 `structure_edition` 或 `analysis_revision`。

### 3.6 专题视角不是事实源，但容易被实现成新模块

- 级别：Medium
- 文档位置：[专题视角](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:554)、[专题视角重跑规则](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:608)、[拆解闭环验收](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1159)
- 问题：文档强调专题视角不是新事实源，但 V1 验收又将五个专题视角列为重要能力。
- 风险：实现时可能把伏笔、关系、设定、节奏等专题复制成独立事实，造成多处不同步。
- 修订方向：明确专题视角只保存派生摘要、刷新状态和引用链；事实改动必须回到来源模块，专题视角仅负责组合、追溯、导出和刷新。

### 3.7 类型模板和标签库是关键质量入口，但定义不足

- 级别：Medium
- 文档位置：[人物系统与关系](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:428)、[类型模板](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:611)
- 问题：类型模板决定 AI 关注点和冲突优先级，人设标签决定人物识别与解释，但当前只列出首批类型，且人设标签库明确本轮不枚举。
- 风险：不同类型下的 AI 输出难以比较，重跑结果不稳定，人物标签也可能成为不可审查的自由文本。
- 修订方向：V1 不必完整建设标签库，但应定义最小内置类型包、每类关注点、标签定义来源、模板冲突规则，以及用户自定义类型从内置模板复制后的发布/回滚规则。

### 3.8 原创 agent 未来兼容性应成为拆解产物合同，而不是 V1 功能

- 级别：Medium
- 文档位置：[原创书架未来职责](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:97)、[桥段级引用安全对象](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:778)、[原创项目模型](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:841)
- 问题：文档已经说明原创项目有独立对象模型，但尚未把未来角色 agent / 剧情沙盘需要的抽象资产写成拆解产物合同。
- 风险：拆解侧可能只产出人类阅读报告，未来原创书架无法用这些资产初始化角色行为、关系立场、世界规则和剧情推演。
- 修订方向：将“模块同构、对象不同构”写成长期规则；拆解模块输出确认后的抽象资产，原创侧保存快照和引用目的，不反写拆解书架。

### 3.9 用户自然入口路径缺少空 / 错 / 恢复态验收

- 级别：Medium
- 文档位置：[V1 拆解主流程](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:258)、[导入校验](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1027)、[产品表面清单](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1095)
- 问题：主路径覆盖了选择资料库、配置 AI、导入、结构校正、估算、拆解、审查、导出，但空状态、错误状态和恢复状态的用户入口不够具体。
- 风险：只验收成功路径会漏掉真实用户最常遇到的阻断场景，例如无资料库、无连接器、导入失败、预算暂停、任务中断、证据断链。
- 修订方向：在 V1 验收里补充真实入口用例：首次启动、无 AI 连接器、导入损坏文本、结构识别失败、任务中断恢复、证据断链、预算暂停后继续/降级/取消。

## 4. 外部参考链接

这些来源只作为二级参照，不代表功能验收已完成。

- [Scrivener official overview](https://www.literatureandlatte.com/scrivener/overview)
- [yWriter7 official page](https://spacejock.com/yWriter7.html)
- [Manuskript official page](https://www.theologeek.ch/manuskript/)
- [Plottr features](https://plottr.com/features/)
- [Dabble official page](https://www.dabblewriter.com/)
- [Novelcrafter official page](https://www.novelcrafter.com/)
- [Sudowrite official page](https://www.sudowrite.com/)
- [Obsidian official page](https://obsidian.md/)
- [Google NotebookLM introduction](https://blog.google/technology/ai/notebooklm-google-ai/)
- [NovelWriter_public GitHub](https://github.com/tuxiangxianzhe/NovelWriter_public/tree/main)
- [SillyTavern docs](https://docs.sillytavern.app/)
- [BookWorld](https://arxiv.org/abs/2504.14538)
- [IBSEN](https://arxiv.org/abs/2407.01093)
- [Generative Agents](https://arxiv.org/abs/2304.03442)
- [MAGNET / ATLAS](https://arxiv.org/abs/2607.00918)

## 5. Task 3：同类软件启发与反证摘要

本节只沉淀 Task 3 的产品判断，不扩写成竞品分析报告。外部软件和研究只用于校准风险、反证产品边界和启发修订方向。

### 5.1 长篇写作工程参照

- 参考对象：Scrivener、yWriter、Manuskript。
- 可借鉴设计：长篇工程通常需要稳定的工程结构、章节/场景拆分、局部重排、快照、导出和本地资料组织。
- 不应照搬边界：WriteStorm V1 不是通用写作编辑器，也不负责完整原创手稿管理。
- 对 WriteStorm 的启发：拆解侧的 `模块 x scope` 应成为可审查、可重跑、可导出的稳定实例；快照和 diff 更应服务于 AI 拆解资产，而不是正文写作版本管理。

### 5.2 Story bible 与共享世界参照

- 参考对象：Plottr、Dabble、Novelcrafter。
- 可借鉴设计：角色、地点、设定、情节线、系列世界和 story bible 需要清晰的信息架构，避免散落在正文或自由标签中。
- 不应照搬边界：这些产品多偏向原创规划和写作过程管理，不能直接替代 WriteStorm 的证据审查和来源追溯定位。
- 对 WriteStorm 的启发：人物、关系、世界规则、问题-解法机制等拆解产物应先成为可确认的抽象资产，再作为未来原创侧可引用材料。

### 5.3 AI 控制与来源 grounding 参照

- 参考对象：Sudowrite、Novelcrafter、NotebookLM。
- 可借鉴设计：AI 能力需要用户控制、上下文选择、来源 grounding、引用和人工核查机制。
- 不应照搬边界：WriteStorm V1 不做正文生成、创意改写或提示词发布市场；NotebookLM 式来源 grounding 也不能替代本地证据锚点和人工确认。
- 对 WriteStorm 的启发：证据状态、审查分层、AI 成本确认、重跑 diff 和样例验收应成为 V1 的产品合同。

### 5.4 本地开放格式与 agent 创作参照

- 参考对象：Obsidian、NovelWriter、SillyTavern、BookWorld、IBSEN、Generative Agents、MAGNET / ATLAS。
- 可借鉴设计：Obsidian 提示本地开放格式和链接关系的重要性；NovelWriter 提示原创生成侧会需要伏笔池、角色状态、前文摘要、作者参考库和分步修订；SillyTavern 提示角色驱动交互依赖 character cards、World Info / Lorebook、group chats、RAG 和脚本扩展；多 agent 研究提示导演-角色协作、记忆/计划/反思、共享世界状态、角色行动和图谱一致性检查等方向。
- 不应照搬边界：这些能力大多属于未来原创、互动聊天或正文生成，不进入 V1 拆解闭环。尤其不能把来源作品角色、桥段和专有设定直接喂给原创 agent 复刻。
- 对 WriteStorm 的启发：当前拆解模块应保持“模块同构、对象不同构”，输出可抽象引用的角色约束、世界规则、问题-解法机制和文风/叙事约束，但不实现角色 agent 推演。

## 6. 后续使用方式

1. 修订产品方案时，优先处理 Blocker 和 High 项。
2. Task 3 竞品反证时，应围绕这些问题判断哪些能力可借鉴、哪些能力会污染 WriteStorm 定位。
3. Task 4 修订建议与验收门禁中，应把这些问题转成可执行修订清单和技术方案前硬闸。

## 7. Task 4：修订建议与验收门禁

### 7.1 目标与边界

本节将 Task 1、Task 1d、Task 2 问题记录和 Task 3 同类软件反证，收束成可写回产品方案的修订清单、V1 验收用例和技术方案前硬闸。

边界保持不变：

- 暂不处理“V1 范围过大，缺少可交付切片”问题。
- 不把原创 agent 推演、正文生成、门禁 / 提示词发布写成 V1 能力。
- 外部软件只作二级参照，不作为 WriteStorm 的产品目标替代。
- 本节只锁产品合同和验收门槛，不新增 API、数据库字段或具体实现方案。

### 7.2 可执行修订清单

#### 7.2.1 Pre-V1 账号式连接器 Go / No-Go

- 处理对象：账号式 AI 连接器。
- 当前问题：官方账号式连接器尚未验证，且缺少失败时的产品 fallback。
- 修订文本方向：在 Pre-V1 增加 `Go / No-Go` 闸口：若官方账号连接不可行，必须重新定义 V1 AI 验收；API Key、本地模型、手动导入 AI 输出或纯本地拆解只能作为重定版 V1 或降级路径，不能继续声称账号式连接器验收已满足。
- 验收口径：产品文档明确“连接可用 / 不可用 / 部分可用”三种结论分别对应的用户路径，不允许技术方案默认连接器必然成立。

#### 7.2.2 审查分层与完成门槛

- 处理对象：用户审查工作台、拆解完成条件。
- 当前问题：审查负担可能不可完成，文档未定义哪些资产必须人工确认、哪些可延后。
- 修订文本方向：增加三级审查合同：硬门槛资产、建议审查资产、可延后资产；每类定义完成条件和阻塞行为。
- 验收口径：一本书拆解完成后，用户能看到“可进入下一步 / 需补审 / 仅供参考”的明确状态，而不是只看到任务完成百分比。

#### 7.2.3 Book / Job / Asset 状态语义

- 处理对象：书籍工程、异步任务、AI 生成资产三类状态机。
- 当前问题：Book、Job、Asset 状态语义不统一，容易出现任务完成但资产不可用、资产确认但证据失效等冲突。
- 修订文本方向：分别定义三层状态：`Book` 表示书籍工程整体可用性，`Job` 表示异步任务执行，`Asset` 表示分析产物可信度与审查状态。
- 验收口径：任一状态变化都能回答“谁变了、为什么变、影响哪些入口、用户下一步能做什么”。

#### 7.2.4 AnalysisModuleInstance

- 处理对象：`模块 x scope` 的产品承载单位。
- 当前问题：模块与 scope 是关键产品对象，但当前更像技术参数，没有落成一等产品对象。
- 修订文本方向：引入产品层概念 `AnalysisModuleInstance`，表示某分析模块在某个 scope 上的一次可审查产物单元。
- 验收口径：用户能按“人物-全书”“节奏-章节”“技法-片段”等实例查看状态、证据、重跑结果和 diff。

#### 7.2.5 证据 source / structure edition 与失效策略

- 处理对象：证据锚点、源文本版本、结构版本、分析修订和证据重建。
- 当前问题：证据锚点偏技术字段，缺少源文本变化后的产品失效策略。
- 修订文本方向：把 `source_text_edition`、`structure_edition` 和 `analysis_revision` 的边界写成产品合同。源文本内容、编码归一或正文校正变化时更新 `source_text_edition`；章节拆分、故事段调整和 scope 重建进入 `structure_edition`；模块重跑和人工修订进入 `analysis_revision`。证据必须绑定相应来源版本。
- 验收口径：当源文本或结构变化时，系统能标记证据有效、疑似失效、断链或需重建，并说明失效来自正文变化、结构变化还是分析重跑，而不是静默沿用旧结论。

#### 7.2.6 专题视角只做派生视图

- 处理对象：专题视角、事实源边界。
- 当前问题：专题视角不是事实源，但容易被实现成新的事实模块。
- 修订文本方向：明确专题视角只聚合已有资产，不产生独立事实；它可以保存筛选、排序、阅读路径和用户笔记，但不能覆盖原始模块结论。
- 验收口径：删除一个专题视角不会删除人物、事件、技法、证据等底层资产。

#### 7.2.7 类型模板与标签最小合同

- 处理对象：类型模板、人设标签、模块默认配置。
- 当前问题：类型模板和标签库是关键质量入口，但定义不足，后续会直接影响结构识别和审查一致性。
- 修订文本方向：补一个最小合同：模板包含适用题材、默认模块、推荐 scope、必审资产、标签命名规则和禁用标签。
- 验收口径：同一本书切换模板时，系统能说明哪些分析口径变化、哪些历史资产保留、哪些需要重跑。

#### 7.2.8 原创 agent 未来兼容性

- 处理对象：拆解产物合同、原创书架未来兼容边界。
- 当前问题：未来原创能力会反向影响拆解资产结构，但不应进入 V1 功能。
- 修订文本方向：写入“模块同构、对象不同构”：拆解侧产出抽象资产，原创侧未来可引用这些抽象资产，但不得直接复刻来源角色、桥段和专有设定。
- 验收口径：V1 只输出可抽象引用的角色约束、世界规则、问题-解法机制、文风约束等，不出现“用来源作品角色自动推演原创剧情”的入口。

#### 7.2.9 自然入口与空 / 错 / 恢复态

- 处理对象：首次启动、导入、AI 配置、结构校正、长任务、审查和导出入口。
- 当前问题：缺少首次启动、导入失败、任务中断、审查恢复等真实用户路径验收。
- 修订文本方向：把用户入口路径写成验收用例，而不是只描述理想成功流。
- 验收口径：用户从无资料库开始，也能完成导入、失败处理、结构校正、预算确认、任务恢复、审查和导出中的每个关键节点。

### 7.3 V1 验收用例补充

1. 首次启动无资料库：用户进入后能创建本地资料库、看到空状态、导入第一本书，不需要预置数据。
2. 无 AI 连接器：系统能提示当前不可自动拆解，并提供连接配置、降级模式或退出路径，不阻塞本地资料管理。
3. 导入损坏 / 编码失败 / 非小说文本：系统能给出失败原因、保留失败记录、允许重新选择文件或手动指定编码。
4. 结构识别失败并手动校正：章节识别错误时，用户能调整结构，调整后后续模块使用新结构版本。
5. 预算暂停与继续 / 降级 / 取消：AI 成本超过阈值时，用户能暂停、继续、缩小 scope、降低模型或取消任务。
6. 长任务中断恢复：程序关闭或任务失败后，重新进入能看到 checkpoint、已完成实例、待重跑实例和不可恢复原因。
7. 证据断链或 source / structure edition 变化：源文本或结构版本更新后，旧证据必须显示有效性状态、失效来源，并能触发局部重建。
8. 模块重跑产生 diff：重跑模块时，用户已确认资产不被静默覆盖；系统展示新增、删除、冲突和保留项。
9. 技法候选采纳：候选技法被采纳后进入 `TechniqueEntry`，并保留来源证据；采纳动作不反写来源作品事实。

### 7.4 技术方案前硬闸

1. 官方账号式连接器 spike：必须先有可复现结论，再决定 V1 连接器策略。
2. Schema / version / source / structure edition 策略：必须明确书籍、源文本、结构版本、模块实例、资产和证据的版本关系。
3. Markdown / JSON 编辑边界：必须明确哪些内容用户可直接编辑 Markdown，哪些只能通过结构化界面或 JSON 派生。
4. 长任务 checkpoint 粒度：必须明确任务恢复单位是书、章节、模块实例还是资产批次。
5. `AnalysisModuleInstance` 承载边界：必须明确重跑、diff、证据失效、用户确认状态挂在哪个产品对象上。
6. 最小类型模板 / 标签定义：必须先有最小模板合同，否则后续 AI 输出和用户审查无法稳定对齐。
7. 审查完成条件：必须明确“一本书拆解完成”到底意味着任务跑完、硬门槛资产确认，还是证据质量达标。
8. 样本文本与 AI 输出样例：进入技术方案前至少需要一组样本文本、拆解输出和人工审查样例，用于验证证据密度、结构识别和技法抽象质量。
9. 低保真入口路径：没有 UI 高保真也可以，但需要最小流程图或页面清单，证明空态、错态、恢复态有入口承接。

### 7.5 建议写回产品文档的位置

本节不直接修改原产品方案，只记录后续改写时的推荐落点：

- 连接器 Go / No-Go：写回 [连接器 spike](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:158) 附近。
- 状态语义：写回 [状态机章节](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:193)。
- `AnalysisModuleInstance`：写回 [`模块 x scope`](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:348) 附近。
- 专题视角边界：写回 [专题视角](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:554)。
- 类型模板 / 标签库：写回 [类型模板](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:611)。
- 证据与 source / structure edition：写回 [证据锚点](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:630)。
- 验收用例：写回 [验收章节](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1140)。
- 原创未来兼容：写回 [原创书架 V1 边界](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:107) 附近。
- 技术方案前硬闸：写回 [技术方案前必须回答的问题](C:/SoftWork/Git/WriteStorm/docs/product/write-storm-product-design.md:1266) 附近。

### 7.6 Task 4 自检结论

- 已覆盖本记录中除“V1 范围过大，缺少可交付切片”外的全部问题。
- 未把原创 agent 推演、正文生成、门禁 / 提示词发布写成 V1 能力。
- 未声称外部软件、UI 原型或高保真交互已经验收。
- 本节可直接作为后续改写产品方案前的修订清单和门禁清单。
