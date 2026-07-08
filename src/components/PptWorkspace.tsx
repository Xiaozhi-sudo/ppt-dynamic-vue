"use client";

import { useEffect, useRef, useState } from "react";
import { GenerationTimeline } from "./GenerationTimeline";
import { SlidePreview } from "./SlidePreview";
import { TemplatePicker } from "./TemplatePicker";
import type {
  PptJobEvent,
  PptFillAnimation,
  PptJobStatus,
  PptStepKey,
  PptTemplate,
  RenderedSlide,
} from "@/lib/ppt/types";

type WorkspaceStatus = PptJobStatus | "idle";

interface TemplatesResponse {
  templates?: PptTemplate[];
  error?: string;
}

interface CreateJobResponse {
  jobId?: string;
  error?: string;
}

const terminalStatuses: WorkspaceStatus[] = ["completed", "failed"];
const maxEventSourceRetries = 3;
const eventSourceRetryDelayMs = 700;

export function PptWorkspace() {
  const [topic, setTopic] = useState("");
  const [templates, setTemplates] = useState<PptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [jobId, setJobId] = useState<string>();
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [currentStep, setCurrentStep] = useState<PptStepKey>("analyzing");
  const [progress, setProgress] = useState(0);
  const [slides, setSlides] = useState<RenderedSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [animation, setAnimation] = useState<PptFillAnimation>();
  const [currentMessage, setCurrentMessage] = useState("等待开始生成");
  const [error, setError] = useState<string>();
  const terminalRef = useRef(false);
  const isSubmittingRef = useRef(false);

  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const activeSlide = slides[activeSlideIndex] ?? slides[0];
  const isGenerating = status === "queued" || status === "running";
  const canGenerate =
    topic.trim().length > 0 && Boolean(selectedTemplateId) && !isGenerating;

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const response = await fetch("/api/templates");
        const data = (await response.json()) as TemplatesResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "模板加载失败。");
        }

        if (!cancelled) {
          const nextTemplates = data.templates ?? [];
          setTemplates(nextTemplates);
          setSelectedTemplateId((currentId) => currentId ?? nextTemplates[0]?.id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "模板加载失败。",
          );
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!jobId) return undefined;

    terminalRef.current = false;
    let disposed = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let eventSource: EventSource | undefined;

    const closeEventSource = () => {
      eventSource?.close();
      eventSource = undefined;
    };

    const openEventSource = () => {
      closeEventSource();
      eventSource = new EventSource(`/api/ppt/jobs/${jobId}/events`);

      eventSource.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as PptJobEvent;
          retryCount = 0;

          setStatus(event.status);
          setCurrentStep(event.step);
          setProgress(event.progress);
          setError(event.error);
          setAnimation(event.animation);
          setCurrentMessage(event.message);

          if (event.slides) {
            setSlides(event.slides);
            setActiveSlideIndex((currentIndex) =>
              event.animation
                ? event.animation.slideIndex
                : event.slides && currentIndex < event.slides.length ? currentIndex : 0,
            );
          }

          if (terminalStatuses.includes(event.status)) {
            terminalRef.current = true;
            closeEventSource();
          }
        } catch {
          setError("生成事件解析失败，请重新生成。");
          setStatus("failed");
          terminalRef.current = true;
          closeEventSource();
        }
      };

      eventSource.onerror = () => {
        if (disposed || terminalRef.current) return;
        closeEventSource();

        if (retryCount < maxEventSourceRetries) {
          retryCount += 1;
          retryTimer = setTimeout(openEventSource, eventSourceRetryDelayMs);
          return;
        }

        setError("生成进度连接中断，请重新生成。");
        setStatus("failed");
        terminalRef.current = true;
      };
    };

    openEventSource();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      closeEventSource();
    };
  }, [jobId]);

  useEffect(() => {
    if (terminalStatuses.includes(status)) {
      isSubmittingRef.current = false;
    }
  }, [status]);

  const handleGenerate = async () => {
    if (!selectedTemplateId || !canGenerate || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setError(undefined);
    setSlides([]);
    setActiveSlideIndex(0);
    setProgress(0);
    setCurrentStep("analyzing");
    setAnimation(undefined);
    setCurrentMessage("正在创建生成任务");
    setStatus("queued");
    setJobId(undefined);
    terminalRef.current = false;

    try {
      const response = await fetch("/api/ppt/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
          templateId: selectedTemplateId,
        }),
      });
      const data = (await response.json()) as CreateJobResponse;

      if (!response.ok || !data.jobId) {
        throw new Error(data.error ?? "创建生成任务失败。");
      }

      setJobId(data.jobId);
    } catch (createError) {
      setStatus("failed");
      isSubmittingRef.current = false;
      setError(
        createError instanceof Error ? createError.message : "创建生成任务失败。",
      );
    }
  };

  return (
    <main className="workspace-shell">
      <section className="workspace-panel workspace-panel--input">
        <div className="panel-heading">
          <span className="eyebrow">AI PPT Generator</span>
          <h1>把主题生成可下载 PPT</h1>
        </div>

        <label className="topic-field" htmlFor="ppt-topic">
          <span>汇报主题</span>
          <textarea
            id="ppt-topic"
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：2026 年新能源车市场增长策略"
            rows={6}
            value={topic}
          />
        </label>

        <div className="control-group">
          <div className="control-group__header">
            <span>模板</span>
            {selectedTemplate ? <em>{selectedTemplate.theme}</em> : null}
          </div>
          <TemplatePicker
            onSelect={setSelectedTemplateId}
            selectedTemplateId={selectedTemplateId}
            templates={templates}
          />
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <div className="action-row">
          <button
            className="primary-action"
            disabled={!canGenerate}
            onClick={handleGenerate}
            type="button"
          >
            {isGenerating ? "生成中..." : status === "failed" ? "重新生成" : "生成 PPT"}
          </button>
          {status === "completed" && jobId ? (
            <a
              className="download-action"
              href={`/api/ppt/jobs/${jobId}/download`}
            >
              下载 PPTX
            </a>
          ) : null}
        </div>

        <GenerationTimeline
          currentStep={currentStep}
          progress={progress}
          status={status}
        />
      </section>

      <section className="workspace-panel workspace-panel--slides">
        <div className="preview-toolbar">
          <div>
            <span className="eyebrow">预览</span>
            <h2>{slides.length > 0 ? `${slides.length} 页幻灯片` : "等待生成"}</h2>
            <p>{currentMessage}</p>
          </div>
          <span className={`status-pill status-pill--${status}`}>{status}</span>
        </div>

        <div className="preview-stage">
          {activeSlide ? (
            <SlidePreview
              active
              animation={animation?.slideIndex === activeSlide.index ? animation : undefined}
              mode="large"
              slide={activeSlide}
            />
          ) : (
            <div className="empty-preview">
              <span>16:9</span>
              <strong>生成后在这里查看完整页面</strong>
            </div>
          )}
        </div>

        {slides.length > 0 ? (
          <div className="slide-strip" aria-label="幻灯片缩略图">
            {slides.map((slide, index) => (
              <div className="slide-strip__item" key={slide.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <SlidePreview
                  active={index === activeSlideIndex}
                  mode="thumbnail"
                  onSelect={() => setActiveSlideIndex(index)}
                  slide={slide}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
