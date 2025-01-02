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
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
      
      // Execute content script to get page content
      const [{result}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.body.innerText
      });

      // Process the context through WASM
      const chatContext = new ChatContext(result);
      const processedContext = chatContext.get_relevant_text();

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
        addMessageToChat(response.content, false);
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
  addMessageToChat("Hello! I'm your AI assistant. How can I help you today?", false);
});
