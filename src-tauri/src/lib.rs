mod db;

use std::{
    fs,
    path::Path,
    sync::Mutex,
};

use chrono::Local;
use db::{AppStats, Entry, EntryFilter, EntryInput, TagSummary};
use rusqlite::Connection;
use tauri::{Manager, State};

pub struct AppState {
    db: Mutex<Connection>,
}

fn create_daily_backup(connection: &Connection, app_data_dir: &Path) -> Result<(), String> {
    let backup_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;

    let backup_path = backup_dir.join(format!(
        "daymark-{}.sqlite3",
        Local::now().format("%Y%m%d")
    ));

    if !backup_path.exists() {
        let escaped_path = backup_path.to_string_lossy().replace('\'', "''");
        connection
            .execute_batch(&format!("VACUUM INTO '{escaped_path}'"))
            .map_err(|error| error.to_string())?;
    }

    let mut backups = fs::read_dir(&backup_dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|extension| extension == "sqlite3")
        })
        .collect::<Vec<_>>();

    backups.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
    });

    for old_backup in backups.into_iter().rev().skip(7) {
        let _ = fs::remove_file(old_backup.path());
    }

    Ok(())
}

#[tauri::command]
fn list_entries(
    state: State<'_, AppState>,
    filter: EntryFilter,
) -> Result<Vec<Entry>, String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::list_entries(&connection, &filter)
}

#[tauri::command]
fn get_entry(state: State<'_, AppState>, id: String) -> Result<Option<Entry>, String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::get_entry(&connection, &id)
}

#[tauri::command]
fn save_entry(state: State<'_, AppState>, input: EntryInput) -> Result<Entry, String> {
    let mut connection = state
        .db
        .lock()
        .map_err(|_| "数据库当前不可用".to_string())?;
    db::save_entry(&mut connection, input)
}

#[tauri::command]
fn trash_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::trash_entry(&connection, &id)
}

#[tauri::command]
fn restore_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::restore_entry(&connection, &id)
}

#[tauri::command]
fn delete_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::delete_entry(&connection, &id)
}

#[tauri::command]
fn toggle_favorite(state: State<'_, AppState>, id: String) -> Result<Entry, String> {
    let mut connection = state
        .db
        .lock()
        .map_err(|_| "数据库当前不可用".to_string())?;
    db::toggle_favorite(&mut connection, &id)
}

#[tauri::command]
fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagSummary>, String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::list_tags(&connection)
}

#[tauri::command]
fn get_stats(state: State<'_, AppState>) -> Result<AppStats, String> {
    let connection = state.db.lock().map_err(|_| "数据库当前不可用".to_string())?;
    db::get_stats(&connection)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("daymark.sqlite3");
            let connection = Connection::open(&db_path)?;
            db::initialize(&connection)?;
            if let Err(error) = create_daily_backup(&connection, &app_data_dir) {
                eprintln!("failed to create daily backup: {error}");
            }

            app.manage(AppState {
                db: Mutex::new(connection),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_entries,
            get_entry,
            save_entry,
            trash_entry,
            restore_entry,
            delete_entry,
            toggle_favorite,
            list_tags,
            get_stats
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Daymark");
}
