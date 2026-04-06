# paperclip-rs

Type-safe file attachment library for Rust, inspired by [Paperclip](https://github.com/thoughtbot/paperclip) for Ruby on Rails.

## Features

- 🔒 **Type-safe** - Leverages Rust's type system for compile-time safety
- 🎨 **Style-based transformations** - Define multiple versions (thumb, medium, etc.)
- 🗄️ **Storage abstraction** - Filesystem, S3, and in-memory backends
- ⚡ **Async-first** - Built on Tokio for non-blocking operations
- 🖼️ **Image processing** - Pure Rust image transformations via `image` crate
- ✅ **Validations** - File size, content type, and dimension constraints

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
paperclip-rs = { version = "0.1", features = ["filesystem"] }
```

Features:
- `filesystem` (default) - Local file system storage
- `s3` - AWS S3 compatible storage
- `memory` - In-memory storage for testing

## Quick Start

```rust
use paperclip_rs::{Attachment, FileAttachmentBuilder, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut avatar = FileAttachmentBuilder::new("./uploads", "/uploads")
        .build()
        .with_style(Style::new(
            "thumb",
            Geometry {
                width: 100,
                height: 100,
                mode: ResizeMode::Fill,
            },
        ))
        .with_style(Style::new(
            "medium",
            Geometry {
                width: 300,
                height: 300,
                mode: ResizeMode::Fit,
            },
        ))
        .max_size(5 * 1024 * 1024);

    let image_bytes = std::fs::read("avatar.jpg")?;
    let path = avatar.upload(image_bytes).await?;

    println!("Avatar uploaded to: {}", path);
    println!("Thumb URL: {}", avatar.style_url("thumb").await?);
    println!("Medium URL: {}", avatar.style_url("medium").await?);

    Ok(())
}
```

## Geometry Syntax

Paperclip-style geometry strings for image transformations:

| Syntax | Description |
|--------|-------------|
| `100x100` | Fit within 100x100 (preserve aspect ratio) |
| `100x100#` | Exact crop to 100x100 |
| `100x100>` | Only resize if larger than 100x100 |
| `100x100^` | Minimum 100x100, fill rest |

```rust
use paperclip_rs::ImageProcessor;

// Parse geometry strings
let thumb = ImageProcessor::parse_geometry("100x100#")?;
let medium = ImageProcessor::parse_geometry("300x300>")?;
```

## Storage Backends

### Filesystem (Default)

```rust
use paperclip_rs::{FileAttachmentBuilder, FilesystemStorage};

let storage = FilesystemStorage::new("./uploads", "https://cdn.example.com");
let attachment = Attachment::new(storage);
```

### S3 (Feature: `s3`)

```rust
use paperclip_rs::S3Storage;

let storage = S3Storage::new("my-bucket", "us-east-1")
    .with_prefix("attachments");
let attachment = Attachment::new(storage);
```

### In-Memory (Testing)

```rust
use paperclip_rs::MemoryStorage;

let storage = MemoryStorage::new();
let attachment = Attachment::new(storage);
```

## Advanced Configuration

### Custom Validators

```rust
use paperclip_rs::Validator;

fn validate_jpeg(bytes: &[u8]) -> Result<(), paperclip_rs::Error> {
    if bytes.start_with(b"\xFF\xD8\xFF") {
        Ok(())
    } else {
        Err(paperclip_rs::Error::Validation("Not a JPEG".to_string()))
    }
}

let attachment = Attachment::new(storage)
    .with_validator(&validate_jpeg);
```

### Multiple Styles

```rust
let styles = vec![
    Style::new("icon", Geometry::new(32, 32, ResizeMode::Exact)),
    Style::new("thumb", Geometry::new(100, 100, ResizeMode::Fill)),
    Style::new("medium", Geometry::new(300, 300, ResizeMode::Fit)),
    Style::new("large", Geometry::new(800, 600, ResizeMode::ShrinkOnly)),
];

let attachment = Attachment::new(storage)
    .with_styles(styles);
```

## Comparison with Paperclip (Ruby)

| Paperclip (Ruby) | paperclip-rs |
|------------------|-------------|
| Runtime validation | Compile-time trait bounds |
| Method chaining DSL | Derive macros |
| Duck-typed backends | Trait-based generics |
| ImageMagick FFI | Pure Rust `image` crate |
| Ruby callbacks | Trait implementations |
| Hash-based config | Type-safe structs |

## License

MIT OR Apache-2.0

## Acknowledgments

Inspired by the [Paperclip](https://github.com/thoughtbot/paperclip) gem for Ruby on Rails.
