import { FileText, RotateCcw, Star, Trash2 } from "lucide-react";
import type { Entry } from "../types";
import { formatCompactDate, formatTime } from "../lib/date";

interface EntryListProps {
  entries: Entry[];
  selectedId?: string | null;
  trashMode?: boolean;
  searchQuery?: string;
  onSelect: (entry: Entry) => void;
  onTrash: (entry: Entry) => void;
  onRestore: (entry: Entry) => void;
  onDeleteForever: (entry: Entry) => void;
}

function excerpt(value: string): string {
  const plain = /<\/?[a-z][\s\S]*>/i.test(value)
    ? new DOMParser().parseFromString(value, "text/html").body.textContent ?? ""
    : value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[#>*_`~[\]()]/g, "");

  return plain
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 92);
}

function groupLabel(dateKey: string, index: number, entries: Entry[]): string {
  if (index > 0 && entries[index - 1].entryDate === dateKey) {
    return "";
  }

  const date = new Date(`${dateKey}T00:00:00`);
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function EntryList({
  entries,
  selectedId,
  trashMode = false,
  searchQuery,
  onSelect,
  onTrash,
  onRestore,
  onDeleteForever,
}: EntryListProps) {
  if (!entries.length) {
    return (
      <div className="empty-list">
        <div className="empty-list__icon">
          <FileText size={22} />
        </div>
        <strong>{searchQuery ? "没有匹配的日记" : "这里还没有日记"}</strong>
        <p>
          {searchQuery
            ? "换一个关键词，或试试搜索标签。"
            : "点击“写日记”开始记录今天。"}
        </p>
      </div>
    );
  }

  return (
    <div className="entry-list">
      {entries.map((entry, index) => {
        const month = groupLabel(entry.entryDate, index, entries);
        const selected = selectedId === entry.id;

        return (
          <div key={entry.id}>
            {month ? <div className="entry-list__month">{month}</div> : null}
            <article
              className={`entry-item ${selected ? "is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`打开日记：${entry.title}`}
              onClick={() => onSelect(entry)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(entry);
                }
              }}
            >
              <div className="entry-item__date">
                <strong>{formatCompactDate(entry.entryDate)}</strong>
                <span>{formatTime(entry.updatedAt)}</span>
              </div>
              <div className="entry-item__body">
                <div className="entry-item__title-row">
                  <h3>{entry.title || "未命名日记"}</h3>
                  {entry.favorite ? (
                    <Star
                      className="entry-item__favorite"
                      size={14}
                      fill="currentColor"
                      aria-label="已收藏"
                    />
                  ) : null}
                </div>
                <p>{excerpt(entry.content) || "空白日记"}</p>
              </div>
              <div className="entry-item__actions">
                {trashMode ? (
                  <>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="恢复日记"
                      title="恢复"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRestore(entry);
                      }}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      aria-label="永久删除日记"
                      title="永久删除"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteForever(entry);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    className="icon-button entry-item__trash"
                    type="button"
                    aria-label="移到回收站"
                    title="移到回收站"
                    onClick={(event) => {
                      event.stopPropagation();
                      onTrash(entry);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
