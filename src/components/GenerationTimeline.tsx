import { pptSteps } from "@/lib/ppt/steps";
import type { PptJobStatus, PptStepKey } from "@/lib/ppt/types";

export interface GenerationTimelineProps {
  currentStep: PptStepKey;
  status: PptJobStatus | "idle";
  progress: number;
}

type TimelineStepState = "pending" | "active" | "done" | "failed";

const getStepState = (
  stepKey: PptStepKey,
  currentStep: PptStepKey,
  status: PptJobStatus | "idle",
): TimelineStepState => {
  const stepIndex = pptSteps.findIndex((step) => step.key === stepKey);
  const currentIndex = pptSteps.findIndex((step) => step.key === currentStep);

  if (status === "failed" && stepKey === currentStep) return "failed";
  if (status === "completed") return "done";
  if (status === "idle" || currentIndex === -1) return "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
};

export function GenerationTimeline({
  currentStep,
  status,
  progress,
}: GenerationTimelineProps) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <section className="generation-timeline" aria-label="生成进度">
      <div className="timeline-header">
        <span className="eyebrow">生成流程</span>
        <strong>{normalizedProgress}%</strong>
      </div>
      <div
        aria-label={`当前进度 ${normalizedProgress}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedProgress}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${normalizedProgress}%` }} />
      </div>
      <ol className="timeline-steps">
        {pptSteps.map((step) => {
          const stepState = getStepState(step.key, currentStep, status);

          return (
            <li className={`timeline-step is-${stepState}`} key={step.key}>
              <span className="timeline-step__marker" aria-hidden="true" />
              <span className="timeline-step__content">
                <span className="timeline-step__label">{step.label}</span>
                <span className="timeline-step__message">{step.message}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
