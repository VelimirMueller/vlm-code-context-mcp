//! Image processor implementation

use super::traits::{ImageFormat, ProcessOptions, Processor, ResizeMode};
use crate::error::{Error, Result};
use async_trait::async_trait;
use image::{
    imageops::{FilterType, Lanchzos3},
    DynamicImage, ImageOutputFormat,
};
use std::io::Cursor;

/// Geometry specification for image resizing
#[derive(Debug, Clone, PartialEq)]
pub struct Geometry {
    pub width: u32,
    pub height: u32,
    pub mode: ResizeMode,
}

/// Image processor using the `image` crate
pub struct ImageProcessor;

impl ImageProcessor {
    /// Create new image processor
    pub fn new() -> Self {
        Self
    }

    /// Parse geometry string (e.g., "100x100#", "300x300>", "200x200^")
    ///
    /// Format: `<width>x<height><modifier>`
    /// Modifiers:
    /// - `#` - Exact crop to dimensions
    /// - `>` - Only resize if larger than dimensions
    /// - `^` - Minimum dimensions, fill rest
    /// - (none) - Fit within dimensions
    pub fn parse_geometry(s: &str) -> Result<Geometry> {
        let s = s.trim();
        let mut parts = s.split(['x', '#', '>', '^']);

        let width: u32 = parts
            .next()
            .ok_or_else(|| Error::InvalidGeometry(s.to_string()))?
            .parse()
            .map_err(|_| Error::InvalidGeometry(s.to_string()))?;

        let height: u32 = parts
            .next()
            .ok_or_else(|| Error::InvalidGeometry(s.to_string()))?
            .parse()
            .map_err(|_| Error::InvalidGeometry(s.to_string()))?;

        // Determine mode from modifier
        let mode = if s.contains('#') {
            ResizeMode::Exact
        } else if s.contains('>') {
            ResizeMode::ShrinkOnly
        } else if s.contains('^') {
            ResizeMode::Fill
        } else {
            ResizeMode::Fit
        };

        Ok(Geometry { width, height, mode })
    }
}

impl Default for ImageProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Processor for ImageProcessor {
    async fn process(&self, original: Vec<u8>, options: &ProcessOptions) -> Result<Vec<u8>> {
        // Load image from bytes
        let img = image::load_from_memory(&original)
            .map_err(|e| Error::ImageProcessing(format!("Failed to load image: {}", e)))?;

        // Apply transformation based on mode
        let processed = match (options.width, options.height) {
            (Some(w), Some(h)) => self.resize(img, w, h, options.mode)?,
            (Some(w), None) => self.resize_width(img, w)?,
            (None, Some(h)) => self.resize_height(img, h)?,
            (None, None) => img,
        };

        // Encode to output format
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);

        let format = match options.format {
            ImageFormat::Jpeg => ImageOutputFormat::Jpeg(options.quality),
            ImageFormat::Png => ImageOutputFormat::Png,
            ImageFormat::WebP => {
                return Err(Error::ImageProcessing(
                    "WebP not yet supported".to_string(),
                ))
            }
        };

        processed
            .write_to(&mut cursor, format)
            .map_err(|e| Error::ImageProcessing(format!("Failed to encode: {}", e)))?;

        Ok(output)
    }

    fn name(&self) -> &str {
        "image"
    }
}

impl ImageProcessor {
    fn resize(&self, img: DynamicImage, width: u32, height: u32, mode: ResizeMode) -> Result<DynamicImage> {
        let (orig_w, orig_h) = img.dimensions();

        match mode {
            ResizeMode::Fit => {
                // Fit within bounds, preserve aspect ratio
                let ratio = (width as f32 / orig_w as f32).min(height as f32 / orig_h as f32);
                if ratio < 1.0 {
                    let new_w = (orig_w as f32 * ratio).round() as u32;
                    let new_h = (orig_h as f32 * ratio).round() as u32;
                        Ok(img.resize(new_w, new_h, Lanchzos3))
                } else {
                    Ok(img)
                }
            }
            ResizeMode::Fill => {
                // Resize to cover, then crop
                let ratio = (width as f32 / orig_w as f32).max(height as f32 / orig_h as f32);
                let new_w = (orig_w as f32 * ratio).round() as u32;
                let new_h = (orig_h as f32 * ratio).round() as u32;
                let resized = img.resize(new_w, new_h, Lanchzos3);
                Ok(resized.crop_imm(
                    (new_w - width) / 2,
                    (new_h - height) / 2,
                    width,
                    height,
                ))
            }
            ResizeMode::Exact => {
                // Exact dimensions, may stretch
                Ok(img.resize_exact(width, height, FilterType::Lanczos3))
            }
            ResizeMode::ShrinkOnly => {
                // Only resize if larger than bounds
                if orig_w > width || orig_h > height {
                    let ratio = (width as f32 / orig_w as f32).min(height as f32 / orig_h as f32);
                    let new_w = (orig_w as f32 * ratio).round() as u32;
                    let new_h = (orig_h as f32 * ratio).round() as u32;
                    Ok(img.resize(new_w, new_h, Lanchzos3))
                } else {
                    Ok(img)
                }
            }
        }
    }

    fn resize_width(&self, img: DynamicImage, width: u32) -> Result<DynamicImage> {
        Ok(img.resize(width, img.height(), Lanchzos3))
    }

    fn resize_height(&self, img: DynamicImage, height: u32) -> Result<DynamicImage> {
        Ok(img.resize(img.width(), height, Lanchzos3))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_geometry_fit() {
        let geo = ImageProcessor::parse_geometry("100x200").unwrap();
        assert_eq!(geo.width, 100);
        assert_eq!(geo.height, 200);
        assert_eq!(geo.mode, ResizeMode::Fit);
    }

    #[test]
    fn test_parse_geometry_exact() {
        let geo = ImageProcessor::parse_geometry("100x100#").unwrap();
        assert_eq!(geo.width, 100);
        assert_eq!(geo.height, 100);
        assert_eq!(geo.mode, ResizeMode::Exact);
    }

    #[test]
    fn test_parse_geometry_shrink_only() {
        let geo = ImageProcessor::parse_geometry("300x300>").unwrap();
        assert_eq!(geo.width, 300);
        assert_eq!(geo.height, 300);
        assert_eq!(geo.mode, ResizeMode::ShrinkOnly);
    }

    #[test]
    fn test_parse_geometry_fill() {
        let geo = ImageProcessor::parse_geometry("200x200^").unwrap();
        assert_eq!(geo.width, 200);
        assert_eq!(geo.height, 200);
        assert_eq!(geo.mode, ResizeMode::Fill);
    }

    #[test]
    fn test_parse_geometry_invalid() {
        assert!(ImageProcessor::parse_geometry("invalid").is_err());
        assert!(ImageProcessor::parse_geometry("abcxdef").is_err());
    }
}
