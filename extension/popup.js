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

// Add this function to get user info
async function getUserInfo() {
  try {
    // Get basic info
    const basicInfo = await chrome.identity.getProfileUserInfo();
    
    // Get extended info
    const extendedInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    
    return {
      email: basicInfo.email,
      id: basicInfo.id,
      name: extendedInfo.name,
      givenName: extendedInfo.givenName,
      familyName: extendedInfo.familyName,
      username: basicInfo.email.split('@')[0] // fallback/alternative
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', async () => {
  const messagesContainer = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-message');

  // Get user info
  const userInfo = await getUserInfo();
  
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

  // Update the welcome message to include user info
  const welcomeMessage = document.createElement('div');
  welcomeMessage.classList.add('message', 'assistant-message', 'initial-message');
  welcomeMessage.innerHTML = `
    <div class="user-profile">
      <p>👋 Hello${userInfo?.givenName ? ` ${userInfo.givenName}` : userInfo?.name ? ` ${userInfo.name}` : ''}!</p>
    </div>
    <p>I'm your AI assistant.</p>
    <p>I can help you understand web pages better by analyzing their content and context. Just ask me anything!</p>
  `;
  messagesContainer.appendChild(welcomeMessage);

  // Add detailed user info message
  if (userInfo) {
    const userInfoMessage = document.createElement('div');
    userInfoMessage.classList.add('message', 'assistant-message', 'user-info-message');
    userInfoMessage.innerHTML = `
      <div class="user-info-details">
        <h3>Your Profile Information:</h3>
        <ul>
          ${userInfo.givenName ? `<li><strong>First Name:</strong> <span class="info-value">${userInfo.givenName}</span></li>` : ''}
          ${userInfo.familyName ? `<li><strong>Last Name:</strong> <span class="info-value">${userInfo.familyName}</span></li>` : ''}
          ${userInfo.name ? `<li><strong>Full Name:</strong> <span class="info-value">${userInfo.name}</span></li>` : ''}
          ${userInfo.email ? `<li><strong>Email:</strong> <span class="info-value">${userInfo.email}</span></li>` : ''}
          ${userInfo.username ? `<li><strong>Username:</strong> <span class="info-value">${userInfo.username}</span></li>` : ''}
          ${userInfo.id ? `<li><strong>User ID:</strong> <span class="info-value user-id">${userInfo.id}</span></li>` : ''}
        </ul>
      </div>
    `;
    messagesContainer.appendChild(userInfoMessage);
  }
});
