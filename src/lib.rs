use wasm_bindgen::prelude::*;
use web_sys::console;
use serde::{Serialize, Deserialize};
use ammonia::clean;

#[derive(Serialize, Deserialize)]
pub struct ProcessedContext {
    summary: String,
    key_points: Vec<String>,
    relevant_text: String,
    screenshot: Option<String>,
}

#[wasm_bindgen]
pub struct ChatContext {
    original_text: String,
    processed_data: ProcessedContext,
}

#[wasm_bindgen]
impl ChatContext {
    #[wasm_bindgen(constructor)]
    pub fn new(text: &str, screenshot: Option<String>) -> ChatContext {
        console::log_1(&"Processing chat context...".into());
        
        let cleaned_screenshot = screenshot.map(|s| {
            if s.starts_with("data:image/") {
                s.split(",").nth(1).unwrap_or(&s).to_string()
            } else {
                s
            }
        });
        
        let summary = format!("Summary: {}", &text[..text.len().min(200)]);
        let relevant_text = text.to_string();
        let key_points = vec![
            "Extracted from page content".to_string(),
            "Processed by WASM".to_string(),
        ];

        ChatContext {
            original_text: text.to_string(),
            processed_data: ProcessedContext {
                summary,
                key_points,
                relevant_text,
                screenshot: cleaned_screenshot,
            }
        }
    }

    #[wasm_bindgen]
    pub fn get_processed_context(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.processed_data).unwrap()
    }

    #[wasm_bindgen]
    pub fn get_relevant_text(&self) -> String {
        self.processed_data.relevant_text.clone()
    }

    #[wasm_bindgen]
    pub fn sanitize_message(&self, html: &str) -> String {
        clean(html)
    }
}

#[wasm_bindgen(start)]
pub fn main() -> Result<(), JsValue> {
    console::log_1(&"Chat WASM module initialized!".into());
    Ok(())
}

#[wasm_bindgen]
pub fn sanitize_html(html: &str) -> String {
    clean(html)
}
