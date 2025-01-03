// Import WASM functions
import init, { ChatContext } from './wasm/rust_wasm.js';

// Create WebSocket connection
const socket = new WebSocket('ws://localhost:8080');

// Initialize WASM
let wasmModule = null;

async function initializeWasm() {
  try {
    wasmModule = await init();
    console.log("WASM initialized successfully");
    return true;
  } catch (err) {
    console.error("Failed to initialize WASM:", err);
    return false;
  }
}

// Initialize WASM immediately
initializeWasm();

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', () => {
  const messagesContainer = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-message');

  // Function to add message to chat UI
  function addMessageToChat(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isUser ? 'user-message' : 'assistant-message');
    
    // Simply use innerHTML for assistant messages and textContent for user messages
    if (isUser) {
      messageDiv.textContent = content;
    } else {
      messageDiv.innerHTML = content;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function captureScreenshot() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      return screenshot.split(',')[1]; // Remove the data:image/png;base64, prefix
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      return null;
    }
  }

  // Function to send message
  async function sendMessage() {
    if (!wasmModule) {
      const initialized = await initializeWasm();
      if (!initialized) {
        addMessageToChat("Error: WASM initialization failed", false);
        return;
      }
    }

    const messageText = userInput.value.trim();
    if (!messageText) return;

    // Clear input
    userInput.value = '';

    // Add user message to chat
    addMessageToChat(messageText, true);

    try {
      // Get the active tab's content
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Capture screenshot
      const screenshot = await captureScreenshot();
      
      // Execute content script to get page content
      const [{result}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.body.innerText
      });

      // Process the context through WASM
      const chatContext = new ChatContext(result, screenshot);
      const processedContext = chatContext.get_processed_context();

      // Send message and context to server
      socket.send(JSON.stringify({
        text: messageText,
        context: processedContext
      }));

    } catch (error) {
      console.error("Error:", error);
      addMessageToChat("Error processing your message", false);
    }
  }

  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Handle messages from the server
  socket.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      if (response.type === 'message') {
        // Remove any wrapping <p> tags around code blocks if they exist
        const cleanContent = response.content.replace(/<p>```(.*?)```<\/p>/g, '```$1```');
        addMessageToChat(cleanContent, false);
      } else if (response.type === 'error') {
        addMessageToChat(`Error: ${response.content}`, false);
      }
    } catch (error) {
      console.error('Error parsing server response:', error);
      addMessageToChat('Error processing server response', false);
    }
  };

  // Handle connection errors
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    addMessageToChat("Error: Could not connect to server", false);
  };

  // Add welcome message
  const welcomeMessage = document.createElement('div');
  welcomeMessage.classList.add('message', 'assistant-message', 'initial-message');
  welcomeMessage.innerHTML = `
    <p>👋 Hello! I'm your AI assistant.</p>
    <p>I can help you understand web pages better by analyzing their content and context. Just ask me anything!</p>
  `;
  messagesContainer.appendChild(welcomeMessage);
});
