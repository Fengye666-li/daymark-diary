import {
  CheckCircle2,
  Download,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import type { UpdateState } from "../hooks/useUpdater";

interface UpdateNoticeProps {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateNotice({
  state,
  onInstall,
  onDismiss,
}: UpdateNoticeProps) {
  if (state.status === "idle") {
    return null;
  }

  const busy =
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "installing";

  return (
    <aside
      className={`update-notice update-notice--${state.status}`}
      role="status"
      aria-live="polite"
    >
      <div className="update-notice__icon">
        {state.status === "up-to-date" ? (
          <CheckCircle2 size={18} />
        ) : state.status === "available" ? (
          <Download size={18} />
        ) : state.status === "error" ? (
          <RefreshCw size={18} />
        ) : (
          <LoaderCircle className="spin" size={18} />
        )}
      </div>
      <div className="update-notice__content">
        <strong>
          {state.status === "checking"
            ? "正在检查更新"
            : state.status === "up-to-date"
              ? "当前已是最新版本"
              : state.status === "available"
                ? `发现新版本 ${state.version}`
                : state.status === "downloading"
                  ? `正在下载更新 ${state.progress ?? 0}%`
                  : state.status === "installing"
                    ? "正在安装更新"
                    : "更新失败"}
        </strong>
        {state.notes ? <p>{state.notes}</p> : null}
        {state.error ? <p>{state.error}</p> : null}
        {state.status === "downloading" ? (
          <div className="update-notice__progress">
            <span style={{ width: `${state.progress ?? 8}%` }} />
          </div>
        ) : null}
      </div>
      {state.status === "available" ? (
        <button className="button button--compact" type="button" onClick={onInstall}>
          安装更新
        </button>
      ) : null}
      {!busy ? (
        <button
          className="icon-button update-notice__close"
          type="button"
          aria-label="关闭更新提示"
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      ) : null}
    </aside>
  );
}
