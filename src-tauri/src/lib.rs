mod pdf;

use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Deserialize, Serialize)]
struct SidecarError {
    error: String,
}

#[tauri::command]
fn inspect_pdf(file_path: String) -> Result<pdf::FileInfo, String> {
    pdf::inspect(&file_path)
}

#[tauri::command]
async fn extract_text(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<pdf::ExtractionResult, String> {
    run_sidecar(&app, &file_path).await
}

#[tauri::command]
fn save_text(content: String, path: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save: {e}"))
}

fn parse_sidecar_success(stdout: &[u8]) -> Result<pdf::ExtractionResult, String> {
    serde_json::from_slice(stdout).map_err(|e| format!("Failed to parse result: {e}"))
}

fn parse_sidecar_error(stderr: &[u8]) -> String {
    if let Ok(err) = serde_json::from_slice::<SidecarError>(stderr) {
        return err.error;
    }

    let message = String::from_utf8_lossy(stderr).trim().to_string();
    if message.is_empty() {
        "Parser failed".to_string()
    } else {
        message
    }
}

async fn run_sidecar(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Result<pdf::ExtractionResult, String> {
    let output = app
        .shell()
        .sidecar("pdfparse-parser")
        .map_err(|e| format!("Failed to create sidecar: {e}"))?
        .arg(file_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run parser: {e}"))?;

    if output.status.success() {
        parse_sidecar_success(&output.stdout)
    } else {
        Err(parse_sidecar_error(&output.stderr))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            inspect_pdf,
            extract_text,
            save_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{parse_sidecar_error, parse_sidecar_success, SidecarError};

    #[test]
    fn parses_sidecar_success_json() {
        let result = parse_sidecar_success(
            br#"{"pages":["hello"],"page_count":1,"char_count":5}"#,
        )
        .expect("valid result");

        assert_eq!(result.pages, vec!["hello".to_string()]);
        assert_eq!(result.page_count, 1);
        assert_eq!(result.char_count, 5);
    }

    #[test]
    fn parses_sidecar_structured_error() {
        let message = parse_sidecar_error(
            serde_json::to_string(&SidecarError {
                error: "Unable to read this file".to_string(),
            })
            .expect("serialize")
            .as_bytes(),
        );

        assert_eq!(message, "Unable to read this file");
    }

    #[test]
    fn falls_back_to_stderr_text() {
        let message = parse_sidecar_error(b"unexpected failure");

        assert_eq!(message, "unexpected failure");
    }
}
