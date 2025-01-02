const WebSocket = require('ws');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const wss = new WebSocket.Server({ port: 8080 });

// Store chat histories for different connections
const chatHistories = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Initialize chat history for this connection
  const chatId = Date.now().toString();
  chatHistories.set(chatId, []);
  ws.chatId = chatId;

  ws.on('message', async (message) => {
    try {
      const { text, context } = JSON.parse(message);
      const chatHistory = chatHistories.get(ws.chatId);
      
      // Add user message to history
      chatHistory.push({ role: "user", content: text });

      // Prepare messages for OpenAI
      const messages = [
        { role: "system", content: "You are a helpful AI assistant. Use the provided webpage context to help answer questions." },
        { role: "system", content: `Current webpage context: ${context}` },
        ...chatHistory
      ];

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        messages: messages,
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 2048,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
      
      // Add assistant response to history
      chatHistory.push({ role: "assistant", content: assistantMessage });
      
      // Send response back to client
      ws.send(JSON.stringify({
        type: 'message',
        content: assistantMessage
      }));

    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        content: 'Error processing your message'
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    chatHistories.delete(ws.chatId);
  });
});

console.log("WebSocket server running on ws://localhost:8080");
