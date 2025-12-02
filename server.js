const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

// ---------------- OPENAI KEY ---------------- //
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
console.log("⭐ OPENAI key loaded (first 10 chars):", OPENAI_API_KEY.slice(0, 10));

// ---------------- FIREBASE ---------------- //
const admin = require("firebase-admin");

let db = null; // we'll only set this if Firebase init works

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || "./firebase-service-account.json";
  console.log("🔥 Trying to load Firebase service account from:", serviceAccountPath);

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("🔥 Firebase initialized!");
} catch (err) {
  console.error("❌ Failed to initialize Firebase. Firestore logging will be disabled.");
  console.error("   Reason:", err.message);
}

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

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Initialize memory for this session
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

  // Add user message to history
  conversationMemory[sessionId].push({ role: "user", content: message });

  // Keep history small
  if (conversationMemory[sessionId].length > MAX_HISTORY + 1) {
    conversationMemory[sessionId].splice(1, 1); // keep system message at index 0
  }

  try {
    // ---------------- OPENAI CALL ---------------- //
    console.log("🔑 Using OpenAI key (first 10 chars):", OPENAI_API_KEY.slice(0, 10));

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-5.1",
        messages: conversationMemory[sessionId],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices?.[0]?.message?.content || "";
    conversationMemory[sessionId].push({ role: "assistant", content: reply });

    // ✅ Send reply to the frontend *even if Firestore fails later*
    res.json({ reply });

    // ---------------- FIRESTORE LOG (NON-BLOCKING) ---------------- //
    if (db) {
      db.collection("messages")
        .add({
          sessionId,
          userMessage: message,
          assistantReply: reply,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .then(() => {
          console.log("📝 Conversation saved to Firestore");
        })
        .catch((err) => {
          console.error("❌ Firestore save failed:", err.message);
        });
    } else {
      console.warn("⚠️ Firestore disabled: message not saved.");
    }
  } catch (error) {
    console.error("❌ OPENAI ERROR:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong calling OpenAI." });
  }
});

// ---------------- START SERVER ---------------- //
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
