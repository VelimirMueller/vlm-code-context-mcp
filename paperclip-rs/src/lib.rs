//! paperclip-rs: Type-safe file attachment library for Rust
//!
//! Inspired by Paperclip for Ruby on Rails, adapted for Rust's type system
//! and async ecosystem.
//!
//! # Features
//!
//! - Type-safe attachment definitions via generics
//! - Trait-based storage abstraction
//! - Compile-time style validation
//! - Async-first design with Tokio
//! - Zero-copy operations where possible
//!
//! # Quick Start
//!
//! ```rust,no_run
//! use paperclip_rs::{Attachment, FileAttachmentBuilder, Style};
//! use paperclip_rs::processors::{Geometry, ResizeMode};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let mut avatar = FileAttachmentBuilder::new("./uploads", "/uploads")
//!         .build()
//!         .with_style(Style::new(
//!             "thumb",
//!             Geometry {
//!                 width: 100,
//!                 height: 100,
//!                 mode: ResizeMode::Fill,
//!             },
//!         ))
//!         .max_size(5 * 1024 * 1024);
//!
//!     let image_bytes = std::fs::read("avatar.jpg")?;
//!     let path = avatar.upload(image_bytes).await?;
//!
//!     println!("Avatar uploaded to: {}", path);
//!     println!("Thumb URL: {}", avatar.style_url("thumb").await?);
//!
//!     Ok(())
//! }
//! ```
//!
//! # Storage Backends
//!
//! - **FilesystemStorage** (default): Local file system storage
//! - **MemoryStorage**: In-memory for testing
//! - **S3Storage** (feature: "s3"): AWS S3 compatible storage
//!
//! # Modules
//!
//! - [`attachment`]: Attachment types and builders
//! - [`storage`]: Storage backend implementations
//! - [`processors`]: Image processing with geometry parsing
//! - [`traits`]: Core traits for extensibility
//! - [`error`]: Error types

pub mod attachment;
pub mod error;
pub mod processors;
pub mod storage;
pub mod traits;

// Re-exports for convenience
pub use attachment::{Attachment, AttachmentConfig, FileAttachmentBuilder, Style};
pub use error::{Error, Result};
pub use processors::{Geometry, ImageProcessor};
pub use storage::{FilesystemStorage, MemoryStorage};
#[cfg(feature = "s3")]
pub use storage::S3Storage;
pub use traits::{ImageFormat, ProcessOptions, Processor, ResizeMode, StorageBackend, Validator};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
