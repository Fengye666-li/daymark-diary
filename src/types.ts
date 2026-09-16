export type EntryKind =
  | "today"
  | "all"
  | "favorites"
  | "trash"
  | "date"
  | "tag";

export interface Entry {
  id: string;
  title: string;
  content: string;
  entryDate: string;
  mood: string;
  weather: string;
  favorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EntryInput {
  id?: string;
  title: string;
  content: string;
  entryDate: string;
  mood: string;
  weather: string;
  favorite: boolean;
  tags: string[];
}

export interface EntryFilter {
  kind: EntryKind;
  query?: string;
  date?: string;
  tag?: string;
}

export interface TagSummary {
  name: string;
  count: number;
}

export interface AppStats {
  all: number;
  favorites: number;
  trash: number;
}

export interface DiaryRepository {
  listEntries(filter: EntryFilter): Promise<Entry[]>;
  getEntry(id: string): Promise<Entry | null>;
  saveEntry(input: EntryInput): Promise<Entry>;
  trashEntry(id: string): Promise<void>;
  restoreEntry(id: string): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<Entry>;
  listTags(): Promise<TagSummary[]>;
  getStats(): Promise<AppStats>;
}
