import { useCallback, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isDesktopRuntime } from "../data";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  notes?: string;
  progress?: number;
  error?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isDesktopRuntime) {
      return;
    }

    setState({ status: "checking" });

    try {
      const update = await check();
      if (!update) {
        setState({ status: "up-to-date" });
        if (silent) {
          window.setTimeout(() => {
            setState((current) =>
              current.status === "up-to-date" ? { status: "idle" } : current,
            );
          }, 2400);
        }
        return;
      }

      updateRef.current = update;
      setState({
        status: "available",
        version: update.version,
        notes: update.body ?? "",
      });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) {
      return;
    }

    try {
      let downloaded = 0;
      let total = 0;
      setState((current) => ({ ...current, status: "downloading", progress: 0 }));

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((current) => ({
            ...current,
            status: "downloading",
            progress: total > 0 ? Math.round((downloaded / total) * 100) : undefined,
          }));
        }
        if (event.event === "Finished") {
          setState((current) => ({ ...current, status: "installing" }));
        }
      });

      await relaunch();
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: errorMessage(error),
      }));
    }
  }, []);

  const dismiss = useCallback(() => {
    setState((current) =>
      current.status === "downloading" || current.status === "installing"
        ? current
        : { status: "idle" },
    );
  }, []);

  return { state, checkForUpdates, installUpdate, dismiss };
}
