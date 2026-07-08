import type { PptTemplate } from "@/lib/ppt/types";

export interface TemplatePickerProps {
  templates: PptTemplate[];
  selectedTemplateId?: string;
  onSelect: (templateId: string) => void;
}

const colorKeys = ["primary", "secondary", "accent", "background"] as const;

export function TemplatePicker({
  templates,
  selectedTemplateId,
  onSelect,
}: TemplatePickerProps) {
  if (templates.length === 0) {
    return <p className="muted-copy">模板加载中...</p>;
  }

  return (
    <div className="template-picker" role="list" aria-label="选择 PPT 模板">
      {templates.map((template) => {
        const isSelected = template.id === selectedTemplateId;

        return (
          <button
            aria-pressed={isSelected}
            className={`template-option${isSelected ? " is-selected" : ""}`}
            key={template.id}
            onClick={() => onSelect(template.id)}
            type="button"
          >
            <span className="template-option__main">
              <span className="template-option__name">{template.name}</span>
              <span className="template-option__description">
                {template.description}
              </span>
            </span>
            <span aria-hidden="true" className="template-option__swatches">
              {colorKeys.map((colorKey) => (
                <span
                  className="template-option__swatch"
                  key={colorKey}
                  style={{ backgroundColor: template.colors[colorKey] }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
