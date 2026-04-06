# Getting Started with paperclip-rs

A comprehensive guide to get you up and running with paperclip-rs.

## Table of Contents

1. [Installation](#installation)
2. [Basic Usage](#basic-usage)
3. [Storage Backends](#storage-backends)
4. [Image Styles](#image-styles)
5. [Validation](#validation)
6. [Integration with Web Frameworks](#integration-with-web-frameworks)

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
paperclip-rs = "0.1"
tokio = { version = "1", features = ["full"] }
```

For specific storage backends:

```toml
# Filesystem only (default)
paperclip-rs = { version = "0.1", default-features = false, features = ["filesystem"] }

# S3 support
paperclip-rs = { version = "0.1", features = ["s3"] }

# All features
paperclip-rs = { version = "0.1", features = ["filesystem", "s3", "memory"] }
```

## Basic Usage

### Step 1: Create an Attachment

```rust
use paperclip_rs::{FileAttachmentBuilder, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut avatar = FileAttachmentBuilder::new("./uploads", "/uploads")
        .build()
        .max_size(5 * 1024 * 1024); // 5MB

    Ok(())
}
```

### Step 2: Upload a File

```rust
let file_bytes = std::fs::read("profile.jpg")?;
let path = avatar.upload(file_bytes).await?;
println!("Uploaded to: {}", path);
```

### Step 3: Get URLs

```rust
let original_url = avatar.url().await?;
let thumb_url = avatar.style_url("thumb").await?;
```

### Step 4: Clean Up

```rust
avatar.delete().await?;
```

## Storage Backends

### Filesystem Storage

For local development and small deployments:

```rust
use paperclip_rs::FilesystemStorage;

let storage = FilesystemStorage::new(
    "./public/uploads",  // Local path
    "https://cdn.example.com/uploads"  // CDN URL
);
```

### S3 Storage

For production deployments:

```rust
use paperclip_rs::S3Storage;

let storage = S3Storage::new("my-bucket", "us-east-1")
    .with_prefix("attachments");

let attachment = Attachment::new(storage);
```

### In-Memory Storage

For testing:

```rust
use paperclip_rs::MemoryStorage;

let storage = MemoryStorage::new();
let attachment = Attachment::new(storage);
```

## Image Styles

Styles define different versions of uploaded images.

### Creating Styles

```rust
use paperclip_rs::Style;
use paperclip_rs::processors::{Geometry, ResizeMode};

// Thumbnail with exact crop
let thumb = Style::new(
    "thumb",
    Geometry {
        width: 100,
        height: 100,
        mode: ResizeMode::Exact,  // # modifier
    },
);

// Medium size, fit within bounds
let medium = Style::new(
    "medium",
    Geometry {
        width: 300,
        height: 300,
        mode: ResizeMode::Fit,  // No modifier
    },
);

// Large, only shrink if bigger
let large = Style::new(
    "large",
    Geometry {
        width: 1200,
        height: 1200,
        mode: ResizeMode::ShrinkOnly,  // > modifier
    },
);
```

### Using Multiple Styles

```rust
let attachment = Attachment::new(storage)
    .with_style(thumb)
    .with_style(medium)
    .with_style(large);
```

### Geometry Reference

| Mode | Description | Modifier |
|------|-------------|----------|
| Fit | Fit within bounds, preserve ratio | none |
| Exact | Exact crop to dimensions | `#` |
| Fill | Cover bounds, crop excess | `^` |
| ShrinkOnly | Only resize if larger | `>` |

Example geometry strings:
- `"100x100"` - Fit within 100x100
- `"100x100#"` - Exact 100x100 crop
- `"300x300>"` - Only if larger than 300x300
- `"200x200^"` - At least 200x200, fill rest

## Validation

### File Size Limits

```rust
let attachment = Attachment::new(storage)
    .max_size(10 * 1024 * 1024); // 10MB
```

### Custom Validators

```rust
use paperclip_rs::Validator;

fn validate_jpeg(bytes: &[u8]) -> Result<(), paperclip_rs::Error> {
    // JPEG files start with these bytes
    if bytes.start_with(&[0xFF, 0xD8, 0xFF]) {
        Ok(())
    } else {
        Err(paperclip_rs::Error::Validation(
            "Not a JPEG file".to_string()
        ))
    }
}

let attachment = Attachment::new(storage)
    .with_validator(&validate_jpeg);
```

### Content Type Validation

```rust
fn validate_image_type(bytes: &[u8]) -> Result<(), paperclip_rs::Error> {
    let jpeg = [0xFF, 0xD8, 0xFF];
    let png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    if bytes.starts_with(&jpeg) || bytes.starts_with(&png) {
        Ok(())
    } else {
        Err(paperclip_rs::Error::Validation(
            "Only JPEG and PNG allowed".to_string()
        ))
    }
}
```

## Integration with Web Frameworks

### Actix-Web Example

```rust
use actix_multipart::Multipart;
use actix_web::{web, App, HttpResponse, Responder};
use paperclip_rs::{FileAttachmentBuilder, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};

async fn upload_avatar(
    mut payload: Multipart,
) -> impl Responder {
    let mut avatar = FileAttachmentBuilder::new("./uploads", "/uploads")
        .build()
        .with_style(Style::new(
            "thumb",
            Geometry {
                width: 100,
                height: 100,
                mode: ResizeMode::Fill,
            },
        ));

    while let Ok(Some(field)) = payload.try_next().await {
        if field.name() == "avatar" {
            let mut bytes = Vec::new();
            let _ = field.copy_to(&mut bytes).await?;

            match avatar.upload(bytes).await {
                Ok(path) => {
                    return HttpResponse::Ok().json(serde_json::json!({
                        "path": path,
                        "url": avatar.url().await.ok()
                    }));
                }
                Err(e) => {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": e.to_string()
                    }));
                }
            }
        }
    }

    HttpResponse::BadRequest().finish()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/avatar", web::post().to(upload_avatar))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

### Axum Example

```rust
use axum::{
    extract::Multipart,
    response::{IntoResponse, Json},
    Router,
};
use paperclip_rs::{FileAttachmentBuilder, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};
use serde_json::json;

async fn upload_avatar(
    mut mutlipart: Multipart,
) -> impl IntoResponse {
    let mut avatar = FileAttachmentBuilder::new("./uploads", "/uploads")
        .build()
        .with_style(Style::new(
            "thumb",
            Geometry {
                width: 100,
                height: 100,
                mode: ResizeMode::Fill,
            },
        ));

    while let Some(mut field) = mutlipart.next_field().await.unwrap() {
        if field.name() == Some("avatar") {
            let bytes = field.bytes().await.unwrap().to_vec();

            match avatar.upload(bytes).await {
                Ok(path) => {
                    return Json(json!({
                        "path": path,
                        "url": avatar.url().await.ok()
                    }))
                }
                Err(e) => {
                    return Json(json!({
                        "error": e.to_string()
                    }))
                }
            }
        }
    }

    Json(json!({"error": "No file uploaded"}))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/avatar", axum::routing::post(upload_avatar));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

## Next Steps

- Check the [examples directory](../examples/) for more code samples
- Read the [migration guide](./MIGRATION.md) if coming from Ruby Paperclip
- Review the [API documentation](https://docs.rs/paperclip-rs)
