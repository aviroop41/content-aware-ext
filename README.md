# Content-Aware Assistant Extension

A browser extension that provides AI assistance while browsing the web.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Chrome/Chromium-based browser

## Setup Instructions

1. Clone the repository:

git clone <repository-url>
cd <repository-name>

2. Install dependencies:

npm install

3. Configure the environment:
   - Navigate to the `websocket-server` directory
   - Copy the `.env.example` file to `.env`
   - Add your API key to the `.env` file:

``` bash
cp websocket-server/.env.example websocket-server/.env
```

Then edit the `.env` file and add your API key:

``` bash
API_KEY=your_api_key_here
```

4. Build the project:

``` bash
chmod +x build.sh
./build.sh
```

5. Start the WebSocket server:

``` bash
cd websocket-server
npm start
```

6. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `extension` directory from this project

## Usage

Once the extension is loaded and the server is running:
1. Open any code file in your browser
2. Click the extension icon in your browser toolbar
3. Use the assistant to get help with your code

## Development

- The extension's main functionality is in `extension/content.js` and `extension/popup.js`
- The WebSocket server handles communication between the extension and the AI service
- The Rust library (`src/lib.rs`) provides additional functionality

## Troubleshooting

If you encounter any issues:
- Make sure the WebSocket server is running
- Verify your API key is correctly set in the `.env` file
- Check the browser console for any error messages
- Ensure all dependencies are properly installed

## License

MIT Open Source License# content-aware-ext