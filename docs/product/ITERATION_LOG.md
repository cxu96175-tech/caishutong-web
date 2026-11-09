# 产品迭代记录

本文件按时间追加，记录反馈理解、尝试次数和验证结果。它不是当前规格；当前有效结论同步到 `CURRENT_STATE.md`，明确认可的内容同步到 `APPROVED_BASELINE.md`。

## 规则

- 每次针对已有实现的反馈至少追加一条记录。
- 同一用户目标和可观察问题共享尝试计数。
- 约第 3 次仍未解决时，停止继续 Patch，转入根因分析。
- 记录真实验证结果，不把“已修改”写成“已解决”。

### `2026-11-09`｜生产刷新核对与双环境计划同步

- 反馈等级：`LEVEL B`（同步数据流、计划任务环境覆盖与生产发布）。
- 目标/问题：发布已修复的数字彩开奖内容，确保开奖窗口计划任务覆盖正式 D1，并从正式站实际核验最新快照；本轮明确不发布竞彩功能。
- 当前状态依据：生产开奖由 Pages `/api/lottery?fresh=1` 走可信来源同步；生产 Worker 已更新代码但 Cloudflare Cron 由于账户触发器配额已满而未绑定；现有 GitHub Actions 仅运行 Preview。
- 基线影响：不改数字彩 UI 目标及奖号数据契约；竞彩模块和接口不带入本次发布。
- 本次尝试次数：`1`（以生产真实请求为验收）。
- 实际改动：计划将开奖采集结果改为一次收集、分别同步 Preview 与 Production，避免生产环境只靠未配置的 Cloudflare Cron；福彩3D来源失败时用上海福彩公开历史页只核验期号/号码，不将地区销量冒充全国销量。生产 D1 新增快照迁移已执行，生产 Worker 代码已更新但 Cron 触发仍受账户额度限制。
- 验证方式：同步专项回归、生产构建、diff 检查；正式站 8 彩 API 读取及逐彩种 `fresh=1`；正式站自定义域名和 Worker 健康检查；Production GitHub Actions 计划执行证据。
- 结果：本次正式 Pages 部署已建立；福彩3D及其他多个彩种返回经校验的当前快照。逐彩种强制刷新中，已观察到部分上游 403/502、部分正常返回“无新期”；尚不能声称八彩强制刷新全数成功或计划任务已实际触发。其余类别需按实测结果补记。
- 未解决原因或根因假设：Cloudflare 账户 Cron 5 个名额已满；GitHub 当前工作流只触发 Preview。中国福彩网全国3D接口在 Worker 出网时 403，福彩3D回退仅提供号码，不提供全国销量；刷新接口保留已有数据并报告回退状态。
- 下一步决策：在修正后的工作流进入默认分支后，确认 GitHub Actions 的 schedule run 成功并核验 Production D1；手动刷新只在来源可信且新期号/同一期元数据可以安全核验时写库，否则保留上一有效快照。
- 相关任务/文件：`.github/workflows/lottery-preview-sync.yml`、`worker-lottery-sync/index.js`、`functions/api/lottery.js`、`functions/_lib/lotterySources.js`、`migrations/production/0008_lottery_latest.sql`。

### `2026-11-08`｜福彩3D详情销量来源纠正

- 反馈等级：`LEVEL B`（开奖元数据来源及持久快照纠正）。
- 目标/问题：详情截图中福彩3D 2026297显示销量193.8万元、奖池0元、一等奖`--`；其中销量与全国口径不符。
- 当前状态依据：`PRODUCT_SPEC.md`要求销量、奖池和奖级必须对应同一期同组号码，缺失信息显示`--`；`CURRENT_STATE.md`规定详情仅显示同期开奖元数据。
- 基线影响：仅修改后台来源筛选、同期开奖快照合并与回归测试；不改变UI，不影响其他彩种或竞彩。
- 本次尝试次数：`针对该截图第2次；完成刷新链路根因修复`。
- 根因：3D销量旧值来自地方HTML表格（本地fixture金额1,937,630元，正对应页面193.8万元）；全国福彩接口的同一期全国销量为96,507,570元。旧快照合并只补空值，已有错误地区销量不会被权威全国数据纠正；此外，手动刷新接口之前只在新期时报告更新，且同期开奖快照不替换已认证记录，导致用户刷新仍看到旧销量。奖池0与福彩3D不适用奖池的语义不匹配；一等奖`--`则是来源记录缺少同期开奖注数，不能从销量推导。
- 本次改动：从地区HTML配置中移除3D；只在期号和开奖号码完全一致且来源精确为国家级福彩接口时，允许更正3D既有销量；在同一权威来源下明确`poolApplicable=false`；扩展同期期奖级注数的安全补齐，并让Worker把实际发生的同期元数据更正记为`metadata-enriched`。同时将Pages手动刷新接入受限的同期元数据纠正；只有安全纠正确实写入时才报告`refreshStatus=updated`，否则仍按“无新期开奖”处理。
- 验证：`node scripts/test-lottery-preview-sync.mjs`通过，覆盖正式刷新接口复现旧地区销量并纠正到全国销量、非同一期/不同号码不允许覆盖、奖池不适用、缺失一等奖注数不伪造；`pnpm run build`通过；`git diff --check`通过。
- 结果：本地回归通过；测试站和正式站仍待线上核验。生产API之前读到D1仍为1,937,630元；由于工作区存在大量其他未提交改动，本轮未部署或修改Production D1。
- 下一步决策：在隔离本次修改后部署Preview，检查福彩3D API及详情页：全国销量、奖池“不适用”、一等奖注数若上游仍无则保持`--`；验收通过后再按发布授权进入正式站。
- 相关任务/文件：`tasks/TASK-20261108-fc3d-national-sales-correction.md`、`functions/_lib/ssqNotice.js`、`functions/_lib/lotterySnapshot.js`、`worker-lottery-sync/index.js`、`scripts/test-lottery-preview-sync.mjs`。

### `2026-11-08`｜福彩3D销量修复 Preview 环境安全核验

- 反馈等级：`LEVEL B`（测试环境数据流及部署目标核验）。
- 目标/问题：继续完成福彩3D同期元数据修复的 Preview API/详情验收，避免对正式数据产生写入。
- 根因/发现：Cloudflare Pages 的 Preview 设置页当前显示 `DB → caishutong-analytics` 正式 D1；仓库 `wrangler.jsonc` 则声明 Preview D1 为 `caishutong-lottery-preview`。两处配置不一致，Preview 手动 fresh 会调用持久化修正流程，不能在未厘清前触发。
- 实际处理：仅做只读核验；复跑同步回归、构建和 diff 检查均通过。没有部署，没有点击刷新，没有写入任何线上 D1。
- 结果：线上验收仍未完成；Cloudflare 控制台导航到预览 D1详情时读取超时。禁止以本地构建替代线上验收，也不把安全门未通过描述成已发布。
- 下一步：在 Cloudflare Pages Preview 设置中确认并修正绑定至独立预览 D1 后，部署本任务隔离提交并验证福彩3D API/详情页；Production 仍需单独发布授权。
- 相关任务/文件：`tasks/TASK-20261108-fc3d-national-sales-correction.md`、`wrangler.jsonc`。

## 记录模板

### `YYYY-MM-DD`｜`问题标题`

- 反馈等级：`LEVEL A / LEVEL B / LEV