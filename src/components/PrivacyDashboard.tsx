import { ShieldCheck, WifiOff, Cpu, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { isNative } from "@/lib/native";

/**
 * プライバシーダッシュボード（差別化機能）。
 * 「すべて端末内で処理」を常時可視化し、ネットワーク送信が無いことを示す。
 */
export function PrivacyDashboard() {
  const items = [
    { icon: Cpu, label: "音声処理", value: "端末のCPU/WebAudio" },
    { icon: HardDrive, label: "保存先", value: isNative ? "アプリ内ストレージ" : "ブラウザ内 (IndexedDB)" },
    { icon: WifiOff, label: "サーバー送信", value: "なし（0バイト）" },
  ];

  return (
    <Card className="overflow-hidden border-accent/30">
      <div className="flex items-center gap-3 bg-gradient-to-r from-primary/20 to-accent/20 p-4">
        <div className="relative">
          <ShieldCheck className="h-7 w-7 text-accent" />
          <span className="absolute inset-0 rounded-full ring-2 ring-accent/40 animate-pulse-ring" />
        </div>
        <div>
          <p className="text-sm font-semibold">すべてあなたの端末内で処理中</p>
          <p className="text-xs text-muted-foreground">録音・変換・保存は外部に一切送信されません</p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1 p-3 text-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span className="text-[11px] font-medium leading-tight">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
