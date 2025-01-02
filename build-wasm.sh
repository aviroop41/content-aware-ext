#!/bin/bash

# Exit on any error
set -e

echo "🦀 Building WASM module..."

# Build the WASM package
wasm-pack build --target web

# Create wasm directory if it doesn't exist
mkdir -p extension/wasm

# Copy the necessary files
echo "📁 Copying files to extension/wasm..."
cp pkg/rust_wasm_bg.wasm extension/wasm/
cp pkg/rust_wasm.js extension/wasm/
cp pkg/rust_wasm.d.ts extension/wasm/

echo "✅ Build and copy completed successfully!" 