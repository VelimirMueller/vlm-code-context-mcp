//! Storage backend implementations

use super::traits::StorageBackend;
use crate::error::{Error, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::sync::Mutex;

/// Filesystem storage for development
#[derive(Clone)]
pub struct FilesystemStorage {
    base_path: PathBuf,
    base_url: String,
}

impl FilesystemStorage {
    /// Create new filesystem storage
    pub fn new<P: AsRef<Path>>(base_path: P, base_url: impl Into<String>) -> Self {
        Self {
            base_path: base_path.as_ref().to_path_buf(),
            base_url: base_url.into(),
        }
    }

    /// Ensure directory exists
    async fn ensure_dir(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
        Ok(())
    }
}

#[async_trait]
impl StorageBackend for FilesystemStorage {
    async fn store(&self, bytes: Vec<u8>, path: &str) -> Result<String> {
        let full_path = self.base_path.join(path);
        self.ensure_dir(&full_path).await?;
        fs::write(&full_path, bytes).await?;
        Ok(path.to_string())
    }

    async fn retrieve(&self, path: &str) -> Result<Vec<u8>> {
        let full_path = self.base_path.join(path);
        if !full_path.exists() {
            return Err(Error::NotFound(path.to_string()));
        }
        fs::read(&full_path).await.map_err(Into::into)
    }

    async fn delete(&self, path: &str) -> Result<()> {
        let full_path = self.base_path.join(path);
        fs::remove_file(&full_path).await?;
        Ok(())
    }

    async fn url(&self, path: &str) -> Result<String> {
        Ok(format!("{}{}", self.base_url, path))
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        Ok(self.base_path.join(path).exists())
    }
}

/// In-memory storage for testing
#[derive(Clone, Default)]
pub struct MemoryStorage {
    files: Arc<Mutex<std::collections::HashMap<String, Vec<u8>>>>,
}

impl MemoryStorage {
    /// Create new in-memory storage
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl StorageBackend for MemoryStorage {
    async fn store(&self, bytes: Vec<u8>, path: &str) -> Result<String> {
        let mut files = self.files.lock().await;
        files.insert(path.to_string(), bytes);
        Ok(path.to_string())
    }

    async fn retrieve(&self, path: &str) -> Result<Vec<u8>> {
        let files = self.files.lock().await;
        files
            .get(path)
            .cloned()
            .ok_or_else(|| Error::NotFound(path.to_string()))
    }

    async fn delete(&self, path: &str) -> Result<()> {
        let mut files = self.files.lock().await;
        files.remove(path);
        Ok(())
    }

    async fn url(&self, path: &str) -> Result<String> {
        Ok(format!("/memory/{}", path))
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        let files = self.files.lock().await;
        Ok(files.contains_key(path))
    }
}

/// S3 storage for production (requires "s3" feature)
#[cfg(feature = "s3")]
pub struct S3Storage {
    bucket: String,
    region: String,
    prefix: Option<String>,
    // S3 client would go here - using placeholder for now
}

#[cfg(feature = "s3")]
impl S3Storage {
    /// Create new S3 storage
    pub fn new(bucket: impl Into<String>, region: impl Into<String>) -> Self {
        Self {
            bucket: bucket.into(),
            region: region.into(),
            prefix: None,
        }
    }

    /// Set path prefix for all files
    pub fn with_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.prefix = Some(prefix.into());
        self
    }
}

#[cfg(feature = "s3")]
#[async_trait]
impl StorageBackend for S3Storage {
    async fn store(&self, _bytes: Vec<u8>, path: &str) -> Result<String> {
        let full_path = match &self.prefix {
            Some(prefix) => format!("{}/{}", prefix, path),
            None => path.to_string(),
        };
        // TODO: Implement actual S3 upload using rusoto_s3
        Ok(full_path)
    }

    async fn retrieve(&self, path: &str) -> Result<Vec<u8>> {
        // TODO: Implement actual S3 download
        Err(Error::Storage("S3 not yet implemented".to_string()))
    }

    async fn delete(&self, _path: &str) -> Result<()> {
        // TODO: Implement actual S3 delete
        Err(Error::Storage("S3 not yet implemented".to_string()))
    }

    async fn url(&self, path: &str) -> Result<String> {
        Ok(format!(
            "https://{}.s3.{}.amazonaws.com/{}",
            self.bucket, self.region, path
        ))
    }

    async fn exists(&self, _path: &str) -> Result<bool> {
        // TODO: Implement actual S3 exists check
        Ok(false)
    }
}
