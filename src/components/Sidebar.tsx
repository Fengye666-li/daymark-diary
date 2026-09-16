import type { RefObject } from "react";
import {
  BookOpenText,
  CalendarDays,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Sun,
  Trash2,
} from "lucide-react";
import type { AppStats, EntryKind } from "../types";

type ActiveSection = EntryKind | "calendar";

interface SidebarProps {
  activeSection: ActiveSection;
  search: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  stats: AppStats;
  theme: "light" | "dark";
  collapsed: boolean;
  onSearch: (value: string) => void;
  onNew: () => void;
  onSelect: (kind: EntryKind) => void;
  onCalendar: () => void;
  onToggleTheme: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onCheckUpdates: () => void;
  onResetLayout: () => void;
}

export function Sidebar({
  activeSection,
  search,
  searchInputRef,
  stats,
  theme,
  collapsed,
  onSearch,
  onNew,
  onSelect,
  onCalendar,
  onToggleTheme,
  onCollapse,
  onExpand,
  onCheckUpdates,
  onResetLayout,
}: SidebarProps) {
  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: typeof BookOpenText;
    count?: number;
  }> = [
    { id: "today", label: "今天", icon: NotebookPen },
    { id: "all", label: "全部日记", icon: BookOpenText, count: stats.all },
    { id: "favorites", label: "收藏", icon: Star, count: stats.favorites },
    { id: "calendar", label: "日历", icon: CalendarDays },
    { id: "trash", label: "回收站", icon: Trash2, count: stats.trash },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar-topline">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <NotebookPen size={18} />
          </div>
          <div className="brand__copy">
            <strong>日迹</strong>
          </div>
        </div>
        <button
          className="icon-button sidebar-collapse-button"
          type="button"
          aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
          onClick={collapsed ? onExpand : onCollapse}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <button className="new-entry-button" type="button" onClick={onNew}>
        <Plus size={17} />
        <span>写日记</span>
        <kbd>Ctrl N</kbd>
      </button>

      <div className="sidebar-primary">
        <label className="sidebar-search">
          <Search size={16} />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            placeholder="搜索日记"
            aria-label="搜索日记"
            onChange={(event) => onSearch(event.target.value)}
          />
          <kbd>Ctrl F</kbd>
        </label>

        <nav className="sidebar-nav" aria-label="日记视图">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.id === "calendar"
                ? activeSection === "calendar"
                : activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav__item ${active ? "is-active" : ""}`}
                type="button"
                aria-current={active ? "page" : undefined}
                title={item.label}
                onClick={() =>
                  item.id === "calendar" ? onCalendar() : onSelect(item.id)
                }
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {typeof item.count === "number" && item.count > 0 ? (
                  <em>{item.count}</em>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          className="sidebar-footer__theme"
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
          title={theme === "light" ? "深色主题" : "浅色主题"}
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === "light" ? "深色" : "浅色"}</span>
        </button>
        <button
          className="sidebar-footer__reset"
          type="button"
          onClick={onCheckUpdates}
          aria-label="检查更新"
          title="检查更新"
        >
          <RefreshCw size={15} />
          <span>检查更新</span>
        </button>
        <button
          className="sidebar-footer__reset"
          type="button"
          onClick={onResetLayout}
          aria-label="重置布局"
          title="重置布局"
        >
          <RotateCcw size={15} />
          <span>重置布局</span>
        </button>
      </div>
    </aside>
  );
}
