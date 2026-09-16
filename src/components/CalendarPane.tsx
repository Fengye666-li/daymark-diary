import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Entry } from "../types";
import {
  createMonthGrid,
  getMonthTitle,
  todayKey,
} from "../lib/date";
import { EntryList } from "./EntryList";

interface CalendarPaneProps {
  entries: Entry[];
  selectedDate: string;
  selectedId?: string | null;
  onSelectDate: (date: string) => void;
  onSelect: (entry: Entry) => void;
  onTrash: (entry: Entry) => void;
}

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarPane({
  entries,
  selectedDate,
  selectedId,
  onSelectDate,
  onSelect,
  onTrash,
}: CalendarPaneProps) {
  const initial = new Date(`${selectedDate}T00:00:00`);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const monthGrid = createMonthGrid(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
  );
  const counts = entries.reduce<Map<string, number>>((map, entry) => {
    map.set(entry.entryDate, (map.get(entry.entryDate) ?? 0) + 1);
    return map;
  }, new Map());
  const dayEntries = entries.filter((entry) => entry.entryDate === selectedDate);

  const moveMonth = (offset: number) => {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + offset,
        1,
      ),
    );
  };

  return (
    <div className="calendar-pane">
      <div className="calendar-header">
        <div>
          <span>日历</span>
          <h2>{getMonthTitle(visibleMonth.getFullYear(), visibleMonth.getMonth())}</h2>
        </div>
        <div className="calendar-header__actions">
          <button
            className="icon-button"
            type="button"
            aria-label="上个月"
            title="上个月"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="button button--ghost button--compact"
            type="button"
            onClick={() => {
              const today = new Date();
              setVisibleMonth(
                new Date(today.getFullYear(), today.getMonth(), 1),
              );
              onSelectDate(todayKey());
            }}
          >
            今天
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="下个月"
            title="下个月"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label="日记日历">
        {monthGrid.map((day) => {
          const count = counts.get(day.key) ?? 0;
          const selected = day.key === selectedDate;
          return (
            <button
              key={day.key}
              className={[
                "calendar-day",
                day.inCurrentMonth ? "" : "is-outside",
                selected ? "is-selected" : "",
                day.key === todayKey() ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              role="gridcell"
              aria-label={`${day.key}${count ? `，${count}篇日记` : ""}`}
              onClick={() => {
                if (!day.inCurrentMonth) {
                  const date = new Date(`${day.key}T00:00:00`);
                  setVisibleMonth(
                    new Date(date.getFullYear(), date.getMonth(), 1),
                  );
                }
                onSelectDate(day.key);
              }}
            >
              <span>{day.day}</span>
              {count ? (
                <i>
                  {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                    <b key={index} />
                  ))}
                </i>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="calendar-day-entries">
        <div className="calendar-day-entries__heading">
          <span>{selectedDate.replaceAll("-", ".")}</span>
          <em>{dayEntries.length} 篇</em>
        </div>
        <EntryList
          entries={dayEntries}
          selectedId={selectedId}
          onSelect={onSelect}
          onTrash={onTrash}
          onRestore={() => undefined}
          onDeleteForever={() => undefined}
        />
      </div>
    </div>
  );
}
