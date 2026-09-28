# 项目进度记录

> 用途：记录大阶段、当前上下文和恢复入口。每完成一个可验收阶段后更新一次；不要把临时想法替代为已完成状态。

## 当前快照

- 更新时间：2026-09-29
- 当前分支：以 `git branch --show-current` 为准
- 基线提交：`a5e4c5a Record integrated production release`
- 工作区状态：阶段 59 综合数据表样式调整已提交并发布；另有未跟踪的 `lottery-official-data-test` Worker 草稿，未发布。
- 当前版本：`package.json` 中为 `1.2.1`
- 当前阶段：阶段 59 — 综合数据表格字号与奖号列自适应
- 阶段状态：已发布，待用户验收

## 项目范围

这是“彩研通”彩票数据与走势图前端项目，包含：

- React/Vite 用户端界面
- 福彩、体彩及数字彩种的开奖、详情、历史、走势图和选号工具
- 指标状态趋势、遗漏走势、均线与图表交互
- 图片导出、水印和走势图展示
- 邮箱验证码登录、反馈提交与管理端 API
- Cloudflare Pages Functions、D1 迁移和管理接口

## 阶段记录

### 阶段 0 — 项目恢复记录（已完成）

- 已完成：创建 `PROGRESS.md`。
- 已确认：当前工作区在创建前干净，最近提交为 `fecc7fc`。
- 已确认：构建命令为 `pnpm run build`（也可使用 `npm run build`）。
- 验证结果：已检查项目入口、构建脚本、Git 分支/提交和工作区状态。
- 相关文件：`PROGRESS.md`、`package.json`。
- 相关提交：待随用户后续功能阶段一起提交。

### 阶段 1 — 导出图片顶部标题与参数（已完成）

- 目标：下载图片时在图片顶部增加图片名称和当前筛选参数。
- 完成内容：统一导出画布顶部标题；基础走势图记录期数、遗漏值、连号标记；冷热图记录分析期数和显示期数；快乐8图表记录视图名称和显示期数；保留原有底部白底水印。
- 相关文件：`src/main.jsx`。
- 验证结果：`pnpm run build` 通过，Vite 完成生产构建。
- 相关提交：待后续阶段统一提交。
- 待办/风险：本地逻辑尚未发布到用户端，线上验收需在部署后进行。

### 阶段 2 — 线上导出版本核对（已定位）

- 现象：用户端下载图片没有顶部名称和参数。
- 本地确认：`src/main.jsx` 已调用 `appendExportHeader`，本地构建产物引用 `index-BY_t6YPF.js`。
- 线上确认：`https://888888c.xyz/` 仍引用旧资源 `index-CEPKKK5Z.js`。
- 原因：顶部标题和参数的本地改动尚未提交/部署到用户端，线上仍运行旧版本。
- 本次处理：仅完成只读核对，未修改程序、未部署。
- 处理结果：确认需使用生产分支 `main` 部署，不能只部署到 `Preview / HEAD`。

### 阶段 3 — 生产域名部署与核对（已完成）

- 相关提交：`e53fb37 Add export image title and parameters`。
- 预览部署：`https://5af2c2d3.caishutong-web.pages.dev`（Preview / HEAD）。
- 生产部署：`https://4ecc6715.caishutong-web.pages.dev`（Production / main）。
- 用户端核对：`https://888888c.xyz/` 已引用新资源 `index-BY_t6YPF.js`。
- 结果：用户端已切换到包含导出图片顶部标题和参数的版本。

### 阶段 4 — （待定义）

- 目标：
- 完成内容：
- 验证结果：
- 相关提交：
- 待办/风险：

### 阶段 5 — 走势图与详情卡片标题图标清理（已完成）

- 目标：移除用户端所有走势图和详情页卡片标题前的图标，保留标题文字、筛选器和折叠交互。
- 完成内容：移除基础走势图、冷热图、快乐8数据图表、指标状态趋势、号码出现次数、历史开奖号码及详情页胆码冷热宝标题图标；清理对应未使用图标导入。
- 相关文件：`src/main.jsx`。
- 验证结果：`pnpm run build` 通过；生产部署后 `https://888888c.xyz/` 与 `https://534e11e8.caishutong-web.pages.dev/` 均引用 `assets/index-C3SC6W1-.js`。
- 相关提交：`4406ccf Remove trend card title icons`。
- 生产部署：`https://534e11e8.caishutong-web.pages.dev`（Production / main）。
- 结果：用户端正式域名已切换到移除走势图和详情卡片标题图标的版本。

### 阶段 6 — 历史开奖完整列表（已完成）

- 目标：从首页各彩种“历史开奖”入口进入后，直接展开并展示该彩种的全部历史开奖数据。
- 完成内容：历史开奖专用页面取消折叠、期数筛选和分页；打开页面后按彩种请求公开历史归档文本，并解析为完整期号、日期和开奖号码；保留每条历史记录点击进入对应详情页的能力；走势图内的历史开奖折叠卡片保持原交互。
- 相关文件：`functions/api/history.js`、`src/data.js`、`src/main.jsx`、`src/styles.css`。
- 数据来源：`data.17500.cn` 各彩种全量历史文本归档；首页仍使用现有轻量开奖接口，不增加首页首屏请求量。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；生产环境 8 个彩种接口均返回 HTTP 200，共 38,949 条记录（福彩3D 8,734、双色球 3,494、大乐透 2,914、排列3 7,701、排列5 7,701、7星彩 3,381、七乐彩 2,977、快乐8 2,047）。
- 相关提交：`0df1230 Add full historical draw archive`。
- 正式部署：Pages 部署别名 `https://81a4f706.caishutong-web.pages.dev`；生产分支别名 `https://head.caishutong-web.pages.dev`；用户端自定义域名 `https://888888c.xyz` 已验证返回本次构建资源。
- 待办/风险：数据源为公开第三方归档，页面继续保留“以官方开奖结果为准”的提示；如源站调整文本格式，需同步更新解析器。

### 阶段 7 — 管理员详情页导出（已完成）

- 目标：允许现有管理员账号在彩种详情页导出本期数据、指标状态和胆码冷热宝内容。
- 最新变更：详情页图标下方已移除彩种名称，仅保留期号与日期信息；用户已确认发布。
- 完成内容：详情页新增管理员专属“导出图片”按钮；导出内容保持详情页主体布局，按当前页面可视宽度适配，取消额外顶部标题/参数栏；原页面卡片去掉描边，分隔线只在导出克隆画布中临时添加；沿用白底水印和现有 PNG 下载流程；普通用户不显示入口；不改动 `/admin/` 统计与反馈页面。
- 相关文件：`src/main.jsx`、`src/styles.css`。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试地址 HTTP 200；导出逻辑复用现有 `html2canvas` 高清导出与水印能力。
- 相关提交：`f939505 Remove game name from detail hero`。
- 测试部署：`https://detail-export-test.caishutong-web.pages.dev`（Pages preview alias，2026-08-25，已更新详情导出布局、导出专属分隔线和详情页标题清理）。
- 测试验证：测试地址 HTTP 200；最新资源为 `assets/index-4PzFEdCM.js`，已包含详情导出逻辑；管理员详情页导出与标题清理已通过用户验收。
- 正式部署：`https://646e6118.caishutong-web.pages.dev`（Production / main）；`https://888888c.xyz` 已验证 HTTP 200 并引用 `assets/index-4PzFEdCM.js`。
- 待办/风险：无；如后续调整详情导出布局，需继续先发测试版再更新正式版。

### 阶段 8 — 浏览器标签页 Logo（已完成）

- 目标：将浏览器标签页默认地球图标替换为彩研通 Logo。
- 完成内容：在入口 HTML 使用圆形 SVG favicon，直接内嵌现有 Logo 缩略图，避免浏览器不加载 SVG 外部图片；不改动页面内 Logo、管理后台或业务功能。
- 相关文件：`index.html`、`public/caiyan-favicon.svg`、`dist/index.html`。
- 验证结果：`pnpm run build`、`git diff --check` 通过；测试版和生产页面 HTTP 200，生产 favicon SVG 返回 200 且内嵌 PNG 数据，无外部图片依赖。
- 测试部署：`https://detail-export-test.caishutong-web.pages.dev`（本次修复部署资源 `https://79b07b24.caishutong-web.pages.dev`，2026-08-26）。
- 正式部署：`https://888888c.xyz`（本次发布资源 `https://c546f533.caishutong-web.pages.dev`，2026-08-26；提交 `019e6b9`）。
- 待办/风险：浏览器可能缓存旧 favicon，验收时可使用硬刷新或新标签页确认；管理后台未改动。

### 阶段 9 — 基础走势图期数筛选与多视图（待验收）

- 目标：基础走势图默认显示最近50期，支持最近30/50/100/300/500期筛选，并补充截图所示的大小、奇偶、跨度、和值走势。
- 完成内容：基础走势图期数默认值调整为50；筛选项统一为30、50、100、300、500期；走势图展开后增加“基本走势、大小走势、奇偶走势、跨度走势、和值走势”切换；大小/奇偶按号码分区展示，跨度/和值提供逐期开奖指标表；走势页进入后按彩种加载完整历史数据，确保300/500期可用；导出按钮随当前视图导出并写入对应视图名称与期数参数。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；未部署，避免未经验收的界面直接覆盖用户端。
- 相关提交：待用户验收后提交。
- 测试部署：尚未部署；建议验收通过后先发布 Pages 测试别名，再切换正式域名。
- 待办/风险：需要在移动端与桌面端分别确认多视图表格密度、500期渲染性能和导出图片效果。

### 阶段 10 — 首页管理员一键导出（已发布，待验收）

- 目标：首页增加管理员专属“一键导出图片”，批量导出各彩种当前走势图和详情页图片。
- 完成内容：复用现有高清导出、水印、白底与命名参数规则；按彩种逐个加载完整历史数据，分别生成基础走势图和详情页 PNG；导出工作区采用透明离屏渲染，首页按钮和其他操作控件不会进入导出图片；非管理员不显示该入口，沿用现有管理员身份判断。
- 相关文件：`src/main.jsx`、`src/styles.css`、`dist/index.html`、`PROGRESS.md`。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；生产域名与 Pages 部署别名均返回 HTTP 200，线上资源已包含“一键导出图片”文案与批量导出逻辑。
- 相关提交：`7573771 Add admin batch image export`。
- 正式部署：`https://dc7b7249.caishutong-web.pages.dev`（Pages 部署别名，生产分支 `main`）；用户端 `https://888888c.xyz/` 已验证加载资源 `assets/index-Bi07ZYtC.js`。
- 测试部署：本次直接发布生产分支，未另建测试别名。
- 待办/风险：需在管理员账号、普通账号及移动端分别验证入口可见性、16张图片批量下载和浏览器下载拦截策略。

### 阶段 11 — 一键导出内容扩展（已发布，待验收）

- 目标：在首页管理员一键导出中补充无遗漏走势图、适用彩种冷热图，以及快乐8的两个数据图表。
- 完成内容：每个彩种继续导出带遗漏基础走势图、详情页图片，并新增一张隐藏遗漏值的基础走势图；双色球、 大乐透追加冷热图；快乐8分别追加基础矩阵图和综合数据查阅表；所有图片沿用高清、白底、水印、标题参数和命名规则，导出工作区不影响用户端页面。
- 相关文件：`src/main.jsx`、`PROGRESS.md`。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；生产域名与 Pages 部署别名均返回 HTTP 200，线上资源已包含“无遗漏”“冷热图”“基础矩阵图”“综合数据查阅表”等导出内容。
- 相关提交：`c5cdc74 Extend admin batch chart export`。
- 正式部署：`https://a2f95c8d.caishutong-web.pages.dev`（Pages 部署别名，生产分支 `main`）；用户端 `https://888888c.xyz/` 已验证加载资源 `assets/index-DYl79qOG.js`。
- 测试部署：本次直接发布生产分支，未另建测试别名。
- 待办/风险：预计全量导出 28 张图片；需确认管理员、普通用户权限差异，以及浏览器对连续下载的拦截策略。

### 阶段 12 — 用户端动效反馈与页面过渡（待验收）

- 目标：根据动效计划实现按钮反馈、页面过渡、列表进入和走势图彩种选择弹窗动画。
- 完成内容：补充用户端按钮按压缩放与键盘焦点反馈；为首页、历史开奖和我的方案列表加入按序进入动画；为页面/详情/走势图切换增加轻量页面进入过渡；为走势图彩种选择弹窗增加遮罩、面板入场与退出动画，并支持遮罩点击、关闭按钮和 Escape 关闭；统一提供 `prefers-reduced-motion` 降级方案。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试地址 HTTP 200，线上 CSS/JS 已包含按钮反馈、页面过渡、列表进入和弹窗动画。
- 相关提交：未提交。
- 测试部署：`https://detail-export-test.caishutong-web.pages.dev`（最新部署资源 `https://65f2fc7a.caishutong-web.pages.dev`，2026-09-02；此前资源 `https://f7565b2d.caishutong-web.pages.dev`）。
- 待办/风险：需在真实用户端确认不同页面切换、长列表进入节奏、弹窗退出时机以及减少动态效果设置下的可用性；不涉及管理后台。

### 阶段 13 — 大乐透派生走势参考图样式（待验收）

- 目标：将大乐透大小、奇偶、跨度、和值走势图调整为参考图的传统分区表格样式。
- 完成内容：大小/奇偶视图增加期号、星期、开奖号、分区号码、大小比、奇偶比、和值和跨度列；跨度视图增加跨度 01—34 分布网格及跨行走势线；和值视图增加前区和值区间、和值奇偶/振幅和前区和尾分布，并统一使用米黄色双层表头、交替行、分区色块与高亮标记；移动端保留横向滚动查看完整表格。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试地址 HTTP 200，线上资源已包含大乐透派生走势实现。
- 相关提交：未提交。
- 测试部署：`https://detail-export-test.caishutong-web.pages.dev`（本次部署资源 `https://65f2fc7a.caishutong-web.pages.dev`，2026-09-02）。
- 待办/风险：需确认参考图中的号码阈值、跨度/和值区间边界及长表导出时的显示密度；不涉及管理后台和其他彩种派生视图。

### 阶段 14 — 其他彩种派生走势统一（待验收）

- 目标：将阶段 13 的大小、奇偶、跨度和和值走势图表结构同步到双色球、福彩3D、快乐8、排列3、排列5、七乐彩和7星彩。
- 完成内容：非大乐透彩种的派生视图统一增加期号、星期、开奖号码、分组走势、统计指标列；大小/奇偶视图按各彩种玩法规则分组并高亮命中号码；跨度/和值视图补充对应指标及和值尾/和值参考列；号码区、蓝球/后区和多定位号码沿用各彩种已有数据结构，移动端保留横向滚动。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试地址 HTTP 200，线上资源已包含其他彩种派生走势实现。
- 相关提交：未提交。
- 测试部署：`https://detail-export-test.caishutong-web.pages.dev`（本次部署资源 `https://65f2fc7a.caishutong-web.pages.dev`，2026-09-02）。
- 待办/风险：需逐个彩种确认分组标题、大小阈值与跨度/和值展示密度；不涉及管理后台。

### 阶段 15 — 福彩3D/排列3传统派生走势样式（待验收）

- 目标：根据传统走势图参考图，补齐福彩3D与排列3的大小、奇偶、跨度、和值视图。
- 完成内容：大小/奇偶视图增加百位、十位、个位分类、形态分布和比例走势；跨度视图增加 0—9 跨度分布、跨度形态和振幅分布；和值视图增加 0—27 和值走势、和值尾走势及奇偶/012路/大小形态；统一米黄色多层表头、红/青/金色命中单元格和移动端横向滚动。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；生产、自定义域名和 HEAD 别名均返回 HTTP 200，并加载同一构建资源。
- 相关提交：未提交。
- 正式部署：`https://ae60ef20.caishutong-web.pages.dev`（Production / main）。
- HEAD 别名：`https://head.caishutong-web.pages.dev`（已同步本次构建）。
- 用户端：`https://888888c.xyz`（已验证与 HEAD 别名资源一致）。
- 待办/风险：需在福彩3D与排列3实际走势图页面核对形态命名、首行振幅为空值和长表导出密度；不涉及管理后台。

### 阶段 16 — 派生走势图视觉风格统一（待验收）

- 目标：让大小走势、奇偶走势、跨度走势与和值走势的页面视觉语言和基本走势保持一致。
- 完成内容：为所有派生视图增加统一容器；统一灰阶表头、浅色分隔线、斑马纹行、期号吸附列和横向滚动条；将通用大小/奇偶命中值改为基础走势同款红/蓝圆形标记；保留大乐透、福彩3D与排列3已有的语义色，并收敛到基础走势的色彩、字号和间距体系；不改动原有数据计算、筛选、遗漏或导出逻辑。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 相关提交：未提交。
- 发布状态：本阶段仅更新本地工作区，未重新部署；沿用阶段 15 的线上版本。
- 待办/风险：需在用户端逐个切换大小、奇偶、跨度、和值视图做截图验收；用户所说“机构走势、直走势”在当前代码中没有对应标签，本阶段按现有“奇偶走势、和值走势”处理，若需新增独立玩法请另行指定。

### 阶段 17 — 其他彩种派生走势图统一（待验收）

- 目标：将双色球、七乐彩、七星彩和快乐8等彩种的大小、奇偶、跨度、和值派生视图与大乐透采用同一套分隔和视觉规范。
- 完成内容：通用派生表增加彩种标识和逻辑号码组标识；号码组之间补充与基础走势一致的细分隔线；双色球、七乐彩、七星彩、快乐8继续复用统一的灰阶表头、斑马纹、期号吸附列、命中圆标记和移动端横向滚动；大乐透、福彩3D、排列3专用表继续共享同一层视觉收敛规则。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；本地 Vite 页面返回 HTTP 200。
- 相关提交：`0552640 Unify derived trend view styles`。
- 正式部署：`https://f071a6b3.caishutong-web.pages.dev`（Production / main，2026-09-02）。
- HEAD 别名：`https://head.caishutong-web.pages.dev`（已同步至部署 `https://7894f347.caishutong-web.pages.dev`）。
- 用户端：`https://888888c.xyz`（已验证与生产、HEAD 加载同一 `assets/index-BTwZHeqf.js` 和 `assets/index-CilqaBsJ.css`）。
- 验证结果：四个入口均返回 HTTP 200；构建、差异检查通过。
- 待办/风险：需在各彩种实际走势图页逐个切换四种派生视图确认分组边界和长表横向滚动；“合质”按现有产品的“和值”页签处理，未新增独立玩法。

### 阶段 18 — 彩种详情页开奖直播入口（已发布，待验收）

- 目标：在每个彩种详情页提供对应的开奖直播入口。
- 完成内容：福彩3D、双色球、七乐彩和快乐8链接至中彩网福彩开奖直播页；大乐透、排列3、排列5和7星彩链接至中国体彩网开奖直播页；入口放在详情页顶部操作区，使用新标签页打开并保留原页面；直播入口旁仅显示本期开奖日期和一个开奖时间；导出详情图片的目标区域不包含直播入口；未嵌入第三方视频播放器，避免跨域、授权和播放器失效影响页面。
- 相关文件：`src/data.js`、`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 数据/链接来源：中彩网福彩开奖直播页、中国体彩网开奖直播页；链接为外部公开页面，直播内容和可用性以来源平台为准。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；桌面端与 467×1054 移动端截图均显示直播日期/时间，移动端顶部操作区支持换行，普通详情查看和管理员导出逻辑保持不变。
- 相关提交：待用户验收后提交。
- 正式部署：`https://3b387121.caishutong-web.pages.dev`（Production / main，2026-09-02）；HEAD 别名 `https://head.caishutong-web.pages.dev` 与用户端 `https://888888c.xyz` 已同步最新资源。
- 发布资源：`assets/index-DqOZFtS3.js`、`assets/index-xYT8xg0u.css`；两个域名 HTTP 200。
- 待办/风险：第三方直播页面可能因平台策略、地区网络或直播时段变化；如需站内嵌入视频，需要提供具备嵌入授权的稳定播放地址后再接入。

### 阶段 19 — 彩种详情页整体排版优化（已发布，待验收）

- 目标：按整页信息层级统一详情页顶部操作区、开奖摘要和数据卡片的排版节奏。
- 完成内容：顶部返回、直播日期、单个开奖时间及直播入口统一为同一操作行；提升直播信息可读性并移除负外边距；详情主体改为统一纵向间距网格；开奖摘要、指标卡和胆码冷热宝卡片使用一致的卡片间距；移动端同步收敛操作区、号码区和卡片间距，保留横向内容可用性。
- 相关文件：`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；桌面端、467×1054 移动端及 320px 窄屏本地截图确认顶部操作区不换行、数据卡片对齐。
- 相关提交：待用户验收后提交。
- 正式部署：`https://3b387121.caishutong-web.pages.dev`（Production / main，2026-09-02）；用户端 `https://888888c.xyz` 已验证加载同一构建资源。
- 待办/风险：需确认管理员导出详情图片中的卡片间距是否符合最终视觉要求；确认后再发布测试版。

### 阶段 20 — 详情页直播时间信息精简（已发布，待验收）

- 目标：直播信息区域只保留一个开奖时间，避免日期旁重复展示相同时间。
- 完成内容：详情页直播信息保留“直播日期”和单个“直播时间”；移除重复的常规开奖安排字段及对应显示；直播链接、导出区域和其他详情内容保持不变。
- 相关文件：`src/data.js`、`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；移动端 DOM 检查确认仅显示一个开奖时间。
- 相关提交：待用户验收后提交。
- 正式部署：`https://3b387121.caishutong-web.pages.dev`（Production / main，2026-09-02）；HEAD 别名和用户端已同步。
- 发布验证：`https://head.caishutong-web.pages.dev/?nav=1` 与 `https://888888c.xyz/?nav=1&v=20260902-2` 均 HTTP 200，并加载 `assets/index-DqOZFtS3.js` 与 `assets/index-xYT8xg0u.css`。
- 待办/风险：无。

### 阶段 21 — 最新开奖数据源统一与历史校准（进行中）

- 目标：避免首页最新开奖与历史开奖、走势图使用不同数据源导致最新期丢失。
- 原因确认：`/api/lottery` 对接动态开奖 Worker；`/api/history` 对接 `data.17500.cn` 公共历史归档并使用长缓存。历史页和走势图加载归档后会覆盖首页已经拿到的最新记录。
- 已完成：动态开奖接口作为最新期优先源；历史归档仅用于补齐旧期；按彩种和期号去重并按期号倒序；历史请求增加 60 秒客户端缓存上限；首页本地开奖占位缓存缩短为 60 秒；动态接口常规缓存缩短为 30 秒，并支持按分钟刷新桶绕过旧缓存；历史页和走势图在接口返回后保留已加载的最新记录。
- 相关文件：`src/data.js`、`src/main.jsx`、`functions/api/lottery.js`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`mergeRecords` 单元级冒烟验证通过。
- 发布状态：尚未部署；需在测试版验证各彩种最新期号一致后，再发布正式用户端。
- 待办/风险：当前环境直接探测外部开奖 Worker 超时，线上发布前仍需用 Pages 测试地址验证真实响应、最新期号和缓存响应头；若上游 Worker 本身延迟，页面只能提示同步中，不能凭空生成开奖数据。

### 阶段 22 — 官方优先数据统一与开奖窗口同步（已完成本地修复，待发布）

- 目标：按照“官方源优先、代理仅回退、第三方归档只补历史”的规则，统一首页、历史开奖和走势图的数据链路，并补齐七乐彩、快乐8的官方源配置。
- 完成内容：新增统一开奖源适配器；福彩3D、双色球、七乐彩、快乐8接入中国福利彩票接口映射；大乐透、排列3、排列5、7星彩接入中国体育彩票接口映射；官方请求失败后才顺序回退到 `lottery-official-data` 代理；历史接口由服务端合并实时记录和 `17500.cn` 旧期归档，同一期号严格保留实时源；所有响应返回 `sourceType`、`sourceUrl`、`fallback`、`verified`、`stale`、`checkedAt` 和最新期号信息；前端历史页、走势图和首页使用同一标准 API；首页、历史页、走势图在开奖窗口按 60 秒轮询，其他时间按 5 分钟轮询，并在重新聚焦/恢复可见时主动校准。
- 相关文件：`functions/_lib/lotterySources.js`、`functions/api/lottery.js`、`functions/api/history.js`、`src/data.js`、`src/main.jsx`、`PROGRESS.md`。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；3 个 Pages Functions 文件通过 `node --check`；官方响应解析、七乐彩/快乐8字段解析、官方失败后代理回退、实时记录覆盖同期期号归档等冒烟验证通过。
- 发布状态：尚未部署；当前修改只在本地工作区，未改变管理后台，也未修改远程 `lottery-official-data` Worker 源码。
- 待办/风险：需要在 Pages 测试版验证 8 个彩种的真实官方接口返回格式、官方/代理标记、最新期号一致性和 21:00—22:30 轮询；确认无误后再发布正式用户端。

### 阶段 23 — 测试版真实数据源回归（部分完成）

- 测试部署：`https://codex-data-source-v22.caishutong-web.pages.dev`；部署资源别名 `https://72791c44.caishutong-web.pages.dev`。
- 验证结果：8 个 `/api/lottery?game=...&limit=1` 接口均返回 HTTP 200，页面资源正常加载；历史接口返回的最新期号与实时代理记录一致；来源字段正确暴露 `sourceType`、`fallback`、`verified` 和 `officialError`。
- 关键发现：本机直接请求福彩接口可返回 HTTP 200，体彩接口也能返回有效 JSON；同一请求从 Cloudflare Pages Functions 出站时，福彩返回 HTTP 403，体彩部分接口返回 HTTP 567，因此测试版 8 个彩种均暂时使用 `lottery-official-data` 代理回退，不能标记为已核验官方源。
- 已修复：补充浏览器请求头、7星彩单对象响应解析，并重新部署测试版。
- 待办/风险：在解决 Cloudflare 出站到福彩/体彩接口的访问限制或为 `lottery-official-data` 补充可证明的官方上游来源前，禁止把当前测试版宣称为“8 个彩种全部官方实时源”，也不发布到正式用户端。

### 阶段 24 — 官方优先数据链路与实时回退验证（进行中）

- 目标：按照实时开奖源分析结论，固定“官方源优先、可信回退、历史归档只补旧期”的数据顺序，并验证首页、历史开奖和走势图使用同一套数据。
- 完成内容：共享数据适配器导出官方解析器；新增 00038 最新开奖页解析作为明确标记的实时回退源，Huaniao 仅补可用的历史记录；官方请求失败时返回 `officialError`，回退记录标记 `sourceType=third-party`、`fallback=true`、`verified=false`；统一大乐透/7星彩期号 `2026102` 与 `26102` 等别名，避免历史合并重复；历史接口仍由实时结果优先、17500.cn 只补旧期。
- 相关文件：`functions/_lib/lotterySources.js`、`functions/api/lottery.js`、`functions/api/history.js`、`worker-official-data/index.js`、`worker-official-data/wrangler.jsonc`、`PROGRESS.md`。
- 验证结果：`pnpm run build`、`git diff --check`、`node --check` 通过；测试分支 8 个彩种接口均 HTTP 200，均返回当前回退源最新期号：福彩3D `2026241`、双色球 `2026104`、大乐透 `2026102`、排列3/5 `2026241`、7星彩 `2026104`、七乐彩 `2026103`、快乐8 `2026241`；历史接口可见最新期并用归档补旧期，dlt/qxc 不再产生 2026/26 双期号重复。
- 测试部署：`https://codex-official-proxy-v5.caishutong-web.pages.dev`；部署资源 `https://d84e73f3.caishutong-web.pages.dev`。
- 数据源诊断：福彩/体彩官方接口在 Pages/Worker 出口仍分别返回 HTTP 403/567 或超时；测试 Worker `lottery-official-data-test` 已部署但官方出口仍不可用，因此不能宣称当前回退数据已被官方核验。
- 待办/风险：要达到“官方发布后自动同步且 verified=true”，还需要为 `lottery-official-data` 配置能访问官方站点的采集环境或可信官方数据推送；在此之前不应直接替换正式代理，也不应把第三方回退标成官方。

### 阶段 25 — 首页缺失彩种代码映射修复（测试版）

- 现象：测试版首页只显示双色球、大乐透、7星彩、七乐彩，福彩3D、排列3、排列5、快乐8缺失。
- 原因：前端请求把 `fcsd`、`pls`、`plw`、`klb` 等上游代码传给 `/api/lottery`；统一 API 接受的是前端彩种 key `fc3d`、`pl3`、`pl5`、`kl8`，因此四个请求返回 HTTP 400，被 `Promise.allSettled` 静默过滤。
- 修复：`src/data.js` 改为传递前端彩种 key；保留上游代码仅用于数据源代理内部映射。
- 验证结果：`pnpm run build`、`git diff --check`、Node 静态检查通过；测试版 8 个彩种接口均 HTTP 200；缺失的四个彩种请求不再返回 400。
- 测试部署：`https://codex-official-proxy-v6.caishutong-web.pages.dev`；部署资源 `https://b366ccf3.caishutong-web.pages.dev`。
- 待办/风险：尚未替换正式用户端；需在浏览器刷新测试版确认 8 张首页卡片全部出现后，再决定是否发布正式域名。

### 阶段 26 — 数字 0 展示修复（测试版）

- 现象：福彩3D、排列3、排列5的开奖数字中，数字 0 在首页卡片和部分走势图中被省略。
- 原因：前端号码格式化与派生表筛选使用 `.filter(Boolean)`，JavaScript 会把数字 `0` 判定为 false。
- 修复：改为只过滤空字符串、`null` 和 `undefined`，保留数字 0；接口数据、首页号码球、历史/走势图派生表共用同一修复。
- 相关文件：`src/data.js`、`src/main.jsx`、`PROGRESS.md`。
- 验证结果：`pnpm run build`、`git diff --check`、静态检查通过；接口原始数据确认福彩3D `[0,0,2]`、排列3 `[0,5,0]`、排列5 `[0,5,0,7,6]` 均完整返回。
- 测试部署：`https://codex-official-proxy-v7.caishutong-web.pages.dev`；部署资源 `https://8a3ce708.caishutong-web.pages.dev`。
- 待办/风险：尚未替换正式用户端；需刷新测试版确认号码球视觉显示后再发布。

### 阶段 27 — 首页、详情页与走势图屏效优化（待验收）

- 目标：在不改变开奖数据规则、导出逻辑和管理后台的前提下，提升首页、详情页和走势图在桌面/移动端的呈现稳定性与首屏响应。
- 完成内容：首页只请求每个彩种最新一期，历史和走势图进入后按需加载，减少首屏传输与解析；首页长卡片启用可见区域延迟渲染并收敛桌面/移动端卡片间距；详情页统一操作区、主体纵向间距和移动端宽度约束；走势图、冷热图、快乐8图表和指标状态图增加横向滚动边界、稳定滚动槽和布局隔离，避免长表撑破页面。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试版首页实测显示 8 个彩种且 0 值保留，首页/走势图可正常进入。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://304a6de6.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。
- 待办/风险：需要在真实手机尺寸验收首页、详情页和走势图的间距、横向滚动与图表加载；确认无误后再安排正式发布。

### 阶段 28 — 详情页与走势图历史开奖号码区块移除（待验收）

- 目标：删除详情页和走势图页面底部的“历史开奖号码”区块，保留首页历史开奖入口和独立历史开奖页。
- 完成内容：移除 `Detail` 和 `Trend` 中的 `HistoryList` 渲染；历史开奖页 `HistoryPage` 继续显示完整历史数据，走势图主体、冷热图、指标状态趋势和详情导出区域不变。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；源码中仅保留独立历史开奖页的 `HistoryList` 使用。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://75b24e59.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。

### 阶段 29 — 详情页概览重排与视觉精修（待验收）

- 目标：优化详情页的视觉层级、字号、色彩和间距，减少留白并让本期信息更齐整。
- 完成内容：详情页改为单一“本期概览”信息面板；桌面端左侧集中彩种/期号/开奖号码，右侧上下排列本期数据与指标；冷热号码保留为第二层独立卡片；统一标题、数值、辅助文字的字号层级与对比度；移动端改为图标左侧、开奖信息右侧的紧凑布局，指标和数据卡片同步收紧间距。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；Impeccable detector 仅提示既有的宽度动画警告，未新增详情页问题。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://a205d637.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。

### 阶段 30 — 详情页冷热宝历史数据补齐与紧凑布局优化（待验收）

- 目标：修复详情页“胆码冷热宝”误显示为“近 1 期”的问题，并减少该模块的多余留白。
- 根因：阶段 27 为优化首页首屏只请求每个彩种最新一期，详情页沿用了这份轻量数据，导致冷热宝统计样本只有 1 期。
- 完成内容：详情页进入时单独请求统一 `/api/history` 历史接口并合并当前记录，最多保留最近 50 期；历史同步完成前显示“同步中…”状态，避免误导性地展示近 1 期；详情页自动导出等待历史同步完成；冷热宝卡片收紧内边距、标题说明、分组间距和号码球尺寸，移动端同步压缩。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；Impeccable detector 仅提示既有的宽度动画警告，未新增详情页问题。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://ea766289.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户在测试版验收后再决定。
- 待办/风险：需要在测试版详情页确认冷热宝显示的期数和移动端间距；若历史接口暂时不可用，页面会保留已加载数据并显示同步结束状态。

### 阶段 31 — 冷热宝说明文字精简（待验收）

- 目标：删除详情页“胆码冷热宝”标题旁的期数小字及下方说明小字，所有彩种保持一致。
- 完成内容：移除普通展示状态下的“近 N 期”和统计说明文字；保留大乐透可操作的期数下拉筛选，加载状态仍保留“同步中…”反馈，避免用户误解数据尚未完成加载。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://506eefc5.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。
- 待办/风险：需要在测试版分别打开福彩、体彩详情页确认标题区域保持紧凑，且大乐透期数筛选仍可用。

### 阶段 32 — 冷热宝期数控件与卡片重排（待验收）

- 目标：优化“胆码冷热宝”模块的层级和间距，并允许用户自主填写分析期数。
- 完成内容：所有支持冷热宝的彩种统一显示“分析期数”数字输入框；输入范围限制为 1 至当前已加载的历史期数，回车或失焦后自动校正；保留各彩种原有默认分析窗口；热码、温码、冷码改为独立的紧凑行卡片，标题与控件同一行，移动端同步适配。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://bcee22fa.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。
- 待办/风险：需要在测试版详情页分别输入不同期数，确认统计结果和移动端卡片间距符合预期。

### 阶段 33 — 冷热宝分组描边移除（待验收）

- 目标：去除冷热宝热码、温码、冷码分组行的描边，减轻移动端视觉重量。
- 完成内容：移除分组行的边框，仅保留轻微底色、圆角和间距来维持分组层次；期数输入和统计逻辑保持不变。
- 相关文件：`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://82bacad0.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。
- 待办/风险：需要在测试版移动端确认分组仍然可辨识且没有多余描边。

### 阶段 34 — 详情页本期数据字段补齐（待验收）

- 目标：修复详情页“本期数据”中销量、奖池和一等奖长期显示 `--` 的问题。
- 根因：开奖源标准化只保留期号、日期和号码，丢弃了销售额、奖池和奖级字段；回退解析还引用了未定义的 `NUMBER_FIELDS`，且详情链接可能误指向试机号页面。
- 完成内容：保留福彩官方 `sales/poolmoney/prizegrades` 和体彩 `lotterySaleAmount/lotteryPoolAmount/prizeLevelList` 字段；为福彩3D、排列3、排列5、快乐8标记奖池不适用；修复数字字段解析和回退源字段顺序；回退时按真实期号打开开奖详情页，补齐销量、奖池、一等奖金额及注数。
- 相关文件：`functions/_lib/lotterySources.js`、`src/data.js`、`functions/api/lottery.js`、`functions/api/history.js`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；测试接口已确认福彩3D返回销量 `97410000`、双色球返回销量/奖池/一等奖、 大乐透返回销量/奖池/一等奖。
- 测试部署：`https://screen-polish-v1.caishutong-web.pages.dev`；最新部署资源 `https://65dd4519.caishutong-web.pages.dev`（2026-09-09）。
- 正式发布：未覆盖 `888888c.xyz`、`head.caishutong-web.pages.dev` 或管理后台，待用户验收后再决定。
- 待办/风险：回退源详情页存在偶发响应慢，当前请求失败时会保留号码并在下一次请求重试；官方源恢复后将优先使用官方字段。

### 阶段 35 — 详情页本期数据字段补齐正式发布（已完成）

- 目标：将阶段 34 已在独立测试版验证的详情页本期数据字段修复正式发布到用户端，并同步更新生产开奖 Worker。
- 完成内容：正式发布 Pages `main` 构建；发现 `888888c.xyz/api/lottery*` 由 Cloudflare 路由到生产 Worker `lottery-official-data` 后，同步发布 `worker-official-data` 并兼容 `/api/lottery` 转发路径；首页、详情页、历史和走势图继续使用统一开奖数据链路；未修改管理后台。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`888888c.xyz` 与 Pages 生产部署返回 HTTP 200；正式域名 8 个彩种 API 均返回 HTTP 200 和本期记录，销量、奖池（适用时）、一等奖字段按上游返回；历史接口抽查双色球与福彩3D返回最新期。
- 正式部署：Pages 生产部署 `https://64ce0ebe.caishutong-web.pages.dev`（`main`）；用户端 `https://888888c.xyz`；HEAD 分支部署 `https://bfaf0984.caishutong-web.pages.dev`，Wrangler 返回别名 `https://head-olb0.caishutong-web.pages.dev`；开奖 Worker 版本 `7b0087ca-1f42-4aa7-bfcb-d7537b647599`，入口 `https://lottery-official-data.cxu96175.workers.dev`。
- 管理后台：未修改。
- 待办/风险：官方福彩/体彩接口当前偶发 403/567，生产已按既定可信度顺序回退到公开开奖详情源并标记 `fallback`；`head.caishutong-web.pages.dev` 是旧别名，当前最新 HEAD 部署以 Wrangler 返回的 `head-olb0` 别名为准。

### 阶段 36 — 详情页底色清理与导出边距优化（已完成）

- 目标：移除详情页开奖概览和冷热宝分组的内层底色，并仅在导出图片中为冷热宝卡片保留左右安全边距。
- 完成内容：详情页开奖概览的 `.detail-hero` 改为透明背景；所有彩种冷热宝分组行改为透明背景；导出详情图时给冷热宝卡片增加 12px 左右边距，正常页面布局不变。
- 相关文件：`src/styles.css`、`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 正式部署：Pages `main` 部署 `https://2a40eaba.caishutong-web.pages.dev`；用户端 `https://888888c.xyz` 已验证 HTTP 200 并加载 `assets/index-qV0wzP1j.js`、`assets/index-CDt6rg-i.css`。
- 管理后台：未修改；开奖 Worker 未修改。
- 待办/风险：需要在移动端刷新正式用户端并实际导出一张图片确认左右边距；本次接口继续沿用生产 Worker 的回退标记策略。

### 阶段 37 — 产品内容登录门槛（已完成）

- 目标：只有完成邮箱验证码登录后，才能查看用户端首页、选号工具、我的方案、历史开奖、走势图、详情、玩法规则及帮助/关于等产品内容。
- 完成内容：在用户端统一渲染入口增加登录门槛；未登录时不挂载任何产品数据组件，直接展示登录表单；登录成功后保留原本的目标页面并立即解锁；个人中心登录页和管理员入口保持可访问。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 发布：Pages 生产部署 `https://602c4e9d.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已验证 HTTP 200 并引用本次构建资源 `assets/index-DzND0cCT.js`、`assets/index-Bhdpwhmm.css`。
- 待办/风险：当前为前端访问控制；开奖 API 仍按现有公开数据接口运行，管理员 API 继续由服务端鉴权保护。

### 阶段 38 — 导出按当前视口与 DOM 渲染（已完成）

- 目标：让导出图片使用当前浏览器实际视口宽高和当前页面 DOM 的响应式状态，减少导出图与页面展示之间的布局差异，同时保留既有标题、水印、详情页分隔线和走势图完整宽度规则。
- 完成内容：走势图和详情导出统一改用当前 `window.innerWidth/innerHeight` 作为 html2canvas 的渲染视口；走势图导出使用当前页面滚动偏移，不再把渲染视口强制设为内容宽高；其他导出专属排版逻辑保持不变。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 发布：Pages 生产部署 `https://cf9dd1be.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已验证 HTTP 200 并引用资源 `assets/index-BCoh0re4.js`、`assets/index-Bhdpwhmm.css`。
- 待办/风险：html2canvas 对部分 CSS 特性（如滤镜、复杂阴影和 SVG）仍可能存在像素级差异；若验收仍有具体偏差，需要针对对应组件做局部导出样式修正。

### 阶段 39 — DOM 截图导出一致性（已完成）

- 目标：让手动导出和首页一键导出都直接按当前 DOM 截图，保留既有标题、水印、详情页分隔线和走势图完整宽度规则，避免导出图与页面视觉不一致。
- 完成内容：移除走势图导出中隐藏 `.trend-lines` 后手工绘制连线与命中球的 Canvas 重建逻辑；保留 SVG 连线、命中样式和当前 DOM 状态；移除详情导出时强制改写克隆节点宽度/溢出的逻辑；保留当前视口、完整走势图宽度、标题、水印、导出分隔线和冷热宝左右安全边距；首页一键导出继续复用同一批量导出工作区和截图逻辑。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`https://888888c.xyz/` 返回 HTTP 200，已加载 `assets/index-DsT1jnh7.js` 和 `assets/index-Bhdpwhmm.css`，新 JS 资源返回 HTTP 200。
- 发布：Pages 正式部署 `https://7a5352d9.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已确认切换到本次构建。
- 待办/风险：需要在移动端详情页、桌面端完整走势图和首页一键导出各实际下载一张图片，确认 SVG 连线、标题、水印、分隔线和完整宽度均与页面一致。

### 阶段 40 — 快乐8矩阵图导出三列布局（已完成）

- 目标：快乐8基础矩阵图导出时每行固定显示 3 期数据，避免移动端导出因响应式规则变成每行 2 期。
- 完成内容：为矩阵图导出增加三列专用截图规则，仅在导出克隆 DOM 中设置三列网格和对应最小宽度；页面正常展示仍保留现有响应式布局；首页一键导出的快乐8矩阵图复用同一规则。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`https://888888c.xyz/` 返回 HTTP 200，已加载 `assets/index-DiahRzM3.js`，新版 JS 资源 HEAD 返回 HTTP 200。
- 发布：Pages 正式部署 `https://2b78bb8d.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已确认切换到本次构建。
- 待办/风险：需要在移动端实际导出快乐8矩阵图，确认每行 3 期且标题、水印和完整内容不被裁切。

### 阶段 41 — 导出克隆尺寸与详情边距修复（已完成）

- 目标：修复导出图仍残留详情背景、本期数据贴边、快乐8矩阵缩短后底部留白，以及冷热宝内容底部被裁切的问题。
- 完成内容：导出克隆中明确移除详情概览及开奖区域背景/阴影，给本期数据和冷热宝保留左右安全边距，补齐详情概览与冷热宝之间的导出分隔线；截图前为克隆节点预留空间，按克隆后的真实内容高度重新裁剪画布，矩阵图三列布局不再沿用移动端两列时的旧高度。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`https://888888c.xyz/` 返回 HTTP 200，已加载 `assets/index-Bq3vKIOt.js`，新版 JS 资源 HEAD 返回 HTTP 200。
- 发布：Pages 正式部署 `https://d7cfacf6.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已确认切换到本次构建。
- 待办/风险：需要在手机端导出福彩3D/双色球/大乐透详情，以及快乐8矩阵图，确认背景、边距、底部内容和水印位置符合预期。

### 阶段 42 — 首页一键导出统一截图链路（已完成）

- 目标：修复首页“一键导出图片”仍使用旧导出效果的问题，让批量导出的基础走势图与单张导出完全使用同一套 DOM 截图规则。
- 完成内容：将基础走势图的独立导出函数改为调用统一 `exportTrendElement`；批量走势图保留完整宽度并直接捕获当前 DOM/SVG，继续沿用标题、水印和既有导出参数；详情、冷热图和快乐8矩阵图继续共享同一截图入口。
- 相关文件：`src/main.jsx`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过；`https://888888c.xyz/` 返回 HTTP 200，已加载 `assets/index-DILHpj-W.js`，新版 JS 资源 HEAD 返回 HTTP 200。
- 发布：Pages 正式部署 `https://5b6ffb82.caishutong-web.pages.dev`（2026-09-11）；自定义域名 `https://888888c.xyz` 已确认切换到本次构建。
- 待办/风险：需要在首页执行一次完整批量导出，确认每个彩种的走势图、详情、冷热图和快乐8两张图都不再出现旧布局。

### 阶段 43 — 首页缺失彩种的部分失败容错（已完成）

- 目标：避免单个彩种上游临时超时或接口异常时，首页整卡从列表中消失。
- 原因确认：`Promise.allSettled` 会返回成功彩种的部分结果，旧逻辑随后用 `setAll(rows)` 覆盖完整状态；失败彩种因此被静默过滤。此前旧版还存在将 `fcsd/pls/plw/klb` 误传给统一 API 的问题，截图中缺失的四个彩种与该现象一致。
- 完成内容：首页按彩种合并本次成功结果与已有结果，失败请求保留上一次记录；没有可用记录时显示“正在同步最新开奖，稍后自动重试”的占位卡；继续使用 `fc3d/pl3/pl5/kl8` 作为统一 API 参数。
- 相关文件：`src/main.jsx`、`src/data.js`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 发布：已随本次 Pages 正式部署发布到 `https://888888c.xyz`。
- 待办/风险：正式发布后检查 8 个彩种均显示；开奖窗口内观察临时失败时是否保留旧记录并自动恢复。

### 阶段 44 — 7星彩历史长图移动端与独立导出（已完成）

- 目标：优化七星彩历史开奖长条图的列间距和字号，并让手机小屏一次展示全部 7 个位置；详情图与历史长图分开导出。
- 完成内容：收紧历史表格列间距，缩小和值字号、放大位置奖号；移动端取消横向滚动并使用固定列宽适配 9 列；日期列改为居中并收紧宽度；标题改为“历史开奖长条图”并移除说明小字；新增“导出历史图”按钮；详情导出目标移除七星彩历史表，首页一键导出新增独立的七星彩历史长图任务。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`、`dist/index.html`（构建产物）。
- 验证结果：`pnpm run build` 通过；`git diff --check` 通过。
- 发布：Pages 正式部署 `https://b8f8e314.caishutong-web.pages.dev`（2026-09-18）；自定义域名 `https://888888c.xyz` 已返回 HTTP 200，并加载 `assets/index-BGTtxsyn.js`、`assets/index-5J1mvorA.css`。
- 待办/风险：仍需在真实 375—452px 手机宽度实际检查 7 个位置的可读性，并分别下载详情图与历史长图做最终视觉验收。

### 阶段 45 — 详情页今日观察（已发布，待验收）

- 完成内容：所有彩种详情页增加“今日观察”卡片；从近期已开奖数据中筛选和值集中、奇数次数偏离、最大遗漏等候选，按偏离常态程度选出一条突出信息；没有明显偏离时显示中性说明，不做预测或推荐。
- 相关文件：`src/main.jsx`、`src/styles.css`、`dist/index.html`（构建产物）。
- 验证结果：`npm run build` 通过；Pages `main` 部署成功；`https://888888c.xyz/` 返回 HTTP 200，并加载 `assets/index-B-ngoci-.js`、`assets/index-Cj4GXHlf.css`。
- 正式部署：Pages 生产部署 `https://3925a5b2.caishutong-web.pages.dev`（2026-09-20）；自定义域名已切换到本次构建。
- 待办/风险：需要在真实移动端和各彩种详情页验收文案长度与异常度筛选结果。

### 阶段 46 — 首页一键导出与内页导出统一（已发布，待验收）

- 完成内容：首页一键导出改为逐个执行各内页导出按钮的默认操作；移除额外的无遗漏走势图，统一基础走势图的期数、遗漏值、连号标记、标题和文件名；保留双色球/大乐透冷热图、快乐8两张图、七星彩历史长图等内页专属导出。
- 相关文件：`src/main.jsx`、`dist/index.html`（构建产物）。
- 验证结果：`npm run build`、`git diff --check` 通过；`https://888888c.xyz/` 返回 HTTP 200，并加载 `assets/index-DZU6d46u.js`、`assets/index-13Fx7HAq.css`。
- 正式部署：Pages 生产部署 `https://cb2af191.caishutong-web.pages.dev`（2026-09-20）；自定义域名已切换到本次构建。
- 待办/风险：需要登录会员账号执行一次完整一键导出，逐张对比内页按钮导出的图片内容与顺序。

### 阶段 47 — 今日观察文案去遗漏单一化（已发布，待验收）

- 完成内容：修正“今日观察”大多数落到遗漏值的问题；现在统一比较和值集中、奇偶偏离、跨度集中、同号与遗漏，只有遗漏明显强于其它指标时才作为主观察，其它指标突出时优先展示并附带对比说明；继续保持仅描述已开奖数据、不做预测。
- 相关文件：`src/main.jsx`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；`https://888888c.xyz/?nav=1` 返回 HTTP 200，并加载 `assets/index-9Ub0JNMt.js`、`assets/index-BZZaYeTZ.css`；生产 JS 已包含“跨度集中在”“同号”“仅描述已开奖数据”等新文案。
- 正式部署：Pages 生产部署 `https://fbb2082e.caishutong-web.pages.dev`（2026-09-20）；自定义域名已切换到本次构建。
- 待办/风险：需要在各彩种详情页实际观察不同历史数据下的文案分布，确认和值、奇偶、跨度、同号与遗漏均能按突出程度出现。

### 阶段 48 — 胆码冷热宝按分析期数动态分组（已发布，待验收）

- 完成内容：移除 3D、排列3、排列5、双色球、大乐透冷热宝的固定次数阈值；根据用户填写的分析期数、每期号码位置数和号码总数计算窗口平均出现次数，再动态划分热码、温码、冷码；大乐透前区/后区及双色球红球/蓝球分别按各自位置数计算。
- 相关文件：`src/main.jsx`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过。
- 正式部署：Pages 生产部署 `https://c1f8512f.caishutong-web.pages.dev`（2026-09-20）；自定义域名 `https://888888c.xyz/?nav=1` 返回 HTTP 200，并加载 `assets/index-BmdpHjvR.js`、`assets/index-BZZaYeTZ.css`。
- 待办/风险：需要用不同分析期数检查各彩种分组是否随输入即时变化，并确认历史数据不足时的边界表现。

### 阶段 49 — 首页一键导出与内页截图层级统一（已发布，待验收）

- 完成内容：修复首页批量导出隐藏容器与内页 DOM 层级不同导致的 CSS 继承差异；批量导出节点现在直接挂载到与内页相同的页面层级，走势图、冷热图、快乐8图表、七星彩历史长图和详情图共享内页的宽度、响应式与卡片样式规则；截图时仍保留当前 DOM 状态、标题、水印和既有导出参数。
- 相关文件：`src/main.jsx`、`src/styles.css`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过。
- 正式部署：Pages 生产部署 `https://0e9b4090.caishutong-web.pages.dev`（2026-09-20）；自定义域名 `https://888888c.xyz/?nav=1` 返回 HTTP 200，并加载 `assets/index-pCLoPq9u.js`、`assets/index-DbIGMQnQ.css`。
- 待办/风险：需要登录会员执行首页一键导出，与各内页单独导出逐张比对桌面及移动端图片。

### 阶段 50 — 一键导出发布后的空白页热修复（已发布，待验收）

- 根因：为引入 Portal 时误将 `createRoot` 从 `react-dom` 导入，生产运行时触发 `TypeError: createRoot is not a function`，React 未能挂载。
- 完成内容：恢复 `createRoot` 从 `react-dom/client` 导入，仅从 `react-dom` 导入 `createPortal`；保留批量导出节点层级统一修复。
- 验证结果：`npm run build`、`git diff --check` 通过；无头浏览器验证自定义域名页面 body 已渲染且无运行时异常；`https://888888c.xyz/?nav=1` 返回 HTTP 200，加载 `assets/index-Cc9m-BDq.js`、`assets/index-DbIGMQnQ.css`。
- 正式部署：Pages 生产部署 `https://07c8059f.caishutong-web.pages.dev`（2026-09-20）。
- 待办/风险：需要登录会员执行首页一键导出，确认导出动作本身与内页单独导出逐张一致。

### 阶段 51 — 首页一键导出补回无遗漏走势图（已发布，待验收）

- 完成内容：批量导出每个彩种同时生成显示遗漏值和隐藏遗漏值两张基础走势图；更新任务总数、文件名、标题和导出参数，保留详情图、冷热图、快乐8图表和七星彩历史长图。
- 相关文件：`src/main.jsx`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；生产部署 `https://953f4203.caishutong-web.pages.dev` 返回 HTTP 200；自定义域名 `https://888888c.xyz/?nav=1` 返回 HTTP 200，并加载包含 `batch-trend-nomiss` 与 `基本走势-无遗漏` 的线上 JS。
- 正式部署：Pages 生产部署 `https://953f4203.caishutong-web.pages.dev`（2026-09-20）。
- 待办/风险：需要登录会员执行一次完整一键导出，确认两张基础走势图均下载且与内页导出规则一致。

### 阶段 52 — 游客登录与受限访问（已发布，待验收）

- 完成内容：登录页和个人中心增加“游客登录”；游客会话保存在本机，允许访问首页和选号工具，禁止打开详情、历史、走势图、玩法规则、我的方案及导出功能；游客可以选号但不能保存方案，个人中心保留退出游客模式入口。
- 相关文件：`src/main.jsx`、`src/styles.css`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；生产部署 `https://8a0f502f.caishutong-web.pages.dev` 返回 HTTP 200；自定义域名 `https://888888c.xyz/?nav=1` 返回 HTTP 200，并加载包含游客登录逻辑的线上 JS。
- 正式部署：Pages 生产部署 `https://8a0f502f.caishutong-web.pages.dev`（2026-09-21）。
- 待办/风险：需要在未登录、游客登录、邮箱登录三种状态下分别验收路由守卫和底部导航。

### 阶段 53 — 详情页综合数据与冷热宝视觉整理（已发布，待验收）

- 完成内容：详情页新增“综合数据”历史汇总模块，支持近10/20/30/50/100期切换；3D、排列3、排列5展示开奖号、形态、和值、跨度、奇偶比、大小比和012路/质合比，其他彩种按可用号码区指标展示；数据位于详情导出容器内，会随详情图导出。
- 完成内容：基础走势图补齐排列5的“号码分布”组，模拟选号区域显示0—9分布位；走势图增加序号列和3D/排列3/排列5的开奖号指标列；修正折线层级，避免折线被表格行背景遮住。
- 完成内容：详情页胆码冷热宝改为热/温/冷三条横向色带，保留按分析期数动态分组与当前号码统计。
- 相关文件：`src/main.jsx`、`src/styles.css`、`dist/index.html`（构建产物）、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；Cloudflare Pages 生产部署成功，部署地址 `https://1464f8ef.caishutong-web.pages.dev`（2026-09-25）；`https://888888c.xyz/` 返回本次构建 HTML 并加载 `assets/index-BdmHk5lp.js`、`assets/index-zDrhmJH-.css`；线上 JS/CSS 已确认包含综合数据表、排列5号码分布及冷热色带样式。
- 正式部署：Pages `main` 部署 `https://1464f8ef.caishutong-web.pages.dev`（2026-09-25）。
- 待办/风险：需要在详情页与走势图实际验收列顺序、折线连续性、移动端横向滚动和导出图片效果。
- 待办/风险：详情页综合数据表的移动端排版、导出效果及走势图折线仍需继续验收。

### 阶段 54 — 综合数据与冷热宝统一规则（已发布，待验收）

- 目标：所有彩种详情统一综合数据表格、排列、导出与冷热宝布局，并修复走势图连线显示层级。
- 完成内容：综合数据表各列等宽、单列固定底色、移除表格外框及单元格描边；历史顺序改为旧期在上、最新期在下；详情页把综合数据放到冷热宝下方；为综合数据增加独立导出，并加入首页一键导出队列。
- 完成内容：全站详情页把“分析期数”改为“期数”并保留原选择功能；冷热色带高度缩短约三分之一，号码与标签上下居中；走势图连接线调整到号码圆点下方。
- 约定：走势图只保留“开奖号”列，不增加重复的“中奖彩票号”列。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；`https://888888c.xyz/?nav=1` 与生产部署地址均返回 HTTP 200，并加载 `assets/index-CtU4mbAu.js`、`assets/index-D9fMaHGv.css`。
- 正式部署：Pages `main` 分支，`https://184d7720.caishutong-web.pages.dev`（2026-09-26）。
- 状态：已发布，待用户验收。

### 阶段 59 — 综合数据表格字号与奖号列自适应（已发布）

- 目标：综合数据表按截图反馈放大字号、形态字号单独放大、奖号列按号码文本长度适配，并保留淡化后的列底色与清晰网格。
- 完成内容：奖号列宽根据当前彩种展示期内的奖号文本长度动态分配；综合数据表桌面正文/表头字号分别调整为 13px/12px，手机调整为 11px/10px，形态标签额外增大；保留列颜色并减淡底色与网格线，维持走势图式轻网格观感。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；生产 Pages 部署 `https://748c344a.caishutong-web.pages.dev` 对应提交 `2f83244`，主站与部署预览均返回 HTTP 200，主站 HTML 已加载本次 JS/CSS 资源；受保护的详情页尚未进行浏览器视觉复核。
- 状态：已发布，待用户验收。

### 阶段 55 — 综合数据窄屏展示细化（进行中）

- 目标：移除综合数据卡片的冗余文字、让全部指标在手机屏幕宽度内可见，并增加清晰但轻量的表格分隔线。
- 完成内容：去掉可见“期数”标签和标题副文案，保留下拉选择；按内容权重设置列宽并缩窄奖号列；恢复浅色外框及行列网格线，保持各列固定底色、不启用隔行换色。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；确认 `src/main.jsx` 中已无综合数据副文案。
- 正式部署：Pages `main` 分支，`https://5caf6bc6.caishutong-web.pages.dev`（2026-09-27）；生产域名加载同版资源。
- 状态：已发布，待用户验收。

### 阶段 56 — 详情整图导出与冷热号码适配（进行中）

- 目标：冷热号码在窄屏完整可见且自动换行；大乐透冷热宝默认分析近11期；详情导出只生成包含综合数据的整页图，不再单独导出综合数据。
- 完成内容：冷热宝号码缩小并取消横向滚动，空间不足时自动换行；大乐透冷热宝默认期数调整为11；综合数据保留在详情整图内，移除详情页与首页批量导出的独立综合图任务，并在整图导出时隐藏综合数据筛选控件。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；首页批量导出任务数已同步移除综合图单独任务，详情导出目标仍包含综合数据模块。
- 正式部署：Pages `main` 分支，`https://5caf6bc6.caishutong-web.pages.dev`（2026-09-27）；自定义域名 `https://888888c.xyz/?nav=1` 返回 HTTP 200，加载 `assets/index-BWz3RtSu.js`、`assets/index-fCbK0aM-.css`。
- 状态：已发布，待用户验收。

### 阶段 57 — 走势图分隔线与统计列精简（进行中）

- 目标：各彩种走势图的位置分隔线与真实号码组右边界对齐；移除右侧独立开奖/统计列；隐藏冗余的“期数”提示但保留筛选功能。
- 完成内容：分隔线位置计算补上序号列宽度，并固定位置表头宽度；移除排列三、排列五、福彩3D走势图右侧开奖号与统计列，其他彩种沿用无统计列的紧凑表格；在基础走势图、快乐8、历史列表及遗漏走势图的期数筛选控件中隐藏“期数”字样，保留可访问标签和选择控件。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；构建产物已生成，走势图各位置分隔线按序号列、期号列及号码组宽度计算。
- 正式部署：Pages `main` 分支，`https://5caf6bc6.caishutong-web.pages.dev`（2026-09-27）；生产域名及部署地址均返回 HTTP 200，加载 `assets/index-BWz3RtSu.js`、`assets/index-fCbK0aM-.css`。
- 状态：已发布，待用户验收。

### 阶段 58 — 走势图默认30期与筛选器优化（待验收）

- 目标：模拟选号的号码分布行完整显示并与位置列对齐；期数下拉菜单贴合产品样式且始终展开在触发器下方；指标状态走势图初次加载默认展示近30期，所有彩种一致。
- 完成内容：分布占位圆点改为与走势图数字列等宽、等高且不额外占用水平空间；基础走势图期数筛选替换为自定义浮层下拉，支持点击外部/Escape关闭和滚动/缩放重定位；指标状态走势图在初始缓存只有一条记录、完整历史异步加载后自动扩展到所选的30期范围，同时尊重用户手动调整的起止期数；综合数据形态列改为按形态名称使用固定颜色，跨期同形态同色、不同形态可辨。
- 相关文件：`src/main.jsx`、`src/styles.css`、`PROGRESS.md`。
- 验证结果：`npm run build`、`git diff --check` 通过；Pages 生产部署已关联提交 `ebc313b`，自定义域名返回 HTTP 200 并加载本次构建资源。线上只读检查表明排列5接口正常响应，但官方源返回 HTTP 567，当前回退至未验证的第三方公开源。Playwright 本地页面加载正常，但登录页要求授权，未绕过权限；走势图与下拉视觉交互尚未完成浏览器验收。
- 正式部署：Pages `main`，`https://47788da8.caishutong-web.pages.dev`（2026-09-27）；`https://888888c.xyz/?nav=1` 加载 `assets/index-B_qECIPr.js`、`assets/index-W28e314U.css`。
- 状态：已发布，待用户验收。

## 恢复工作流程

新会话开始时按以下顺序读取：

1. 阅读本文件的“当前快照”和最近一个未完成阶段。
2. 运行 `git status --short`，确认工作区是否有未提交改动。
3. 运行 `git diff`，理解当前未提交实现；如需要，再查看 `git log -5 --oneline`。
4. 查看本阶段列出的相关文件和验证命令。
5. 继续完成“待完成”和“待办/风险”，不要重复已经标记为完成的工作。

## 每阶段更新模板

完成一个阶段后，更新以下内容：

- `当前阶段` 和 `阶段状态`
- 阶段目标与实际完成内容
- 相关文件或模块
- 验证命令及结果
- 相关提交或部署地址
- 遗留问题、风险和下一阶段入口

建议状态值：`进行中`、`待验收`、`已完成`、`已阻塞`。

## 常用验证

```bash
pnpm run build
git status --short
git diff --check
```

## 约定

- 只有真正完成并验证过的内容才写入“已完成”。
- 用户验收前标记为“待验收”，不要提前标记为“已完成”。
- 发布测试版或正式版后记录部署地址、版本标识和发布日期。
- 管理后台、用户端和数据库迁移如果分阶段变更，要分别记录，避免恢复时误认为已同步。
