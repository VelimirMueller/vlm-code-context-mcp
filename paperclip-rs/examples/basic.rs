//! Basic example of using paperclip-rs for file uploads

use paperclip_rs::{Attachment, FileAttachmentBuilder, Style};
use paperclip_rs::processors::{Geometry, ResizeMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("📎 paperclip-rs Basic Example");
    println!("==============================\n");

    // Create an attachment with multiple styles
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
        .max_size(5 * 1024 * 1024); // 5MB limit

    // Simulate an image upload (in real usage, this would come from a form)
    let dummy_image = create_dummy_jpeg();

    println!("Uploading avatar...");
    let path = avatar.upload(dummy_image).await?;
    println!("✓ Uploaded to: {}\n", path);

    println!("Generated URLs:");
    println!("  Original: {}", avatar.url().await?);
    println!("  Thumb:    {}", avatar.style_url("thumb").await?);
    println!("  Medium:   {}", avatar.style_url("medium").await?);

    println!("\nFile size: {} bytes", avatar.size());
    println!("Is uploaded: {}", avatar.is_uploaded());

    // Cleanup
    println!("\nCleaning up...");
    avatar.delete().await?;
    println!("✓ Deleted");

    Ok(())
}

/// Create a minimal valid JPEG for demonstration
fn create_dummy_jpeg() -> Vec<u8> {
    // JPEG magic bytes + minimal data
    let jpeg_header = vec![
        0xFF, 0xD8, 0xFF, 0xE0, // JPEG SOI + APP0
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
        0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xFF, 0xD9, // EOI
    ];
    jpeg_header
}
