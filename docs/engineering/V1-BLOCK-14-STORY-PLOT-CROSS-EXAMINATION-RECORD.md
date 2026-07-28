# V1 Block 14 故事情节深度方法论拷打结论

Date: 2026-07-27

Status: `DOMAIN_SEMANTICS_CLOSED / PRODUCTION_CONFIGURATION_OPEN`
（七个核心模块领域语义进度：`1 / 7`）

Authority: D122–D131。D131 记录端点与所有权窄补丁，并维持 D127 完整 `CLOSED`
表述的撤销。14-G0 本体与跨域所有权仍以
`V1-BLOCK-14-G0-CROSS-EXAMINATION-RECORD.md` 为准；本文只冻结获批模块
`故事情节` 的有限关注面、分析判断、领域语义、证据/完成边界和验证输入。

Implementation status: 未授权。本文不冻结共享命题包络、Zod/JSON Schema、数据库拓扑、
IPC DTO、审查状态机、CAS、Prompt、真实 AI、持久化或 UI。

## 1. 一句话结论

故事情节模块重建并解释作品在故事世界中的变化过程：发生了什么、局面怎样改变、这些变化
怎样通过事件关系和情节线形成持续发展。它不负责叙述呈现、人物/关系/世界持续状态的第二份
事实，不评价作品是否精彩，也不把技法、类型配方或真实读者效果伪装成原作事实。

本模块的领域语义已具备后续共享 Schema 质询所需的输入，但这不是“作者、编辑、叙事学与
生产工程共同验证完成”。外部效度、运行配置和真实长篇生产表现仍未关闭。Block 14 仍未完成：

- 其他六个核心模块尚未进行同等级深度方法论拷打；
- 14-G1 影响评估已完成，但实现准入仍开放；
- 七模块共享 Evidence、命题、审查、历史、版本和物理存储协议尚未冻结；
- 不得据此编写 Prompt、pipeline、migration 或生产实现。

### 1.1 状态解释

- `DOMAIN_SEMANTICS_CLOSED`：Q1–Q47 的领域问题经过完整重审和 D131 窄补丁修订，当前领域
  契约闭合；这不等于生产验证或共享 Schema 冻结。
- `PRODUCTION_CONFIGURATION_OPEN`：本文不是一次 Prompt、逐段执行清单或生产验收结论。
  六问运行骨架、条件触发和真实长篇对照属于后续门禁。
- 其他六模块仍为 `OPEN`；它们只拷打模块专属文学判断，共享治理和工程约束不重复质询。

### 1.2 关键裁决的来源映射

| 裁决 | 来源 | 支持范围与限制 |
| --- | --- | --- |
| story/discourse 分离；情节同时涉及事件、时间、因果及读者建构 | Cambridge, *Psychonarratology: Events and Plot*，<https://www.cambridge.org/core/books/abs/psychonarratology/events-and-plot/C2A9547C8B58828C62F6E6C07AD97928> | 支持故事世界变化与叙述呈现分开；不替本产品决定资产类型 |
| “准入结构化故事事件”是产品门槛，不是事件的唯一文学定义 | Abbott, *Defining narrative*，<https://www.cambridge.org/core/books/cambridge-introduction-to-narrative/defining-narrative/45F0B7D16F447F02F8E5A4CC133F9A24> | 学界对一个/多个事件及因果要求存在分歧 |
| 粗粒度事件与子事件可以形成 part-whole 层级 | *Episodes, events, and models*，<https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2015.00590/full>；HiEve，<https://aclanthology.org/L14-1020/>；MAVEN-ERE，<https://aclanthology.org/2022.emnlp-main.60/> | 支持表达父子层级；不推出所有宏事件都应持久化 |
| 文本分段是需要规则、标注和复核的分析任务 | *Detecting Scenes in Fiction*，<https://aclanthology.org/2021.eacl-main.276/> | 研究对象是 scene，不等同于 Story segment；只支持拒绝“唯一客观分区”的表述 |
| 故事回顾应筛选人物欲求、冲突、决定及叙事弧，不平均罗列场景 | 作者 Mindy Friddle, *The Synopsis Is Your Compass*，<https://www.writersdigest.com/write-better-fiction/the-synopsis-is-your-compass> | 作者实践来源；支持标准回顾的选择性压缩，不定义规范事实 |
| 叙事摘要依赖显著事件、人物行为和因果理解 | NarraSum，<https://aclanthology.org/2022.findings-emnlp.14/> | 支持“无可忠实压缩变化链时不制造空回顾”；不直接定义本产品 Recap Schema |
| 时间线、因果线和故事线是不同叙事维度 | *A Narratology-Based Framework for Storyline Extraction*，<https://www.cambridge.org/core/books/abs/computational-analysis-of-storylines/narratologybased-framework-for-storyline-extraction/74F1D6D4C6F8673C5D46C10D9E315ED8> | 支持关系族和 Plotline 不压成无类型图边；研究语料以新闻为主，不替本产品决定小说端点矩阵 |
| 聚合内同一状态变化必须有唯一一致性边界；读模型可由写模型重建 | Microsoft DDD，<https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/microservice-domain-model>；CQRS，<https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs> | 工程依据；支持 Lifecycle 单写者和非权威 Scope 投影，不证明文学语义 |
| 类型趋势不能压倒作品自身重点，创作者/编辑会按作品长项取舍 | KADOKAWA 现役编辑座谈，<https://school.kadokawa.co.jp/manga-hs/blog/20251223/45194/> | 编辑实践来源；支持 Overlay 只增加关注、不改写 Base 所有权 |
| 复杂指令、长上下文和事件关系抽取需要生产简化与实测 | CELLO，<https://ojs.aaai.org/index.php/AAAI/article/view/29777>；*Lost in the Middle*，<https://aclanthology.org/2024.tacl-1.9/>；EventRelBench，<https://aclanthology.org/2025.findings-emnlp.482/> | 支持建立生产门禁；不预判尚未实现 Prompt 的具体表现 |

## 2. 前置结构：Story segment

### 2.1 产品用途与定义

Story segment 是产品为长篇分析建立、由用户冻结的一套活动中层分区方案，由围绕一个或多个
主要发展中心、需要结合理解的一组连续正文组成。它不是作品唯一真实结构，不声称学界存在
唯一客观边界，也不是卷章不足时才启用的补救 Scope 或新的文学分析模块。

- 每部长篇在本产品进入正式分析前必须形成一套活动 Story segment 分区，至少一个；
- 一卷通常包含多个故事段，但短卷、序卷或单一连续过程可以只有一个；
- 卷的长度和故事段数量不形成领域有效性判断；单段长卷与多段短卷都按相同边界证据审查；
- Story segment 不要求完整起承转合、高潮、独立情节线或最终解决；
- 非情节性正文仍归入最合适的故事段；
- 完全没有独立组织依据的范围不得单独成段。

### 2.2 产品运行不变量

- 每卷正文必须被 Story segment 无缝、无重叠、完整覆盖；
- Story segment 必须连续，可以从章内开始或结束，也可以跨章；
- 活动产品分区中的 Story segment 永不跨卷；这是导航、冻结和版本治理约束，不是文学规律；
- 同一发展延续到下一卷时，上一卷形成告一段落，下一卷形成承接段；
- 跨卷连续性由 Plotline、EventRelation 和全书故事回顾表达；
- 不修改或伪造原文卷章标题树来容纳故事段。

### 2.3 边界判断

强边界证据包括局部发展完成、失败、暂停、转向，或由新的持续发展/情境中心接管。

时间、地点、聚焦、参与者组合等单项变化通常只是候选线索；多项线索共同变化并持续形成
新行动或情境中心时，可以共同构成充分证据。双侧检验要求：

- 前侧能够说明怎样告一段落、暂停或转向；
- 后侧能够说明什么新的持续局面开始接管。

不要求完整闭环，也不把“同一行动尚未得到直接结果”当成绝对禁止切段。Story segment
边界本身不保存铺垫、高潮、人物转折、信息揭示、主题等文学功能标签。

### 2.4 候选、冻结与版本影响

- AI 可以提出一套完整候选划分及少量局部替代边界；不同方案都可能合理；
- 用户冻结一个活动 structureEdition；
- 冻结表示当前范围确定，不表示唯一正确分段或任何文学解释已确认；
- 活动故事段原文范围变化时，只复核实际依赖旧范围的分析；
- 仅改显示名称等不影响范围的信息，不得让全部结果 stale；
- “本范围没有独立情节脉络”不等于 Story segment 无效，仍须完成合法空结果或未决处置。

## 3. 模块内容分层

故事情节不是“五个平级资产”，而是三层产品结构。

### 3.1 四类规范资产

1. `StoryEvent`
2. `EventRelation`
3. `Plotline`
4. `PlotlineRelationClaim`

`PlotlineRelationClaim` 具有跨 Plotline 端点、独立真值、证据、审查和 revision，不能为了
维持旧“三个根”数量而藏进任一 Plotline 聚合。

### 3.2 确定性 Scope 投影

Scope 投影按章、Story segment、卷或全书筛选、排序和聚合规范资产：

- 不调用 AI；
- 不拥有第二份事实；
- 不要求每个 Scope 物化；
- 缓存可丢弃、可重建，没有审查、revision、依赖或 stale 生命周期；
- 只能展示规范资产足以确定的进入/离开状态；
- 无法确定时明确显示未知，禁止按首尾事件补全；
- 筛选、排序、分组和计数仍是投影，不获得稳定资产身份。

### 3.3 派生 `StandardStoryRecap`

标准故事回顾是有来源、有取舍、有压缩、可审查的派生资产，不是第二事实库。

- 每个活动 Story segment、每卷和全书都必须完成“回顾关注面处置”；
- 只有存在能够忠实压缩的变化链时才创建 `StandardStoryRecap`；
- 没有可忠实压缩变化链时，保存已检查、合法空结果、不适用、证据不足或 unresolved 的覆盖
  处置，不创建空 Recap 资产；
- 章节默认只提供确定性投影；
- 章与 Story segment 同范围时引用同一份故事段回顾，不复制；
- 范围交错时按规范资产投影；
- 只有章节本身构成独立故事单位，或用户明确建立章级回顾用途时，才持久化章级派生回顾；
- 查看章节不得触发临时 AI。

每个满足创建资格的必答 Scope，V1 默认至多一份“标准故事回顾”，包含简短概览和可展开的
关键发展步骤。详细复盘直接查看规范资产和 Scope 投影。AI 上下文摘要不属于 Block 14
默认产物。

### 3.4 Scope 回顾语义骨架

标准故事回顾能够识别以下语义角色，但 UI 不必固定显示为四块文字：

1. 进入局面：范围开始时已经有效的 Plotline、目标、条件和未决问题；
2. 最小充分变化链：理解本范围变化必须保留的事件、关系和一个或多个发展中心；
3. 离开局面：范围结束时可确认的变化和当前状态引用；
4. 延续与未决：仍在继续、暂停、转向、汇合或无法确定的发展。

进入、离开或延续无法确认时必须标记未知。压力、阻碍、代价、风险、选择、转折、巧合和
揭示是按需信息，不是固定戏剧配方。

### 3.5 回顾片段

`StandardStoryRecap` 整体承担 revision、审查和 stale。内部结构化片段只为阅读、定位和
Diff 服务：

- 定位符限定在 `recapId + fragmentId` 内；
- `fragmentId` 由系统分配，不能进入规范 `ClaimRef`；
- 语义角色和主要来源集合未变时可跨 revision 保留；
- 选材或含义实质变化时创建新片段；
- 每个片段保存实际依赖的规范资产引用；
- 任一关键片段受影响时，整份 Recap 待复核；
- 片段没有独立事实权威、审查状态或生命周期；
- 前台显示顺序不冒充完整故事时间；并行、偏序和未知顺序必须结构化表达；
- 折叠、字号和纯 UI 排序不写入 Recap。

底层 unresolved、竞争关系和未知时间不得在压缩时消失。回顾选中某事件已经表达其对该
Scope/用途有保留价值，不再创建“本卷关键事件”第二名单或永久重要性评分。

## 4. StoryEvent

### 4.1 事件身份与粒度

准入结构化故事事件是在当前文本证据下，具有相对独立的行动或发生过程及其直接结果，并可
作为因果、状态转变或 Plotline 节点引用的语义单元。它是故事情节模块的结构化保存门槛，
不是对文学中“什么才算事件”的排他定义。

- 不是最小动作；
- 相邻动作可由更高层发生过程概括，且不丢失独立结果、状态变化、因果或 Plotline 作用时，
  必须合并；
- 只有必须被独立引用、审查或连接的发生过程才获得准入结构化身份；
- 正文动作和细节保留在证据中，候选可以合并、拆分或拒绝；
- 后续“变得重要”通常只增加关系和选择价值，不改变事件身份；
- 仅当新证据证明原记录混合了不同发生过程时，才版本化拆分；
- 拆分、合并和替代保留稳定身份历史，并使依赖进入重新挂接/复核。

事件允许形成有向无环的 `part-of` 层级：

- 默认只保留满足当前分析用途的最高可用语义粒度；
- 上层若只是对子事件命名、排序或摘要，仍为无事实所有权的只读 `EventGroup`；
- 上层过程只有在至少拥有一项可独立取证、不能由子事件逐项替代的宏观 `occurrence` 命题、
  时间/空间跨度、行动主体的事件级 `expected outcome`、整体 `direct result`，或由
  EventRelation 单写的独立因果作用时，才可以成为准入结构化故事事件；
- 父事件与子事件通过 EventRelation 的 `structural_containment / part_of` 分支连接；
- 人物目标仍由人物塑造模块单写，父事件只能引用；不新增含混的“过程状态”字段；
- 父事件不复制子事件的行动和直接结果，子事件也不复制父事件独立拥有的宏观命题；
- 因果、状态变化和 Plotline 作用连接实际产生该作用的粒度；
- 父事件与子事件分别审查，任一方确认不自动确认另一方；
- 投影、统计和回顾必须声明使用粒度并防止父子重复计数；
- 自引用、重复 `part-of`、同义重复或互相矛盾的父级归属及层级循环必须由工程校验拒绝；
- 一个子事件可以合法属于多个不同分析粒度或不同整体过程的父事件，前提是每个父级均有独立
  宏观命题，且多父归属不造成同义重复、语义矛盾或重复计数。

### 4.2 事件准入

事件提及候选、准入结构化故事事件和特定 Scope/用途下的选择价值必须分开。

满足以下至少一种独立情节作用才有准入结构化资格：

- 改变或主动保护人物、关系、世界等合格领域状态；
- 改变人物目标实现状态；
- 成为因果、条件、阻碍或潜在后果链节点；
- 开启、发展、转向、暂停、决定或闭合 Plotline；
- 形成持续约束或后续结果；
- 形成需要长期合并证据和条件性引用的未决发生命题。

普通吃饭、散步、开门或计划在没有独立情节作用时不建档；在特定语境下满足准入条件时仍可
成为事件。准入与重要性、摘要选择、ContentFocus 命中和“看起来精彩”无关。

### 4.3 Admission Bundle

准入结构化 StoryEvent 的最小合法语义包：

1. 一个活动 occurrence claim：
   - 稳定语义边界；
   - 有效 EvidenceAnchor；
   - 明确认识身份；
   - 可以 unresolved，但不能是空占位符。
2. 至少一项当前合格的独立情节作用依据。

依据必须是当前合格，或在同一 Admission Bundle 中能够共同通过验证的 EventRelation、
PlotlineDevelopmentRecord 或领域变化。候选标签、风险猜测、StandardStoryRecap、
ContentFocus 命中或重要性判断不能循环证明正式化。

同一 Admission Bundle 可以原子提交 StoryEvent、Plotline 和关联记录，但准入依赖图必须至少
有一条不循环的语义基础：

- StoryEvent 自身具有独立状态变化、direct result、合格因果作用，或文本建立的强前向承诺；
- PlotlineDevelopmentRecord 不能同时成为它所引用的 StoryEvent 和 Plotline 双方唯一准入理由；
- Plotline 单次强前向准入必须引用已具独立情节作用的开启事件；多记录准入必须引用具有独立
  准入基础的事件/结果；
- 服务端必须在接纳事务中检查准入依赖图可回溯到原文证据和至少一个非循环基础，不能只验证
  “对象彼此都有引用”。

系统先使用临时服务端身份整体校验 occurrence、证据、关系及发展记录，通过全部不变量后
原子接纳。不能先落空 StoryEvent 再等待关系补齐。

唯一准入依据失效时进入 `admission_needs_review` 语义。准入结构化身份不静默降回普通候选；
最终可以退役、拒绝、合并或被替代，并保留稳定 ID 和历史。

### 4.4 七组可寻址命题

StoryEvent 由七组按需出现的可寻址命题组成：

1. `occurrence`
2. `participation`
3. `story time`
4. `spatial placement`
5. `direct result`
6. `agency`
7. `expected outcome`

除活动 occurrence 外，其余均非必填。显示文字没有事实权威。依赖必须挂在实际使用它的
命题上，不得使用根级 `authoritativeRefs[]` 让整个事件一起 stale。

当前载荷只保存活动命题；旧命题、替换、竞争和 revision 历史进入共享历史存储。不存在
证据时由关注面处置表达“已检查但未知”，不机械制造 unknown 命题。

### 4.5 发生命题与竞争假说

- 每个 StoryEvent 恰好一个活动 occurrence claim；
- occurrence 可以 unresolved；
- 否定某事件发生是对同一 occurrence 的反驳，不是另一个事件；
- 但具有文本建立的明确期待、期限或进行条件，并因未发生而产生独立结果的缺席、失败或拒绝，
  可以成为 direct result，或在拥有独立发生边界和情节作用时成为准入结构化故事事件；
- “援军没有到”只有在援军到达已构成有效期待/条件且缺席改变局面时才结构化；普通“没有发生”
  以及对既有 occurrence 的否认不获得第二个事件身份；
- 原因、结果、时间或能动性的局部分歧落到对应命题，不复制整个事件；
- 只有两个互斥的正向发生过程，且不存在合法共同发生核心时，才建立多个竞争事件假说；
- 竞争组允许确认其一、全部拒绝或证明原来是两个事件，不要求必选一个。

共同发生核心必须：

- 指向同一故事时间中的具体发生实例；
- 有独立证据，而非模型为合并矛盾抽象出“发生了某事”；
- 本身满足事件准入；
- 参与者、时间、地点和过程连续性足以支持同一身份。

梦境、预言、传闻和他人声称首先是叙述呈现。只有未确认发生命题被持续突出并实际建立
悬念、行动依据、误导或待回收承诺时，才获得稳定未决身份。传闻影响人物行动时，首先建立
“收到并相信传闻”的信息事件；只有传闻所述事件真假需要长期审查时才建立未决事件命题。

### 4.6 Participation

参与命题的默认原子粒度是：

```text
StoryEvent + stableEntityRef + participationRole + eventInternalApplicability
```

- 每条命题绑定一个稳定实体或稳定匿名实体；
- 同一实体可以有多条不同角色命题；
- 按实体身份、角色和事件内适用范围去重；
- 集体和成员表达不同事实时可以共存，不共享确认资格；
- 共同出场、被提及、组织成员身份或叙述者讲述不自动成为参与；
- 后来获知事件不属于原事件参与，归信息事件或人物知识状态；
- witness 只适用于亲历见证；
- “受到影响”只限事件的直接作用，间接后果通过结果、EventRelation 或领域状态表达；
- 人物提供工具/资源可以成为提供者，物件被使用可以成为工具涉入；
- 天气、制度、资源短缺和地点约束是世界条件/EventRelation，不是参与者；
- 适用范围指事件内子过程、故事时间片或证据范围，不复用分析 Scope；
- 人物、集体、组织和物件使用类型化实体引用联合，并校验角色兼容性；
- 物件不能成为决策主体，地点不能成为行动者，除非文本明确赋予人格化行动主体身份。

### 4.7 Story time

故事时间使用多条可组合、可竞争的有限时间约束，不使用统一 `occurredAt`。

V1 有限判别联合只覆盖：

- 时间点或命名时期；
- 区间；
- 持续时长；
- 重复周期；
- 时间框架引用。

StoryEvent 拥有事件自身定位、跨度和重复；EventRelation 单写事件间先于、同时、重叠、
包含等时间关系；世界设定拥有纪年、循环、重置、模拟世界等时间框架和合格换算；叙述调度
拥有文本呈现顺序、倒叙、预叙和重复讲述。

- 兼容的粗细时间命题可以并存，粗粒度确认不自动确认精细时间；
- 不同时间框架没有合格换算时不可直接比较；
- 梦境、传闻、预言和假设默认不创建世界时间框架；
- 只有内容取得 StoryEvent 资格时才可引用明确嵌套故事时间；
- 时间与因果即使端点相同仍是不同 EventRelation；
- 只做有限一致性检查：严格先后不得形成环，明显不相交区间不得同时确认重叠；
- 模糊范围、不同框架或换算缺失时保持未知；
- 未知时间不制造空命题；
- 复合事件内部出现独立时间阶段时回到事件粒度审查。

普通可直接确定的顺序只做投影，不建立海量关系。时间旅行造成因果反常不自动意味着故事
时间严格先后成环。

### 4.8 Spatial placement

空间定位具有独立真值和审查资格，是第七组结构修正中新加入的独立命题组。

- 只引用世界设定拥有的地点身份；
- 世界模块拥有名称、别名、层级、包含关系、环境属性和规则；
- 候选可保留未解析地点提及；
- 正式确认引用稳定地点或稳定匿名地点；
- “王宫”可以确认，“西门/地下通道”保持竞争；
- 包含关系不能反向伪造事件精确位置；
- 连续过程可表达开始、结束、经过和事件内适用范围；
- 地点变化开启独立行动、结果或因果阶段时，必须复核事件拆分；
- 路径和空间顺序不自动证明故事时间、因果或 Story segment 边界；
- 没有地点证据时使用关注面处置，不创建 unknown 地点命题。

### 4.9 Direct result

直接结果是同一事件过程在其语义边界内不可分割的即时落点。“即时”指语义直接，不要求
钟表时间很短。

- directResultClaim 具有稳定身份，可直接成为 EventRelation 端点；
- 会影响后续不自动升级为新 StoryEvent；
- 只有出现新的行动、发生过程、选择者或独立语义边界时才建立新事件；
- 其他模块已经准入的同义状态变化由其单写，事件侧只通过 EventRelation/反向索引展示；
- 原事件即时结果与后续独立事件表达不同事实时可以同时存在；
- 尝试失败、被阻止和相对于明确行动的未实现可以成为直接结果；
- 多条兼容、联合或竞争结果分别审查；
- 粗粒度结果和精细结果使用 `refines` 或竞争关系，不能重复计数；
- 没有结果证据时不创建 unknown 结果。

成功、部分实现、失败或反向实现不是 direct result 字段。能够确定性比较时只做投影；需要
独立解释和审查时建立 `outcome_comparison / realization` EventRelation，引用 expectedOutcomeClaim
及实际结果。

### 4.10 Expected outcome

expectedOutcomeClaim 是主体、事件和时间绑定的高价值行动预期，按需出现，不是每个事件
必填项。

准入至少满足一项：

- 文本明确表达计划、意图或预测；
- 不记录就无法解释为何这样选择；
- 预期与实际落差推动后续情节；
- 多个主体对同一行动存在不同预期；
- 涉及重要风险、代价、误判或牺牲。

自然事件、普通日常动作和结果显然且不影响理解的行动可以没有 expected outcome。

必须区分：

- intended outcome：主体希望行动实现什么；
- anticipated outcome：主体认为行动实际会造成什么。

人物模块拥有稳定目标、知识、信念和误解；事件只拥有这些状态怎样落实为本次行动的具体
预期。读者期待归叙述调度，世界规则允许的可能结果归潜在后果/条件关系，模型常识和作者
意图不能冒充事件预期。事后声称“早就知道”首先只证明人物作出该陈述。

### 4.11 Agency

Agency 不是主动/被动单标签或数值评分，而是一个按需出现的判别联合：

- `decision_mode`
- `initiation_context`
- `constraint_context`
- `epistemic_context`

这些是可分离但不保证完全正交的分析轴，可以并存。每条命题必须：

- 绑定具体主体的 participationClaim；
- 说明与本次行动有关的具体判断；
- 引用人物目标、知识、信念、关系压力、世界条件或 EventRelation；
- 不复制这些来源事实。

“回应先前事件”“执行命令”和“主动决定怎样回应”可以同时成立。客观选择空间与人物认知
中的选择空间必须分开。替代选项只有在文本明确提出、人物实际考虑，或局面直接支持且人物
当时知道、理解并能采取时才保存。认识条件必须指出具体相关信息，不能笼统写“信息不足”。

不为每个维度制造 unknown。若底层权威事实已经足以直接展示且没有新增事件级解释，只做
投影。集体 Agency 只在文本确实呈现共同决策主体时成立。

## 5. EventRelation

### 5.1 原子关系命题

EventRelation 自身是一条具有独立真值、证据、审查和生命周期的完整关系命题，不继续拆为
端点、方向、类型、条件和机制子资产。

- 宽关系与精细关系是不同强度和可证伪条件的命题；
- 宽关系必须有自身证据，不能因具体机制说不清就退回“可能有关”并确认；
- `condition` 可以确认，`necessary_condition` 保持 unresolved；
- 下游优先引用当前证据能够支持的最具体命题；
- 端点、方向、类型、成立条件、适用时间或核心机制实质改变时建立新命题；
- 只补证据或修正文案时可保留 ID 形成 revision；
- `refines / contradicts / alternative / supersedes` 属于七模块共享 Claim 关系协议，不是
  EventRelation 关系族；其中资产身份的拆分/合并/替换沿革仍由 `EntityLineageRecord` 单写；
- ID、证据、审查、revision 和历史由共享命题协议冻结。

### 5.2 判别联合和端点

EventRelation 按关系族使用有限判别联合，不依赖万能可选字段：

- `temporal`：事件间先于、同时、重叠、包含及其他必要时间关系；
- `causal_mechanism`：原因、条件和阻碍；
- `motive`：人物目的怎样解释行动；
- `potential_consequence`：条件性潜在后果怎样约束选择或发展；
- `outcome_comparison`：事件级预期与实际结果之间的兑现、部分兑现、失败或反向实现；V1
  受控子类型为 `realization`；
- `structural_containment`：事件层级包含；V1 的受控子类型为 `part_of`。
- `noncausal_association`：只有在“存在可审查联系、但该联系不是因果”本身有独立证据和
  下游价值时使用；时间相邻仍优先由 `temporal` 表达。

关系族语义端点矩阵：

| 关系族 | 来源端点 | 目标端点 | 方向/限制 |
| --- | --- | --- | --- |
| `temporal` | StoryEvent | StoryEvent | 先于/包含有方向；同时/重叠语义对称 |
| `motive` | 合格人物目标或动机命题 | 行动 StoryEvent | 只解释为何行动，不复制人物命题 |
| `causal_mechanism` | StoryEvent、directResultClaim 或合格领域状态命题 | StoryEvent、directResultClaim 或合格领域状态转变命题 | 原因/条件/阻碍保留来源—目标；领域状态仍由其模块单写 |
| `potential_consequence` | 有证据的事件、规则、状态或条件引用 | 关系内部的条件性结果命题 | 整体由该 EventRelation 单写，不得冒充已发生结果或第五类资产 |
| `outcome_comparison / realization` | expectedOutcomeClaim | directResultClaim、后续 StoryEvent 或合格领域状态转变命题 | 只比较明确预期和实际结果 |
| `structural_containment / part_of` | 子 StoryEvent | 父 StoryEvent | 有向无环结构包含 |
| `noncausal_association` | 合格事件/结果命题 | 合格事件/结果命题 | 必须明确支持“有关但非因果” |

若证据只支持“存在某种合格联系”但关系族尚不能判断，可以保留带证据的
`relation_type_unresolved` 候选/未决命题；若连是否存在联系都未知，不创建 EventRelation。

`potential_consequence` 的条件性结果命题是该 EventRelation 的不可分语义组成，没有独立
ClaimRef、review、revision 或生命周期；下游引用整条关系。若该可能结果后来需要独立审查、
复用或实际发生，必须路由到既有所有者：发生假说进入 StoryEvent，人物预期进入
expectedOutcomeClaim，领域状态及其转变进入人物/关系/世界模块；不得把内部结果组件提升成
隐形第五类故事情节资产。

`structural_containment / part_of` 是完整、可取证、可审查的结构关系命题，而不是因果关系：

- 端点必须是两个准入结构化 StoryEvent；
- 方向固定为子事件指向父事件；
- 关系自身必须说明整体—部分语义并拥有证据或合格依赖，不能仅凭名称相似建立；
- 自引用、重复边、层级环和同义/矛盾父级归属必须失败；
- 合法多父归属允许保留，但投影、统计和回顾必须按声明粒度去重。

`causal_mechanism` 的基础机制子类型只包含：

- cause；
- condition；
- obstacle。

`motive`、`noncausal_association` 是独立关系族；`relation_type_unresolved` 是认识/审查
状态，不是机制子类型。

只有细分会改变理解、因果审查或后续原创时，才细分必要/促成、延迟/增加代价/阻止、
时间相邻/巧合等。不得使用 1–5 强度评分。

联合来源与竞争解释必须分开：

- A 与 B 共同导致 C：一个联合来源命题；
- 可能 A 导致 C，也可能 B 导致 C：两个独立命题及竞争组；
- M1、M2 只有不能同时成立时才互斥，否则可以并存或联合。

同时、重叠等对称关系规范排序端点，但没有虚假作用方向。因果和条件关系保留来源—目标。

### 5.3 推断因果

受治理的分析因果可以 confirmed，但审查状态和认识身份永远分离：

- `confirmed + analysis_inference` 不升级成文本明确事实；
- 内部 `confirmed` 只表示该推断通过当前审查门禁；前台、导出和普通用户文案必须继续显示
  “受支持解释”“已接受推断”或“未决解释”，不得显示为“已确认事实”；
- 关系跨 Scope 保持稳定身份；
- Scope 只记录发现/审查上下文，不是因果成立范围；
- 成立范围由故事时间、世界规则和适用条件决定；
- 全部关键前提必须通过锚点或合格依赖回溯原文；
- 只记录会实质改变判断且有证据支持的竞争解释；
- 反事实检验可以支持，不能独自证明实际因果；
- 人物主观归因与事实因果分别保存。

### 5.4 风险与赌注

风险和赌注不建立两套资产，统一为条件性潜在后果命题：

- 触发条件；
- 可能结果；
- 受影响对象；
- 来源身份；
- 怎样约束选择或 Plotline。

只记录文本建立、人物实际考虑，或规则/因果能够支持且影响选择、Plotline 或理解的后果。
禁止模型穷举抽象可能性或评分。后来实现、部分实现、反转或避免时另建实际事件并关联，保留
原预测历史。

### 5.5 单写者

人物目标解释行动、压力影响选择、领域状态变化和事件间因果若已成为正式 EventRelation，
StoryEvent 只引用或反向展示，不保存第二份可独立修改结论。一个 relation 已确认不自动
确认端点命题；端点变化沿实际依赖使关系 stale。

## 6. Plotline

### 6.1 本体与正式准入

Plotline 是文本已经建立，或由多个合格事件/结果支持的、可持续追踪的发展对象。它不引用
不可知的作者计划，也不因分析者预测“以后可能会写”而成立。

拆解侧正式准入简化为两种模式：

1. 单次强前向建立：一个事件明确建立持续承诺、义务、威胁或待处理结果；
2. 多记录持续发展：多个合格发展记录围绕同一对象形成可辨认的发展、阻碍或变化。

文本明确、分析归纳、混合、依据不确定是独立建立来源轴，不是第三条准入路径。普通目标、
秘密、话题、人物/地点标签、出现频率和 unresolved 内容本身不能证明 Plotline。

分析归纳的 Plotline 可以在当前生命周期无法确定时获得稳定身份，用于跨 Scope 合并证据，
但必须保留分析归纳和 unresolved 资格。

最小合法包：

- 一个活动的可持续发展对象命题；
- 独立建立来源轴；
- 一个由 PlotlineLifecycleRecord 单写的初始 `open` 记录；
- 单次强前向模式引用一个具有独立准入基础的开启事件；或多记录模式引用至少两条由独立
  准入事件/结果支撑的 PlotlineDevelopmentRecord；
- 满足两种准入模式之一且不存在循环自证的支持组合。

### 6.2 领域状态边界

“人物放弃道德底线”只有被多个事件实际组织为持续发展时才是 Plotline；否则归人物塑造。
城市秩序等世界状态仍由世界设定单写，Plotline 只解释事件怎样推动该发展。

同一发展对象跨 Story segment、卷和全书使用一个 Plotline 身份。目标、参与者、策略、
认识、阶段或 Scope 变化不自动创建新线。出现能够独立发展、暂停和闭合的新对象时，从相应
事件另开新线；旧线可以同时继续。

### 6.3 DevelopmentRecord

事件—情节线作用由 PlotlineDevelopmentRecord 唯一拥有。StoryEvent 不保存第二份可修改
归属，只通过反向索引展示。

- 一条记录可以联合引用多个事件、EventRelation 和合格领域变化；
- 同一来源对同一 Plotline 可以形成多个可独立审查的作用命题；
- 记录只拥有“这些来源相对于该发展对象意味着什么”；
- 不复制事件行动、直接结果、人物目标、关系状态或世界状态；
- Plotline 根不嵌入第二份可修改记录。

Base 发展作用：

- `develops`
- `maintains`
- `obstructs`
- `turns`
- `decides`

`complicates` 不是 Base 角色。所谓复杂化必须还原为发展、阻碍、转向、新 Plotline 或
PlotlineRelationClaim；无具体变化内容的“剧情更复杂”不得建立命题。

#### develops

表示问题状态、信息条件、行动条件、结果空间或后续路径发生具有后续意义的变化，不表示更
接近成功。失败、误判暴露、威胁升级和假说空间扩大都可能成立。

#### maintains

必须存在正在发生的压力、趋势或预期变化，并且事件通过具体机制保护原状态。普通静止、
没有进展或某 Scope 没写到不成立。同一事件相对一条线可以维持，相对另一条线可以阻碍。

#### obstructs

必须增加具体困难、代价、延迟、限制或减少可行选择。障碍机制由 EventRelation 单写，
DevelopmentRecord 只拥有相对该线的作用解释。

#### turns

仍追踪同一发展对象，但策略、主要条件、关键认识或可行路径持续改变。短暂偏离、局部插曲
和普通变化不成立。产生独立发展对象时应新开 Plotline。

#### decides

`decides` 只回答结果空间何时实质收窄；该发展对象是否仍需追踪由 LifecycleRecord 单写。

- 决定可以早于闭合；
- 决定绑定当前 sourceTextEdition 文本前沿；
- 后续重新打开真实结果空间时进入 stale/修正；
- 人物认为胜负已定归人物认识，叙述制造胜负感归叙述调度；
- 只检查文本、世界规则、现有条件和人物可采取选择支持的重大结果；
- 复合对象必须说明决定了哪个方面；
- 多个方面长期独立推进时应复核 Plotline 拆分；
- 新发展对象出现不自动关闭旧线。

### 6.4 LifecycleRecord

PlotlineLifecycleRecord 是 `open / paused / closed` 变化的唯一写入者。它引用触发事件、
EventRelation 或 DevelopmentRecord，但 DevelopmentRecord 不再重复写 `opens`、
`triggers_pause`、`triggers_resume`、`reopens` 或 `closes`。

当前生命周期投影只有：

- `open`
- `paused`
- `closed`
- `unresolved`

`unresolved` 只能是投影结果，不能成为 LifecycleRecord 主动写入的目标状态。真实变化只在
`open / paused / closed` 之间发生。

LifecycleRecord 的受控变化：

- `opens`：建立可持续发展对象；
- `pauses`：有合格事实证明发展暂时停止或明确等待条件，且原对象仍需追踪；
- `resumes`：必须引用既有暂停记录；无暂停记录的再次发展只建立 `develops`；
- `reopens`：`closed -> open`，必须证明仍是同一发展对象；
- `closes`：该发展对象不再需要追踪，可以引用单一触发事件或多条发展记录。

Scope 无记录、人物未出场、叙述切换或尚未读取后文不构成暂停。旧结果引出新问题时建立新
Plotline 及承接关系，不能重开旧线。不增加 `dormant` Base 状态。

`open` 表示发展对象已成立、尚未闭合且没有暂停证据；不表示当前 Scope 正在发展或叙述
正在展示。当前状态必须从 LifecycleRecord 投影，不能在 Plotline 根独立修改。

关闭原因独立记录，例如：

- `resolved`
- `failed`
- `abandoned`
- `made_moot`
- `merged_into`

关闭原因不自动决定状态。人物放弃但问题仍持续、失败后继续尝试、汇合后来源线仍能独立
发展，都不必然 closed。暂停/恢复记录故事时间顺序无法确认时，当前投影为 unresolved。

### 6.5 Scope 主导性

真正需要保存的是 Plotline 在特定 Scope 是否属于主导发展，不建立永久主导标签或
“主导/并行/支持”必填单选。

判断问题：

> 删除这条线后，是否仍能解释当前 Scope 最关键的局面变化和结果？

删除测试必须与以下证据共同使用，不能用尚未定义的“关键”循环证明“主导”：

- 该线是否组织当前 Scope 的进入局面与离开局面；
- 当前 Scope 的关键结果是否需要该线才能解释；
- 其他重要发展是否向它汇聚，或持续受它约束；
- 已确认主角的行动是否持续参与该线；
- 文本篇幅和突出程度只能作为辅助证据，不能单独决定主导性。

一个 Scope 可以有一条、多条或无法确认主导线。局部 Scope 可以没有主导线。全书存在
已确认主角时必须交代主角与主导线的关系：

- 文本支持时识别主角中心主导线；
- 证据不足时 unresolved；
- 文本明确将主角置于观察者、承受者或去中心位置时，合法记录未发现；
- 不强造主角中心事实。

Scope 主导性只有需要独立审查、引用或多个下游复用时才物化；默认故事回顾的选材已经表达
该用途下的保留判断。

## 7. PlotlineRelationClaim 与技术沿革

### 7.1 两类谱系必须分开

- `PlotlineRelationClaim`：原作中分支、汇合、承接或跨线互动的文学分析命题；
- 共享 `EntityLineageRecord`：消歧、纠错、拆分、合并和替换产生的数据身份沿革。

两者不能使用同一记录。`PlotlineRelationClaim` 是故事情节模块单写的独立结构化资产，不归
任一端点 Plotline 聚合；各页面只反向投影。

### 7.2 原作关系基数

- 分支：恰好一个来源，至少一个新目标；
- 来源线继续并产生一条或多条新线，属于分支；
- 来源线结束并产生多条新线，属于分支；
- 汇合：至少两个来源共同形成恰好一个新发展对象；
- 汇合不能拆成两两关系丢失共同语义；
- 承接：来源线结束，恰好一个新对象继承旧线结果；
- 同一发展对象跨卷或阶段延续不建立关系；
- 共享事件、交叉或交替呈现本身不等于汇合。

约束：

- 禁止自引用和重复端点；
- 分支、汇合和承接按故事发展先后形成有向无环语义谱系；
- 跨线互动允许相互影响，但双向作用分别取证；
- 身份谱系和发展互动使用判别联合，不能一条命题同时冒充；
- 端点、方向、类型或组合逻辑变化时建立新命题。

跨线互动只允许引用底层事件、EventRelation 和 DevelopmentRecord 形成高层解释；依赖变化
后 stale，且不得反向成为事件因果的权威来源。

## 8. 证据规则

### 8.1 来源证明力

- 来源首先证明它实际呈现或声称的内容；
- 在叙述调度尚未提供冲突信息时，无不可靠标记、无实质冲突的直接叙述和叙述者概述，可以
  给予普通事件暂时工作资格；这不是最终可靠性确认；
- 一旦某项结论实际依赖叙述身份、聚焦边界、自由间接引语归属或可靠性判断，必须建立对
  叙述调度具体合格命题的语义依赖；不要求等待叙述模块整体完成；
- 人物报告、回忆和作品内文献首先确认“该来源作出陈述”；
- 只有独立印证、与可靠事实相容或作品赋予事实权威时，才进一步支持所述事件；
- 多个锚点不等于多个独立来源；
- 同一传闻被多人转述或同一文献反复引用仍可能是一条来源链；
- 叙述者、呈现方式和可靠性观察归叙述调度；
- 可靠性不能压成叙述者永久可信/不可信标签。

EvidenceAnchor 对具体命题表达：

- 支持；
- 反驳；
- 仅证明说法存在。

### 8.2 锚点与上下文

- 锚点是绑定 sourceTextEdition 的原文位置，不等于保存或展示摘录；
- 支持范围精确指出构成证据的文字；
- 上下文窗口只帮助理解指代、否定和语境，不自动取得相同证明力；
- “最小”按语义充分性，不按字符数截断；
- 推断的关键前提最终回溯到锚点或合格依赖；
- 模型解释本身不是证据；
- 重复或跨度过程使用代表性锚点时，记录检查范围和选择依据；
- 引用片段仍受原创引用预算约束。

### 8.3 Append-only continuation 与 revision

追加连载与旧文本修订必须分开：

- append-only 通过祖先/前缀未变校验后，旧 Anchor 继续具备当前版本资格；
- 不逐条重定位未变前缀；
- 新增范围进入待分析，当前覆盖前沿前移；
- 旧版本完成历史保留；
- 新文本只通过实际冲突、补充或高层依赖影响旧结论；
- 不把旧锚点全部 stale；
- 插入、替换、删除和移动旧文本继续执行重定位；
- 结构变化先判断范围引用，不自动断开原文 Anchor。

## 9. 完成语义

故事情节不使用一个含混“分析完成”状态。

### 9.1 当前版本覆盖完成

- 活动 structureEdition 已冻结；
- 分析覆盖到当前 sourceTextEdition 正文末尾；
- 每个必答 Story segment、卷和全书均已完成回顾关注面处置：有合格变化链时存在
  StandardStoryRecap；否则明确记录合法空结果、不适用、证据不足或 unresolved，而不创建
  空 Recap；
- 本次产生并纳入范围的候选均有带理由的处置。

开放连载可以在“作品尚未完结”时达到当前版本覆盖完成。追加正文后，旧版本完成历史保留，
新版本重新进入覆盖未完成，直到新增范围处理完毕。

### 9.2 命题审查与下游门禁

- confirmed 命题证据有效；
- unresolved、rejected 和高影响歧义保留证据、理由和下游影响；
- 模块覆盖完成不自动确认任何命题；
- 下游可用/发布门禁由覆盖、审查、stale、失败和消费者要求确定性计算；
- 调用者不得填写 `passed`；
- 全部拒绝或全部 unresolved 不能无理由伪造完成；
- 合法空结果不能与运行失败混淆。

## 10. MainType、ContentFocus 与自定义关注

### 10.1 MainType

七个 MainType 不为故事情节强制增加通用必答问题。MainType 主要表达舞台和世界范式，不能
保证每类都存在普遍情节结构。

“现代幻想必须检查现实/异能张力”“诸天无限必须检查副本闭环”等作品关注点不能伪装成
MainType 普遍规则。MainType/ContentFocus 一经确认永久冻结的产品规则与 Block 12 当前
可编辑/清空路径存在 P0 冲突，但本模块不夹带修复。

### 10.2 七个 ContentFocus 的故事情节切片

所有问题只重点检查既有事件、EventRelation 和 Plotline；允许未发现、不适用、证据不足
或 unresolved，不创建专属事实类型。

#### 恋爱炒股

1. 各候选关系通过哪些关键事件分别开启、发展、受阻、转向或退出？
2. 同一事件或选择怎样同时改变多方关系发展及后续行动空间？
3. 各候选关系分别获得什么实质发展、承诺与兑现，而非只有出场；只有满足 Plotline 准入
   时，才建立“关系相关 Plotline”。

关系状态仍由关系动力单写。

#### 英雄史诗

1. 个人选择、集体行动和大范围外部压力怎样形成相连的发展链？
2. 私人利害怎样转为共同体利害，共同体变化怎样反作用于个人行动？
3. 存在时，关键胜利、失败或牺牲怎样改变集体行动条件、整体局面和未决发展？

#### 能力规则

1. 已建立的能力效果、条件、限制、成本和信息差怎样成为成败机制？
2. 能力获得、掌握、失去、误用或代价怎样改变可行行动及 Plotline？
3. 解法或失败依赖哪些已建立条件，反制、组合或例外怎样改变实际结果？

能力定义归世界，人物持有状态归人物。

#### 种田运营

1. 文本呈现的资源、知识、劳动和经营选择怎样形成建设/生产结果并反馈下一阶段？
2. 瓶颈、失败、维护成本、取舍和分配怎样改变持续性与行动路径？
3. 利益相关者怎样加入、合作、抵制、受益或受损并形成新条件？

#### 群像

1. 已准入的人物相关 Plotline 怎样独立发展并通过共享事件/结果/条件交叉、分离或汇合？
2. 某人物的选择怎样改变其他人物的行动空间、Plotline 或结果？
3. 集体结果依赖哪些独立贡献；有证据时，群体决策、分工或冲突怎样形成单线无法解释的结果？

#### 事业

1. 文本呈现的专业过程怎样把知识、判断、资源和策略转化为行动与结果？
2. 同事、客户、竞争者、管理者和组织规则怎样提供条件或阻碍事业发展？
3. 事业结果怎样反馈职位、声誉、资源、责任和下一步选择？

#### 冒险探索

1. 探索目标、未知环境、待发现信息或待到达对象怎样组织行动？
2. 适用时，路线、资源、时间、环境和同行者条件怎样形成选择、阻碍和结果？
3. 发现、所得、损失或失败怎样改变能力、目标和方向并连接局部冒险与长期 Plotline？

这是七个 ContentFocus 在故事情节模块中的切片，不是完整 ContentFocus 方法论。其他模块仍须
分别拷打。质量、技巧和复用措辞归 Block 16。

### 10.3 组合

ordered ContentFocus 在运行前合成为一份有效模块方法：

- 所有附加问题共同读取 Base 规范资产；
- 同义问题合并并保留来源 Focus；
- Focus 不是独立运行或结果所有者；
- 顺序只决定配置快照、方法片段和展示优先级；
- 不产生事实覆盖权、真值优先级、所有权变化或调用拓扑；
- Schema、所有权或完成规则冲突时阻塞组合；
- 文学竞争解释保持竞争/unresolved，不阻塞整次分析。

### 10.4 本书特别关注

“本书特别关注”是独立跨 Block 产品需求：

- 只能追加问题；
- 必须遵守现有证据和所有权；
- 不能代替 ContentFocus；
- Block 17 负责路由/运行组合；
- Block 18 负责配置快照、依赖和重跑影响。

## 11. AI 候选、展示和纠错粒度

Block 14 冻结三种粒度，不冻结具体 UI：

1. 机器交换：临时候选骨架 + 原子命题；
2. 默认展示：事件卡、关系卡、Plotline 卡和故事回顾；
3. 纠错：点击卡片语义部位时携带不可见的候选句柄或命题定位。

AI 不得填写正式 ID、review、revision、CAS 或 `passed`。它可以使用批次临时句柄和输入中
已有规范引用，提出新建、匹配、修订、竞争、证据不足或不升级建议。

原子化是证据和纠错能力，不是用户审查负担：

- 普通且证据一致的子命题组合展示；
- 认识身份不同、证据不足、竞争解释、重要下游或用户展开时进入命题级审查；
- “确认整张卡”内部可以事务性作用于一组合格命题，但不制造事件级总确认；
- 有阻塞项时明确显示，不允许静默部分通过；
- 自由文本反馈无法唯一映射时先生成结构化修订 Diff，再由用户确认；
- 拆事件指向候选骨架；
- 情节线归属纠错指向 DevelopmentRecord；
- 回顾选材失真指向 Recap 或局部片段。

AI 候选输出、领域模型、持久化模型和 IPC 读取 DTO 是四层不同契约，不得由一个 Zod Schema
同时承担。

## 12. 生产简化门禁

Q1–Q47 是离线领域方法库、反例库、Schema 输入和验证来源，不是一次 Prompt，也不是要求
模型对每个 StoryEvent 逐项填写的运行清单。任何 Block 17 候选若直接拼接整份规则，生产
门禁必须失败。

### 12.1 三层责任

| 层 | 内容 | 运行责任 |
| --- | --- | --- |
| 领域方法 | 判断变化、选择、结果、连接、发展线、矛盾和证据 | AI 只接收当前模块、Scope 和命中条件所需的短关注卡 |
| 共享治理 | Evidence、版本、候选资格、审查、失效和完成语义 | 七模块定义一次；运行时使用短公共协议和服务端资格判断 |
| 工程约束 | ID、去重、循环、单写者、判别联合、Schema 和事务不变量 | 程序校验；不得要求 AI 用自然语言自证 |

### 12.2 故事情节六问运行骨架

1. 发生了什么值得追踪的变化？
2. 谁选择、行动或遭遇了什么，直接结果是什么？
3. 这些变化怎样连接？
4. 它们影响了哪些持续发展线？
5. 哪些内容矛盾、未决、不可靠或只是说法？
6. 支撑这些判断的最小充分证据在哪里？

六问是运行关注骨架，不是六个新资产类型。模型输出仍只能提出候选；所有正式 ID、审查、
revision、CAS、依赖资格和 `passed` 由系统负责。

### 12.3 条件触发表

| 深入项 | 触发条件 | 未触发时 |
| --- | --- | --- |
| Agency | 选择、受迫、误判、信息差或可行选项会改变情节理解 | 不逐事件检查四个 agency 轴 |
| Expected outcome | 文本明确计划/预测，或预期—实际落差、多主体预期、风险代价具有独立价值 | 不为显然结果创建预期命题 |
| 风险/赌注 | 条件性潜在后果实际约束选择、Plotline 或故事理解 | 不穷举模型想象的可能性 |
| 精细故事时间 | 时间关系影响因果、状态有效期、并行发展、连续性或叙述对照 | 只保留可确定投影或未知 |
| 事件层级 | 宏过程与子过程各有独立取证的整体/局部命题，且下游需要不同粒度 | 只保留单层 StoryEvent 或只读 EventGroup |
| PlotlineRelationClaim | 分支、汇合、承接或跨线互动具有独立解释、审查或下游价值 | 通过共享事件和投影展示，不制造关系资产 |
| 精细 EventRelation | 基础关系不足以解释因果、条件、阻碍或竞争机制 | 使用最少基础类别，不做完整逻辑考试 |
| unresolved occurrence | 事件真假需要持续合并证据，并已产生行动依据、悬念或其他独立情节作用 | 只保存叙述呈现或来源说法 |

条件触发不能退化为“每次先让模型完整检查八类规则”。生产配置仍需冻结触发选择器，但必须满足：

- 能由现有结构化事实、配置和确定性规则判断的触发，优先由程序判定；
- 首轮发现只允许提交带证据定位的触发候选，服务端校验通过后才进入对应的深层分析；
- 未触发的深入项不要求模型逐项输出“已检查但没有”，避免把完整规则库藏进前置自检；
- 本次实际启用的触发项进入运行计划和配置快照，但不是文学事实；
- 触发器的准确率、漏报和额外注意力成本必须进入 Block 17 对照验证。

“长卷只有一个Story segment”不属于领域异常或固定触发条件。若生产验证以后证明某个可测
长度/密度信号有助于发现漏切，只能作为生产配置中的候选复核启发式，并必须评估过度切段
误报；未验证前不得进入Base规则。

`StandardStoryRecap` 在规范事件和 Plotline 达到相应资格后单独综合，不与发现运行混成一次
调用。用户默认审查事件卡、关系卡、发展线卡和回顾；只有冲突、低证据、高影响依赖或主动
展开时进入命题级审查。

### 12.4 真实生产验证占位

本节只保留故事情节方法负载的四个实验 arm。跨模块架构对照、三类语料治理、长距离召回、
系统指标和分阶段准入统一由
`V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md` 管理，不在本模块复制第二份规则。

真实 AI 对照不在 Block 14 本轮执行。Block 17 形成最小可运行候选后、生产 Prompt 冻结前，
必须使用已授权的线性长篇、多线群像长篇和非线性/不可靠叙述长篇，对比三类正式实验组
和一个过载压力组：

1. 六问裸骨架；
2. 六问加经校验的条件触发，这是当前实际候选方案；
3. 六问加全部“与 AI 文学判断有关”的深层关注卡常驻，用来检验条件触发是否漏掉真实增益；
4. 原始 Q1–Q47 全文直接输入只作为极端过载压力测试，因为其中含有本应由程序执行的
   ID、CAS、UI、Schema 和单写者规则，不得作为主要质量对照。

因此生产验证共有四个实验 arm；前三个用于方案质量比较，第四个只测过载边界。

至少比较：

- 关键事件和发展线遗漏；
- 误报率和过度建模率；
- 重复资产、矛盾和身份漂移；
- EvidenceAnchor 定位准确率和 EventRelation 判断准确率；
- 跨卷连续性；
- 标准故事回顾忠实度；
- token、耗时和失败率；
- 当前人工评审者的裁决和纠错时间。

Block 17 尚无真实用户前台，只能测当前人工评审者时间；真实用户纠错时间必须等 Block 18
卡片化入口和精确纠错路径形成后再测。正式实验必须在运行前冻结盲审方案、验收阈值、同一
模型/版本、上下文、分批策略和生成参数；评审者不能知道样本来自哪个实验组。深层关注卡只有
在某类现象上证明具有明确增益时，才转为条件触发器；不得整体进入常规 Prompt。

token 和注意力预算必须同时覆盖六问 Base、ordered ContentFocus 附加问题、“本书特别关注”
问题、实际启用的条件触发及 Story segment/卷/全书回顾任务。不得只测裸六问后宣称生产预算
成立。KADOKAWA 等编辑材料仅作为特定编辑实践案例，不作为跨作品、跨类型的普遍规范依据。

## 13. 验证语料门禁

### 13.1 故事情节专属可观察 fixture

1. `plot-event-admission`
2. `plot-event-hierarchy-admission`
3. `plot-event-hierarchy-invariants`
4. `plot-meaningful-nonoccurrence`
5. `plot-occurrence-claims`
6. `plot-agency-choice`
7. `plot-relation-propositions`
8. `plot-relation-endpoints`
9. `plot-outcome-realization`
10. `plotline-admission-identity`
11. `plotline-admission-no-cycle`
12. `plotline-lifecycle-single-writer`
13. `plot-scope-dominance`
14. `plot-standard-recap`
15. `plot-recap-empty-disposition`
16. `plot-story-time`
17. `plot-spatial-placement`
18. `plotline-relation-claim`
19. `plot-claim-evidence`
20. `plot-risk-stage-comparison`
21. `plot-completion-coverage`

约束：

- `plot-event-hierarchy-admission` 只验证 EventGroup 与正式父事件的准入差异；
- `plot-event-hierarchy-invariants` 验证 `structural_containment / part_of`、合法多父、
  循环/重复/矛盾归属失败和按粒度去重；
- `plot-relation-endpoints` 参数化验证每个关系族的合法/非法端点；
- 其中必须覆盖“事件/结果 → 人物、关系或世界状态转变命题”和
  “expected outcome → 领域状态转变命题”，且不得复制领域状态；
- `plot-outcome-realization` 验证 expected outcome 与实际结果的比较不悬空；
- `plotline-lifecycle-single-writer` 必须让 Development/Lifecycle 双写冲突失败；
- `plot-recap-empty-disposition` 验证必答关注面可以完成而不创建空 Recap；
- 普通行为和计划只有缺少独立情节作用时才不建档；
- 传闻先验证信息事件，未决事件命题只在真假需持续审查时建立；
- 替代选择必须有文本/人物考虑/局面直接支持；
- 风险实现后另建实际事件并关联，不改写预测历史；
- 完成测试明确覆盖全部 Story segment、卷和全书必答范围；
- Scope 主导性测试服从最终主角条件规则；
- 不生成 PlotlineStage 或强度评分。

### 13.2 跨模块 fixture

- `plot-character-relationship-world-links`
- `plot-narrative-nonlinear-claims`

### 13.3 共享 fixture

共享规则只测一次：

- Schema version；
- Evidence；
- append-only/revision；
- review/CAS/history；
- selective stale；
- 伪造 `passed`；
- Overlay 组合。

七个 ContentFocus 使用参数化测试验证合法空结果、不创建专属事实和不覆盖 Base，不为每个
Focus 复制整套文学样本。`good / minimal / invalid / stale / no-evidence` 是分布在小 fixture
上的标签，不创建过载大包。

### 13.4 权威文档一致性门禁

- 本文是故事情节详细规范唯一事实源；
- D131 只记录决策、状态和本文链接；
- Product Design、Technical Design、Context、治理计划和 14-G1 只允许保留状态、四类规范
  资产、核心单写者摘要和本文链接，不得复制关系端点、Lifecycle枚举或Recap准入细则；
- 进入下一模块前必须执行并记录一次只读一致性检查，确认所有活动摘要状态均为
  `DOMAIN_SEMANTICS_CLOSED / PRODUCTION_CONFIGURATION_OPEN`，最新权威均指向当前决策/本文；
- 本轮只读检查必须确认活动规范中不存在 DevelopmentRecord 单写生命周期、每个必答Scope必建空Recap、
  `outcome_realization`无关系族、或作者计划决定Plotline等被撤销表述；
- 仓库目前没有自动检查器；把上述断言实现为文档lint/test属于后续独立工程任务。在实现前，
  不得把人工命令检查误写成“自动门禁已经存在”。

本次D131只读检查记录（2026-07-27）：

- 使用PowerShell文本断言与`rg`核对活动文档，不执行应用、AI或代码测试；
- Q1–Q47共47项，无缺号；
- causal/outcome端点均能引用领域状态转变命题，potential consequence无独立第五资产；
- 活动摘要均指向D131/本文，生产配置仍为OPEN，Q30仍为PROVISIONAL；
- 被撤销的“长卷单段低置信异常”“基础机制混合分类”“自动门禁已经存在”均无活动命中；
- 该记录是本轮人工命令证据，不代表仓库已经实现自动文档lint。

## 14. Q1–Q47 争议台账

| 问题 | 主题 | 最终状态 | 结论/覆盖关系 |
| --- | --- | --- | --- |
| Q1 | 模块根本任务 | CLOSED | 重建并解释故事世界变化过程；回顾是压缩表达，不是模块全部身份 |
| Q2 | 用户问题与顶层能力 | CLOSED | 发生、变化、连接、持续发展；不评价精彩/爽点 |
| Q3 | 资产/投影/综合分层 | CLOSED | 四类规范资产、确定性 Scope 投影、派生标准回顾 |
| Q4 | Story segment 产品定义 | CLOSED（窄补丁修订） | 用户冻结的活动分析分区；卷长/段数不构成领域异常，启发式只归生产配置 |
| Q5 | 连续、覆盖、跨章/跨卷 | CLOSED | 产品运行约束：连续无重叠全覆盖、可跨章、卷界硬切 |
| Q6 | Story segment 边界证据 | CLOSED | 发展中心与双侧检验；形式变化不是自动边界 |
| Q7 | 候选、冻结和版本影响 | CLOSED | 用户冻结一个活动版本；范围变化选择性影响 |
| Q8 | 事件语义角色与能动性 | CLOSED | 事件关注行动/结果/参与/时空/状态引用及主体选择语境 |
| Q9 | EventRelation 命题模型 | CLOSED（窄补丁修订） | 端点含领域状态转变；潜在后果无独立第五资产；机制子类型纯化 |
| Q10 | 准入结构化故事事件 | CLOSED | 产品保存门槛；独立情节作用；语义压缩优先 |
| Q11 | 事件层级 | CLOSED（D129契约补丁后） | 纯汇总为 EventGroup；父子通过 `structural_containment / part_of` 共存；父级只拥有独立宏观命题 |
| Q12 | 故事时间表达 | CLOSED | 有限时间约束和偏序，不补齐全时间线 |
| Q13 | 未确认发生命题 | CLOSED | 持续叙事作用可以获得稳定未决身份 |
| Q14 | 分析因果确认 | CLOSED | 内部可 confirmed 但永久保留 inference；前台显示受支持解释 |
| Q15 | 因果分类粒度 | CLOSED | 少量基础类别，按需细分，不做逻辑考试或评分 |
| Q16 | Plotline 准入 | SUPERSEDED | 旧 A/B/C 被 Q45 两种准入模式替换 |
| Q17 | Plotline 身份 | CLOSED | 身份跟随持续发展对象；新对象另开线 |
| Q18 | Scope 主导性 | CLOSED（重审修订） | 删除测试结合进入/离开、关键结果、汇聚约束和主角持续参与 |
| Q19 | 最小充分故事骨架 | CLOSED | 目的/Scope 相对选择；方法不是固定算法 |
| Q20 | 回顾版本 | CLOSED（重审修订） | 每必答 Scope 处置关注面；有合格变化链才创建 Recap，V1 至多一份 |
| Q21 | 人类回顾/续写简报 | CLOSED | 标准回顾保留；续写简报登记为跨模块下游能力（D125） |
| Q22 | 事件显著性 | CLOSED | 默认不物化、不评分；绑定 Scope/用途/证据 |
| Q23 | 命题级证据与审查 | CLOSED | 按事实所有权拆命题；无事件级总确认 |
| Q24 | 来源可信度 | CLOSED（重审修订） | 直接叙述仅获暂时工作资格；依赖身份/可靠性时引用叙述调度具体命题 |
| Q25 | 锚点充分性 | CLOSED | 最小语义充分支持范围与上下文分离 |
| Q26 | append-only 与 revision | CLOSED | 未变前缀继承资格；修订才重定位 |
| Q27 | 覆盖/审查/发布 | CLOSED（重审修订） | 三者分离；必答回顾关注面处置不等于制造空 Recap |
| Q28 | 冲突/压力等总复问 | WITHDRAWN | 已由前序问题关闭，不整体重开 |
| Q28-A | 风险/赌注 | CLOSED | 条件性潜在后果统一命题 |
| Q28-B | PlotlineStage/升级 | WITHDRAWN | 不建立阶段资产；比较发展记录，技法归 Block 16 |
| Q28-C | 高潮 | WITHDRAWN | 不建立 Base 高潮资产；Overlay 候选、Block 16 机制 |
| Q29 | 类型切换重跑 | WITHDRAWN | 确认后永久冻结；Block 12 冲突另行处理 |
| Q29-A | MainType 普遍情节问题 | CONTRADICTED | MainType 不保证增加情节关注问题 |
| Q29-B | MainType 示例规则 | WITHDRAWN | 改登记“本书特别关注”（D126） |
| Q29-C | ContentFocus 切片 | CLOSED（重审修订） | 恋爱 Focus 检查关系发展；达到准入才建立关系相关 Plotline |
| Q29-D | ordered Focus 组合 | CLOSED | 运行前组合，不改变所有权/真值/调用拓扑 |
| Q29-E | 七 Focus 精确措辞 | CLOSED | 完成归属检查；不夹带技法和质量评判 |
| Q30 | fixture 语料 | PROVISIONAL | 专属追踪矩阵已补缺；fixture实现、共享协议和真实长篇验证仍开放 |
| Q31 | 规范根与可寻址内容 | SUPERSEDED | “三根”被四类规范资产替换；稳定可寻址原则保留 |
| Q32 | StoryEvent 领域结构 | SUPERSEDED | 六组命题被 Q39 七组命题替换；一 Schema 承担四层被否决 |
| Q33 | EventRelation 原子性 | CLOSED（窄补丁修订） | 关系自身完整；状态转变可作目标；Claim关系不属于EventRelation |
| Q34 | Plotline 内部所有权 | CLOSED（重审修订） | Development不写生命周期；Lifecycle单写状态变化；跨线关系独立 |
| Q35 | StandardStoryRecap 片段 | CLOSED（重审修订） | 无变化链不建空Recap；已创建Recap片段无独立事实/审查生命周期 |
| Q36 | AI 候选与用户审查粒度 | CLOSED | 临时骨架+原子命题；默认对象卡；精确纠错 |
| Q37 | 发生竞争与事件身份 | CLOSED（重审修订） | 否定是反驳；有期待/条件且缺席产生独立结果的未发生可结构化 |
| Q38 | Participation | CLOSED | 事件+实体+角色+事件内适用范围 |
| Q39 | Spatial placement | CLOSED | 成为独立第七组命题 |
| Q40 | Story time Schema 语义 | CLOSED | 有限判别联合、框架和关系单写 |
| Q41 | Direct result | CLOSED（窄补丁修订） | direct result与领域状态分离；二者均可作合格关系目标 |
| Q42 | Expected outcome | CLOSED | 高价值按需命题；意图/预测分开 |
| Q43 | Agency 判别联合 | CLOSED | 四类可分离分析轴，主体绑定，按需出现 |
| Q44 | StoryEvent Admission Bundle | CLOSED（重审修订） | occurrence+独立非循环情节作用；互引对象不能循环自证 |
| Q45 | Plotline Admission Bundle | CLOSED（重审修订） | 文本建立/多记录支持；两种模式均须非循环基础 |
| Q46 | Plotline 发展角色 | CLOSED（重审修订） | 只含develops/maintains/obstructs/turns/decides；生命周期作用移出 |
| Q47 | Plotline 生命周期 | CLOSED（重审修订） | LifecycleRecord单写opens/pauses/resumes/reopens/closes及状态投影 |

Q47 后“章节是否默认生成回顾”的追问为 `DUPLICATE / ALREADY_CLOSED`，不产生新裁决：
章节默认只有 Scope 投影，符合已冻结例外时才建立持久化章级派生回顾。

## 15. CONTRADICTED / WITHDRAWN / SUPERSEDED 汇总

### CONTRADICTED

- 任何动作都进入结构化故事事件资产；
- 只保存最终摘要选中的重要事件；
- 父事件与子事件复制同义行动和结果；
- 发生否定建立第二个 StoryEvent；
- 地点作为普通 participation；
- 一个统一 `occurredAt`；
- 时间和因果共用一条关系；
- EventRelation 拆成可分别确认的端点/类型/机制子资产；
- 宽关系自动继承精细关系确定性；
- Plotline 仅由“存在未决内容”成立；
- 目标、参与者、Scope 或阶段变化自动建立新 Plotline；
- `complicates`、`dormant`、PlotlineStage 和 Base 高潮作为通用资产；
- Scope 无事件自动暂停；
- 主导/并行/支持作为每条线必填单选；
- 回顾片段成为事实命题；
- AI 填正式 ID、confirmed、revision 或 passed；
- 用户必须逐条审查所有原子命题；
- MainType 示例强制变成普遍情节问题。

### WITHDRAWN

- Scope 情节综合作为 AI 资产及其物化范围问题；
- Q28 对已闭合冲突/压力/阻碍/代价/转折的整体重开；
- PlotlineStage/升级资产；
- Base 高潮字段或高潮资产；
- 类型切换后的事实重跑讨论；
- 七个 MainType 逐个强造情节问题；
- AI 上下文摘要作为 Block 14 默认产物。

### SUPERSEDED

- 五个平级内容资产 → 四类规范资产、Scope 投影、派生回顾；
- 三个规范根 → 四类规范资产；
- StoryEvent 六组命题 → 七组命题（增加 spatial placement）；
- “子事件准入后父事件只能是 EventGroup” → 父级拥有可独立取证的宏观事件命题时，允许
  通过 `structural_containment / part_of` 与子事件共存；纯汇总仍是 EventGroup；
- Plotline A/B/C 准入路径 → 两种证据模式 + 独立建立来源轴；
- `active` 生命周期 → `open`（未闭合且无暂停证据）；
- “推进”角色 → 中性 `develops`；
- PlotlineRelation 与技术合并/拆分沿革共用记录 → `PlotlineRelationClaim` 与共享
  `EntityLineageRecord` 分离。

## 16. 明确未冻结

以下事项不因故事情节领域语义关闭而获得实现授权：

- `AddressableClaim<T>` 或任何共享命题包络；
- 正式 ID、ClaimRef、竞争组、revision、review、CAS 和状态转换词表；
- EvidenceAnchor 身份、断链状态、引用预算及外部来源 Schema；
- AI 原始输出、经验证候选、领域模型、持久化模型和 IPC DTO 的具体结构；
- 事务、索引、反向索引、历史表和物理规范化方式；
- sourceTextEdition/structureEdition 的通用版本和 selective rebuild 算法；
- canonical module key、排序、migration 003 及 14-G1 兼容；
- Prompt、Block 17 调用拓扑、token 预算和真实 AI；
- 六问关注卡的具体 Prompt 表达、条件触发器阈值和真实长篇生产结果；
- Block 18 UI、持久化、Diff、命题级 stale 和发布门禁实现；
- 其他六模块的深度方法论；
- Block 12 确认后永久冻结冲突的修复。

## 17. 关闭门禁

故事情节 `DOMAIN_SEMANTICS_CLOSED` 只表示：

- 模块有限关注面和判断逻辑已经闭合；
- 单写者、Scope、Evidence、完成和下游边界可转为共享 Schema 输入；
- 规则 fixture 已形成可观察追踪矩阵；
- 不再以工程字段细节冒充用户产品问题。

它不表示：

- Block 14 完成；
- 14-G1 实现准入通过；
- deep Schema 或状态机冻结；
- Prompt/pipeline 可以开始；
- 真实 AI 分析、持久化、审查 UI 或导出已获准；
- 外部效度或真实长篇生产配置已经验证；
- 下一模块可以在本文档实现任务中顺带开始。

D131 关闭的是端点/所有权窄补丁后的领域语义，不恢复 D127 的完整 `CLOSED`。Q30 在 Block 17
真实生产验证前保持
`PROVISIONAL`。完成本文档、生产简化门禁、14-G1 影响评估和权威摘要同步后必须停止，等待
叙述调度模块单独进入 Plan Mode 拷打。
