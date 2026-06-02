import {
  ArrowUpDown,
  Waves,
  Binary,
  Flame,
  Mountain,
  Layers,
  Repeat,
  Activity,
  GripVertical,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { EffectNodeConfig, EffectParams } from "@/types";
import { SPECS } from "@/lib/effects";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  ArrowUpDown,
  Waves,
  Binary,
  Flame,
  Mountain,
  Layers,
  Repeat,
  Activity,
};

interface Props {
  config: EffectNodeConfig;
  onChange: (next: EffectNodeConfig) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

export function EffectCard({ config, onChange, onRemove, dragHandleProps, isDragging }: Props) {
  const spec = SPECS[config.kind];
  const Icon = ICONS[spec.icon] ?? Activity;

  const setParam = (key: string, value: number) => {
    const params: EffectParams = { ...config.params, [key]: value };
    onChange({ ...config, params });
  };

  return (
    <Card className={cn("transition-shadow", isDragging && "ring-2 ring-primary shadow-2xl", !config.enabled && "opacity-60")}>
      <div className="flex items-center gap-2 p-3">
        <button
          aria-label="並べ替え"
          className="touch-none rounded-lg p-1 text-muted-foreground active:bg-secondary"
          {...dragHandleProps}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <Icon className="h-5 w-5 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{spec.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{spec.description}</p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onChange({ ...config, enabled })}
          aria-label={`${spec.label}を有効化`}
        />
        <button
          aria-label="削除"
          onClick={onRemove}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-3 px-4 pb-4">
          {spec.params.map((p) => (
            <div key={p.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-mono tabular-nums">
                  {formatValue(config.params[p.key], p.step)}
                  {p.unit ? ` ${p.unit}` : ""}
                </span>
              </div>
              <Slider
                min={p.min}
                max={p.max}
                step={p.step}
                value={[config.params[p.key]]}
                onValueChange={([v]) => setParam(p.key, v)}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatValue(v: number, step: number): string {
  if (step >= 1) return Math.round(v).toString();
  const decimals = step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return v.toFixed(decimals);
}
