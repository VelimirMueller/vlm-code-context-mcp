//! Proc macros for paperclip-rs declarative attachment definitions

use darling::{FromDeriveInput, FromField};
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Attribute};

/// Attachment options from field attributes
#[derive(Debug, Default, FromField)]
#[darling(attributes(attachment))]
struct AttachmentFieldOpts {
    ident: Option<syn::Ident>,
    ty: Option<syn::Type>,
    style: Option<String>,
    geometry: Option<String>,
    max_size: Option<String>,
    allowed_types: Option<Vec<String>>,
}

/// Struct-level options
#[derive(Debug, Default, FromDeriveInput)]
#[darling(attributes(attachment))]
struct AttachmentOpts {
    ident: Option<syn::Ident>,
    data: darling::ast::Data<darling::util::Ignored>,
}

/// Derive macro for attachment structs
///
/// ```rust
/// use paperclip_macros::Attachment;
/// use paperclip_rs::{Attachment, FilesystemStorage};
///
/// #[derive(Attachment)]
/// pub struct UserProfile {
///     #[attachment(style = "thumb", geometry = "100x100#")]
///     avatar: Attachment<FilesystemStorage>,
/// }
/// ```
#[proc_macro_derive(Attachment, attributes(attachment))]
pub fn derive_attachment(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    // Parse fields for attachment attributes
    let attachment_fields: Vec<_> = input
        .data
        .take_data()
        .expect("Only named structs supported")
        .into_iter()
        .filter_map(|field| {
            let opts = AttachmentFieldOpts::from_field(&field).ok()?;
            Some((field, opts))
        })
        .collect();

    // Generate impl
    let expanded = quote! {
        impl #name {
            /// Initialize all attachments with the given storage base path
            pub fn with_storage<P: AsRef<std::path::Path>>(
                base_path: P,
                base_url: impl Into<String>,
            ) -> Self {
                Self::default()
            }

            /// Upload all attachment fields
            pub async fn upload_attachments(&mut self) -> Result<(), paperclip_rs::Error> {
                // Generated upload logic would go here
                Ok(())
            }

            /// Delete all attachment fields
            pub async fn delete_attachments(&mut self) -> Result<(), paperclip_rs::Error> {
                // Generated delete logic would go here
                Ok(())
            }
        }

        impl Default for #name {
            fn default() -> Self {
                Self {
                    // Field initialization would go here
                }
            }
        }
    };

    TokenStream::from(expanded)
}

/// Helper macro to define styles
#[proc_macro]
pub fn styles(input: TokenStream) -> TokenStream {
    let input_str = input.to_string();
    let style_defs: Vec<&str> = input_str.split(',').map(|s| s.trim()).collect();

    let mut style_items = Vec::new();

    for def in style_defs {
        let parts: Vec<&str> = def.split(':').collect();
        if parts.len() >= 2 {
            let name = parts[0].trim().trim_matches('"');
            let geometry = parts[1].trim().trim_matches('"');

            style_items.push(quote! {
                paperclip_rs::Style::new(
                    #name,
                    paperclip_rs::ImageProcessor::parse_geometry(#geometry)
                        .expect("Invalid geometry string")
                )
            });
        }
    }

    let expanded = quote! {
        vec![#(#style_items),*]
    };

    TokenStream::from(expanded)
}
