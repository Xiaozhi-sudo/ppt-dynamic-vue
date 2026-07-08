# PPT Generator MVP Design

Date: 2026-06-26

## Goal

Build a full-stack MVP for integrating a Doubao-style PPT generation experience into YiCe AI, a general AI chat assistant.

The MVP lets a user enter a topic, choose a PPT template, watch the generation process step by step, preview slides as text is filled into the template, and download a real `.pptx` file.

## Confirmed Scope

- Build from an empty workspace.
- Use a single Next.js full-stack app.
- Use simulated AI content generation for the first version.
- Generate real PPTX files with `pptxgenjs`.
- Use an assistant-style UI: chat/input area on the left, PPT generation workspace on the right.
- Show generation progress similar to Doubao: outline generation, template matching, text filling, preview generation, export completion.

## Non-Goals

- No real LLM API integration in the first MVP.
- No persistent database.
- No user accounts, billing, permissions, or team collaboration.
- No advanced PPT editing canvas.
- No uploaded custom PPT template parsing in the first version.

## Architecture

The app will use Next.js App Router with TypeScript.

Core modules:

- `templates`: Defines built-in PPT templates, slide layouts, colors, typography, and placeholder regions.
- `generator`: Simulates AI output by turning a user topic into structured deck content.
- `renderer`: Merges generated deck content with the selected template and produces slide preview JSON.
- `exporter`: Converts rendered slide JSON into a real PPTX file with `pptxgenjs`.
- `jobs`: Manages in-memory generation jobs, progress events, slide updates, and download artifacts.
- `ui`: Provides the chat-style input, template selector, generation timeline, slide preview grid, active slide preview, and download control.

## Data Model

Template:

- `id`
- `name`
- `description`
- `theme`
- `colors`
- `fontFamily`
- `layouts`

Slide layout:

- `type`: `cover`, `agenda`, `section`, `content`, or `summary`
- `background`
- `titleBox`
- `subtitleBox`
- `bodyBox`
- `accentElements`

Generated deck:

- `title`
- `subtitle`
- `sections`
- `slides`
- `speakerNotes`

Rendered slide:

- `id`
- `index`
- `layoutType`
- `templateId`
- `title`
- `subtitle`
- `bullets`
- `notes`
- `style`
- `status`

Job:

- `id`
- `topic`
- `templateId`
- `status`: `queued`, `running`, `completed`, or `failed`
- `currentStep`
- `progress`
- `slides`
- `downloadPath`
- `error`
- `createdAt`
- `updatedAt`

## User Flow

1. User enters a topic in the YiCe AI style input area.
2. User selects one of the built-in PPT templates.
3. User clicks generate.
4. Frontend creates a PPT job through the API.
5. Frontend opens an SSE connection for job events.
6. Backend emits progress steps:
   - Analyzing topic
   - Generating outline
   - Matching template pages
   - Filling slide text
   - Rendering previews
   - Exporting PPTX
   - Completed
7. Frontend updates the timeline and slide preview as events arrive.
8. User downloads the final PPTX after completion.

## API Design

`GET /api/templates`

Returns the built-in template list and preview metadata.

`POST /api/ppt/jobs`

Request:

```json
{
  "topic": "新能源汽车市场分析",
  "templateId": "business-blue"
}
```

Response:

```json
{
  "jobId": "job_..."
}
```

`GET /api/ppt/jobs/:jobId/events`

Streams server-sent events:

```json
{
  "type": "progress",
  "step": "filling_slides",
  "message": "正在填充第 3 页内容",
  "progress": 65,
  "slides": []
}
```

`GET /api/ppt/jobs/:jobId/download`

Returns the generated `.pptx` file when the job is complete.

## Frontend Design

The page uses a two-column application layout.

Left column:

- YiCe AI style assistant area.
- Topic input.
- Short generated assistant message showing the selected topic and job state.
- Generate button.

Right column:

- Template selector at the top.
- Generation timeline with step status.
- Active slide preview.
- Slide thumbnail grid.
- Download button after completion.

The UI should be functional and dense enough for a product tool. It should avoid a marketing landing-page structure.

## Template Strategy

The MVP includes three built-in templates:

- Business Blue: clear corporate report style.
- Tech Dark: dark technical presentation style.
- Fresh Green: lighter product or education style.

Each template includes five logical layouts:

- Cover
- Agenda
- Section divider
- Content
- Summary

Generated decks can reuse the content layout for multiple body slides.

## Generation Strategy

The simulated generator will produce deterministic content from the topic:

- Deck title based on the topic.
- Subtitle with a report framing.
- Four sections.
- Six slides:
  - Cover
  - Agenda
  - Three content slides
  - Summary

The module boundary should make it easy to replace the simulated generator with a real YiCe AI or LLM adapter later.

## PPTX Export Strategy

The exporter will use `pptxgenjs`.

It will:

- Create a widescreen 16:9 deck.
- Apply template colors and fonts.
- Render title, subtitle, body bullets, and simple accent elements.
- Save the PPTX under a generated output path.
- Expose the file through the download API.

## Error Handling

Handled errors:

- Empty topic.
- Missing or unknown template.
- Unknown job.
- SSE subscription to a failed job.
- Download before completion.
- PPTX export failure.

The frontend displays the failed generation step and allows the user to start a new job.

## Testing And Verification

Minimum verification:

- `GET /api/templates` returns templates.
- `POST /api/ppt/jobs` creates a job for a valid topic and template.
- SSE receives the full generation sequence.
- PPTX export creates a non-empty `.pptx` file.
- Download API returns the completed file.
- The app starts locally and the UI shows template selection, generation progress, slide previews, and download state.

## Implementation Notes

- Keep job state in memory for the MVP.
- Store generated PPTX files in a local writable output directory.
- Use stable TypeScript types shared by API, generator, renderer, exporter, and UI.
- Keep the simulated generator isolated behind an interface so real AI integration is a later adapter change.
- Prefer simple template JSON definitions over custom template parsing in this version.
