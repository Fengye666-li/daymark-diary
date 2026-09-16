import { invoke } from "@tauri-apps/api/core";
import type {
  AppStats,
  DiaryRepository,
  Entry,
  EntryFilter,
  EntryInput,
  TagSummary,
} from "../types";

export const tauriRepository: DiaryRepository = {
  listEntries(filter: EntryFilter) {
    return invoke<Entry[]>("list_entries", { filter });
  },

  getEntry(id: string) {
    return invoke<Entry | null>("get_entry", { id });
  },

  saveEntry(input: EntryInput) {
    return invoke<Entry>("save_entry", { input });
  },

  trashEntry(id: string) {
    return invoke<void>("trash_entry", { id });
  },

  restoreEntry(id: string) {
    return invoke<void>("restore_entry", { id });
  },

  deleteEntry(id: string) {
    return invoke<void>("delete_entry", { id });
  },

  toggleFavorite(id: string) {
    return invoke<Entry>("toggle_favorite", { id });
  },

  listTags() {
    return invoke<TagSummary[]>("list_tags");
  },

  getStats() {
    return invoke<AppStats>("get_stats");
  },

};
