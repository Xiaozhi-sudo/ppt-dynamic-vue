# PPT 动态生成及展示技术解析文档

## 1. 项目定位

本项目是一个 AI PPT 生成器原型。用户输入 PPT 主题并选择模板后，系统会调用大模型生成结构化 PPT 内容，将内容渲染成内部幻灯片数据，再把最终页面拆解成“模板骨架、标题、副标题、正文要点逐步填充”的动画帧，通过 SSE 实时推送给前端展示。生成完成后，后端会导出标准 `.pptx` 文件供用户下载。

当前架构是同仓库双服务：

- 后端：`Next.js App Router API routes`
- 前端：`Vue 3 + Vite + TypeScript + <script setup>`
- PPT 领域逻辑：独立放在 `src/lib/ppt/**`

## 2. 项目结构

```text
ppt-gen-test-v1-main/
├── index.html                         # Vue/Vite 前端 HTML 入口
├── vite.config.ts                     # Vue 前端构建、dev server、/api 代理配置
├── package.json                       # npm 脚本和依赖
├── .env.local                         # 本地大模型配置，已被 .gitignore 忽略
├── docs/
│   └── ppt-dynamic-preview-architecture.md
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Next 根页面，只保留后端服务提示
│   │   └── api/
│   │       ├── templates/route.ts     # 获取 PPT 模板
│   │       └── ppt/jobs/
│   │           ├── route.ts           # 创建 PPT 生成任务
│   │           └── [jobId]/
│   │               ├── route.ts       # 保存编辑后的 slides 并重新导出
│   │               ├── events/route.ts
│   │               └── download/route.ts
│   ├── frontend/
│   │   ├── main.ts                    # Vue app bootstrap
│   │   ├── App.vue                    # Vue 根组件
│   │   ├── styles.css                 # Vue 前端样式
│   │   ├── data/pptSteps.ts           # 前端流程步骤元数据
│   │   ├── types/ppt.ts               # 前端 API DTO 类型
│   │   └── components/
│   │       ├── PptWorkspace.vue       # 主工作区，管理表单、任务、SSE、预览和编辑保存
│   │       ├── TemplatePicker.vue     # 模板选择
│   │       ├── GenerationTimeline.vue # 生成进度时间线
│   │       └── SlidePreview.vue       # 幻灯片大图、缩略图和主画布原位编辑
│   └── lib/ppt/
│       ├── types.ts                   # 后端 PPT 领域类型
│       ├── templates.ts               # 内置模板定义
│       ├── generator.ts               # 本地 fallback 内容生成
│       ├── llm.ts                     # 大模型调用和响应归一化
│       ├── renderer.ts                # GeneratedDeck -> RenderedSlide
│       ├── animation.ts               # 动态展示帧生成
│       ├── jobs.ts                    # 任务状态、SSE 订阅、生成编排
│       ├── exporter.ts                # pptxgenjs 导出 PPTX
│       └── steps.ts                   # 后端生成流程步骤定义
```

## 3. 服务与脚本

后端和前端分开运行：

```bash
npm run dev:api
npm run dev:web
```

默认地址：

- Vue 前端：`http://127.0.0.1:5173`
- Next API：`http://127.0.0.1:3000`

Vite 负责把前端请求里的 `/api` 代理到 Next 后端：

```ts
server: {
  proxy: {
    "/api": "http://127.0.0.1:3000",
  },
}
```

这让 Vue 前端可以直接请求 `/api/templates`、`/api/ppt/jobs`，不用在业务代码里写死后端地址。

## 4. 核心数据模型

项目里有两类核心 PPT 数据：

`GeneratedDeck`

这是大模型或本地生成器产出的语义内容，包含标题、章节、每页的标题、副标题、正文要点和备注。它还不是可展示页面。

`RenderedSlide`

这是结合模板后生成的可展示幻灯片快照，包含：

- 页面索引和布局类型
- 已填充的标题、副标题、正文要点
- 当前页面状态：`pending`、`filling`、`ready`、`failed`
- 模板样式：背景、颜色、字体、标题框、正文框、装饰元素

前端实际渲染的是 `RenderedSlide`。

## 5. PPT 动态生成链路

完整生成链路如下：

1. 前端加载模板：`GET /api/templates`
2. 用户输入主题并选择模板。
3. 前端创建任务：`POST /api/ppt/jobs`
4. 后端创建 `PptJob`，返回 `jobId`。
5. 前端建立 SSE 连接：`GET /api/ppt/jobs/{jobId}/events`
6. 后端异步执行生成任务：
   - 分析主题
   - 调用大模型生成结构化内容
   - 如果大模型失败，降级到本地生成器
   - 匹配模板
   - 渲染幻灯片
   - 生成动态展示帧
   - 导出 PPTX
7. 后端通过 SSE 持续推送进度和页面快照。
8. 前端按事件更新预览、缩略图、时间线和下载按钮。

## 6. 大模型调用

大模型调用在 `src/lib/ppt/llm.ts`。

配置读取优先级：

1. 优先读取环境变量：

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

2. 如果没有环境变量，再尝试读取 `llm-information.md`。

当前项目使用 `.env.local` 配置 DeepSeek。该文件已被 `.gitignore` 忽略，避免密钥提交到仓库。

大模型请求使用 OpenAI 兼容接口：

```text
POST {baseUrl}/chat/completions
```

请求里要求模型只返回 JSON 对象，结构固定为 6 页 PPT：

- 封面
- 目录
- 背景与趋势
- 核心洞察
- 行动建议
- 总结

模型返回后，`normalizeDeck` 会做兜底归一化：

- 如果缺少字段，使用本地生成器的 fallback 数据。
- 如果 `layoutType` 不合法，回退到默认 layout。
- 如果正文要点不是字符串数组，会过滤并限制数量。
- 最终保证后续渲染流程拿到稳定的 `GeneratedDeck`。

## 7. 模板与渲染

模板定义在 `src/lib/ppt/templates.ts`，每个模板包含：

- 颜色主题
- 字体
- 不同页面类型的布局
- 标题、副标题、正文区域坐标
- 装饰元素，例如线条、矩形、圆形

`src/lib/ppt/renderer.ts` 负责把 `GeneratedDeck` 和 `PptTemplate` 合成 `RenderedSlide[]`。

渲染后的每页会携带完整样式信息，所以前端不需要理解模板规则，只需要根据坐标和颜色渲染页面。

## 8. 动态展示帧生成

动态展示的核心在 `src/lib/ppt/animation.ts` 的 `createSlideFillFrames`。

它不是让前端自己猜动画顺序，而是在后端把最终幻灯片拆成多帧中间状态。每一帧都是完整的 `slides` 快照，外加一个 `animation` 元数据。

帧生成顺序：

1. 初始帧：只显示模板骨架，内容为空。
2. 当前页填充标题。
3. 当前页填充副标题。
4. 当前页正文要点逐条追加。
5. 当前页标记为 `ready`。
6. 切到下一页重复以上步骤。
7. 最后一帧返回完整幻灯片。

每帧结构：

```ts
{
  slides: RenderedSlide[];
  animation: {
    phase: "template" | "title" | "subtitle" | "bullets" | "ready";
    field?: "template" | "title" | "subtitle" | "bullets" | "slide";
    slideIndex: number;
    bulletIndex?: number;
  }
}
```

这种设计的关键优点是前端只负责播放，不负责生成状态机。后端保证动画顺序，前端拿到什么就展示什么。

## 9. SSE 实时推送

SSE 入口在：

```text
src/app/api/ppt/jobs/[jobId]/events/route.ts
```

前端使用浏览器原生 `EventSource`：

```ts
new EventSource(`/api/ppt/jobs/${jobId}/events`)
```

后端返回：

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

每条消息格式：

```text
data: {"type":"slides","jobId":"...","progress":55,...}
```

`PptJobEvent` 中最重要的字段：

- `status`：任务状态
- `step`：当前流程阶段
- `message`：展示给用户的进度文案
- `progress`：进度百分比
- `slides`：当前页面快照
- `animation`：当前高亮字段
- `error`：失败原因

## 10. 任务状态管理

任务编排在 `src/lib/ppt/jobs.ts`。

主要函数：

- `createPptJob`：创建任务并启动异步生成。
- `runPptJob`：按步骤执行大模型生成、渲染、拆帧、导出。
- `updateProgress`：推送普通进度。
- `updateSlideFrame`：推送带页面快照的动画帧。
- `subscribeToPptJob`：给 SSE route 订阅任务事件。
- `getPptJob`：获取任务快照。
- `deletePptJob`：清理任务。

任务存储使用挂在 `globalThis` 上的共享 store，而不是普通模块级 `Map`。原因是 Next dev 环境下不同 API route 可能被独立编译和加载，如果只用模块级变量，创建任务的 route 和 SSE route 可能看不到同一份内存。共享 store 可以保证 `/api/ppt/jobs` 和 `/api/ppt/jobs/{jobId}/events` 访问同一张任务表。

终态任务会在保留时间后自动清理，避免内存一直增长。

## 11. Vue 前端播放机制

主组件是 `src/frontend/components/PptWorkspace.vue`。

它负责维护这些状态：

- `topic`：用户输入主题
- `templates`：模板列表
- `selectedTemplateId`：当前模板
- `jobId`：任务 ID
- `status`：任务状态
- `currentStep`：当前流程步骤
- `progress`：进度
- `slides`：当前所有幻灯片快照
- `activeSlideIndex`：当前预览页
- `animation`：当前动画元数据
- `currentMessage`：当前提示文案
- `error`：错误信息
- `hasUnsavedEdits`：当前 slides 是否有未保存修改
- `editMessage` / `editError`：编辑保存反馈

收到 SSE 后，前端直接用后端事件覆盖当前状态：

```ts
slides.value = event.slides;
animation.value = event.animation;
progress.value = event.progress;
currentMessage.value = event.message;
```

如果事件里带了 `animation.slideIndex`，前端会自动切换到正在生成的那一页：

```ts
activeSlideIndex.value = event.animation
  ? event.animation.slideIndex
  : activeSlideIndex.value;
```

## 12. 幻灯片展示组件

`src/frontend/components/SlidePreview.vue` 负责渲染单页幻灯片。

它根据 `RenderedSlide` 中的布局数据做绝对定位：

- `layout.titleBox`：标题区域
- `layout.subtitleBox`：副标题区域
- `layout.bodyBox`：正文区域
- `layout.accentElements`：模板装饰

当 `animation.field` 等于当前元素类型时，组件添加 `is-filling` 类名，由 CSS 触发填充动画。

正文 bullet 通过 `animation.bulletIndex` 标记当前正在填充的条目。

组件支持两种模式：

- `large`：主预览，播放字段级动画、生成提示，并在完成后支持页面文字原位编辑。
- `thumbnail`：缩略图，只展示页面状态，不播放字段级动画。

生成完成后，主预览中的标题、副标题和正文 bullet 会通过 `contenteditable` 进入可编辑状态。用户可以直接点击 PPT 页面上的文字进行修改，而不是在单独表单里改。

原位编辑的事件流如下：

1. 用户点击主预览中的标题、副标题或 bullet。
2. `SlidePreview.vue` 读取被编辑元素的 `textContent`。
3. 组件向父级抛出 `update-title`、`update-subtitle` 或 `update-bullet` 事件。
4. `PptWorkspace.vue` 更新当前 `slides` 状态。
5. 预览立即重渲染。
6. `hasUnsavedEdits` 标记为 `true`，下载入口提示需要先保存。

缩略图模式不支持编辑，避免用户在缩略图区域误改内容。

备注 `notes` 不属于 PPT 页面可见元素，因此仍在下方编辑区修改。保存时会和当前 slides 一起提交给后端。

## 13. 编辑保存与重新导出

生成完成后，用户可以修改当前页内容：

- 主画布直接修改标题。
- 主画布直接修改副标题。
- 主画布直接修改 bullet。
- 下方备注区修改 notes。

前端本地修改后不会立即写入后端，而是先更新 `slides` 状态并标记未保存。用户点击“保存修改”后，前端请求：

```http
PATCH /api/ppt/jobs/{jobId}
Content-Type: application/json
```

请求体包含最新的 `slides`：

```json
{
  "slides": []
}
```

后端入口是：

```text
src/app/api/ppt/jobs/[jobId]/route.ts
```

后端处理流程：

1. 校验请求体是合法 JSON。
2. 校验 `slides` 是数组。
3. 校验每页至少包含 `id`、`title`、`subtitle`、`bullets`、`notes` 等可编辑字段。
4. 调用 `updatePptJobSlides(jobId, slides)`。
5. 在任务存储中找到原始 job。
6. 校验任务已完成，且编辑后的页面数量、页面 id 和原任务匹配。
7. 只采纳文本字段变更，不接受前端篡改布局、模板和样式。
8. 使用更新后的 `RenderedSlide[]` 调用 `exportPptx` 重新导出。
9. 更新 job 的 `slides` 和 `downloadPath`。
10. 返回更新后的 job。

这样设计的重点是：**前端编辑的是结构化 slides，后端重新导出 PPTX，而不是直接修改 PPTX 文件。**

这能保证：

- 页面预览和最终下载文件使用同一份数据。
- 不需要解析已有 PPTX 再反写，降低复杂度。
- 未来扩展图表、图片、表格编辑时仍能沿用同一条保存链路。

保存成功后，前端清空 `hasUnsavedEdits`，下载按钮恢复可用。此时下载的 PPTX 是编辑后的最新版本。

## 14. 进度时间线

`src/frontend/components/GenerationTimeline.vue` 负责展示生成阶段。

流程步骤来自 `src/frontend/data/pptSteps.ts`：

- 分析主题
- 生成大纲
- 匹配模板
- 填充页面
- 渲染预览
- 导出文件
- 生成完成

组件根据 `currentStep` 和 `status` 计算每个步骤状态：

- `pending`
- `active`
- `done`
- `failed`

进度条使用后端推送的 `progress`，前端只做 0 到 100 的边界裁剪。

## 15. PPTX 导出

导出逻辑在 `src/lib/ppt/exporter.ts`，使用 `pptxgenjs`。

导出流程：

1. 校验 `jobId`，防止路径穿越。
2. 创建 `.generated/pptx` 输出目录。
3. 创建 `PptxGenJS` 实例。
4. 按 `RenderedSlide` 添加背景、装饰元素、标题、副标题、正文和备注。
5. 生成 `nodebuffer`。
6. 使用 Node `fs/promises.writeFile` 写入 `.pptx`。

这里没有直接依赖 `pptx.writeFile`，因为在当前运行环境中，库的 `writeFile` 可能在文件完全落盘前 resolve。显式写 buffer 可以保证函数返回时文件已经存在。

PPTX 导出会在两个场景发生：

- 生成任务完成时，后端第一次导出 PPTX。
- 用户保存编辑后的 slides 时，后端重新导出 PPTX 并覆盖该 job 对应的下载文件。

## 16. 错误处理和降级

项目有几类错误处理：

- 模板加载失败：前端显示错误条。
- 创建任务失败：前端进入 `failed` 状态。
- SSE 解析失败：前端关闭连接并提示重新生成。
- SSE 临时断开：前端最多重试 3 次。
- 大模型调用失败：后端记录警告，降级到本地生成器。
- 任务失败：后端推送 `error` 事件，前端展示失败状态。
- 编辑保存失败：前端展示 `editError`，保留未保存状态，用户可继续修改后重试。
- 保存编辑前下载：前端隐藏真实下载入口，提示先保存，避免下载旧版本。

大模型失败不会直接导致整个 PPT 生成失败，除非后续渲染或导出也失败。

## 17. 当前验证命令

常用验证命令：

```bash
npm test
npm run lint
npm run build:web
npm run build:api
```

当前项目已通过：

- 10 个测试文件
- 37 个测试
- Vue 前端生产构建
- Next API 生产构建
- ESLint 检查

## 18. 可升级方向

当前项目已经打通了生成、动态展示、画布原位文字编辑、保存后重新导出这条闭环，但内容结构、版式系统、复杂元素和生产化能力仍比较基础。后续升级时建议优先围绕“数据协议先行”展开：先扩展 `types.ts` 中的 PPT 页面表达能力，再同步改大模型 prompt、渲染器、动画帧、前端展示和 PPTX 导出。

### 18.1 后端升级方向

后端是 PPT 能力上限的主要决定因素。当前后端只支持固定 6 页、固定字段和基础文字排版，后续可以从以下方向升级：

- **可变页数生成**：把当前固定 6 页改成由用户指定页数，或由大模型根据主题自动规划页数。需要扩展 `buildPrompt`、`normalizeDeck`、`createSlideFillFrames` 和前端进度计算。
- **多阶段内容规划**：先让大模型生成大纲和页面规划，再按页面逐页生成内容。这样可以支持更长 PPT，也能减少一次性 JSON 过大导致的模型输出不稳定。
- **更丰富的页面类型**：在 `SlideLayoutType` 中增加 `chart`、`image`、`comparison`、`timeline`、`process`、`table`、`quote`、`caseStudy` 等类型。
- **结构化内容块**：把每页从 `title/subtitle/bullets` 升级为 `blocks` 数组。每个 block 可以是文本、图片、图表、表格、指标卡、时间线节点等。
- **数据图表生成**：让大模型返回图表类型和数据，例如柱状图、折线图、饼图、漏斗图。后端渲染器负责把结构化数据转成预览元素和 PPTX 图表。
- **图片和素材生成**：支持从用户上传、图库搜索或 AI 生图得到图片，并在页面中以 `image` block 使用。需要增加素材存储、图片下载、尺寸裁剪和导出逻辑。
- **品牌化配置**：支持上传 Logo、品牌色、字体、页脚、公司名称，让模板渲染时自动应用品牌视觉。
- **模板库持久化**：当前模板硬编码在 `templates.ts`，后续可以改为 JSON/数据库/云存储模板库，并支持后台新增模板。
- **任务持久化**：当前任务存储在内存和 `globalThis` 中，适合本地 demo。生产环境应改成 Redis、数据库或队列系统，避免服务重启后任务丢失。
- **生成队列和并发控制**：引入任务队列，限制并发模型调用和 PPTX 导出，避免多个用户同时生成时阻塞 Node 进程。
- **流式大模型输出**：当前模型调用是非流式，只有模型返回完整 JSON 后才进入动态展示。后续可以用流式输出先展示大纲、再逐页展示生成过程。
- **更严格的模型输出校验**：引入 schema 校验，例如 Zod 或 JSON Schema，明确校验字段类型、页数、block 类型、图表数据和文本长度。
- **多模型策略**：支持模型选择、重试、降级、超时控制和成本统计。例如复杂 PPT 用强模型，普通汇报用轻模型。
- **导出质量升级**：`exporter.ts` 可以补齐图表、图片、表格、页码、母版、备注、动画标记和更精确的字体控制。

### 18.2 前端升级方向

前端当前已经支持表单、模板选择、SSE 播放、主预览、缩略图、主画布标题/副标题/bullet 原位编辑和备注编辑。后续如果要接近真实 PPT 产品，需要进一步增强编辑、预览和交互能力：

- **生成参数面板**：增加页数、受众、语气、行业、汇报场景、详细程度、是否包含图表、是否包含案例等参数。
- **大纲确认流程**：先展示大模型生成的大纲，让用户确认或修改后再生成完整 PPT。
- **逐页编辑增强**：当前已支持当前页文本原位编辑；后续可增加新增 bullet、删除 bullet、页面复制、页面删除和跨页批量编辑。
- **页面重排和删除**：缩略图区域支持拖拽排序、复制、删除、新增页面。
- **模板实时切换**：生成完成后切换模板，前端重新请求或本地重新映射 `RenderedSlide`，让同一份内容快速换风格。
- **复杂元素预览**：扩展 `SlidePreview.vue`，支持图片、图表、表格、流程图、指标卡、图标等 block 渲染。
- **更细粒度动态展示**：当前只做标题、副标题、bullet 的填充动画。后续可以支持图表逐项增长、图片淡入、数据卡片翻入、时间线节点逐个出现。
- **局部重新生成**：用户可以针对单页、单个 block 或某段文案点击“重新生成”，前端只更新对应页面。
- **生成过程可回放**：保存 SSE 动画帧，支持生成完成后回放动态生成过程。
- **多视图模式**：支持“动态预览”“大纲视图”“讲稿视图”“缩略图排序视图”“导出预览”等不同工作模式。
- **错误恢复体验**：SSE 断线后可以展示“重新连接中”和最近一次成功状态，而不是直接进入失败。
- **下载前检查**：导出前展示页面数量、空字段、图片缺失、文字溢出等检查结果。
- **移动端适配升级**：当前移动端可用但偏基础，后续可改成上下分区、缩略图横滑、底部操作栏。

### 18.3 前后端协议升级

复杂 PPT 能力不应该只在前端或后端单边扩展，核心是升级前后端共享的 PPT 数据协议。

当前协议可以抽象为：

```ts
interface RenderedSlide {
  title: string;
  subtitle?: string;
  bullets: string[];
  style: RenderedSlideStyle;
}
```

后续建议升级为 block 模型：

```ts
interface RenderedSlide {
  id: string;
  index: number;
  layoutType: SlideLayoutType;
  blocks: SlideBlock[];
  style: RenderedSlideStyle;
  status: RenderedSlideStatus;
}

type SlideBlock =
  | TextBlock
  | ImageBlock
  | ChartBlock
  | TableBlock
  | MetricBlock
  | TimelineBlock;
```

这样前端 `SlidePreview.vue` 可以按 block 类型渲染，后端 `exporter.ts` 也可以按同一份 block 数据导出 PPTX。动画协议也可以从 `field` 升级为 `blockId`：

```ts
interface PptFillAnimation {
  phase: "template" | "block" | "ready";
  slideIndex: number;
  blockId?: string;
  itemIndex?: number;
}
```

这个方向可以避免继续给 `title/subtitle/bullets` 打补丁，适合支撑复杂 PPT。

### 18.4 模板系统升级

模板系统可以从“硬编码布局”升级为“声明式模板”：

- 模板用 JSON 描述页面类型、区域、颜色、字体、装饰元素和 block 插槽。
- 每个页面类型提供多个 layout 变体，例如内容页可以有左右图文、上下结构、三卡片结构。
- 渲染器根据内容密度选择合适 layout。
- 模板可带预览图，前端模板选择器展示真实缩略图。
- 模板支持品牌变量，例如 `primaryColor`、`logoUrl`、`footerText`。

升级后，大模型只需要决定“这一页是什么类型、有哪些内容块”，具体视觉排版由模板系统完成。

### 18.5 工程化和生产化升级

如果要从 demo 走向多人可用系统，还需要补齐工程层能力：

- **鉴权**：限制 API 使用，保护大模型 key 和生成结果。
- **任务隔离**：每个用户只能访问自己的 job 和下载文件。
- **持久化存储**：保存生成历史、PPT 源数据、导出文件和素材。
- **日志和观测**：记录模型耗时、生成失败原因、导出耗时、SSE 断线率。
- **成本控制**：统计 token 用量、模型调用次数和用户级配额。
- **文件清理策略**：定期清理 `.generated` 中的旧 PPTX 和临时素材。
- **端到端测试**：增加从创建任务到 SSE 完成再到下载 PPTX 的集成测试。
- **视觉回归测试**：对 `SlidePreview.vue` 做截图测试，防止模板改动导致页面错位。

### 18.6 推荐升级顺序

建议按风险从低到高推进：

1. 增加生成参数：页数、语气、受众、行业。
2. 增加更多页面类型：对比页、时间线页、流程页、数据页。
3. 把 `title/subtitle/bullets` 协议升级为 `blocks` 协议。
4. 扩展 `SlidePreview.vue` 支持 block 渲染。
5. 扩展 `exporter.ts` 支持图表、图片和表格导出。
6. 引入大纲确认和更完整的逐页编辑。
7. 引入持久化任务和素材存储。
8. 做模板库和品牌化配置。

按这个顺序做，可以保持现有 MVP 可用，同时逐步提高 PPT 的复杂度和产品体验。

## 19. 设计要点总结

这个项目的核心不是单纯“生成 PPT”，而是把 PPT 生成过程产品化为可见的动态过程。

关键技术点：

- 用大模型生成结构化 JSON，而不是直接生成 PPT 文件。
- 用模板系统把语义内容变成可展示的 `RenderedSlide`。
- 用后端拆帧保证动态展示顺序稳定。
- 用 SSE 将生成状态和页面快照实时推给前端。
- 用 Vue 负责状态消费、页面播放、主画布原位编辑和保存交互。
- 用 `pptxgenjs` 从同一份渲染数据导出真实 `.pptx` 文件。
- 用 `PATCH /api/ppt/jobs/{jobId}` 保存编辑后的 slides，并重新导出 PPTX。

这种设计让预览动画和最终导出使用同一份数据来源，避免“预览看起来一套，导出文件又是另一套”的问题。
