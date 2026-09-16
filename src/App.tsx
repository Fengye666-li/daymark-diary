import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { EntryList } from "./components/EntryList";
import { CalendarPane } from "./components/CalendarPane";
import { Editor } from "./components/Editor";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { UpdateNotice } from "./components/UpdateNotice";
import { repository } from "./data";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useUpdater } from "./hooks/useUpdater";
import { formatLongDate, todayKey } from "./lib/date";
import type {
  AppStats,
  Entry,
  EntryFilter,
  EntryInput,
  EntryKind,
} from "./types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type ConfirmState = {
  entry: Entry;
  title: string;
  description: string;
};

interface LayoutState {
  sidebarWidth: number;
  collectionWidth: number;
  sidebarCollapsed: boolean;
  collectionCollapsed: boolean;
  editorCollapsed: boolean;
}

const initialStats: AppStats = { all: 0, favorites: 0, trash: 0 };
const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 232,
  collectionWidth: 340,
  sidebarCollapsed: false,
  collectionCollapsed: false,
  editorCollapsed: false,
};
const COLLAPSED_SIDEBAR_WIDTH = 64;
const COLLAPSED_COLLECTION_WIDTH = 54;
const COLLAPSED_EDITOR_WIDTH = 54;

function readLayout(): LayoutState {
  try {
    const stored = localStorage.getItem("daymark.layout.v1");
    if (!stored) {
      return DEFAULT_LAYOUT;
    }

    const parsed = JSON.parse(stored) as Partial<LayoutState>;
    return {
      sidebarWidth:
        typeof parsed.sidebarWidth === "number"
          ? parsed.sidebarWidth
          : DEFAULT_LAYOUT.sidebarWidth,
      collectionWidth:
        typeof parsed.collectionWidth === "number"
          ? parsed.collectionWidth
          : DEFAULT_LAYOUT.collectionWidth,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      collectionCollapsed: Boolean(parsed.collectionCollapsed),
      editorCollapsed: Boolean(parsed.editorCollapsed),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function createEmptyDraft(date = todayKey()): EntryInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    entryDate: date,
    mood: "",
    weather: "",
    favorite: false,
    tags: [],
  };
}

function toDraft(entry: Entry): EntryInput {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    entryDate: entry.entryDate,
    mood: entry.mood,
    weather: entry.weather,
    favorite: entry.favorite,
    tags: entry.tags,
  };
}

function hasDraftContent(draft: EntryInput): boolean {
  return Boolean(draft.title.trim() || draft.content.trim());
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const byDate = b.entryDate.localeCompare(a.entryDate);
    return byDate || b.updatedAt.localeCompare(a.updatedAt);
  });
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("daymark.theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [layout, setLayout] = useState<LayoutState>(readLayout);
  const [filter, setFilter] = useState<EntryFilter>({ kind: "all" });
  const [calendarMode, setCalendarMode] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<AppStats>(initialStats);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryInput>(() => createEmptyDraft());
  const [draftDeletedAt, setDraftDeletedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const updater = useUpdater();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("daymark.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("daymark.layout.v1", JSON.stringify(layout));
  }, [layout]);

  const openEntry = useCallback((entry: Entry) => {
    versionRef.current += 1;
    setSelectedId(entry.id);
    selectedIdRef.current = entry.id;
    setDraft(toDraft(entry));
    setDraftDeletedAt(entry.deletedAt);
    setDirty(false);
    setSaveState("idle");
    setSavedAt(entry.updatedAt);
  }, []);

  const startNew = useCallback((date = todayKey()) => {
    versionRef.current += 1;
    setSelectedId(null);
    selectedIdRef.current = null;
    setDraft(createEmptyDraft(date));
    setDraftDeletedAt(null);
    setDirty(false);
    setSaveState("idle");
    setSavedAt(undefined);
  }, []);

  const refreshSidebar = useCallback(async () => {
    setStats(await repository.getStats());
  }, []);

  const refreshCalendar = useCallback(async () => {
    setCalendarEntries(await repository.listEntries({ kind: "all" }));
  }, []);

  const loadEntries = useCallback(
    async (preferredId?: string | null) => {
      const nextEntries = await repository.listEntries({
        ...filter,
        query: debouncedSearch,
      });
      setEntries(nextEntries);

      const target =
        (preferredId &&
          nextEntries.find((entry) => entry.id === preferredId)) ||
        (selectedIdRef.current &&
          nextEntries.find((entry) => entry.id === selectedIdRef.current)) ||
        nextEntries[0];

      if (target) {
        openEntry(target);
      } else if (
        !nextEntries.length &&
        filter.kind === "all" &&
        !debouncedSearch
      ) {
        startNew();
      }
    },
    [debouncedSearch, filter, openEntry, startNew],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      loadEntries(),
      refreshSidebar(),
      refreshCalendar(),
    ])
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadEntries, refreshCalendar, refreshSidebar]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void updater.checkForUpdates(true);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [updater.checkForUpdates]);

  const updateDraft = useCallback((patch: Partial<EntryInput>) => {
    versionRef.current += 1;
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSaveState("dirty");
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasDraftContent(draft)) {
      setDirty(false);
      setSaveState("idle");
      return;
    }

    const version = versionRef.current;
    setSaveState("saving");

    try {
      const saved = await repository.saveEntry(draft);
      if (version !== versionRef.current) {
        return;
      }

      setDraft((current) => ({
        ...current,
        id: saved.id,
        title: saved.title,
      }));
      setSelectedId(saved.id);
      selectedIdRef.current = saved.id;
      setDraftDeletedAt(null);
      setDirty(false);
      setSavedAt(saved.updatedAt);
      setSaveState("saved");
      setEntries((current) => {
        const exists = current.some((entry) => entry.id === saved.id);
        return sortEntries(
          exists
            ? current.map((entry) => (entry.id === saved.id ? saved : entry))
            : [saved, ...current],
        );
      });
      await Promise.all([refreshSidebar(), refreshCalendar()]);
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }, [draft, refreshCalendar, refreshSidebar]);

  useEffect(() => {
    if (!dirty || !hasDraftContent(draft) || draftDeletedAt) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleSave();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draft, draftDeletedAt, dirty, handleSave]);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (dirty && hasDraftContent(draft) && !draftDeletedAt) {
        void handleSave();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveWhenHidden();
      }
    };

    window.addEventListener("blur", saveWhenHidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", saveWhenHidden);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draft, draftDeletedAt, dirty, handleSave]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (!command) {
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        startNew();
        setMobileEditorOpen(true);
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, startNew]);

  const selectKind = (kind: EntryKind) => {
    setCalendarMode(false);
    setFilter({ kind });
    setSelectedId(null);
    selectedIdRef.current = null;
    setMobileEditorOpen(false);
  };

  const selectCalendar = () => {
    setCalendarMode(true);
    setFilter({
      kind: "date",
      date: filter.kind === "date" && filter.date ? filter.date : todayKey(),
    });
    setMobileEditorOpen(false);
  };

  const selectEntry = (entry: Entry) => {
    openEntry(entry);
    setMobileEditorOpen(true);
  };

  const handleToggleFavorite = async () => {
    if (!draft.id) {
      updateDraft({ favorite: !draft.favorite });
      return;
    }

    try {
      const saved = await repository.toggleFavorite(draft.id);
      setDraft((current) => ({ ...current, favorite: saved.favorite }));
      setEntries((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      setCalendarEntries((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      setSavedAt(saved.updatedAt);
      await refreshSidebar();
    } catch (error) {
      console.error(error);
    }
  };

  const handleTrash = async (entry?: Entry) => {
    const draftIsPersisted =
      Boolean(draft.id) && selectedIdRef.current === draft.id;
    const target =
      entry ?? (draftIsPersisted ? ({ id: draft.id } as Entry) : null);
    if (!target?.id) {
      startNew();
      return;
    }

    await repository.trashEntry(target.id);
    selectedIdRef.current = null;
    setSelectedId(null);
    await Promise.all([
      loadEntries(null),
      refreshSidebar(),
      refreshCalendar(),
    ]);
  };

  const handleRestore = async (entry?: Entry) => {
    const id = entry?.id ?? (draftDeletedAt ? draft.id : undefined);
    if (!id) {
      return;
    }

    await repository.restoreEntry(id);
    await Promise.all([
      loadEntries(id),
      refreshSidebar(),
      refreshCalendar(),
    ]);
  };

  const handleDeleteForever = async (entry?: Entry) => {
    const draftIsPersisted =
      Boolean(draft.id) && selectedIdRef.current === draft.id;
    const target =
      entry ?? (draftIsPersisted ? ({ id: draft.id } as Entry) : null);
    if (!target?.id) {
      return;
    }

    setConfirmState({
      entry: target,
      title: "永久删除这篇日记？",
      description: "这个操作无法撤销，正文和收藏状态都会从本机数据库中移除。",
    });
  };

  const confirmDelete = async () => {
    if (!confirmState) {
      return;
    }

    await repository.deleteEntry(confirmState.entry.id);
    setConfirmState(null);
    selectedIdRef.current = null;
    setSelectedId(null);
    await Promise.all([
      loadEntries(null),
      refreshSidebar(),
      refreshCalendar(),
    ]);
  };

  const resizePane = (
    pane: "sidebar" | "collection",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (window.innerWidth <= 780) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const initialWidth =
      pane === "sidebar" ? layout.sidebarWidth : layout.collectionWidth;
    const siblingWidth =
      pane === "sidebar"
        ? layout.collectionCollapsed
          ? COLLAPSED_COLLECTION_WIDTH
          : layout.collectionWidth
        : layout.sidebarCollapsed
          ? COLLAPSED_SIDEBAR_WIDTH
          : layout.sidebarWidth;
    const minimumEditorWidth = layout.editorCollapsed
      ? COLLAPSED_EDITOR_WIDTH
      : 440;
    const maximumWidth =
      window.innerWidth - siblingWidth - minimumEditorWidth - 16;
    const minimumWidth = pane === "sidebar" ? 190 : 250;
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clamp(
        initialWidth + moveEvent.clientX - startX,
        minimumWidth,
        Math.min(pane === "sidebar" ? 320 : 520, maximumWidth),
      );
      setLayout((current) => ({
        ...current,
        [pane === "sidebar" ? "sidebarWidth" : "collectionWidth"]: nextWidth,
      }));
    };

    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const adjustPaneWidth = (
    pane: "sidebar" | "collection",
    direction: -1 | 1,
  ) => {
    setLayout((current) => {
      const field = pane === "sidebar" ? "sidebarWidth" : "collectionWidth";
      const currentWidth = current[field];
      const minimum = pane === "sidebar" ? 190 : 250;
      const maximum = pane === "sidebar" ? 320 : 520;
      return {
        ...current,
        [field]: clamp(currentWidth + direction * 12, minimum, maximum),
      };
    });
  };

  const selectedDate =
    filter.kind === "date" && filter.date ? filter.date : todayKey();
  const activeSection = calendarMode ? "calendar" : filter.kind;
  const title = search.trim()
    ? "搜索结果"
    : filter.kind === "today"
      ? "今天"
      : filter.kind === "favorites"
        ? "收藏"
        : filter.kind === "trash"
          ? "回收站"
          : filter.kind === "date"
            ? formatLongDate(selectedDate)
            : filter.kind === "tag"
              ? `# ${filter.tag}`
              : "全部日记";
  const entryCount = calendarMode
    ? calendarEntries.filter((entry) =>
        entry.entryDate.includes(selectedDate.slice(0, 7)),
      ).length
    : entries.length;
  const sidebarWidth = layout.sidebarCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : layout.sidebarWidth;
  const collectionWidth = layout.collectionCollapsed
    ? COLLAPSED_COLLECTION_WIDTH
    : layout.collectionWidth;
  const layoutStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
    "--collection-width": `${collectionWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={[
        "app-shell",
        mobileEditorOpen ? "editor-open" : "",
        layout.editorCollapsed ? "editor-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={layoutStyle}
    >
      <Sidebar
        activeSection={activeSection}
        search={search}
        searchInputRef={searchInputRef}
        stats={stats}
        theme={theme}
        collapsed={layout.sidebarCollapsed}
        onSearch={setSearch}
        onNew={() => {
          startNew();
          setMobileEditorOpen(true);
        }}
        onSelect={selectKind}
        onCalendar={selectCalendar}
        onToggleTheme={() =>
          setTheme((current) => (current === "light" ? "dark" : "light"))
        }
        onCollapse={() =>
          setLayout((current) => ({ ...current, sidebarCollapsed: true }))
        }
        onExpand={() =>
          setLayout((current) => ({ ...current, sidebarCollapsed: false }))
        }
        onCheckUpdates={() => void updater.checkForUpdates(false)}
        onResetLayout={() => setLayout(DEFAULT_LAYOUT)}
      />

      {!layout.sidebarCollapsed ? (
        <div
          className="layout-resizer layout-resizer--sidebar"
          role="separator"
          aria-label="调整侧栏宽度"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={(event) => resizePane("sidebar", event)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              adjustPaneWidth(
                "sidebar",
                event.key === "ArrowLeft" ? -1 : 1,
              );
            }
          }}
        />
      ) : null}

      <section
        className={`collection-pane ${
          layout.collectionCollapsed ? "collection-pane--collapsed" : ""
        }`}
      >
        {layout.collectionCollapsed ? (
          <div className="collapsed-rail">
            <button
              className="icon-button collapsed-rail__button"
              type="button"
              aria-label="展开日记列表"
              title="展开日记列表"
              onClick={() =>
                setLayout((current) => ({
                  ...current,
                  collectionCollapsed: false,
                }))
              }
            >
              <PanelLeftOpen size={18} />
            </button>
            <span className="collapsed-rail__label">列表</span>
            <strong className="collapsed-rail__count">{entryCount}</strong>
          </div>
        ) : (
          <>
            <header className="collection-header">
              <div>
                <h1>{title}</h1>
              </div>
              <div className="collection-header__meta">
                {loading ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <span>{entryCount} 篇</span>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label="收起日记列表"
                  title="收起日记列表"
                  onClick={() =>
                    setLayout((current) => ({
                      ...current,
                      collectionCollapsed: true,
                    }))
                  }
                >
                  <PanelLeftClose size={17} />
                </button>
              </div>
            </header>

            {calendarMode ? (
              <CalendarPane
                entries={calendarEntries.filter((entry) => {
                  if (!search.trim()) {
                    return true;
                  }
                  const query = search.trim().toLocaleLowerCase();
                  return `${entry.title}\n${entry.content}\n${entry.tags.join(" ")}`
                    .toLocaleLowerCase()
                    .includes(query);
                })}
                selectedDate={selectedDate}
                selectedId={selectedId}
                onSelectDate={(date) =>
                  setFilter({ kind: "date", date })
                }
                onSelect={selectEntry}
                onTrash={handleTrash}
              />
            ) : (
              <EntryList
                entries={entries}
                selectedId={selectedId}
                trashMode={filter.kind === "trash"}
                searchQuery={debouncedSearch}
                onSelect={selectEntry}
                onTrash={handleTrash}
                onRestore={handleRestore}
                onDeleteForever={handleDeleteForever}
              />
            )}
          </>
        )}
      </section>

      {!layout.collectionCollapsed ? (
        <div
          className="layout-resizer layout-resizer--collection"
          role="separator"
          aria-label="调整日记列表宽度"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={(event) => resizePane("collection", event)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              adjustPaneWidth(
                "collection",
                event.key === "ArrowLeft" ? -1 : 1,
              );
            }
          }}
        />
      ) : null}

      <Editor
        draft={draft}
        isTrashed={Boolean(draftDeletedAt)}
        collapsed={layout.editorCollapsed}
        saveState={saveState}
        savedAt={savedAt}
        onChange={updateDraft}
        onSave={() => void handleSave()}
        onToggleFavorite={() => void handleToggleFavorite()}
        onTrash={() => void handleTrash()}
        onRestore={() => void handleRestore()}
        onDeleteForever={() => void handleDeleteForever()}
        onBack={() => setMobileEditorOpen(false)}
        onCollapse={() =>
          setLayout((current) => ({ ...current, editorCollapsed: true }))
        }
        onExpand={() =>
          setLayout((current) => ({ ...current, editorCollapsed: false }))
        }
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description ?? ""}
        confirmLabel="永久删除"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmState(null)}
      />

      <UpdateNotice
        state={updater.state}
        onInstall={() => void updater.installUpdate()}
        onDismiss={updater.dismiss}
      />
    </div>
  );
}
