//! Core traits for paperclip-rs

use async_trait::async_trait;
use crate::error::{Error, Result};

/// Configuration for image processing options
#[derive(Debug, Clone)]
pub struct ProcessOptions {
    /// Width in pixels
    pub width: Option<u32>,
    /// Height in pixels
    pub height: Option<u32>,
    /// Resize mode
    pub mode: ResizeMode,
    /// Output format
    pub format: ImageFormat,
    /// Quality for lossy formats (1-100)
    pub quality: u8,
}

/// Resize mode for image processing
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResizeMode {
    /// Fit within dimensions (preserve aspect ratio)
    Fit,
    /// Fill exact dimensions (may crop)
    Fill,
    /// Exact dimensions (crop to match)
    Exact,
    /// Only resize if larger than dimensions
    ShrinkOnly,
}

/// Image output format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Jpeg,
    Png,
    WebP,
}

impl Default for ProcessOptions {
    fn default() -> Self {
        Self {
            width: None,
            height: None,
            mode: ResizeMode::Fit,
            format: ImageFormat::Jpeg,
            quality: 85,
        }
    }
}

/// Storage backend trait for file persistence
#[async_trait]
pub trait StorageBackend: Send + Sync {
    /// Store file bytes and return the path/key
    async fn store(&self, bytes: Vec<u8>, path: &str) -> Result<String>;

    /// Retrieve file bytes by path/key
    async fn retrieve(&self, path: &str) -> Result<Vec<u8>>;

    /// Delete file by path/key
    async fn delete(&self, path: &str) -> Result<()>;

    /// Get public URL for file
    async fn url(&self, path: &str) -> Result<String>;

    /// Check if file exists
    async fn exists(&self, path: &str) -> Result<bool>;
}

/// Processor trait for image/video transformations
#[async_trait]
pub trait Processor: Send + Sync {
    /// Process input bytes with given options
    async fn process(&self, original: Vec<u8>, options: &ProcessOptions) -> Result<Vec<u8>>;

    /// Get processor name
    fn name(&self) -> &str {
        "default"
    }
}

/// Validator trait for file validation
pub trait Validator: Send + Sync {
    /// Validate file bytes
    fn validate(&self, bytes: &[u8]) -> Result<()>;

    /// Get validator name
    fn name(&self) -> &str {
        "default"
    }
}

impl<F> Validator for F
where
    F: Fn(&[u8]) -> Result<()> + Send + Sync,
{
    fn validate(&self, bytes: &[u8]) -> Result<()> {
        self(bytes)
    }
}
