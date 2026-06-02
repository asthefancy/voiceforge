import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import type { EffectKind, EffectNodeConfig } from "@/types";
import { EFFECT_KINDS, SPECS, makeEffectConfig } from "@/lib/effects";
import { EffectCard } from "@/components/EffectCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface Props {
  chain: EffectNodeConfig[];
  onChange: (chain: EffectNodeConfig[]) => void;
}

/**
 * ドラッグ&ドロップで並べ替え可能なエフェクトチェーンエディタ（差別化機能）。
 * タッチ操作に最適化（TouchSensor + ドラッグハンドル）。
 */
export function EffectChainEditor({ chain, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = chain.findIndex((c) => c.id === active.id);
    const newIndex = chain.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(chain, oldIndex, newIndex));
  };

  const addEffect = (kind: EffectKind) => {
    onChange([...chain, makeEffectConfig(kind)]);
  };

  const updateAt = (id: string, next: EffectNodeConfig) =>
    onChange(chain.map((c) => (c.id === id ? next : c)));

  const removeAt = (id: string) => onChange(chain.filter((c) => c.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          エフェクトチェーン（上から順に適用）
        </h2>
        <AddEffectDialog onAdd={addEffect} />
      </div>

      {chain.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          まだエフェクトがありません。「追加」から声を作りましょう。
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chain.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {chain.map((c) => (
                <SortableEffect
                  key={c.id}
                  config={c}
                  onChange={(next) => updateAt(c.id, next)}
                  onRemove={() => removeAt(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableEffect({
  config,
  onChange,
  onRemove,
}: {
  config: EffectNodeConfig;
  onChange: (next: EffectNodeConfig) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EffectCard
        config={config}
        onChange={onChange}
        onRemove={onRemove}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function AddEffectDialog({ onAdd }: { onAdd: (kind: EffectKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="accent">
          <Plus /> 追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">エフェクトを追加</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {EFFECT_KINDS.map((kind) => (
            <DialogClose asChild key={kind}>
              <button
                onClick={() => onAdd(kind)}
                className="focus-ring rounded-xl border border-border bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary"
              >
                <p className="text-sm font-medium">{SPECS[kind].label}</p>
                <p className="text-[11px] text-muted-foreground">{SPECS[kind].description}</p>
              </button>
            </DialogClose>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
