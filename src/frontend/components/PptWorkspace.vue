<template>
  <main class="workspace-shell">
    <aside class="control-rail">
      <div class="brand-block">
        <span class="eyebrow">YiCe AI PPT</span>
        <h1>动态生成演示文稿</h1>
      </div>

      <label class="topic-field" for="ppt-topic">
        <span>汇报主题</span>
        <textarea
          id="ppt-topic"
          v-model="topic"
          placeholder="例如：2026 年新能源车市场增长策略"
          rows="7"
        />
      </label>

      <section class="control-group" aria-label="模板">
        <div class="control-group__header">
          <span>模板风格</span>
          <em v-if="selectedTemplate">{{ selectedTemplate.theme }}</em>
        </div>
        <TemplatePicker
          :selected-template-id="selectedTemplateId"
          :templates="templates"
          @select="selectedTemplateId = $event"
        />
      </section>

      <div v-if="error" class="error-banner" role="alert">
        {{ error }}
      </div>

      <div class="action-row">
        <button
          class="primary-action"
          :disabled="!canGenerate"
          type="button"
          @click="handleGenerate"
        >
          {{ generateLabel }}
        </button>
        <a
          v-if="status === 'completed' && jobId && !hasUnsavedEdits"
          class="download-action"
          :href="`/api/ppt/jobs/${jobId}/download`"
        >
          下载 PPTX
        </a>
        <span v-else-if="status === 'completed' && hasUnsavedEdits" class="download-action is-disabled">
          保存后下载
        </span>
      </div>

      <GenerationTimeline
        :current-step="currentStep"
        :progress="progress"
        :status="status"
      />
    </aside>

    <section class="preview-workbench" aria-label="幻灯片动态预览">
      <header class="preview-toolbar">
        <div>
          <span class="eyebrow">实时预览</span>
          <h2>{{ slides.length > 0 ? `${slides.length} 页幻灯片` : "等待生成" }}</h2>
          <p>{{ currentMessage }}</p>
        </div>
        <span :class="['status-pill', `status-pill--${status}`]">{{ status }}</span>
      </header>

      <div class="preview-stage">
        <SlidePreview
          v-if="activeSlide"
          active
          :animation="activeSlideAnimation"
          :editable="canEditActiveSlide"
          mode="large"
          :slide="activeSlide"
          @update-title="updateActiveSlideText('title', $event)"
          @update-subtitle="updateActiveSlideText('subtitle', $event)"
          @update-bullet="updateActiveSlideBullet"
        />
        <div v-else class="empty-preview">
          <span>16:9</span>
          <strong>生成后在这里查看完整页面</strong>
        </div>
      </div>

      <div v-if="slides.length > 0" class="slide-strip" aria-label="幻灯片缩略图">
        <div v-for="(slide, index) in slides" :key="slide.id" class="slide-strip__item">
          <span>{{ String(index + 1).padStart(2, "0") }}</span>
          <SlidePreview
            :active="index === activeSlideIndex"
            mode="thumbnail"
            selectable
            :slide="slide"
            @select="activeSlideIndex = index"
          />
        </div>
      </div>

      <section v-if="canEditActiveSlide" class="slide-editor" aria-label="编辑当前幻灯片">
        <div class="slide-editor__header">
          <div>
            <span class="eyebrow">编辑当前页</span>
            <h3>第 {{ activeSlideIndex + 1 }} 页文案</h3>
          </div>
          <span v-if="editMessage" class="edit-status">{{ editMessage }}</span>
        </div>

        <p class="editor-hint">点击预览页里的标题、副标题或要点即可直接修改。</p>

        <label class="editor-field" for="slide-notes-editor">
          <span>备注</span>
          <textarea
            id="slide-notes-editor"
            :value="activeSlide?.notes ?? ''"
            rows="3"
            @input="updateActiveSlideText('notes', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <div class="editor-actions">
          <p v-if="editError" class="editor-error">{{ editError }}</p>
          <button
            data-testid="save-slide-edits"
            class="primary-action primary-action--compact"
            :disabled="!hasUnsavedEdits || isSavingEdits"
            type="button"
            @click="handleSaveSlideEdits"
          >
            {{ isSavingEdits ? "保存中..." : "保存修改" }}
          </button>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import GenerationTimeline from "./GenerationTimeline.vue";
import SlidePreview from "./SlidePreview.vue";
import TemplatePicker from "./TemplatePicker.vue";
import type {
  CreateJobResponse,
  PptFillAnimation,
  PptJobEvent,
  PptStepKey,
  PptTemplate,
  RenderedSlide,
  TemplatesResponse,
  UpdateJobResponse,
  WorkspaceStatus,
} from "@/frontend/types/ppt";

const terminalStatuses: WorkspaceStatus[] = ["completed", "failed"];
const maxEventSourceRetries = 3;
const eventSourceRetryDelayMs = 700;

const topic = ref("");
const templates = ref<PptTemplate[]>([]);
const selectedTemplateId = ref<string>();
const jobId = ref<string>();
const status = ref<WorkspaceStatus>("idle");
const currentStep = ref<PptStepKey>("analyzing");
const progress = ref(0);
const slides = ref<RenderedSlide[]>([]);
const activeSlideIndex = ref(0);
const animation = ref<PptFillAnimation>();
const currentMessage = ref("等待开始生成");
const error = ref<string>();
const terminal = ref(false);
const isSubmitting = ref(false);
const eventSource = ref<EventSource>();
const retryTimer = ref<ReturnType<typeof setTimeout>>();
const hasUnsavedEdits = ref(false);
const isSavingEdits = ref(false);
const editMessage = ref<string>();
const editError = ref<string>();

let disposed = false;

const selectedTemplate = computed(() =>
  templates.value.find((template) => template.id === selectedTemplateId.value),
);
const activeSlide = computed(
  () => slides.value[activeSlideIndex.value] ?? slides.value[0],
);
const activeSlideAnimation = computed(() =>
  animation.value?.slideIndex === activeSlide.value?.index ? animation.value : undefined,
);
const canEditActiveSlide = computed(
  () => status.value === "completed" && Boolean(activeSlide.value),
);
const isGenerating = computed(
  () => status.value === "queued" || status.value === "running",
);
const canGenerate = computed(
  () =>
    topic.value.trim().length > 0 &&
    Boolean(selectedTemplateId.value) &&
    !isGenerating.value,
);
const generateLabel = computed(() => {
  if (isGenerating.value) return "生成中...";
  if (status.value === "failed") return "重新生成";
  return "生成 PPT";
});

const replaceActiveSlide = (updater: (slide: RenderedSlide) => RenderedSlide) => {
  const targetSlide = activeSlide.value;
  if (!targetSlide) return;

  slides.value = slides.value.map((slide) =>
    slide.id === targetSlide.id ? updater(slide) : slide,
  );
  hasUnsavedEdits.value = true;
  editMessage.value = undefined;
  editError.value = undefined;
};

const updateActiveSlideText = (
  field: "title" | "subtitle" | "notes",
  value: string,
) => {
  replaceActiveSlide((slide) => ({
    ...slide,
    [field]: value,
  }));
};

const updateActiveSlideBullet = (bulletIndex: number, value: string) => {
  replaceActiveSlide((slide) => ({
    ...slide,
    bullets: slide.bullets.map((bullet, index) =>
      index === bulletIndex ? value : bullet,
    ),
  }));
};

const closeEventSource = () => {
  eventSource.value?.close();
  eventSource.value = undefined;
};

const loadTemplates = async () => {
  try {
    const response = await fetch("/api/templates");
    const data = (await response.json()) as TemplatesResponse;

    if (!response.ok) {
      throw new Error(data.error ?? "模板加载失败。");
    }

    const nextTemplates = data.templates ?? [];
    templates.value = nextTemplates;
    selectedTemplateId.value = selectedTemplateId.value ?? nextTemplates[0]?.id;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "模板加载失败。";
  }
};

const openEventSource = (id: string, retryCount = 0) => {
  closeEventSource();
  eventSource.value = new EventSource(`/api/ppt/jobs/${id}/events`);

  eventSource.value.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as PptJobEvent;

      status.value = event.status;
      currentStep.value = event.step;
      progress.value = event.progress;
      error.value = event.error;
      animation.value = event.animation;
      currentMessage.value = event.message;

      if (event.slides) {
        slides.value = event.slides;
        hasUnsavedEdits.value = false;
        editMessage.value = undefined;
        editError.value = undefined;
        activeSlideIndex.value = event.animation
          ? event.animation.slideIndex
          : activeSlideIndex.value < event.slides.length
            ? activeSlideIndex.value
            : 0;
      }

      if (terminalStatuses.includes(event.status)) {
        terminal.value = true;
        closeEventSource();
      }
    } catch {
      error.value = "生成事件解析失败，请重新生成。";
      status.value = "failed";
      terminal.value = true;
      closeEventSource();
    }
  };

  eventSource.value.onerror = () => {
    if (disposed || terminal.value) return;
    closeEventSource();

    if (retryCount < maxEventSourceRetries) {
      retryTimer.value = setTimeout(
        () => openEventSource(id, retryCount + 1),
        eventSourceRetryDelayMs,
      );
      return;
    }

    error.value = "生成进度连接中断，请重新生成。";
    status.value = "failed";
    terminal.value = true;
  };
};

const handleGenerate = async () => {
  if (!selectedTemplateId.value || !canGenerate.value || isSubmitting.value) return;

  isSubmitting.value = true;
  error.value = undefined;
  editMessage.value = undefined;
  editError.value = undefined;
  hasUnsavedEdits.value = false;
  slides.value = [];
  activeSlideIndex.value = 0;
  progress.value = 0;
  currentStep.value = "analyzing";
  animation.value = undefined;
  currentMessage.value = "正在创建生成任务";
  status.value = "queued";
  jobId.value = undefined;
  terminal.value = false;

  try {
    const response = await fetch("/api/ppt/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: topic.value.trim(),
        templateId: selectedTemplateId.value,
      }),
    });
    const data = (await response.json()) as CreateJobResponse;

    if (!response.ok || !data.jobId) {
      throw new Error(data.error ?? "创建生成任务失败。");
    }

    jobId.value = data.jobId;
    openEventSource(data.jobId);
  } catch (createError) {
    status.value = "failed";
    isSubmitting.value = false;
    error.value =
      createError instanceof Error ? createError.message : "创建生成任务失败。";
  }
};

const handleSaveSlideEdits = async () => {
  if (!jobId.value || !hasUnsavedEdits.value || isSavingEdits.value) return;

  isSavingEdits.value = true;
  editError.value = undefined;
  editMessage.value = undefined;

  try {
    const response = await fetch(`/api/ppt/jobs/${jobId.value}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slides: slides.value,
      }),
    });
    const data = (await response.json()) as UpdateJobResponse;

    if (!response.ok) {
      throw new Error(data.error ?? "保存修改失败。");
    }

    if (data.job?.slides) {
      slides.value = data.job.slides;
    }
    hasUnsavedEdits.value = false;
    editMessage.value = "修改已保存";
    currentMessage.value = "修改已保存，可下载最新版";
  } catch (saveError) {
    editError.value = saveError instanceof Error ? saveError.message : "保存修改失败。";
  } finally {
    isSavingEdits.value = false;
  }
};

watch(status, (nextStatus) => {
  if (terminalStatuses.includes(nextStatus)) {
    isSubmitting.value = false;
  }
});

onMounted(() => {
  void loadTemplates();
});

onBeforeUnmount(() => {
  disposed = true;
  if (retryTimer.value) {
    clearTimeout(retryTimer.value);
  }
  closeEventSource();
});
</script>
