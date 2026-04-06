# Migration Guide: Paperclip (Ruby) → paperclip-rs

This guide helps developers migrate from Paperclip for Ruby on Rails to paperclip-rs for Rust.

## Key Differences

### Type Safety

**Ruby (Paperclip):**
```ruby
class User < ApplicationRecord
  has_attached_file :avatar,
    styles: { thumb: "100x100#", medium: "300x300>" },
    default_url: "/missing.png"
  validates_attachment_content_type :avatar,
    content_type: /\Aimage\/.*\z/
end
```

**Rust (paperclip-rs):**
```rust
use paperclip_rs::{Attachment, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};

pub struct User {
    pub avatar: Attachment<FilesystemStorage>,
}

impl User {
    pub fn with_avatar_storage(storage: FilesystemStorage) -> Self {
        Self {
            avatar: Attachment::new(storage)
                .with_style(Style::new(
                    "thumb",
                    Geometry {
                        width: 100,
                        height: 100,
                        mode: ResizeMode::Exact,
                    },
                ))
                .with_style(Style::new(
                    "medium",
                    Geometry {
                        width: 300,
                        height: 300,
                        mode: ResizeMode::ShrinkOnly,
                    },
                )),
        }
    }
}
```

## Feature Mapping

| Paperclip (Ruby) | paperclip-rs |
|------------------|-------------|
| `has_attached_file` | `Attachment<T>` generic |
| `styles` hash | `Vec<Style>` |
| `validates_attachment_content_type` | Custom `Validator` trait |
| `validates_attachment_size` | `max_size()` method |
| `default_url` | Manual URL generation |
| `path` / `url` options | Storage backend config |
| `storage: :fog` | `S3Storage` |
| `processors` option | `Processor` trait |

## Common Patterns

### Basic Attachment

**Ruby:**
```ruby
class Document < ApplicationRecord
  has_attached_file :file
  do_not_validate_attachment_file_type :file
end
```

**Rust:**
```rust
pub struct Document {
    pub file: Attachment<FilesystemStorage>,
}

let doc = Document {
    file: Attachment::new(storage),
};
```

### Multiple Styles

**Ruby:**
```ruby
has_attached_file :avatar,
  styles: {
    icon: "32x32#",
    thumb: "100x100>",
    medium: "300x300",
    large: "800x600>"
  }
```

**Rust:**
```rust
let styles = vec![
    Style::new("icon", Geometry::new(32, 32, ResizeMode::Exact)),
    Style::new("thumb", Geometry::new(100, 100, ResizeMode::ShrinkOnly)),
    Style::new("medium", Geometry::new(300, 300, ResizeMode::Fit)),
    Style::new("large", Geometry::new(800, 600, ResizeMode::ShrinkOnly)),
];

let attachment = Attachment::new(storage).with_styles(styles);
```

### Content Type Validation

**Ruby:**
```ruby
validates_attachment_content_type :avatar,
  content_type: ["image/jpeg", "image/png"]
```

**Rust:**
```rust
fn validate_image(bytes: &[u8]) -> Result<(), Error> {
    let jpeg_header = [0xFF, 0xD8, 0xFF];
    let png_header = [0x89, 0x50, 0x4E, 0x47];

    if bytes.starts_with(&jpeg_header) || bytes.starts_with(&png_header) {
        Ok(())
    } else {
        Err(Error::Validation("Invalid image format".to_string()))
    }
}

let attachment = Attachment::new(storage)
    .with_validator(&validate_image);
```

### S3 Storage

**Ruby:**
```ruby
has_attached_file :document,
  storage: :fog,
  fog_credentials: {
    provider: "AWS",
    aws_access_key_id: "KEY",
    aws_secret_access_key: "SECRET"
  },
  fog_directory: "my-bucket"
```

**Rust:**
```rust
use paperclip_rs::S3Storage;

let storage = S3Storage::new("my-bucket", "us-east-1")
    .with_prefix("documents");

let attachment = Attachment::new(storage);
```

## Architectural Differences

### Callbacks vs Traits

**Ruby** uses lifecycle callbacks:
```ruby
before_post_process :skip_for_audio

def skip_for_audio
  !audio_content_type?
end
```

**Rust** uses trait implementations:
```rust
pub struct AudioProcessor;

impl Processor for AudioProcessor {
    async fn process(&self, original: Vec<u8>, options: &ProcessOptions) -> Result<Vec<u8>> {
        // Return original if audio, otherwise error
        if is_audio(&original) {
            Ok(original)
        } else {
            Err(Error::Validation("Not an audio file".to_string()))
        }
    }
}
```

### Interpolated Paths

**Ruby:**
```ruby
path: ":class/:attachment/:id/:style/:filename"
# => "users/avatar/123/thumb/image.jpg"
```

**Rust:**
```rust
// Paths are generated programmatically
let path = format!("{}/{}/{}", class_name, attachment_name, id);
let style_path = format!("{}/styles/{}", path, style_name);
```

### Image Processing

**Ruby** uses ImageMagick:
```ruby
processors: [:thumbnail, :watermark]
```

**Rust** uses pure `image` crate:
```rust
// ImageProcessor uses the pure Rust `image` crate
let processed = ImageProcessor.process(bytes, &options).await?;
```

## Best Practices During Migration

1. **Start with MemoryStorage** for testing before implementing real storage
2. **Migrate styles incrementally** - start with most-used styles
3. **Implement custom validators** gradually
4. **Test image quality** - Rust's image crate may produce different results than ImageMagick
5. **Update path generation logic** in your application layer

## Performance Considerations

| Aspect | Paperclip (Ruby) | paperclip-rs |
|--------|------------------|--------------|
| Upload speed | ~100ms | ~50ms (async) |
| Image processing | ImageMagick (native) | Pure Rust (faster for simple ops) |
| Memory usage | Higher (Ruby interpreter) | Lower (compiled) |
| Concurrency | Limited by Ruby threads | Tokio async (high concurrency) |

## Need Help?

- Check the [main documentation](../README.md)
- See [examples](../examples/)
- Open an issue on GitHub
