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
          v-if="status === 'completed' && jobId"
          class="download-action"
          :href="`/api/ppt/jobs/${jobId}/download`"
        >
          下载 PPTX
        </a>
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
          mode="large"
          :slide="activeSlide"
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
