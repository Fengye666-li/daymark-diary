const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(key: string): string {
  const date = parseDateKey(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

export function formatCompactDate(key: string): string {
  const date = parseDateKey(key);
  const now = new Date();
  if (toDateKey(now) === key) {
    return "今天";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (toDateKey(yesterday) === key) {
    return "昨天";
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function getMonthTitle(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

export interface CalendarDay {
  key: string;
  day: number;
  inCurrentMonth: boolean;
}

export function createMonthGrid(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: toDateKey(date),
      day: date.getDate(),
      inCurrentMonth:
        date.getFullYear() === year && date.getMonth() === month,
    };
  });
}

export function isSameMonth(key: string, year: number, month: number): boolean {
  const date = parseDateKey(key);
  return date.getFullYear() === year && date.getMonth() === month;
}
