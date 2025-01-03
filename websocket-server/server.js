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
      console.log('Received message:', { 
        text, 
        hasScreenshot: !!context.screenshot,
        screenshotLength: context.screenshot ? context.screenshot.length : 0
      });
      
      const chatHistory = chatHistories.get(ws.chatId);
      
      // Add user message to history
      chatHistory.push({ role: "user", content: text });

      // Prepare context message including screenshot if available
      let contextMessage = `Current webpage context: ${context.relevant_text}`;
      if (context.screenshot) {
        console.log('Screenshot received, length:', context.screenshot.length);
        contextMessage += `\n[Screenshot of the webpage is available in base64 format]`;
      }

      // Prepare messages for OpenAI
      const messages = [
        { role: "system", content: "You are a helpful AI assistant. You MUST format your ENTIRE response in pure HTML to be displayed in a web browser. Your response must start with HTML tags and end with HTML tags. Use appropriate HTML tags for formatting like <p>, <ul>, <li>, <code>, <br>, etc. Do not include any plain text outside of HTML tags. IMPORTANT: Do not wrap your response in markdown code blocks or ```html ``` tags - return pure HTML only." },
        { role: "system", content: `<p>${contextMessage}</p>` }
      ];

      // If there's a screenshot, add it directly to the main conversation
      if (context.screenshot) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: text },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${context.screenshot}`,
                detail: "low"
              }
            }
          ],
        });
      } else {
        messages.push({ role: "user", content: text });
      }

      // Add previous chat history
      messages.push(...chatHistory.slice(0, -1));

      // Call OpenAI API with the enhanced context
      const completion = await openai.chat.completions.create({
        messages: messages,
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 2048,
      });

      let assistantMessage = completion.choices[0]?.message?.content || "<p>Sorry, I couldn't generate a response.</p>";

      // Remove any markdown code block wrapping if present
      assistantMessage = assistantMessage.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');

      // Ensure the response is properly wrapped in HTML
      if (!assistantMessage.trim().startsWith('<')) {
        assistantMessage = `<p>${assistantMessage}</p>`;
      }

      // Validate that the response contains HTML
      if (!/<[^>]*>/g.test(assistantMessage)) {
        assistantMessage = `<p>${assistantMessage}</p>`;
      }

      console.log('Assistant message:', assistantMessage);
      
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
