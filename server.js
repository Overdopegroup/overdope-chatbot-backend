const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Memory for each session
const conversationMemory = {};
const MAX_HISTORY = 10;

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
        content: `You are a helpful assistant for Overdope Production Hub. Answer clearly and based only on the information provided. If someone asks about podcast studio in cyclorama, add €50 to the cost. If a question is off-topic, respond with: 'I’m here to help with content creation, studio rentals, and creative projects. What are you looking to create?'

Services:

🎬 Video Production
- Music videos: €150–€500/hour
- Simple Music Video Package: €250 (in-house cyclorama)
- Reels: €20–€400
- Event Reel + Photoshoot: from €600
- Full preproduction available

🎙️ Podcast Studio
- 2-Camera (ATEM Mini Pro): €90/hour
- Add 3rd camera: +€30
- 6K High-Res: €120/hour (+€50 for 3rd)
- Edited ATEM: €150
- Edited High-Res: €200
- Add €50 if recorded in cyclorama
- Audio sync is separate

🎛️ Studio B – Self-Service
- 1 Hour: €20
- 4 Hours: €70
- 6 Hours: €95
- 8 Hours: €120
- 15 hours/month: €210
- Masterclass: €50/hour
- Photoshoot: €50 (30 min, 10 photos)
- Reel Session: €100 (30 min + editing)
- Multitrack: €35/hour

📸 Content Creation
- Product Photography: €2–€1500/photo
- Reels: €20–€400

💍 Weddings & Photoshoots
- Cyclorama studio for portraits, weddings
- Wedding videography/photo

💳 Booking & Payment
- Payments: card, transfer, cash
- Booking system in progress
- Add €50 for podcast outside podcast room

FAQs:
- Cyclorama includes lights/softboxes, kitchen, lounge. No gear unless agreed.
- Bring your own gear or request our team.
- ATEM switching is baked in — no separate camera feeds.
- Yes, we help with preproduction.

Tone: Friendly, helpful, professional or casual based on user.`
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
