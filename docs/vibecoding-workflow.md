**核心原则**
Codex 生产化不是靠“更会 prompt”，而是靠把工作拆成 5 个控制面：

1. **输入面**：任务怎么描述，哪些上下文给它。
2. **记忆面**：哪些规则沉淀到 `AGENTS.md`、docs、skills，而不是每次口头说。
3. **执行面**：什么时候用本地、worktree、新线程、subagent、automation。
4. **门禁面**：哪些行为必须被 sandbox、rules、hooks、人工确认拦住。
5. **验收面**：怎么证明它真的做完，而不是“看起来改了”。

**一、任务怎么喂给 Codex**

别说：

```
帮我做登录功能。
```

生产环境应该这样：

```
目标：实现邮箱验证码登录。

范围：
- 前端入口：src/pages/Login.tsx
- API：src/server/auth/*
- 不改数据库表结构，除非先说明原因

用户路径：
1. 用户输入邮箱
2. 点击发送验证码
3. 输入验证码
4. 登录后跳转 /dashboard

完成标准：
- 新增/更新测试
- npm run typecheck 通过
- npm test auth 通过
- 手动验证登录成功和验证码错误两条路径

先读相关文件，给我一个实现计划。计划确认前不要改代码。
```

真正有用的是：**目标、范围、用户路径、禁止项、完成标准**。
不是把需求说长，而是把“它怎么知道自己做完了”写清楚。

**二、上下文太长怎么拆**

不要把一整个产品塞进一个线程。生产里建议用这几个文件承载上下文：

```
docs/product/SPEC.md          产品目标、用户路径、边界
docs/product/FLOWS.md         关键流程
docs/engineering/CONTEXT.md   架构、模块职责、领域语言
docs/engineering/DECISIONS.md 已确认决策
docs/engineering/PITFALLS.md  踩坑和禁止项
docs/tasks/TASK-xxx.md        当前任务的范围、计划、验收
```

然后每个 Codex 线程只吃当前任务：

```
按 docs/tasks/TASK-123.md 执行。
必要时读取 docs/engineering/CONTEXT.md 和 docs/product/FLOWS.md。
不要读取无关历史任务。
每完成一个阶段先验证再继续。
```

上下文治理的重点是：**聊天记录不是产品文档**。
一旦需求变长，就让 Codex 先把需求固化成文件，再开新线程执行。

**三、新线程到底什么时候有用**

新线程不是为了“重新聊天”，是为了清掉噪声。

适合开新线程：

- 需求已经整理成 `SPEC.md` / `TASK.md`，准备干净执行。
- Codex 连续两三轮改不对，旧上下文已经污染。
- 从探索阶段切到实现阶段。
- 从实现阶段切到 review 阶段。
- 换一个完全不同任务。

适合 fork：

- 当前任务没结束，但你想试另一种技术方案。
- 例如：一个线程试 Zustand，一个线程试 TanStack Query。

适合 side conversation：

- 你只是问“现在状态是什么”“这个文件是干嘛的”。
- 不想把主线程执行上下文打乱。

适合 `/compact`：

- 任务还没结束，但上下文快满。
- 你希望保留主线，不想开新线程。

生产建议：**探索、方案、实现、验收、复盘，尽量别全塞一个线程。**

**四、subagent 怎么真正用**

subagent 不是“多几个 AI 帮忙写代码”。
生产里最稳的用法是：**读、查、审、总结并行；写代码集中到主线程或单一执行 agent。**

好用场景：

```
用 4 个 subagent 并行审查当前分支：
1. 安全风险：权限、注入、敏感信息、越权
2. 测试缺口：缺哪些单测/集成测试
3. 架构风险：模块边界、重复逻辑、隐藏耦合
4. UI/产品路径：用户能否从入口完成任务

要求：
- subagent 只读，不改文件
- 每个 finding 必须带文件路径和理由
- 等全部返回后，主线程汇总并按严重级排序
```

不建议：

```
开 5 个 subagent 同时实现这个功能。
```

这容易产生冲突、重复实现、风格不一致。
如果要并行写，必须按明确边界拆：比如一个只改后端 API，一个只改前端页面，一个只写测试，而且最后由主线程统一整合。

**五、真实门禁怎么设**

门禁不要只写“你必须小心”。分层做。

第一层：`AGENTS.md`，约束工作方式：

```
## Hard Gates

- 声称完成前必须运行相关验证命令并报告结果。
- UI 改动必须通过真实入口验证，不能只看组件。
- 生产数据、迁移、部署、删除、权限变更必须先停下请求人工确认。
- 连续两次修复失败后，必须停止继续改代码，先写最小复现或失败测试。
- 未看到用户引用的截图/设计稿/链接时，不得声称高保真符合。
```

第二层：rules，控制命令权限：

```
prefix_rule(
    pattern = ["npm", "test"],
    decision = "allow",
    justification = "Tests are safe and expected",
)

prefix_rule(
    pattern = ["git", "push"],
    decision = "prompt",
    justification = "Pushing changes requires review",
)

prefix_rule(
    pattern = ["gh", "pr", "merge"],
    decision = "forbidden",
    justification = "PR merges must be done manually after review",
)
```

第三层：hooks，做机械检查。适合：

- 用户 prompt 是否含密钥。
- Codex 要跑危险命令前拦截。
- 回合结束前检查是否声明了“通过”但没跑测试。
- subagent 停止时强制输出结构化 summary。
- compact 前把关键决策写进任务文件。

**六、生产里推荐的任务生命周期**

一个中等功能别让 Codex 一口气“从需求做到上线”。拆成这样：

1. **Clarify**：让它采访你，补齐用户、入口、成功状态、失败状态。
2. **Spec**：产出 `TASK-xxx.md`，包括范围、文件、验收。
3. **Plan**：让它读代码后给实现计划，不改代码。
4. **Red**：先补失败测试或最小复现。
5. **Implement**：只做一个可验收增量。
6. **Verify**：运行测试、类型检查、真实入口验证。
7. **Review**：让 Codex 用 code review 视角查 diff。
8. **Retrospective**：把踩坑写回 `AGENTS.md` / `PITFALLS.md` / skill。

关键点：**每轮只推进一个可验证增量**。
不要让 Codex 累积 20 个文件大改，最后才发现方向错了。

**七、什么时候做成 Skill**

如果你发现自己反复说同一套话，就做 skill。

适合做 skill 的东西：

- UI 高保真验收流程
- PR review 流程
- 发布前检查
- 数据迁移门禁
- 线上 bug 诊断流程
- Figma 到代码流程
- 安全审计流程
- 长任务交接/handoff 流程

`AGENTS.md` 是规则，skill 是流程。
比如“每次 UI 改动都要截图、对照、列差异、再修”这种就很适合 skill。

**八、MCP/插件怎么用得像生产系统**

MCP 不要为了“多工具”而装。只接能提供真实证据源的东西：

- GitHub：PR、issue、review comments。
- Sentry：线上错误和 stack trace。
- Figma：真实设计稿。
- Playwright/Chrome：真实浏览器验证。
- Docs MCP/Context7：最新库文档。
- Slack/Linear/Notion：需求和反馈来源。

原则：**凡是会变的事实，不靠模型记忆，靠 MCP/connector 读源头。**

**九、失败时不要继续硬 prompt**

Codex 做不到时，别一直说“再改好点”。按这个流程：

```
停止继续实现。
请你：
1. 总结当前失败现象
2. 列出你尝试过的改法
3. 找出最小复现路径
4. 写一个失败测试或可观察断言
5. 只修复这个断言
6. 修完后运行验证
```

如果还失败，开新线程，带这段：

```
旧线程失败总结：
- 目标：
- 已尝试：
- 失败现象：
- 正确约束：
- 当前相关文件：
- 不要重复的错误路线：
请重新诊断，不要直接套旧实现。
```

**十、一个可直接套用的“生产 prompt 模板”**

```
你现在是这个仓库的执行 agent。

目标：
[一句话目标]

业务背景：
[用户是谁、入口在哪、成功状态是什么]

范围：
- 可改：
- 不可改：
- 重点文件：

约束：
- 不引入新依赖，除非先说明必要性
- 不做无关重构
- 不改公开 API，除非先列兼容方案
- 不碰生产数据/密钥/部署

工作方式：
1. 先读相关代码和文档
2. 给计划，不改代码
3. 每次只实现一个可验证增量
4. 修改后运行最小相关验证
5. 最后 review diff，列风险和剩余问题

完成标准：
- [测试命令]
- [用户路径验证]
- [截图/日志/输出证据]
```

**十一、我建议你的 Codex 配置心法**

- 默认 `workspace-write`，别长期 full access。
- 高风险项目禁止自动网络和危险命令。
- `.env`、密钥、生产配置默认 deny。
- `git push`、部署、迁移、批量删除默认 prompt 或 forbidden。
- 常规测试、lint、typecheck 可以 allow。
- 所有“声称完成”必须有验证证据。
- 长任务必须落地 `TASK.md`，不要只留在线程里。
- 子工作体默认只读，除非明确隔离 worktree。
- worktree 用来隔离实现，不是复制项目版本。
- automation 只跑已经人工验证过 prompt 的稳定流程。

这套比“提示词技巧”更重要。真正生产可用的 Codex，不是让它一次变聪明，而是让它在边界、证据、上下文和验收上被系统性约束。官方依据来自 Codex manual 的 Prompting、Workflows、AGENTS.md、Rules、Hooks、Permissions、Worktrees、Subagents、Automations、MCP、Memories 章节。
