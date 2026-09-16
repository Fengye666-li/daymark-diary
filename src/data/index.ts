import type { DiaryRepository } from "../types";
import { browserRepository } from "./browserRepository";
import { tauriRepository } from "./tauriRepository";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const repository: DiaryRepository = isTauri
  ? tauriRepository
  : browserRepository;

export const isDesktopRuntime = isTauri;
