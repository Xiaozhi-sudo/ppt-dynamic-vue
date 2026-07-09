<template>
  <section class="generation-timeline" aria-label="生成进度">
    <div class="timeline-header">
      <span class="eyebrow">生成流程</span>
      <strong>{{ normalizedProgress }}%</strong>
    </div>
    <div
      :aria-label="`当前进度 ${normalizedProgress}%`"
      :aria-valuenow="normalizedProgress"
      aria-valuemax="100"
      aria-valuemin="0"
      class="progress-track"
      role="progressbar"
    >
      <span :style="{ width: `${normalizedProgress}%` }" />
    </div>
    <ol class="timeline-steps">
      <li
        v-for="step in pptSteps"
        :key="step.key"
        :class="['timeline-step', `is-${getStepState(step.key)}`]"
      >
        <span class="timeline-step__marker" aria-hidden="true" />
        <span class="timeline-step__content">
          <span class="timeline-step__label">{{ step.label }}</span>
          <span class="timeline-step__message">{{ step.message }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { pptSteps } from "@/frontend/data/pptSteps";
import type { PptStepKey, WorkspaceStatus } from "@/frontend/types/ppt";

type TimelineStepState = "pending" | "active" | "done" | "failed";

const props = defineProps<{
  currentStep: PptStepKey;
  progress: number;
  status: WorkspaceStatus;
}>();

const normalizedProgress = computed(() => Math.max(0, Math.min(100, props.progress)));

const getStepState = (stepKey: PptStepKey): TimelineStepState => {
  const stepIndex = pptSteps.findIndex((step) => step.key === stepKey);
  const currentIndex = pptSteps.findIndex((step) => step.key === props.currentStep);

  if (props.status === "failed" && stepKey === props.currentStep) return "failed";
  if (props.status === "completed") return "done";
  if (props.status === "idle" || currentIndex === -1) return "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
};
</script>
