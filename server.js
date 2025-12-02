const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

// DEBUG — SEE IF RENDER IS LOADING YOUR OPENAI KEY
console.log("⭐ OPENAI key loaded (first 10 chars):", process.env.OPENAI_API_KEY?.slice(0, 10));

// ---------------- FIREBASE ---------------- //
const admin = require("firebase-admin");

// Load Firebase from Render Secret File
let serviceAccount = null;

try {
  serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log("🔥 Firebase service account loaded from:", process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error("❌ Failed to load FIREBASE_SERVICE_ACCOUNT:", err.message);
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("🔥 Firebase initialized!");
}

const db = admin.firestore();

// ---------------- EXPRESS ---------------- //
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------- MEMORY ---------------- //
const conversationMemory = {};
const MAX_HISTORY = 10;

// ---------------- KNOWLEDGE BASE ---------------- //
const knowledgeBase = fs.readFileSync("./overdope_chatbot_knowledge_base.txt", "utf-8");

// ---------------- CHAT ENDPOINT ---------------- //
app.post("/chat", async (req, res) => {
  const { message, sessionId = "default" } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });

  // Initialize memory for session
  if (!conversationMemory[sessionId]) {
    conversationMemory[sessionId] = [
      {
        role: "system",
        content: `
You are a helpful assistant for Overdope Production Hub.
Answer clearly and ONLY using the information provided.
If someone asks about podcast studio in cyclorama, add €50.
If question is off-topic, respond with:
"I'm here to help with content creation, studio rentals, and creative projects. What are you looking to create?"

${knowledgeBase}
        `.trim(),
      },
    ];
  }

  // Save message
  conversationMemory[sessionId].push({ role: "user", content: message });

  if (conversationMemory[sessionId].length > MAX_HISTORY + 1) {
    conversationMemory[sessionId].splice(1, 1);
  }

  try {
    // ---------------- OPENAI API CALL ---------------- //
    console.log("🔑 Using OpenAI key (first 10 chars):", process.env.OPENAI_API_KEY?.slice(0, 10));

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-5.1",
        messages: conversationMemory[sessionId],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || "";
    conversationMemory[sessionId].push({ role: "assistant", content: reply });

    // Save in Firebase
    await db.collection("messages").add({
      sessionId,
      userMessage: message,
      assistantReply: reply,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ reply });

  } catch (error) {
    console.error("❌ OPENAI ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong calling OpenAI." });
  }
});

// ---------------- START SERVER ---------------- //
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
