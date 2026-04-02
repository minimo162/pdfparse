use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Deserialize, Serialize)]
pub struct ExtractionResult {
    pub pages: Vec<String>,
    pub page_count: usize,
    pub char_count: usize,
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub file_name: String,
    pub file_size: u64,
}

pub fn inspect(file_path: &str) -> Result<FileInfo, String> {
    let path = Path::new(file_path);
    let metadata = fs::metadata(path).map_err(|_| "Unable to read this file".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Unable to read this file".to_string())?
        .to_string();

    Ok(FileInfo {
        file_name,
        file_size: metadata.len(),
    })
}
