# 产品迭代记录

本文件按时间追加，记录反馈理解、尝试次数和验证结果。它不是当前规格；当前有效结论同步到 `CURRENT_STATE.md`，明确认可的内容同步到 `APPROVED_BASELINE.md`。

## 规则

- 每次针对已有实现的反馈至少追加一条记录。
- 同一用户目标和可观察问题共享尝试计数。
- 约第 3 次仍未解决时，停止继续 Patch，转入根因分析。
- 记录真实验证结果，不把“已修改”写成“已解决”。

## 记录模板

### `YYYY-MM-DD`｜`问题标题`

- 反馈等级：`LEVEL A / LEVEL B / LEVEL C`
- 目标/问题：`用户想完成什么，当前哪里不对`
- 当前状态依据：`CURRENT_STATE 中的相关段落`
- 基线影响：`无 / 受保护区域 / 需要明确确认`
- 本次尝试次数：`1 / 2 / 3 / 根因分析`
- 实际改动：`待填写`
- 验证方式：`构建、测试、浏览器路径、截图、手工检查等`
- 结果：`已解决 / 部分解决 / 未解决`
- 未解决原因或根因假设：`待填写`
- 下一步决策：`继续最小修复 / 结构调整 / 停止并请求方向确认`
- 相关任务/文件：`待填写`

## 历史记录

### `2026-10-28`｜免 Key 竞彩来源核验与发布门槛

- 反馈等级：`LEVEL B`（上游数据接入/产品内容边界）。
- 目标/问题：用户无法取得服务商 API Key，要求改用公开页面抓取或成熟免费接口，打通足球、篮球赛事时间与赛果并上线。
- 当前状态依据：竞彩 UI 已本地实现；百查适配器依赖 `JINGCAI_PROVIDER_TOKEN`，当前无法取得真实数据。
- 基线影响：不改已确认彩票首页、导航与详情；遵守本产品仅展示赛事/赛果、不提供赔率的边界。
- 本次尝试次数：`免 Key 来源核验第 1 次`。
- 实际改动：用户明确要求只加入竞彩足球和竞彩篮球、排除指数/赔率及其他赛事。改核验大象比分：公开页标题及分组明确标记竞彩类型；只读请求确认四个公开页面可达，robots.txt 允许公开页面抓取并禁止 `/api/`。数据源方案改为只抓公开 HTML、按竞彩编号过滤、白名单抽取比赛基础字段。
- 验证方式：页面与规则：[竞彩足球赛程](https://www.dxvs.com/preview/football)、[竞彩篮球赛程](https://www.dxvs.com/preview/basketball)、[足球比分](https://www.dxvs.com/scores)、[篮球比分](https://www.dxvs.com/basketball)、[robots.txt](https://www.dxvs.com/robots.txt)。四页 HTTP 200；robots 允许 `/`，禁止 `/api/`。
- 结果：`免 Key 来源已找到且公开页面抓取符合 robots 规则；实现与 Preview 联调待完成；未发布`。
- 未解决原因或根因假设：页面是 SSR HTML；篮球比分结构横跨多行，需精确解析并确保赔率不进入结果。生产发布仍需审查未提交工作、整合最新 main 并验证 Cloudflare 授权。
- 下一步决策：实现公开 HTML 解析与竞彩白名单过滤，使用 fixtures 和真实公开页面验证；然后 Preview 联调、整合最新 main 并发布。
- 相关任务/文件：`TASK-20261017-01`、`PRODUCT_SPEC.md`、`docs/product/CURRENT_STATE.md`、`functions/api/jingcai.js`、`src/JingcaiSection.jsx`。

### `2026-10-28`｜采用 GitHub Actions 作为 Preview 开奖同步调度器

- 反馈等级：`LEVEL B`（服务端计划任务与访问控制调整）
- 目标/问题：Cloudflare 免费账户 Cron 触发器额度已满；用户确认授权改用 GitHub Actions，继续完成 Preview 自动追新。
- 当前状态依据：Preview D1、Pages 快照读取和独立 Worker 已部署；该轮本地 Worker 代码已增加 GitHub OIDC 校验。
- 基线影响：只面向 Preview；Production 和其他 Worker 不触碰。
- 本次尝试次数：`调度替代方案第 1 次`
- 实际改动：添加仅访问 `caiyan-lottery-sync-preview` 的 GitHub Actions 工作流；不使用长期共享密钥；Worker 验证签名、issuer、audience、仓库、默认分支、工作流路径和触发事件；保留 Worker 时间窗校验。工作流尚未写到远端，避免在认证版 Worker 部署前开始定时调用。
- 验证方式：Worker `node --check`、构建、`git diff --check` 和本地签名令牌模拟通过（匿名拒绝、限定令牌通过）；用户审阅同意 Wrangler 授权后，CLI 登录成功；Worker 部署版本 `0220a599-da40-46bd-ba99-4340eab2ae2d` 显示 100% 生效并绑定 Preview D1。匿名 HTTP 探测连接超时；GitHub 创建工作流 API 返回 403 `Resource not accessible by integration`。
- 结果：`Preview Worker 已部署；自动调度未启用`
- 未解决原因或根因假设：本机无法连接 Worker 对外端点；GitHub 连接器无权创建默认分支内容。未绕过连接器权限，也未以未验证状态启用工作流。
- 下一步决策：由用户恢复 GitHub 连接对目标仓库的 Contents 写入权限，或手动添加工作流；再通过 GitHub runner 验证 Worker 的健康、认证拒绝和 Preview D1 同步。
- 相关任务/文件：`TASK-20261028-latest-draw-snapshot.md`、`PROGRESS.md`、`.github/workflows/lottery-preview-sync.yml`、`worker-lottery-sync/index.js`、`worker-lottery-sync/wrangler.jsonc`。

### `2026-10-28`｜最新开奖快照 Preview 联调与 Cron 额度阻塞

- 反馈等级：`LEVEL B`
- 目标/问题：首页始终保留最新有效开奖，并在开奖窗口追新；取得有效新期开奖后停止重复抓取。
- 当前状态依据：`CURRENT_STATE.md` 与阶段 67；Preview D1、Pages、Worker 已实际配置。
- 基线影响：仅测试环境；Production D1 和正式发布均未改动。
- 本次尝试次数：`结构性方案第 1 次，Preview 联调`
- 实际改动：新建隔离 Preview D1 并应用迁移；官方播种 8 个彩种快照；修复福彩3D官方响应字段解析和排列5官方 gameNo；部署 Preview Pages 与绑定该 D1 的同步 Worker。
- 验证方式：构建及 diff 检查通过；8 个彩种官方抓取均标记 verified；部署后 8 个 Preview API 返回 200、snapshot/verified 为 true。Worker Cron 部署被 Cloudflare 拒绝，错误 10072：该账户免费计划已有 5 个 Cron 触发器。
- 结果：`快照首屏链路已在 Preview 验证；自动定时抓取未启用`
- 未解决原因或根因假设：账号 Cron 额度上限；不能在未授权的情况下删除/替换其他 Worker 触发器、升级计划或改动 GitHub。
- 下一步决策：等待用户选择现有 Cron Worker 合并/替换、授权采用 GitHub Actions，或自行升级 Cloudflare 计划；在获得授权前保持 Preview 快照读取，不触碰生产和其他项目。
- 相关任务/文件：`TASK-20261028-latest-draw-snapshot.md`、`PROGRESS.md`、`wrangler.jsonc`、`worker-lottery-sync/wrangler.jsonc`、`functions/_lib/lotterySources.js`。

### `2026-10-28`｜开奖首页常驻最近有效结果

- 反馈等级：`LEVEL B`（首页数据持久化与自动同步流程）。
- 目标/问题：任何时候都要显示最近一次有效开奖；开奖时段持续追查，确认新期号并保存后停止该彩种当日抓取。
- 当前状态依据：`CURRENT_STATE.md` 更新为服务端快照优先、客户端缓存兜底；`PRODUCT_SPEC.md` 增加了开奖窗口和验收标准。
- 基线影响：不改变首页卡片/导航；正式环境 D1 与 Worker 不得被此次测试修改。
- 本次尝试次数：`结构性方案第 1 次`。
- 实际改动：新增 D1 快照表、Pages API 快照优先读写、持久本地缓存兜底和隔离 Worker 定时同步草案。Worker 按北京时间 20:45—23:30 每两分钟运行，逐彩种停止已确认当日新期号的后续查询。
- 验证方式：构建、diff 检查、时间窗与快照/API 模拟检查、SQLite migration/UPSERT 语法检查均通过；尚未连接实际 Preview D1，也未做线上 Cron 触发验收。
- 结果：`实现部分完成，未部署`。
- 未解决原因或根因假设：项目现有 Pages 配置的 D1 ID 是单一绑定，不能确认 Preview 与 Production 隔离。没有单独 Preview D1 及初始快照种子时，无法证明“新用户首次进入任何时候都有数据”。
- 下一步决策：先提供独立 Preview D1 ID 并确认 Preview Pages 绑定指向该数据库，再迁移、播种八个彩种快照并部署/验收；不触碰 Production。
- 相关任务/文件：`TASK-20261028-latest-draw-snapshot.md`、`migrations/0005_lottery_latest.sql`、`functions/_lib/lotterySnapshot.js`、`functions/api/lottery.js`、`worker-lottery-sync/`、`src/data.js`。

### `2026-10-27`｜测试站首页加载慢

- 反馈等级：`LEVEL B`（首页请求与缓存状态调整）。
- 目标/问题：测试站接口部分彩种返回 400，其余冷请求约 3–8 秒；首页等全部请求结束才更新，1 分钟缓存过期后容易再次出现等待。
- 当前状态依据：`CURRENT_STATE.md` 首页展示及后台数据校准。
- 基线影响：不改首页卡片、导航和彩票数据定义；正式站未发布。
- 本次尝试次数：`1`。
- 实际改动：从当前正式主线建立隔离构建，修正测试环境前端/接口版本不一致；首页改为各彩种渐进呈现、本机缓存保留 24 小时，避免部分接口失败时用不完整结果覆盖旧缓存；焦点/可见性变化时去重和节流；服务端成功响应短时缓存，手动刷新绕过缓存。隔离构建排除了未发布的竞彩功能。
- 验证方式：构建通过；渐进回调与缓存命中测试通过；最终测试部署 `764cac31`；8 个接口复测均返回 200，缓存命中约 0.7–2 秒；上一轮浏览器游客首页显示全部 8 个彩种；最终部署别名加载 `index-DGsl5fRh.js`。最终轮浏览器已打开登录页，游客路径未再次逐项走查。
- 结果：`部分解决`，首次无缓存仍受上游影响，冷请求约 3–8 秒，快乐8曾短暂返回 502 后恢复。
- 下一步决策：用户验收测试版；若需进一步缩短首次访问，需增加可靠的持久数据快照/服务端定时预取并单独验证数据新鲜度。
- 相关任务/文件：`src/data.js`、`src/main.jsx`、`functions/api/lottery.js`、`PROGRESS.md`。

### `2026-10-17`｜新增竞彩足球/篮球赛事信息

- 反馈等级：`LEVEL B`
- 目标/问题：用户同意采用公开页面抓取，新增竞彩足球和竞彩篮球的比赛时间、赛果信息。
- 当前状态依据：`CURRENT_STATE.md` 已定义首页独立栏目、服务端抓取和缓存降级状态。
- 基线影响：不改变现有导航、开奖卡片或彩票数据结构。
- 本次尝试次数：`1`
- 实际改动：新增首页竞彩卡片（足球/篮球切换、日期选择、刷新、状态/比分、加载/空/错误和更新时间提示）；新增 Pages Function 抓取公开 JSON、字段标准化和 Cloudflare Cache API 缓存；新增赛果优先合并逻辑。根据公开实现样例，将足球赛果适配为 `getMatchResultV1.qry`，解析 `value.matchResult`、`allHomeTeam`/`allAwayTeam`、`sectionsNo999`；篮球仍使用相似路径推定，尚未有独立证据验证。
- 验证方式：`npm run build` 通过；`git diff --check` 通过；本地 fixture 验证足球/篮球标准化和比分解析（mock，不是上游实测）。官方页面多次超时；本地浏览器预览因沙箱禁止端口监听（EPERM）未能打开，Playwright CLI 启动超时。
- 结果：`部分解决`
- 未解决原因或根因假设：公开实现为非官方样例；官方页面与 API 在当前环境超时，足球字段有样例依据但没有 live response；篮球对应路径和字段仍属推定；Pages Function 线上缓存行为尚未实测。
- 下一步决策：需要在可访问 sporttery.cn 的 Pages 预览/运行环境验证两个运动项目的真实返回；若遇到 WAF 或访问限制则尊重限制，不做绕过；通过后再讨论发布。
- 相关任务/文件：`TASK-20261017-01`、`src/JingcaiSection.jsx`、`functions/api/jingcai.js`、`src/main.jsx`、`src/styles.css`。

### `2026-10-18`｜切换到已确认的授权竞彩数据服务

- 反馈等级：`LEVEL B`（数据源与服务端数据流调整）
- 目标/问题：竞彩网接口被访问限制拒绝；需要授权来源提供竞彩足球/竞彩篮球赛程赛果。
- 当前状态依据：`CURRENT_STATE.md` 已更新为百查数据授权 API；状态码枚举、费用和密钥尚未验证。
- 基线影响：不改变首页导航或栏目结构；数据来源标签改为接口实际返回的来源名称。
- 本次尝试次数：`数据源验证第 1 次`
- 实际改动：Pages Function 改用百查数据 `lotteryList` 与 `lotteryResultList`，按 `classify=1/2` 切换足球/篮球，读取服务端 secret `JINGCAI_PROVIDER_TOKEN`，只返回产品允许的赛程/赛果字段；UI 来源标签由响应动态填充。未知数值状态不猜测；移除推定的竞彩网 endpoint。
- 验证方式：`npm run build` 与 `git diff --check` 通过；足球/篮球模拟 fixture 通过，确认 `classify=1/2`、比赛关联/赛果比分合并正确、赔率未进入标准化响应，非法运动类型返回 400。接口文档已确认请求头、`data` 字段和分类参数；尚无商户密钥，尚未进行真实上游请求。
- 结果：`部分解决`
- 未解决原因或根因假设：需用户配置测试密钥并确认服务商费用、限额与生产授权；真实状态枚举/响应完整性仍待实测。
- 下一步决策：在预览环境配置服务端 secret 后做足球/篮球联调；成本与授权确认后再发布生产。
- 相关任务/文件：`TASK-20261017-01`、`functions/api/jingcai.js`、`src/JingcaiSection.jsx`、`PRODUCT_SPEC.md`、`docs/product/CURRENT_STATE.md`。

### `2026-10-28`｜公开竞彩 HTML 解析器接通

- 反馈等级：`LEVEL B`（数据来源和数据流变更）
- 目标/问题：用户无法取得收费服务商 Key，要求只接入竞彩足球与竞彩篮球；明确不显示指数/赔率，不加入其他赛事。
- 当前状态依据：`CURRENT_STATE.md`、`PRODUCT_SPEC.md` 和 `TASK-20261017-01`。
- 基线影响：保留既有首页栏目和足球/篮球切换；不改变开奖、导航或其他彩种。
- 本次尝试次数：公开来源核验后第 1 次实现。
- 实际改动：Pages Function 读取大象比分允许访问的公开 HTML 页，仅以“周赛日+竞彩编号”筛选记录，抽取编号、赛事、开赛时间、主客队、状态、比分及更新时间；不会抓取 `/api/`，赔率不进入缓存/API/UI。真实页面不支持日期参数，因此移除日期选择器，跨日场次显示月日。补充来源缓存、过期缓存回退和请求大小/超时限制。
- 验证方式：`npm run build`、`git diff --check`、`node --check` 通过；真实上游 HTML 的端到端 Function 调用足球/篮球均 HTTP 200，分别解析 17/14 场，响应白名单无赔率字段。独立 Pages Preview `24e5d4e5` 页面/API 均 200；浏览器确认足球/篮球切换、无赔率文案，390px 窄屏无横向溢出。纯 Vite 无 Pages Functions runtime，故仅用 Pages Preview 作最终联调。
- 结果：`已整合 main 并发布 Production`
- 发布证据：竞彩专属提交 `c6b924e` 快进推送至 GitHub `main`；Cloudflare Production 部署 `8653175c-14fa-4337-a123-2fd8777bd2ee` 已生成。正式域名 `/api/jingcai` 足球/篮球均 HTTP 200、17/14 场；响应字段无赔率；首页浏览器确认栏目展示和 390px 无溢出。
- 未解决事项：独立 Preview 游客首页的开奖列表区显示错误状态，超出竞彩改动范围；建议另立任务确认其是否为 Preview 环境差异。
- 下一步决策：监控公开来源页面结构和可用性；任何数据源变更均应保持竞彩编号白名单和赔率不进入响应的边界。
- 相关任务/文件：`TASK-20261017-01`、`functions/api/jingcai.js`、`src/JingcaiSection.jsx`、`src/styles.css`、`PROGRESS.md`。
