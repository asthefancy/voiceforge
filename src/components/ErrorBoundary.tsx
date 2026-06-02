import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * 予期せぬ描画エラーでアプリ全体が白画面になるのを防ぐエラーバウンダリ。
 * 端末内で完結するため、エラー内容も外部送信はしない（コンソール出力のみ）。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("VoiceForge error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div>
          <h1 className="text-lg font-semibold">問題が発生しました</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            アプリの再読み込みで回復できます。データは端末内に保持されています。
          </p>
        </div>
        <p className="max-w-sm break-words rounded-lg bg-secondary/50 p-2 font-mono text-[11px] text-muted-foreground">
          {this.state.error.message}
        </p>
        <Button onClick={this.reset}>再読み込み</Button>
      </div>
    );
  }
}
