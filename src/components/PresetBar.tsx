import { useState } from "react";
import { Bookmark, Share2, Check, Copy } from "lucide-react";
import type { EffectNodeConfig, Preset } from "@/types";
import { BUILTIN_PRESETS } from "@/lib/presets";
import { buildShareUrl } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  chain: EffectNodeConfig[];
  inputGainDb: number;
  outputGainDb: number;
  userPresets: Preset[];
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
}

export function PresetBar({ chain, inputGainDb, outputGainDb, userPresets, onApply, onSave }: Props) {
  const all = [...userPresets, ...BUILTIN_PRESETS];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">プリセット</h2>
        <div className="flex gap-2">
          <SaveDialog onSave={onSave} />
          <ShareDialog preset={{ id: "current", name: "現在の設定", inputGainDb, outputGainDb, chain }} />
        </div>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {all.map((p) => (
          <button
            key={p.id}
            onClick={() => onApply(p)}
            className="focus-ring shrink-0 rounded-full border border-border bg-secondary/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary active:scale-95"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveDialog({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Bookmark /> 保存
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">現在の設定を保存</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="プリセット名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={!name.trim()}
          onClick={() => {
            onSave(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          保存する
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ preset }: { preset: Preset }) {
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(preset);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* クリップボード不可環境 */
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Share2 /> 共有
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">プリセットを共有</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          この URL を開くと同じエフェクト設定が再現されます（設定は URL 内に含まれ、サーバーには送信されません）。
        </p>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-[11px]" />
          <Button size="icon" variant="accent" onClick={copy} aria-label="コピー">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
