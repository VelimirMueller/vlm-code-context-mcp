//! Attachment types and implementations

use super::processors::{Geometry, ImageProcessor, ProcessOptions};
use super::storage::FilesystemStorage;
use super::traits::{ImageFormat, Processor, ResizeMode, StorageBackend, Validator};
use crate::error::Result;
use std::marker::PhantomData;
use std::path::PathBuf;

/// Style definition for image attachments
#[derive(Debug, Clone)]
pub struct Style {
    pub name: String,
    pub geometry: Geometry,
    pub format: ImageFormat,
    pub quality: u8,
}

impl Style {
    /// Create new style
    pub fn new(name: impl Into<String>, geometry: Geometry) -> Self {
        Self {
            name: name.into(),
            geometry,
            format: ImageFormat::Jpeg,
            quality: 85,
        }
    }

    /// Set output format
    pub fn format(mut self, format: ImageFormat) -> Self {
        self.format = format;
        self
    }

    /// Set quality (1-100)
    pub fn quality(mut self, quality: u8) -> Self {
        self.quality = quality.min(100);
        self
    }
}

/// File attachment configuration
#[derive(Debug, Clone)]
pub struct AttachmentConfig {
    pub name: String,
    pub styles: Vec<Style>,
    pub validators: Vec<String>,
    pub max_size: Option<usize>,
}

impl Default for AttachmentConfig {
    fn default() -> Self {
        Self {
            name: "attachment".to_string(),
            styles: Vec::new(),
            validators: Vec::new(),
            max_size: Some(10 * 1024 * 1024), // 10MB default
        }
    }
}

/// Attachment that wraps a storage backend
pub struct Attachment<T: StorageBackend> {
    storage: T,
    config: AttachmentConfig,
    processor: ImageProcessor,
    path: Option<String>,
    original_size: usize,
}

impl<T: StorageBackend> Attachment<T> {
    /// Create new attachment with storage backend
    pub fn new(storage: T) -> Self {
        Self {
            storage,
            config: AttachmentConfig::default(),
            processor: ImageProcessor::new(),
            path: None,
            original_size: 0,
        }
    }

    /// Set attachment configuration
    pub fn with_config(mut self, config: AttachmentConfig) -> Self {
        self.config = config;
        self
    }

    /// Add a style
    pub fn with_style(mut self, style: Style) -> Self {
        self.config.styles.push(style);
        self
    }

    /// Set maximum file size
    pub fn max_size(mut self, size: usize) -> Self {
        self.config.max_size = Some(size);
        self
    }

    /// Upload and process file
    pub async fn upload(&mut self, bytes: Vec<u8>) -> Result<String> {
        // Validate file size
        if let Some(max_size) = self.config.max_size {
            if bytes.len() > max_size {
                return Err(crate::error::Error::Validation(format!(
                    "File size {} exceeds maximum {}",
                    bytes.len(),
                    max_size
                )));
            }
        }

        self.original_size = bytes.len();

        // Generate unique path
        let path = self.generate_path();
        self.path = Some(path.clone());

        // Store original
        self.storage.store(bytes.clone(), &path).await?;

        // Process and store styles
        for style in &self.config.styles {
            let options = ProcessOptions {
                width: Some(style.geometry.width),
                height: Some(style.geometry.height),
                mode: style.geometry.mode,
                format: style.format,
                quality: style.quality,
            };

            let processed = self.processor.process(bytes.clone(), &options).await?;
            let style_path = self.style_path(&path, &style.name);
            self.storage.store(processed, &style_path).await?;
        }

        Ok(path)
    }

    /// Get URL for original file
    pub async fn url(&self) -> Result<String> {
        let path = self.path.as_ref().ok_or_else(|| {
            crate::error::Error::Validation("No file uploaded".to_string())
        })?;
        self.storage.url(path).await
    }

    /// Get URL for a specific style
    pub async fn style_url(&self, style_name: &str) -> Result<String> {
        let path = self.path.as_ref().ok_or_else(|| {
            crate::error::Error::Validation("No file uploaded".to_string())
        })?;
        let style_path = self.style_path(path, style_name);
        self.storage.url(&style_path).await
    }

    /// Delete attachment and all styles
    pub async fn delete(&mut self) -> Result<()> {
        let path = self.path.as_ref().ok_or_else(|| {
            crate::error::Error::Validation("No file uploaded".to_string())
        })?;

        // Delete original
        self.storage.delete(path).await?;

        // Delete styles
        for style in &self.config.styles {
            let style_path = self.style_path(path, &style.name);
            let _ = self.storage.delete(&style_path).await;
        }

        self.path = None;
        Ok(())
    }

    /// Get original file size
    pub fn size(&self) -> usize {
        self.original_size
    }

    /// Check if file is uploaded
    pub fn is_uploaded(&self) -> bool {
        self.path.is_some()
    }

    fn generate_path(&self) -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_micros();
        format!("{}/{}.bin", self.config.name, timestamp)
    }

    fn style_path(&self, original_path: &str, style_name: &str) -> String {
        // Insert style name before the filename
        if let Some(parent) = std::path::Path::new(original_path).parent() {
            if let Some(filename) = std::path::Path::new(original_path).file_name() {
                return format!(
                    "{}/styles/{}/{}",
                    parent.display(),
                    style_name,
                    filename.to_string_lossy()
                );
            }
        }
        format!("styles/{}/{}", style_name, original_path)
    }
}

/// Builder for creating filesystem attachments
pub struct FileAttachmentBuilder {
    base_path: PathBuf,
    base_url: String,
}

impl FileAttachmentBuilder {
    pub fn new<P: AsRef<std::path::Path>>(base_path: P, base_url: impl Into<String>) -> Self {
        Self {
            base_path: base_path.as_ref().to_path_buf(),
            base_url: base_url.into(),
        }
    }

    pub fn build(self) -> Attachment<FilesystemStorage> {
        let storage = FilesystemStorage::new(self.base_path, self.base_url);
        Attachment::new(storage)
    }
}

impl Default for FileAttachmentBuilder {
    fn default() -> Self {
        Self::new("./uploads", "/uploads")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::MemoryStorage;

    #[tokio::test]
    async fn test_attachment_upload() {
        let storage = MemoryStorage::new();
        let mut attachment = Attachment::new(storage).max_size(1024 * 1024);

        let test_data = vec![0u8; 100];
        let result = attachment.upload(test_data).await;
        assert!(result.is_ok());
        assert!(attachment.is_uploaded());
        assert_eq!(attachment.size(), 100);
    }

    #[test]
    fn test_style_builder() {
        let geo = Geometry {
            width: 100,
            height: 100,
            mode: ResizeMode::Fit,
        };
        let style = Style::new("thumb", geo)
            .format(ImageFormat::Png)
            .quality(90);
        assert_eq!(style.name, "thumb");
        assert_eq!(style.format, ImageFormat::Png);
        assert_eq!(style.quality, 90);
    }
}
