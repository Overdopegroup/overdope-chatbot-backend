const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Memory for each session
const conversationMemory = {};
const MAX_HISTORY = 10;

// Read the knowledge base from the file ONCE at startup
const knowledgeBase = fs.readFileSync('./overdope_chatbot_knowledge_base.txt', 'utf-8');

app.post('/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Create memory for session if it doesn't exist
  if (!conversationMemory[sessionId]) {
    conversationMemory[sessionId] = [
      {
        role: 'system',
        content: `
You are a helpful assistant for Overdope Production Hub. Answer clearly and based only on the information provided. If someone asks about podcast studio in cyclorama, add €50 to the cost. If a question is off-topic, respond with: "I’m here to help with content creation, studio rentals, and creative projects. What are you looking to create?"

${knowledgeBase}
        `.trim()
      }
    ];
  }

  // Save the user's message
  conversationMemory[sessionId].push({ role: 'user', content: message });

  // Keep only latest messages (plus system)
  if (conversationMemory[sessionId].length > MAX_HISTORY + 1) {
    conversationMemory[sessionId] = [
      conversationMemory[sessionId][0], // Keep system prompt
      ...conversationMemory[sessionId].slice(-MAX_HISTORY)
    ];
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: conversationMemory[sessionId]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = response.data.choices?.[0]?.message?.content;
    conversationMemory[sessionId].push({ role: 'assistant', content: reply });
    res.json({ reply });
  } catch (error) {
    console.error('❌ OpenAI error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
