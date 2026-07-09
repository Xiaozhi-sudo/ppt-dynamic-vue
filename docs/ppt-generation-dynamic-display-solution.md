# PPT 生成动态展示前后端技术实现方案

## 1. 方案目标

本文档描述一个通用的 PPT 生成与动态展示技术方案，不依赖具体项目实现。

目标是实现如下体验：

1. 用户在前端输入主题、选择模板和生成参数。
2. 前端向后端发起 PPT 生成请求。
3. 后端异步调用大模型生成 PPT 内容。
4. 后端将内容渲染为可预览的幻灯片结构。
5. 后端把生成过程拆成多个动态展示事件，实时推送给前端。
6. 前端按事件逐步渲染 PPT 页面，让用户看到“PPT 正在生成”的过程。
7. 后端最终导出 `.pptx` 文件。
8. 前端在生成完成后提供下载入口。

核心思想是：**PPT 不是一次性生成完再展示，而是后端持续推送结构化生成状态，前端根据状态逐步渲染页面。**

## 2. 整体架构

推荐采用前后端分层架构：

```text
Frontend
  ├── 生成表单
  ├── 生成进度展示
  ├── PPT 动态预览画布
  ├── 缩略图列表
  └── 下载入口

Backend API
  ├── 创建生成任务
  ├── 查询任务状态
  ├── SSE/WebSocket 推送生成事件
  ├── 下载 PPTX 文件
  └── 可选：保存编辑后的 PPT

PPT Generation Service
  ├── Prompt 构建
  ├── 大模型调用
  ├── JSON 解析与校验
  ├── 模板匹配
  ├── 页面渲染
  ├── 动态帧生成
  └── PPTX 导出

Storage
  ├── 任务状态
  ├── 幻灯片结构化数据
  ├── 动态事件缓存
  ├── 导出文件
  └── 图片/素材资源
```

## 3. 前端发起生成请求

用户点击“生成 PPT”时，前端向后端创建任务接口发送请求。

推荐接口：

```http
POST /api/ppt/jobs
Content-Type: application/json
```

请求体示例：

```json
{
  "topic": "2026 年新能源车市场增长策略",
  "templateId": "business-blue",
  "pageCount": 8,
  "language": "zh-CN",
  "audience": "公司管理层",
  "tone": "专业、简洁、偏商业汇报",
  "includeCharts": true,
  "includeSpeakerNotes": true
}
```

后端不应该在这个请求里同步完成全部 PPT 生成，因为大模型调用、图片处理和 PPTX 导出都可能耗时较长。推荐做法是：

- 创建一个异步任务。
- 立即返回 `jobId`。
- 前端拿到 `jobId` 后订阅任务事件。

响应示例：

```json
{
  "jobId": "job_20260709_x7af92",
  "status": "queued"
}
```

前端收到 `jobId` 后，立即建立实时连接：

```ts
const eventSource = new EventSource(`/api/ppt/jobs/${jobId}/events`);
```

也可以使用 WebSocket。SSE 更适合此类“服务端持续推送，前端只接收”的场景，实现简单，浏览器原生支持。

## 4. 后端创建任务

后端收到创建请求后，需要完成以下动作：

1. 校验请求参数。
2. 创建任务记录。
3. 保存任务初始状态。
4. 投递异步生成任务。
5. 返回 `jobId`。

任务初始结构建议如下：

```ts
interface PptJob {
  id: string;
  userId?: string;
  topic: string;
  templateId: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: PptStep;
  progress: number;
  slides: RenderedSlide[];
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
```

任务状态可以存储在：

- 本地内存：适合 demo，不适合生产。
- Redis：适合短生命周期任务和 SSE 事件。
- 数据库：适合保存生成历史。
- 对象存储：适合保存导出的 PPTX 和图片素材。

生产环境推荐：

```text
PostgreSQL/MySQL：保存任务元数据
Redis：保存实时状态和事件队列
S3/OSS/MinIO：保存 PPTX 和素材文件
BullMQ/Celery/Sidekiq：执行异步生成任务
```

## 5. 后端生成 PPT 的核心流程

后端异步任务建议拆成多个阶段，每个阶段都更新任务状态并推送事件。

```text
1. analyze_topic
2. generate_outline
3. generate_slide_content
4. validate_content
5. match_template
6. render_slides
7. build_animation_frames
8. export_pptx
9. completed
```

### 5.1 分析主题

后端根据用户输入构建生成上下文：

- 主题
- 页数
- 受众
- 场景
- 语言
- 风格
- 是否需要图表
- 是否需要讲稿备注

这一阶段可以不调用大模型，也可以先调用一次轻量模型做意图分析。

推送事件：

```json
{
  "type": "progress",
  "step": "analyze_topic",
  "message": "正在分析主题和汇报场景",
  "progress": 10
}
```

### 5.2 生成大纲

后端调用大模型生成 PPT 大纲。

推荐先生成大纲，再生成具体页面内容，而不是一次性要求模型输出完整 PPT。这样更稳定，也便于前端展示“正在生成结构”的过程。

大纲结构示例：

```json
{
  "title": "2026 年新能源车市场增长策略",
  "subtitle": "市场趋势、竞争格局与增长路径",
  "sections": [
    {
      "title": "市场背景",
      "slides": ["行业趋势", "用户变化"]
    },
    {
      "title": "增长机会",
      "slides": ["细分市场机会", "渠道策略"]
    },
    {
      "title": "行动计划",
      "slides": ["重点举措", "里程碑"]
    }
  ]
}
```

推送事件：

```json
{
  "type": "outline",
  "step": "generate_outline",
  "message": "已生成演示文稿大纲",
  "progress": 25,
  "outline": {}
}
```

### 5.3 生成每页内容

后端根据大纲逐页生成内容。

推荐模型输出结构化 JSON，而不是 Markdown 或自然语言文本。这样前端和导出器都能稳定消费。

页面内容结构示例：

```ts
interface GeneratedSlide {
  id: string;
  layoutType:
    | "cover"
    | "agenda"
    | "content"
    | "comparison"
    | "chart"
    | "timeline"
    | "summary";
  title: string;
  subtitle?: string;
  blocks: SlideBlock[];
  notes?: string;
}
```

内容块结构示例：

```ts
type SlideBlock =
  | {
      type: "text";
      id: string;
      text: string;
    }
  | {
      type: "bullets";
      id: string;
      items: string[];
    }
  | {
      type: "chart";
      id: string;
      chartType: "bar" | "line" | "pie";
      title: string;
      data: Array<{ label: string; value: number }>;
    }
  | {
      type: "image";
      id: string;
      prompt?: string;
      url?: string;
      alt: string;
    }
  | {
      type: "table";
      id: string;
      columns: string[];
      rows: string[][];
    };
```

如果暂时只做简单 PPT，也可以先使用：

```ts
interface GeneratedSlide {
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
}
```

但长期建议使用 `blocks`，因为图表、图片、表格和复杂排版都需要它。

### 5.4 内容校验与修复

大模型输出不能直接信任，需要做校验：

- JSON 是否能解析。
- 页数是否符合要求。
- 每页是否有标题。
- block 类型是否合法。
- 图表数据是否完整。
- 文本是否过长。
- 是否有空页面。

推荐使用 JSON Schema 或 Zod。

如果校验失败，可以：

- 要求模型修复 JSON。
- 局部重新生成失败页面。
- 使用 fallback 模板补齐缺失字段。

### 5.5 匹配模板

模板系统负责把结构化内容转成可展示页面。

模板通常包含：

- 颜色
- 字体
- 背景
- 页面尺寸
- 页面类型
- 内容区域
- 装饰元素
- block 插槽

模板示例：

```ts
interface PptTemplate {
  id: string;
  name: string;
  theme: string;
  colors: ThemeColors;
  fontFamily: string;
  layouts: Record<SlideLayoutType, SlideLayout[]>;
}
```

同一种页面类型可以有多个 layout 变体。后端可以根据内容密度自动选择：

- bullet 少：选择大字留白版。
- bullet 多：选择紧凑列表版。
- 有图表：选择图文/图表布局。
- 有对比：选择左右对比布局。

### 5.6 渲染为前端可展示结构

后端需要把 `GeneratedSlide` 渲染成 `RenderedSlide`。

`RenderedSlide` 是前端动态展示的核心数据，不是 PPTX 文件本身。

示例：

```ts
interface RenderedSlide {
  id: string;
  index: number;
  layoutType: string;
  status: "pending" | "filling" | "ready" | "failed";
  background: string;
  elements: SlideElement[];
  notes?: string;
}

type SlideElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | ChartElement
  | TableElement;
```

元素结构示例：

```ts
interface TextElement {
  id: string;
  type: "text";
  role: "title" | "subtitle" | "body" | "caption";
  text: string;
  region: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  style: {
    fontSize: number;
    fontWeight?: number;
    color: string;
    align?: "left" | "center" | "right";
  };
}
```

坐标推荐使用百分比，便于前端按 16:9 容器自适应：

```ts
region: {
  x: 0.08,
  y: 0.12,
  w: 0.72,
  h: 0.18
}
```

前端根据这些坐标用 CSS absolute positioning 渲染。

## 6. 后端如何把 PPT 返回给前端

这里要区分两类“返回”：

1. **动态预览数据返回给前端**
2. **最终 PPTX 文件返回给前端**

### 6.1 动态预览数据

动态预览不建议返回二进制 PPTX。因为 PPTX 文件不适合浏览器逐步展示，也不适合做生成过程动画。

推荐返回结构化事件：

```json
{
  "type": "slides",
  "jobId": "job_20260709_x7af92",
  "step": "render_slides",
  "message": "正在填充第 3 页正文",
  "progress": 58,
  "status": "running",
  "slides": [],
  "animation": {
    "slideIndex": 2,
    "elementId": "slide-3-bullet-2",
    "phase": "element",
    "itemIndex": 1
  }
}
```

这些事件通过 SSE 或 WebSocket 推给前端。

### 6.2 最终 PPTX 文件

生成完成后，后端导出 PPTX，并返回下载地址：

```json
{
  "type": "completed",
  "jobId": "job_20260709_x7af92",
  "status": "completed",
  "progress": 100,
  "downloadUrl": "/api/ppt/jobs/job_20260709_x7af92/download"
}
```

前端显示下载按钮：

```html
<a href="/api/ppt/jobs/job_20260709_x7af92/download">下载 PPTX</a>
```

下载接口：

```http
GET /api/ppt/jobs/{jobId}/download
```

响应头：

```http
Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
Content-Disposition: attachment; filename="generated.pptx"
```

后端可以从本地文件、对象存储或内存 buffer 返回 PPTX。

## 7. 动态展示事件设计

前端动态展示依赖后端事件。建议统一事件协议。

```ts
type PptJobEvent =
  | ProgressEvent
  | OutlineEvent
  | SlideFrameEvent
  | CompletedEvent
  | FailedEvent;
```

进度事件：

```json
{
  "type": "progress",
  "step": "generate_outline",
  "message": "正在生成大纲",
  "progress": 20,
  "status": "running"
}
```

页面帧事件：

```json
{
  "type": "slide_frame",
  "step": "render_slides",
  "message": "正在填充第 2 页标题",
  "progress": 45,
  "status": "running",
  "slides": [],
  "animation": {
    "phase": "element",
    "slideIndex": 1,
    "elementId": "slide-2-title"
  }
}
```

完成事件：

```json
{
  "type": "completed",
  "step": "completed",
  "message": "PPT 已生成完成",
  "progress": 100,
  "status": "completed",
  "slides": [],
  "downloadUrl": "/api/ppt/jobs/job_20260709_x7af92/download"
}
```

失败事件：

```json
{
  "type": "failed",
  "step": "export_pptx",
  "message": "PPTX 导出失败",
  "progress": 90,
  "status": "failed",
  "error": "Export timeout"
}
```

## 8. 后端如何生成动态展示帧

动态展示帧可以有两种做法。

### 8.1 快照帧方案

后端每次推送完整 `slides` 快照。

示例：

```json
{
  "slides": [
    {
      "id": "slide-1",
      "elements": [
        { "id": "title", "text": "新能源车市场增长策略" }
      ]
    }
  ]
}
```

优点：

- 前端简单。
- 状态一致性强。
- 刷新或重连后容易恢复。

缺点：

- 数据量较大。
- 页数很多时 SSE 消息会变大。

适合 MVP 和中小型 PPT。

### 8.2 Patch 增量方案

后端只推送变化：

```json
{
  "patch": {
    "op": "replace",
    "path": "/slides/2/elements/3/text",
    "value": "新的 bullet"
  }
}
```

优点：

- 数据量小。
- 适合复杂页面和大量元素。

缺点：

- 前端状态机复杂。
- 重连恢复需要额外快照。

生产系统可以采用：**快照 + patch 混合方案**。关键节点推快照，细粒度动画推 patch。

### 8.3 推荐帧生成顺序

对一页 PPT，推荐按如下顺序生成展示帧：

```text
1. 显示页面背景
2. 显示模板装饰元素
3. 显示标题
4. 显示副标题
5. 逐条显示正文 bullet
6. 显示图表坐标轴
7. 逐项显示图表数据
8. 显示图片或图标
9. 标记当前页完成
10. 切换到下一页
```

每一步都可以对应一个事件。

## 9. 前端如何动态渲染

前端动态渲染分为四层：

```text
任务状态层
  └── 管理 jobId、status、progress、message

事件订阅层
  └── SSE/WebSocket 连接、重试、断线处理

幻灯片状态层
  └── 保存 slides、activeSlideIndex、animation

画布渲染层
  └── 根据 RenderedSlide 绘制 PPT 页面
```

### 9.1 建立事件连接

前端创建任务成功后：

```ts
const response = await fetch("/api/ppt/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const { jobId } = await response.json();
const eventSource = new EventSource(`/api/ppt/jobs/${jobId}/events`);
```

监听消息：

```ts
eventSource.onmessage = (message) => {
  const event = JSON.parse(message.data);
  handlePptEvent(event);
};
```

处理断线：

```ts
eventSource.onerror = () => {
  retryWithBackoff();
};
```

### 9.2 更新前端状态

前端收到事件后更新状态：

```ts
function handlePptEvent(event: PptJobEvent) {
  status.value = event.status;
  progress.value = event.progress;
  message.value = event.message;

  if (event.slides) {
    slides.value = event.slides;
  }

  if (event.animation) {
    animation.value = event.animation;
    activeSlideIndex.value = event.animation.slideIndex;
  }

  if (event.status === "completed") {
    downloadUrl.value = event.downloadUrl;
    eventSource.close();
  }
}
```

### 9.3 渲染 PPT 画布

前端不直接解析 PPTX，而是渲染后端返回的结构化页面。

推荐使用 HTML/CSS 实现预览：

```html
<div class="slide-canvas">
  <div
    v-for="element in slide.elements"
    :key="element.id"
    class="slide-element"
    :style="toElementStyle(element)"
  >
    {{ element.text }}
  </div>
</div>
```

样式：

```css
.slide-canvas {
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
}

.slide-element {
  position: absolute;
}
```

坐标转换：

```ts
function toElementStyle(element: SlideElement) {
  return {
    left: `${element.region.x * 100}%`,
    top: `${element.region.y * 100}%`,
    width: `${element.region.w * 100}%`,
    height: `${element.region.h * 100}%`,
  };
}
```

### 9.4 动画高亮

后端事件中带有当前动画元素：

```json
{
  "animation": {
    "slideIndex": 2,
    "elementId": "slide-3-title",
    "phase": "element"
  }
}
```

前端根据 `elementId` 给对应元素加 class：

```html
<div
  :class="[
    'slide-element',
    { 'is-filling': animation?.elementId === element.id }
  ]"
>
  {{ element.text }}
</div>
```

CSS：

```css
.slide-element.is-filling {
  animation: fill-in 420ms ease-out;
}

@keyframes fill-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## 10. 前端动态展示页面结构

推荐前端页面包含：

```text
左侧控制区
  ├── 主题输入
  ├── 模板选择
  ├── 生成参数
  ├── 生成按钮
  └── 下载按钮

右侧预览区
  ├── 当前状态文案
  ├── 进度条
  ├── PPT 主画布
  ├── 缩略图列表
  └── 生成步骤时间线
```

核心组件：

```text
PptWorkspace
  ├── GenerationForm
  ├── TemplatePicker
  ├── GenerationTimeline
  ├── SlideCanvas
  ├── SlideThumbnails
  └── DownloadButton
```

## 11. 编辑与重新导出

如果需要支持用户编辑生成后的 PPT，建议不要直接修改 PPTX 文件，而是修改结构化 `slides` 数据。

流程：

1. 用户在前端修改标题、正文、图表数据等。
2. 前端更新本地 `slides` 状态，预览即时变化。
3. 前端调用后端保存接口：

```http
PATCH /api/ppt/jobs/{jobId}
Content-Type: application/json
```

请求体：

```json
{
  "slides": []
}
```

4. 后端校验 slides。
5. 后端用新的 slides 重新导出 PPTX。
6. 前端下载最新版 PPTX。

这种方式可以保证：

- 预览数据和导出数据一致。
- 不需要解析和反写 PPTX。
- 后续支持编辑图表、图片、文本都更容易。

## 12. 异常处理

需要覆盖以下异常：

- 创建任务失败。
- 大模型超时。
- 大模型返回非法 JSON。
- 页面渲染失败。
- SSE 断线。
- PPTX 导出失败。
- 下载文件不存在。
- 用户刷新页面后恢复任务失败。

前端策略：

- 展示明确错误信息。
- SSE 断线自动重试。
- 重试多次失败后允许用户重新生成。
- 如果任务已完成，允许重新获取最终状态。

后端策略：

- 每个阶段捕获错误并更新任务状态。
- 保留错误消息。
- 对模型调用设置 timeout。
- 对导出文件做路径安全校验。
- 定期清理过期任务和文件。

## 13. 安全与生产化

生产环境需要考虑：

- API 鉴权。
- 用户只能访问自己的任务。
- 大模型 API Key 只保存在后端。
- 下载链接需要权限校验。
- 文件路径不能由用户直接控制。
- 限制生成频率和并发数量。
- 记录 token 消耗和生成成本。
- 对上传图片做格式和大小限制。
- 对模型输出做内容安全过滤。

## 14. 推荐接口清单

```http
GET /api/ppt/templates
POST /api/ppt/jobs
GET /api/ppt/jobs/{jobId}
GET /api/ppt/jobs/{jobId}/events
PATCH /api/ppt/jobs/{jobId}
GET /api/ppt/jobs/{jobId}/download
DELETE /api/ppt/jobs/{jobId}
```

说明：

- `GET /templates`：获取模板。
- `POST /jobs`：创建生成任务。
- `GET /jobs/{jobId}`：查询任务当前状态。
- `GET /jobs/{jobId}/events`：订阅实时生成事件。
- `PATCH /jobs/{jobId}`：保存用户编辑后的 slides。
- `GET /jobs/{jobId}/download`：下载 PPTX。
- `DELETE /jobs/{jobId}`：删除任务和临时文件。

## 15. 推荐技术选型

前端：

- Vue / React / Svelte 均可。
- 用 HTML/CSS 渲染预览画布。
- 用 SSE 或 WebSocket 接收进度。
- 用 canvas 也可以，但文本编辑和自适应会更复杂。

后端：

- Node.js、Python、Go 都可。
- Node.js 可以使用 `pptxgenjs` 导出 PPTX。
- Python 可以使用 `python-pptx` 导出 PPTX。
- 异步任务可用 BullMQ、Celery、Sidekiq、Temporal。

实时通信：

- SSE：推荐用于单向进度推送。
- WebSocket：适合多人协作、实时编辑。

存储：

- Redis：任务状态和事件缓存。
- PostgreSQL/MySQL：任务历史和用户数据。
- S3/OSS/MinIO：PPTX、图片、素材文件。

## 16. 最小可行版本

如果要先做 MVP，建议只实现：

1. 固定 6 页 PPT。
2. 固定模板。
3. 页面字段只包含标题、副标题、bullet、备注。
4. 后端用大模型生成 JSON。
5. 后端生成快照帧。
6. 前端用 SSE 播放快照。
7. 后端用结构化数据导出 PPTX。

MVP 不建议一开始就做：

- 复杂图表。
- AI 生图。
- 拖拽排版。
- 多人协作。
- 完整模板编辑器。

这些能力应该在结构化协议稳定后再扩展。

## 17. 方案总结

PPT 生成动态展示的关键不是“直接把 PPTX 文件返回给前端”，而是把生成过程拆成可消费的结构化事件。

推荐核心链路：

```text
前端提交生成请求
  -> 后端创建任务
  -> 后端调用大模型生成结构化内容
  -> 后端匹配模板并渲染为 RenderedSlide
  -> 后端生成动态展示帧
  -> 后端通过 SSE/WebSocket 推送事件
  -> 前端按事件渲染 PPT 画布
  -> 后端导出 PPTX
  -> 前端展示下载链接
```

只要结构化数据协议设计合理，前端动态预览、用户编辑和最终 PPTX 导出就可以共用同一份数据，系统后续也能扩展到图表、图片、复杂模板和品牌化 PPT。
