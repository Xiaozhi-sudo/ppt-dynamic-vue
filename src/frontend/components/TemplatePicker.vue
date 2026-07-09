<template>
  <p v-if="templates.length === 0" class="muted-copy">模板加载中...</p>
  <div v-else class="template-picker" role="list" aria-label="选择 PPT 模板">
    <button
      v-for="template in templates"
      :key="template.id"
      :aria-pressed="template.id === selectedTemplateId"
      :class="['template-option', { 'is-selected': template.id === selectedTemplateId }]"
      type="button"
      @click="emit('select', template.id)"
    >
      <span class="template-option__main">
        <span class="template-option__name">{{ template.name }}</span>
        <span class="template-option__description">{{ template.description }}</span>
      </span>
      <span aria-hidden="true" class="template-option__swatches">
        <span
          v-for="colorKey in colorKeys"
          :key="colorKey"
          class="template-option__swatch"
          :style="{ backgroundColor: template.colors[colorKey] }"
        />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PptTemplate } from "@/frontend/types/ppt";

defineProps<{
  templates: PptTemplate[];
  selectedTemplateId?: string;
}>();

const emit = defineEmits<{
  select: [templateId: string];
}>();

const colorKeys = ["primary", "secondary", "accent", "background"] as const;
</script>
