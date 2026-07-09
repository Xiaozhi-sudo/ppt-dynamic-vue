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
│   │               ├── events/route.ts
│   │               └── download/route.ts
│   ├── frontend/
│   │   ├── main.ts                    # Vue app bootstrap
│   │   ├── App.vue                    # Vue 根组件
│   │   ├── styles.css                 # Vue 前端样式
│   │   ├── data/pptSteps.ts           # 前端流程步骤元数据
│   │   ├── types/ppt.ts               # 前端 API DTO 类型
│   │   └── components/
│   │       ├── PptWorkspace.vue       # 主工作区，管理表单、任务、SSE、预览
│   │       ├── TemplatePicker.vue     # 模板选择
│   │       ├── GenerationTimeline.vue # 生成进度时间线
│   │       └── SlidePreview.vue       # 幻灯片大图和缩略图渲染
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

- `large`：主预览，播放字段级动画和生成提示。
- `thumbnail`：缩略图，只展示页面状态，不播放字段级动画。

## 13. 进度时间线

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

## 14. PPTX 导出

导出逻辑在 `src/lib/ppt/exporter.ts`，使用 `pptxgenjs`。

导出流程：

1. 校验 `jobId`，防止路径穿越。
2. 创建 `.generated/pptx` 输出目录。
3. 创建 `PptxGenJS` 实例。
4. 按 `RenderedSlide` 添加背景、装饰元素、标题、副标题、正文和备注。
5. 生成 `nodebuffer`。
6. 使用 Node `fs/promises.writeFile` 写入 `.pptx`。

这里没有直接依赖 `pptx.writeFile`，因为在当前运行环境中，库的 `writeFile` 可能在文件完全落盘前 resolve。显式写 buffer 可以保证函数返回时文件已经存在。

## 15. 错误处理和降级

项目有几类错误处理：

- 模板加载失败：前端显示错误条。
- 创建任务失败：前端进入 `failed` 状态。
- SSE 解析失败：前端关闭连接并提示重新生成。
- SSE 临时断开：前端最多重试 3 次。
- 大模型调用失败：后端记录警告，降级到本地生成器。
- 任务失败：后端推送 `error` 事件，前端展示失败状态。

大模型失败不会直接导致整个 PPT 生成失败，除非后续渲染或导出也失败。

## 16. 当前验证命令

常用验证命令：

```bash
npm test
npm run lint
npm run build:web
npm run build:api
```

当前项目已通过：

- 9 个测试文件
- 34 个测试
- Vue 前端生产构建
- Next API 生产构建
- ESLint 检查

## 17. 设计要点总结

这个项目的核心不是单纯“生成 PPT”，而是把 PPT 生成过程产品化为可见的动态过程。

关键技术点：

- 用大模型生成结构化 JSON，而不是直接生成 PPT 文件。
- 用模板系统把语义内容变成可展示的 `RenderedSlide`。
- 用后端拆帧保证动态展示顺序稳定。
- 用 SSE 将生成状态和页面快照实时推给前端。
- 用 Vue 只负责状态消费、页面播放和交互。
- 用 `pptxgenjs` 从同一份渲染数据导出真实 `.pptx` 文件。

这种设计让预览动画和最终导出使用同一份数据来源，避免“预览看起来一套，导出文件又是另一套”的问题。
