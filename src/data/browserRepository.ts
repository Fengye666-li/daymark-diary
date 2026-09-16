import type {
  AppStats,
  DiaryRepository,
  Entry,
  EntryFilter,
  EntryInput,
  TagSummary,
} from "../types";
import { todayKey } from "../lib/date";

const STORAGE_KEY = "daymark.entries.v1";

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const byDate = b.entryDate.localeCompare(a.entryDate);
    return byDate || b.updatedAt.localeCompare(a.updatedAt);
  });
}

function readEntries(): Entry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Entry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: Entry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function entryMatches(entry: Entry, filter: EntryFilter): boolean {
  if (filter.kind === "trash" && !entry.deletedAt) {
    return false;
  }
  if (filter.kind !== "trash" && entry.deletedAt) {
    return false;
  }
  if (filter.kind === "today" && entry.entryDate !== todayKey()) {
    return false;
  }
  if (filter.kind === "favorites" && !entry.favorite) {
    return false;
  }
  if (filter.kind === "date" && entry.entryDate !== filter.date) {
    return false;
  }
  if (
    filter.kind === "tag" &&
    (!filter.tag || !entry.tags.includes(filter.tag))
  ) {
    return false;
  }
  if (filter.query?.trim()) {
    const query = filter.query.trim().toLocaleLowerCase();
    const searchable = `${entry.title}\n${entry.content}\n${entry.tags.join(" ")}`
      .toLocaleLowerCase();
    if (!searchable.includes(query)) {
      return false;
    }
  }
  return true;
}

export const browserRepository: DiaryRepository = {
  async listEntries(filter) {
    return sortEntries(readEntries().filter((entry) => entryMatches(entry, filter)));
  },

  async getEntry(id) {
    return readEntries().find((entry) => entry.id === id) ?? null;
  },

  async saveEntry(input) {
    const entries = readEntries();
    const now = new Date().toISOString();
    const existing = input.id
      ? entries.find((entry) => entry.id === input.id)
      : undefined;
    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];

    const saved: Entry = {
      id: existing?.id ?? crypto.randomUUID(),
      title: input.title.trim(),
      content: input.content,
      entryDate: input.entryDate || todayKey(),
      mood: input.mood,
      weather: input.weather,
      favorite: input.favorite,
      tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: existing?.deletedAt ?? null,
    };

    const next = existing
      ? entries.map((entry) => (entry.id === saved.id ? saved : entry))
      : [saved, ...entries];
    writeEntries(next);
    return saved;
  },

  async trashEntry(id) {
    const now = new Date().toISOString();
    writeEntries(
      readEntries().map((entry) =>
        entry.id === id ? { ...entry, deletedAt: now, updatedAt: now } : entry,
      ),
    );
  },

  async restoreEntry(id) {
    writeEntries(
      readEntries().map((entry) =>
        entry.id === id
          ? { ...entry, deletedAt: null, updatedAt: new Date().toISOString() }
          : entry,
      ),
    );
  },

  async deleteEntry(id) {
    writeEntries(readEntries().filter((entry) => entry.id !== id));
  },

  async toggleFavorite(id) {
    const entries = readEntries();
    const current = entries.find((entry) => entry.id === id);
    if (!current) {
      throw new Error("找不到这篇日记");
    }

    const saved = {
      ...current,
      favorite: !current.favorite,
      updatedAt: new Date().toISOString(),
    };
    writeEntries(entries.map((entry) => (entry.id === id ? saved : entry)));
    return saved;
  },

  async listTags(): Promise<TagSummary[]> {
    const counts = new Map<string, number>();
    for (const entry of readEntries()) {
      if (entry.deletedAt) {
        continue;
      }
      for (const tag of entry.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  async getStats(): Promise<AppStats> {
    const entries = readEntries();
    return {
      all: entries.filter((entry) => !entry.deletedAt).length,
      favorites: entries.filter((entry) => !entry.deletedAt && entry.favorite)
        .length,
      trash: entries.filter((entry) => entry.deletedAt).length,
    };
  },

};
