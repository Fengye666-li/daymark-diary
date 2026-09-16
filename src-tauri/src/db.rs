use std::collections::HashMap;

use chrono::{Local, Utc};
use rusqlite::{
    params, params_from_iter,
    types::Value,
    Connection, OptionalExtension, Row,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub content: String,
    pub entry_date: String,
    pub mood: String,
    pub weather: String,
    pub favorite: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    pub id: Option<String>,
    pub title: String,
    pub content: String,
    pub entry_date: String,
    pub mood: String,
    pub weather: String,
    pub favorite: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryFilter {
    pub kind: String,
    pub query: Option<String>,
    pub date: Option<String>,
    pub tag: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagSummary {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStats {
    pub all: i64,
    pub favorites: i64,
    pub trash: i64,
}

struct RawEntry {
    id: String,
    title: String,
    content: String,
    entry_date: String,
    mood: String,
    weather: String,
    favorite: bool,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
}

pub fn initialize(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            PRAGMA busy_timeout = 5000;
            PRAGMA temp_store = MEMORY;
            PRAGMA wal_autocheckpoint = 1000;
            PRAGMA journal_size_limit = 67108864;

            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                entry_date TEXT NOT NULL,
                mood TEXT NOT NULL DEFAULT '',
                weather TEXT NOT NULL DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_entries_date
                ON entries(entry_date DESC, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_entries_deleted
                ON entries(deleted_at);

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                color TEXT NOT NULL DEFAULT '#2f6f62'
            );

            CREATE TABLE IF NOT EXISTS entry_tags (
                entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY(entry_id, tag_id)
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts
                USING fts5(entry_id UNINDEXED, title, content, tokenize='trigram');
            "#,
        )
        .map_err(|error| error.to_string())
}

fn parse_entry(row: &Row<'_>) -> rusqlite::Result<RawEntry> {
    Ok(RawEntry {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        entry_date: row.get(3)?,
        mood: row.get(4)?,
        weather: row.get(5)?,
        favorite: row.get::<_, i64>(6)? != 0,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        deleted_at: row.get(9)?,
    })
}

fn load_tags(connection: &Connection, entry_id: &str) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT tags.name
            FROM tags
            JOIN entry_tags ON entry_tags.tag_id = tags.id
            WHERE entry_tags.entry_id = ?1
            ORDER BY tags.name COLLATE NOCASE
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([entry_id], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())
}

fn hydrate_entry(connection: &Connection, raw: RawEntry) -> Result<Entry, String> {
    let tags = load_tags(connection, &raw.id)?;
    Ok(Entry {
        id: raw.id,
        title: raw.title,
        content: raw.content,
        entry_date: raw.entry_date,
        mood: raw.mood,
        weather: raw.weather,
        favorite: raw.favorite,
        tags,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        deleted_at: raw.deleted_at,
    })
}

pub fn list_entries(connection: &Connection, filter: &EntryFilter) -> Result<Vec<Entry>, String> {
    let mut values: Vec<Value> = Vec::new();
    let mut conditions: Vec<String> = Vec::new();
    let mut join_fts = false;

    if let Some(query) = filter
        .query
        .as_deref()
        .map(str::trim)
        .filter(|query| !query.is_empty())
    {
        if query.chars().count() >= 3 {
            join_fts = true;
            conditions.push("entries_fts MATCH ?".to_string());
            values.push(Value::Text(format!(
                "\"{}\"",
                query.replace('"', "\"\"")
            )));
        } else {
            conditions.push("(e.title LIKE ? OR e.content LIKE ?)".to_string());
            let pattern = format!("%{query}%");
            values.push(Value::Text(pattern.clone()));
            values.push(Value::Text(pattern));
        }
    }

    match filter.kind.as_str() {
        "trash" => conditions.push("e.deleted_at IS NOT NULL".to_string()),
        _ => conditions.push("e.deleted_at IS NULL".to_string()),
    }

    match filter.kind.as_str() {
        "today" => {
            conditions.push("e.entry_date = ?".to_string());
            values.push(Value::Text(
                Local::now()
                    .date_naive()
                    .format("%Y-%m-%d")
                    .to_string(),
            ));
        }
        "favorites" => conditions.push("e.favorite = 1".to_string()),
        "date" => {
            if let Some(date) = filter.date.as_deref() {
                conditions.push("e.entry_date = ?".to_string());
                values.push(Value::Text(date.to_string()));
            }
        }
        "tag" => {
            if let Some(tag) = filter.tag.as_deref() {
                conditions.push(
                    r#"
                    EXISTS (
                        SELECT 1
                        FROM entry_tags et
                        JOIN tags t ON t.id = et.tag_id
                        WHERE et.entry_id = e.id AND t.name = ? COLLATE NOCASE
                    )
                    "#
                    .to_string(),
                );
                values.push(Value::Text(tag.to_string()));
            }
        }
        _ => {}
    }

    let from = if join_fts {
        "entries e JOIN entries_fts ON entries_fts.entry_id = e.id"
    } else {
        "entries e"
    };
    let sql = format!(
        r#"
        SELECT
            e.id,
            e.title,
            e.content,
            e.entry_date,
            e.mood,
            e.weather,
            e.favorite,
            e.created_at,
            e.updated_at,
            e.deleted_at
        FROM {from}
        WHERE {}
        ORDER BY e.entry_date DESC, e.updated_at DESC
        "#,
        conditions.join(" AND ")
    );

    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params_from_iter(values.iter()), parse_entry)
        .map_err(|error| error.to_string())?;

    let raw_entries = rows
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;

    raw_entries
        .into_iter()
        .map(|entry| hydrate_entry(connection, entry))
        .collect()
}

pub fn get_entry(connection: &Connection, id: &str) -> Result<Option<Entry>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT
                id, title, content, entry_date, mood, weather, favorite,
                created_at, updated_at, deleted_at
            FROM entries
            WHERE id = ?1
            "#,
        )
        .map_err(|error| error.to_string())?;
    let raw = statement
        .query_row([id], parse_entry)
        .optional()
        .map_err(|error| error.to_string())?;

    match raw {
        Some(entry) => hydrate_entry(connection, entry).map(Some),
        None => Ok(None),
    }
}

fn normalize_title(input: &EntryInput) -> String {
    input.title.trim().chars().take(80).collect()
}

fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut seen = HashMap::new();
    let mut normalized = Vec::new();

    for tag in tags {
        let value = tag.trim();
        if value.is_empty() {
            continue;
        }
        let key = value.to_lowercase();
        if seen.insert(key, ()).is_none() {
            normalized.push(value.chars().take(30).collect());
        }
    }

    normalized
}

fn tag_color(tag: &str) -> &'static str {
    const COLORS: [&str; 6] = [
        "#2f6f62", "#c1694f", "#7568a8", "#3f748f", "#a3772f", "#6f7d47",
    ];
    let hash = tag
        .chars()
        .fold(0usize, |value, character| value.wrapping_add(character as usize));
    COLORS[hash % COLORS.len()]
}

pub fn save_entry(connection: &mut Connection, input: EntryInput) -> Result<Entry, String> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let id = input
        .id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now().to_rfc3339();
    let existing = transaction
        .query_row(
            "SELECT created_at, deleted_at FROM entries WHERE id = ?1",
            [&id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let created_at = existing
        .as_ref()
        .map(|(created_at, _)| created_at.clone())
        .unwrap_or_else(|| now.clone());
    let deleted_at = existing.and_then(|(_, deleted_at)| deleted_at);
    let title = normalize_title(&input);
    let entry_date = if input.entry_date.trim().is_empty() {
        Utc::now().date_naive().format("%Y-%m-%d").to_string()
    } else {
        input.entry_date.trim().to_string()
    };

    transaction
        .execute(
            r#"
            INSERT INTO entries (
                id, title, content, entry_date, mood, weather, favorite,
                created_at, updated_at, deleted_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                entry_date = excluded.entry_date,
                mood = excluded.mood,
                weather = excluded.weather,
                favorite = excluded.favorite,
                updated_at = excluded.updated_at
            "#,
            params![
                id,
                title,
                input.content,
                entry_date,
                input.mood.trim(),
                input.weather.trim(),
                i64::from(input.favorite),
                created_at,
                now,
                deleted_at
            ],
        )
        .map_err(|error| error.to_string())?;

    transaction
        .execute("DELETE FROM entry_tags WHERE entry_id = ?1", [&id])
        .map_err(|error| error.to_string())?;

    for tag in normalize_tags(&input.tags) {
        transaction
            .execute(
                "INSERT OR IGNORE INTO tags(name, color) VALUES (?1, ?2)",
                params![tag, tag_color(&tag)],
            )
            .map_err(|error| error.to_string())?;
        let tag_id = transaction
            .query_row(
                "SELECT id FROM tags WHERE name = ?1 COLLATE NOCASE",
                [&tag],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO entry_tags(entry_id, tag_id) VALUES (?1, ?2)",
                params![id, tag_id],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction
        .execute("DELETE FROM entries_fts WHERE entry_id = ?1", [&id])
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "INSERT INTO entries_fts(entry_id, title, content) VALUES (?1, ?2, ?3)",
            params![id, title, input.content],
        )
        .map_err(|error| error.to_string())?;

    transaction.commit().map_err(|error| error.to_string())?;
    get_entry(connection, &id)?.ok_or_else(|| "保存后无法读取日记".to_string())
}

pub fn trash_entry(connection: &Connection, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let changed = connection
        .execute(
            "UPDATE entries SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("找不到这篇日记".to_string());
    }
    Ok(())
}

pub fn restore_entry(connection: &Connection, id: &str) -> Result<(), String> {
    let changed = connection
        .execute(
            "UPDATE entries SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("找不到这篇日记".to_string());
    }
    Ok(())
}

pub fn delete_entry(connection: &Connection, id: &str) -> Result<(), String> {
    connection
        .execute("DELETE FROM entries_fts WHERE entry_id = ?1", [id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM entries WHERE id = ?1", [id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn toggle_favorite(connection: &mut Connection, id: &str) -> Result<Entry, String> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let changed = transaction
        .execute(
            r#"
            UPDATE entries
            SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END,
                updated_at = ?1
            WHERE id = ?2
            "#,
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("找不到这篇日记".to_string());
    }
    transaction.commit().map_err(|error| error.to_string())?;
    get_entry(connection, id)?.ok_or_else(|| "找不到这篇日记".to_string())
}

pub fn list_tags(connection: &Connection) -> Result<Vec<TagSummary>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT tags.name, COUNT(DISTINCT entries.id)
            FROM tags
            JOIN entry_tags ON entry_tags.tag_id = tags.id
            JOIN entries ON entries.id = entry_tags.entry_id
            WHERE entries.deleted_at IS NULL
            GROUP BY tags.id, tags.name
            ORDER BY COUNT(DISTINCT entries.id) DESC, tags.name COLLATE NOCASE
            "#,
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(TagSummary {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())
}

pub fn get_stats(connection: &Connection) -> Result<AppStats, String> {
    let all = connection
        .query_row(
            "SELECT COUNT(*) FROM entries WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let favorites = connection
        .query_row(
            "SELECT COUNT(*) FROM entries WHERE deleted_at IS NULL AND favorite = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    let trash = connection
        .query_row(
            "SELECT COUNT(*) FROM entries WHERE deleted_at IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    Ok(AppStats {
        all,
        favorites,
        trash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        initialize(&connection).expect("initialize database");
        connection
    }

    fn sample_input() -> EntryInput {
        EntryInput {
            id: None,
            title: "测试日记".to_string(),
            content: "今天完成了本地日记应用。\n\n- SQLite\n- 全文搜索".to_string(),
            entry_date: "2026-09-15".to_string(),
            mood: "平静".to_string(),
            weather: "晴".to_string(),
            favorite: false,
            tags: vec!["开发".to_string(), "测试".to_string()],
        }
    }

    #[test]
    fn saves_searches_and_counts_entries() {
        let mut connection = test_connection();
        let saved = save_entry(&mut connection, sample_input()).expect("save entry");

        assert_eq!(saved.title, "测试日记");
        assert_eq!(saved.tags, vec!["开发", "测试"]);

        let results = list_entries(
            &connection,
            &EntryFilter {
                kind: "all".to_string(),
                query: Some("本地日记应用".to_string()),
                date: None,
                tag: None,
            },
        )
        .expect("full-text search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, saved.id);

        let tags = list_tags(&connection).expect("list tags");
        assert_eq!(tags.len(), 2);
        assert_eq!(tags.iter().map(|tag| tag.count).sum::<i64>(), 2);

        let stats = get_stats(&connection).expect("stats");
        assert_eq!(stats.all, 1);
        assert_eq!(stats.favorites, 0);
        assert_eq!(stats.trash, 0);
    }

    #[test]
    fn file_database_uses_wal_and_full_sync() {
        let database_path = std::env::temp_dir().join(format!(
            "daymark-test-{}.sqlite3",
            Uuid::new_v4()
        ));
        let connection = Connection::open(&database_path).expect("open file database");
        initialize(&connection).expect("initialize database");

        let journal_mode = connection
            .query_row("PRAGMA journal_mode", [], |row| row.get::<_, String>(0))
            .expect("journal mode");
        let synchronous = connection
            .query_row("PRAGMA synchronous", [], |row| row.get::<_, i64>(0))
            .expect("synchronous mode");

        assert_eq!(journal_mode.to_lowercase(), "wal");
        assert_eq!(synchronous, 2);

        drop(connection);
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!(
                "{}{}",
                database_path.to_string_lossy(),
                suffix
            ));
        }
    }

    #[test]
    fn keeps_title_empty_when_not_provided() {
        let mut connection = test_connection();
        let mut input = sample_input();
        input.title.clear();

        let saved = save_entry(&mut connection, input).expect("save entry");
        assert_eq!(saved.title, "");
    }

    #[test]
    fn supports_favorites_trash_restore_and_permanent_delete() {
        let mut connection = test_connection();
        let saved = save_entry(&mut connection, sample_input()).expect("save entry");

        let favorite = toggle_favorite(&mut connection, &saved.id).expect("favorite");
        assert!(favorite.favorite);

        trash_entry(&connection, &saved.id).expect("trash");
        let trashed = list_entries(
            &connection,
            &EntryFilter {
                kind: "trash".to_string(),
                query: None,
                date: None,
                tag: None,
            },
        )
        .expect("list trash");
        assert_eq!(trashed.len(), 1);

        restore_entry(&connection, &saved.id).expect("restore");
        let restored = get_entry(&connection, &saved.id)
            .expect("get entry")
            .expect("entry exists");
        assert!(restored.deleted_at.is_none());

        delete_entry(&connection, &saved.id).expect("delete permanently");
        assert!(get_entry(&connection, &saved.id)
            .expect("get deleted entry")
            .is_none());
        assert_eq!(get_stats(&connection).expect("stats").all, 0);
    }
}
