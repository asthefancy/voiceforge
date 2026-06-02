import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { formatTime } from "@/lib/utils";

interface Props {
  recording: boolean;
  onStop: () => void;
}

/**
 * 録音中をアプリ全体で示すインジケータ（ヘッダーに常駐）。
 * どのタブにいても経過時間が見え、その場で停止できる。
 */
export function RecordingIndicator({ recording, onStop }: Props) {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (!recording) {
      setSec(0);
      return;
    }
    setSec(0);
    const id = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  if (!recording) return null;

  return (
    <div
      role="status"
      aria-label={`録音中 ${formatTime(sec)}`}
      className="flex items-center gap-2 rounded-full bg-destructive/15 py-1 pl-3 pr-1 text-destructive"
    >
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
      <span className="font-mono text-xs tabular-nums">{formatTime(sec)}</span>
      <button
        onClick={onStop}
        aria-label="録音停止"
        className="focus-ring rounded-full bg-destructive p-1.5 text-destructive-foreground"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  );
}
