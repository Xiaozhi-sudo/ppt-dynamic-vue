# PPT Gen Test V1

一个基于 Next.js 的 AI PPT 生成器原型。用户输入主题并选择模板后，系统会生成 6 页中文 PPT 内容，在右侧预览区展示逐页、逐元素填充动画，并支持导出 `.pptx` 文件。

## 功能

- 主题生成 PPT：输入汇报主题后生成封面、目录、内容页和总结页。
- 模板选择：内置商务蓝、科技黑、清新绿 3 套模板。
- 生成过程可视化：右侧主预览先显示模板骨架，再依次填充标题、副标题和要点。
- SSE 实时进度：前端通过事件流接收生成状态、页面快照和动画阶段。
- PPTX 导出：生成完成后可下载标准 PowerPoint 文件。
- 测试覆盖：包含内容生成、模板、渲染、动画帧、任务流和导出测试。

## 技术栈

- Next.js 15 App Router
- React 19
- TypeScript
- pptxgenjs
- Vitest
- ESLint

## 本地启动

安装依赖：

```bash
npm install
```

配置大模型环境变量。推荐创建 `.env.local`：

```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

启动开发服务：

```bash
npm run dev
```

默认访问：

```text
http://127.0.0.1:3000
```

生产构建和启动：

```bash
npm run build
npm run start
```

## 使用流程

1. 在左侧输入 PPT 主题。
2. 选择一个模板。
3. 点击“生成 PPT”。
4. 右侧主预览会按页面顺序展示生成动画：
   - 铺设 PPT 模板骨架
   - 填充当前页标题
   - 填充当前页副标题
   - 逐条填充正文要点
   - 当前页完成后自动切到下一页
5. 生成完成后点击“下载 PPTX”。

## API

创建生成任务：

```http
POST /api/ppt/jobs
Content-Type: application/json

{
  "topic": "AI 生成 PPT 过程可视化",
  "templateId": "business-blue"
}
```

订阅生成事件：

```http
GET /api/ppt/jobs/{jobId}/events
```

下载 PPTX：

```http
GET /api/ppt/jobs/{jobId}/download
```

获取模板：

```http
GET /api/templates
```

## 动画数据结构

后端会通过 SSE 推送 `slides` 快照和 `animation` 元数据，前端根据这些字段驱动右侧预览动画：

```json
{
  "type": "slides",
  "step": "filling_slides",
  "message": "正在填充第 2 页要点",
  "progress": 55,
  "slides": [],
  "animation": {
    "phase": "bullets",
    "field": "bullets",
    "slideIndex": 1,
    "bulletIndex": 0
  }
}
```

`phase` 包括：

- `template`：模板骨架
- `title`：标题填充
- `subtitle`：副标题填充
- `bullets`：正文要点填充
- `ready`：当前页完成

## 脚本

```bash
npm run dev      # 启动开发服务
npm run build    # 生产构建
npm run start    # 启动生产服务
npm run lint     # ESLint 检查
npm test         # 运行测试
```

## 安全说明

不要提交任何真实密钥。以下文件和目录已被 `.gitignore` 排除：

- `.env`
- `.env*.local`
- `llm-information.md`
- `node_modules/`
- `.next/`
- `.generated/`
- `.agents/`
- `.codex/`

## 项目结构

```text
src/app/                  Next.js 页面和 API 路由
src/components/           前端工作区、模板选择、PPT 预览组件
src/lib/ppt/              PPT 内容生成、模板、渲染、动画帧、任务和导出逻辑
docs/superpowers/         开发过程中的规格和计划文档
```
