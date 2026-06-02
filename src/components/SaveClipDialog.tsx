import { useEffect, useState } from "react";
import type { PendingClip } from "@/hooks/useSoundboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  pending: PendingClip | null;
  onClose: () => void;
  onSave: (name: string, tags: string[]) => void;
}

/**
 * 録音直後の保存ダイアログ。録音はどのタブから開始されても、
 * このダイアログはアプリ最上位で表示されるため動線が一貫する。
 */
export function SaveClipDialog({ pending, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (pending) {
      setName(`フレーズ ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`);
      setTags("");
    }
  }, [pending]);

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">録音を保存</DialogTitle>
        </DialogHeader>
        <Input placeholder="フレーズ名" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="タグ（カンマ区切り 例: ロボット, 挨拶）"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            破棄
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim()}
            onClick={() =>
              onSave(
                name.trim(),
                tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              )
            }
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
