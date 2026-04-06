//! Error types for paperclip-rs

use std::io;
use thiserror::Error;

/// Main error type for paperclip-rs
#[derive(Error, Debug)]
pub enum Error {
    /// IO error during file operations
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    /// Image processing error
    #[error("Image processing error: {0}")]
    ImageProcessing(String),

    /// Storage backend error
    #[error("Storage error: {0}")]
    Storage(String),

    /// Validation error
    #[error("Validation failed: {0}")]
    Validation(String),

    /// Geometry parsing error
    #[error("Invalid geometry string: {0}")]
    InvalidGeometry(String),

    /// S3 client error
    #[cfg(feature = "s3")]
    #[error("S3 error: {0}")]
    S3(String),

    /// File not found
    #[error("File not found: {0}")]
    NotFound(String),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// Result type alias
pub type Result<T> = std::result::Result<T, Error>;
